## Context

既有 `application_workflow` 是「案件級」的單列記錄（stage + 單一 reviewer_id + is_approved 三欄），設計上假設「每階段一位審查者」。董事審查階段需升級為「一組人共同審查」，無法沿用單列結構。

系統已有 `chairman` 角色（剛加入），目前未被程式碼用到。本 change 第一次賦予 chairman 實質功能（CRUD 組別、派案、調整系統開關）。

`board_member` 角色已存在於 roles seed，但目前無實際用途；本 change 將賦予其「投票」的業務語意。

## Goals / Non-Goals

**Goals:**

- 董事組別的 CRUD 與優先序維護（chairman / admin）。
- 案件派案記錄（哪個組別、手動或自動、派案人）。
- 任一組員可在「董事審核」區塊共筆（核准金額 / 審核意見 / 審核結果），以「儲存」按鈕提交中間狀態。
- Dirty state 保護：未儲存的編輯會 disable「通過」「不通過結案」按鈕，避免誤推進導致編輯消失。
- 自動派案演算法：當前案件數最少、平手時 priority 最小。
- 權限：僅本案派組成員 OR chairman OR admin 可編輯、儲存、按通過/不通過。

**Non-Goals:**

- 不支援一人跨組（`board_group_members.user_id` UNIQUE）。
- 不支援個別投票 / 組長決策機制；以「組員共筆」取代。
- 不保留每次儲存的歷史版本於資料表（audit_logs 已記錄 before/after）。
- 不支援組員逾時未審的自動提醒（本次不做通知排程延伸）。
- 不改動其他階段（admin_review / home_visit / reimbursement）的推進邏輯。

## Decisions

### schema：3 張新表，不改既有表結構

**選擇**：
- `board_groups`（組別主檔）
- `board_group_members`（組別 ↔ user 多對多，但 UNIQUE(user_id) 限制一人一組）
- `board_review_assignments`（每案一列，PK application_id，記錄當前派到哪組）
- **不建立** `board_review_votes`（原設計中用來記錄每位組員投票的表；共筆模式下不需要）

**Alternatives considered**：
1. *保留 `board_review_votes` 做為協作痕跡記錄*：組員共筆模式下，審核意見在 `application_workflow.comments` 已被最後一次儲存覆寫；若需追溯每次儲存的變動，`audit_logs` 的 `board_review.draft_save` 已記錄 before/after 足夠。多留一張表只是冗餘。
2. *用 JSONB 存多版本歷史*：過度設計，與「last write wins 共筆」的需求不符。

3 表足夠，審核共筆的中間狀態直接寫入既有 `applications.approved_amount` 與 `application_workflow.comments / is_approved`。

### 重派處理：只換 assignment，不動審核表單的現有資料

重派時（chairman 將案件從 A 組改派到 B 組）：
- `board_review_assignments` UPDATE 為新 group_id，同步寫 audit `board_review.reassign`。
- `applications.approved_amount` 與 `application_workflow.comments / is_approved` **維持不動**（舊組寫過的內容保留給新組參考）。新組可視情況覆寫或完全重寫。

**理由**：
- 共筆模式下，既有審核內容就是該案目前的「共同進度」。換組別不等於「之前白寫」—— 新組可能同意既有判斷，直接在上面繼續即可。
- 若新組希望從白紙開始，可手動清空 input 再儲存；這是 UX 決策，不是系統強制。

### 自動派案演算法

SQL（單一 query）：

```sql
SELECT g.id
FROM board_groups g
LEFT JOIN (
    SELECT a.group_id, COUNT(*) AS n
    FROM board_review_assignments a
    JOIN applications ap ON ap.id = a.application_id
    WHERE ap.status = '1'              -- 僅進行中
      AND ap.id IN (
          SELECT application_id FROM application_workflow WHERE stage = 'board_review'
      )
    GROUP BY a.group_id
) c ON c.group_id = g.id
WHERE g.is_active = TRUE
  AND EXISTS (SELECT 1 FROM board_group_members m WHERE m.group_id = g.id)
ORDER BY COALESCE(c.n, 0) ASC, g.priority ASC
LIMIT 1;
```

- **案件最少優先**（ASC）：`COALESCE` 處理沒有案件的組別視為 0。
- **平手時 priority 小優先**（ASC）：小者優先，與專案其他 sort_order 語意一致。
- **必要條件**：組別要 is_active、且至少有一名成員（空組不派）。

若查不到（沒有 active 有成員的組別）→ `autoAssignCaseToBoardGroup` 回傳 `{ success: false, error: '目前無可用的董事組別' }`，案件狀態不變。

### 儲存（draft）與推進（advance/reject）的分離

**`saveBoardReviewDraft(applicationId, { approvedAmount, comments, isApproved }, operatorUserId)`** 的事務內邏輯：

1. SELECT `applications.status`, `workflow.stage`, `workflow.comments`, `applications.approved_amount` 取得當前值與目前階段。
2. 驗證 stage='board_review' 且 status='1'（否則拒絕）。
3. SELECT `board_review_assignments.group_id` 取該案派組；驗證 operator 為該組成員 OR chairman OR admin。
4. UPDATE `applications.approved_amount = $approvedAmount`。
5. UPDATE `application_workflow.comments = $comments, is_approved = $isApproved`。
6. 寫 audit `board_review.draft_save`，`detail` 只放有變動的欄位 + before / after（與 `application.basics_update` 同模式）。
7. COMMIT。

