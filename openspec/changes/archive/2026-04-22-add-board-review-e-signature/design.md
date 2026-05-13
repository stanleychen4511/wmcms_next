## Context

前一個 change（`add-board-group-assignment`）確立：董事長派組、組員共筆、「任一組員代表按通過 / 不通過」的流程。但這僅僅滿足「基金會內部有人負責」，缺了「全員書面同意」的可稽查形式。

《電子簽章法》第 9 條：文書當事人**同意**採用電子簽章者，該簽章具有與親筆簽章相同的效力。要構成「同意採用」並站得住腳，系統須：
1. 能識別簽章主體身份（不只是 session cookie，最好是簽當下再驗一次）。
2. 能綁定簽章與當時的文件內容（事後修改文件仍能判別簽章是否對應最新版）。
3. 留下完整稽核鏈（誰、何時、什麼 IP、UA）。

本 change 的目標是落實以上三項，不做 PKI（不必登記 CA、不用讀卡機、不碰外部付費服務）。

## Goals / Non-Goals

**Goals:**

- 每位派組成員可於案件詳情頁手寫簽章 + 輸入登入密碼二次驗證。
- 簽章紀錄含 content_hash，可判定事後內容是否變動。
- 「通過」「不通過結案」在 stage=board_review 時強制「全員當前組員皆已簽 + hash 有效」才能推進。
- 內容變動（儲存草稿的實際欄位變動）與重派組別時，所有既有簽章失效。
- 所有簽章與失效事件有 audit_logs。

**Non-Goals:**

- 不整合外部 CA / 第三方簽章平台（付費）。
- 不做 OTP、TOTP 等額外驗證因子（首版只做密碼）。
- 不支援代簽、組長統籤、匿名簽。
- 不做圖像真偽比對（手寫圖像只是視覺紀錄，法律效力來自「密碼驗證後的本人意思表示」）。
- 不保留同一人多版本簽章歷史（每人一筆 current，作廢事件寫 audit）。

## Decisions

### Content hash 計算規則：固定順序、lexicographic stable

**選擇**：以 Node.js `crypto.createHash('sha256')` 計算下列字串的 SHA-256 hex：

```
v1|{applicationId}|{approvedAmount ?? 'null'}|{comments ?? 'null'}|{isApproved ?? 'null'}|{assignedGroupId}
```

- `v1` 前綴保留未來升級 hash 版本時的 forward-compat。
- 欄位用 `|` 分隔；`null` 顯式標記避免空字串歧義。
- 派組 id 也進 hash：重派 = 內容改變（即使其他欄位不動）。

**Alternatives considered**：

1. *JSON.stringify 整個 row*：JS 的 key order 對 v8 是插入順序，但對跨 JS/Go/Python/SQL 讀回等情境不穩定，且 `null` vs `""` 表現可能混淆。
2. *只 hash 三個業務欄位不含 group_id*：重派時若簽章保留會出現「新組還沒簽就過關」，與需求 Q6 衝突。故 group_id 必入。

### 簽章儲存格式：`signature_data_url` = base64 PNG

**選擇**：`react-signature-canvas` 的 `toDataURL('image/png')` 結果直接存 TEXT 欄位（前綴 `data:image/png;base64,...`）。

**Alternatives considered**：

1. *存 BYTEA binary*：需前後端 base64 轉換成本；但 DB 占用較小。對基金會案件量（預估 <1000 案/年），儲存成本可忽略，TEXT 便於 debug 與直接嵌入 `<img src>`。
2. *存於 Vercel Blob*：引入額外 FS 依賴、失去事務一致性（寫 Blob 成功但 DB 寫 fail 就孤兒檔）。不划算。

### 密碼驗證：復用既有 `hashPassword` + 二次驗證

**選擇**：`submitBoardSignature` 事務內 SELECT 該 user 的 `search_salt` 與 `password` 欄位，以相同演算法重算 `hashPassword(providedPassword, saltBuffer)` 比對。比對失敗 → 回錯、不寫任何資料。

**Alternatives considered**：

1. *用 session 推論（不重驗）*：不符合「簽章當下確認本人」的語意，若 session 被盜用可偽簽。
2. *Email OTP*：依賴 SMTP（雖已設定）增加延遲與失敗面；首版先做密碼。

### 守門點：server-side 在 `advanceWorkflowStage` / `closeCaseRejected`，前端只做 UX

**選擇**：
- **前端**：按鈕 disable + tooltip 僅為 UX；可被 JS hack 繞過。
- **後端**：進入 `UPDATE applications SET status = ...` 之前再加一個 SELECT 驗證：
  ```sql
  SELECT
    (SELECT COUNT(*) FROM board_group_members WHERE group_id = $assignedGroupId) AS member_count,
    (SELECT COUNT(*) FROM board_review_signatures s
     JOIN board_group_members m
       ON m.user_id = s.signer_user_id AND m.group_id = $assignedGroupId
     WHERE s.application_id = $applicationId AND s.content_hash = $currentHash) AS valid_sig_count
  ```
  若 `member_count = valid_sig_count > 0` 才允許，否則 ROLLBACK。

**理由**：權威在 server。前端繞過也無法推進，資料絕不進入不合規狀態。

### 簽章失效的觸發點

1. `saveBoardReviewDraft` 的 diff 計算出 `changedFields.length > 0` 時 → DELETE all rows in `board_review_signatures` WHERE application_id=X → audit `board_review.signatures_invalidated` `reason='content_changed'`。
2. `assignCaseToBoardGroup` 的重派路徑（reassigned=true）→ 同上 → audit `reason='reassigned'`。
3. **不需要**明確的「每次驗證 hash」排程；後端守門動態重算即可。

### 權限：chairman / admin 可簽嗎？

**決策**：**不可**。理由：
- 簽章目的是「該組全員同意」，非成員不應以簽章表達同意。
- chairman / admin 仍可編輯內容（共筆權限），但不算入「全員」。
- 若 chairman 同時也是某組員（身兼二職），依 `board_group_members` 是否有他的 row 判定，不因他另有 chairman 角色而自動簽。

### UI 佈局

- `BoardSignaturePanel` 放在 `BoardVoteCard` 之下、ApplicationForm 的董事審核區塊之上。
- 每位組員一列：頭像 + 姓名 + 狀態 badge（✅ 已簽 / ⏳ 未簽 / ⚠️ 失效）。
- 狀態為「未簽」或「失效」且該列是當前 user：顯示 inline 小按鈕「簽章 / 重新簽章」→ 開 modal。
- 狀態為「已簽」可點開縮圖看大圖 + 簽章時間。

## Risks / Trade-offs

- **登入密碼等於簽章金鑰**：若使用者密碼弱 / 被盜 → 他人可偽造其簽章。Mitigation：
  - 系統密碼政策由後台維護（已存在）。
  - 所有簽章均有 IP + UA 稽核記錄，事後可追蹤異常。
  - 若發生事故，可依 audit_logs 搭配實體調查釐清責任。
- **Browser canvas 筆觸品質**：滑鼠簽名會不如手寫潦草；可接受（圖像品質不是法律效力的來源，是「同意 + 身份」）。建議 UI 提示「請盡量用觸控筆或手指於觸控螢幕操作以得到較佳筆跡」。
- **PNG Base64 占用**：經驗值 300×150 畫布的 base64 約 5–15 KB。對 10 人組、100 案 = 100 × 10 = 1000 筆 × 10KB = 10MB，可接受。
- **hash v1 升級路徑**：若未來要加欄位（例如家訪報告編號）進 hash，須新舊簽章標示不同版本。Mitigation：hash prefix `v1|` 已保留，未來出 `v2` 時既有 `v1` 簽章自動失效 → 提示重簽 → 平滑過渡。
- **內容變動立即廢簽的 UX 痛感**：組員 A 簽完、組員 B 打開想簽前手一滑動了一個欄位→ A 的簽章作廢要重來。Mitigation：UI 在編輯欄位時若已有任一簽章，先顯示 confirm「修改會使 N 個已簽名失效」→ 使用者選擇後再存。
- **重派組後金額/意見保留但簽章作廢**：與前一 change 的「重派不清空審核資料」一致；簽章作廢是刻意的，因為簽章效力綁在「某組某內容」上，換組即失效。