**「通過」按鈕** 仍由既有 `advanceWorkflowStage(applicationId, 'board_review', 'reimbursement', ...)` 處理；**「不通過結案」按鈕** 仍由既有 `closeCaseRejected(applicationId, comments, operatorUserId)` 處理。這兩個函式不需大改，但呼叫點要加權限判斷（同儲存的三軌：派組成員 OR chairman OR admin）。

**Dirty-state 保護** 完全在前端：
- `ApplicationForm` 內部追蹤 `initialValues`（從 `appDetail` 初次載入）vs `currentValues`。
- dirty = currentValues 任一欄位 !== initialValues。
- dirty=true 時：
  - 儲存按鈕 **啟用**（變 primary 色）
  - 通過 / 不通過結案按鈕 **disabled** 並 tooltip「請先儲存編輯」
- 儲存成功 → 從 server 重載 appDetail → `initialValues` 更新為新值 → dirty=false。

### 權限判定：chairman vs admin vs board_member

| 操作 | chairman | admin | board_member（該組） | board_member（其他組） |
|---|---|---|---|---|
| CRUD board_groups | ✅ | ✅ | ❌ | ❌ |
| 切換 board_auto_assign | ✅ | ✅ | ❌ | ❌ |
| 手動派案 / 重新指派 | ✅ | ✅ | ❌ | ❌ |
| 編輯 / 儲存董事審核區塊 | ✅ | ✅ | ✅ | ❌ |
| 按「通過 / 不通過結案」 | ✅ | ✅ | ✅ | ❌ |
| 看派案資訊與組員清單 | ✅ | ✅ | ✅ | ✅（可看，不可編輯） |

共筆模式下，編輯與最終決策權對齊：任一組員代表組別共識皆可操作；chairman / admin 具兼容權限以便協助或修正。非所屬組別的其他董事只能唯讀檢視。

### 自動派案觸發點

於 `advanceWorkflowStage` 成功推進至 `board_review` 後（同一事務提交之後），讀 `board_auto_assign` 設定：
- `'true'` → 呼叫 `autoAssignCaseToBoardGroup(applicationId, null)`（operator 為 system）
  - 若成功 → 寫 audit `board_review.assign` with mode='auto'
  - 若失敗（無可用組別）→ 不阻斷推進（status 已進 board_review），只 console.warn。由 UI 提示「尚未派組」供 chairman 手動處理。
- `'false'` → 不做事，等 chairman 手動派。

**為何不阻斷推進**：若自動派失敗就回滾 advance 會導致使用者看到「按了下一步沒反應」，體驗差；改為允許「進了 board_review 但無派組」的中間態，由 UI 明確標示。

### UI 放置：批次派案走 CaseListPage 而非單獨頁

與 user 商定的路徑：chairman 在「申請案件管理」頁用 filter 篩 board_review + 未派案，批次勾選後按「批次自動派案」。

**為何不另開新頁**：
- 批次操作的 UX 已在現有頁面成熟（批次選取、批次派案框類似 supervisor 的「批次派承辦人」）
- 減少導航切換
- chairman 可同時看其他狀態的案件做決策

## Risks / Trade-offs

- **自動派案的一致性競態**：兩個案件同時進 board_review 時，都去 query 目前最少的組別，可能都挑到同一組（兩筆案件都派給 A 組，但演算法看的是「執行當下」）。Mitigation：目前無事務鎖；高併發場景實務上不會發生（基金會案件數少）。若未來需要嚴格一致，可用 `SELECT ... FOR UPDATE` 鎖 `board_groups` 表，本 change 不做。
- **Dirty state 判斷誤判**：若浮點數/字串的比對邏輯錯誤（例如空字串 vs null）可能 false positive 鎖死按鈕。Mitigation：比對前先正規化（trim、Number cast），且儲存按鈕一律啟用（使用者可重複儲存相同值清掉 dirty）。
- **誤按「不通過結案」風險**：仍沿用既有 `closeCaseRejected` 有的確認 modal（需填寫結案原因）；加上 dirty-state 鎖，未儲存不能按，進一步降低誤按。
- **共筆覆寫衝突**：兩位組員同時編輯各自 input 後都按「儲存」—— 後按的覆寫前按的。audit_logs 記錄兩次 draft_save 的 before/after 可追溯。Mitigation：首版接受 last write wins；若實際發生爭議，加「最近編輯者 + 時間」顯示即可緩解。本次不做 optimistic lock。
- **空組別或組別全員停用**：組別 is_active=TRUE 但無成員、或所有成員 is_active=FALSE（帳號停用）→ 自動派案不會選該組（SQL 有 EXISTS 子句檢查）；手動派則允許（由使用者負責）。
- **一人一組限制**：若日後需要一位董事同時審多個案件但跨組別分工，目前 schema 不支援。Mitigation：UNIQUE(user_id) 可透過 migration 取消；屬未來擴充。
- **board_auto_assign 關閉期的積壓**：自動派案關閉期，chairman 可能忘記手動派，案件卡在 board_review。Mitigation：CaseListPage filter 顯示「未派案」計數，chairman 登入即可看到。
