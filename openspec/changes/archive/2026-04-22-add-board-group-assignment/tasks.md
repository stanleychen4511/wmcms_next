## 1. 資料庫 Schema 與設定

- [x] 1.1 於 `scripts/init_db.sql` 新增資料表 `board_groups`（id/name UNIQUE/priority/is_active/created_at/updated_at），並補 COMMENT。依 design「schema：3 張新表，不改既有表結構」原則，新表各自獨立，不改 `application_workflow` 既有欄位（實作 spec「Board groups schema and maintenance」之 `board_groups` 欄位）
- [x] 1.2 於 `scripts/init_db.sql` 新增資料表 `board_group_members`（複合 PK (group_id, user_id) + UNIQUE(user_id)，ON DELETE CASCADE 指向 board_groups 與 users），並補 COMMENT（實作 spec「Board groups schema and maintenance」之 members 一人一組限制）
- [x] 1.3 於 `scripts/init_db.sql` 新增資料表 `board_review_assignments`（application_id PK、group_id FK、assigned_at/assigned_by/assign_mode CHECK），並補 COMMENT（實作 spec「Board review assignments schema」）
- [x] 1.4 [DEPRECATED，保留稽核用] 於 `scripts/init_db.sql` 曾新增 `board_review_votes`；共筆模式下不再使用，以 task 7.1 的 DROP 取代
- [x] 1.5 於 `scripts/init_db.sql` 與 `settingsActions.ensureDefaultSettings` 加入 `board_auto_assign` 預設 `'false'`（實作 spec「Batch auto-assignment and settings switch」之 seeding scenario）
- [x] 1.6 透過 MCP 對 `pg_wmcms` 與 `pg_wmcms_demo` 執行對應 CREATE TABLE IF NOT EXISTS 與 system_settings upsert；驗證新表建立、setting 預設值正確

## 2. 型別與稽核

- [x] 2.1 於 `src/app/actions/auditActions.ts` 擴充 `AuditAction` 聯合型別加入字面值（`board_group.create/update/toggle_active/delete`、`board_review.assign/reassign/vote/rejected/advanced`）與 `AuditTargetType` 加入 `board_group/board_assignment/board_vote`（實作 spec「Audit trail extension」之初版；task 8.1 會修正為最終型別）

## 3. Server Actions

- [x] 3.1 新增 `src/app/actions/boardGroupActions.ts`：定義 `BoardGroup` / `BoardGroupMember` 介面與 CRUD 函式 `fetchAllBoardGroups` / `fetchActiveBoardGroups` / `createBoardGroup` / `updateBoardGroup` / `toggleBoardGroupActive` / `deleteBoardGroup`。每個 mutate 函式做權限檢查（chairman 或 admin 才可）、事務包裹、audit log 寫入。`deleteBoardGroup` 於 `board_review_assignments` 有引用時回錯不刪（實作 spec「Board group CRUD server actions」全部 scenarios）
- [x] 3.2 於 `boardGroupActions.ts` 新增 `assignCaseToBoardGroup(applicationId, groupId, operatorUserId, mode)`：事務驗證 (a) 權限 chairman/admin、(b) stage='board_review' AND status='1'、(c) group is_active、(d) UPSERT board_review_assignments；寫 audit `board_review.assign`（首次）或 `board_review.reassign`（覆寫）（實作 spec「Manual case assignment」—— 初版含「清除未投票 row」邏輯，task 7.2 會簡化為「不動審核欄位」）
- [x] 3.3 於 `boardGroupActions.ts` 新增 `autoAssignCaseToBoardGroup(applicationId, operatorUserId)`：以 design「自動派案演算法」之 SQL（LEFT JOIN count + ORDER BY count ASC, priority ASC LIMIT 1）挑選組別；若無可用組別回 `{ success: false, error: '無可用董事組別' }` 不寫 DB；成功則呼叫 `assignCaseToBoardGroup(mode='auto')`（實作 spec「Auto-assignment algorithm」全部 scenarios）
- [x] 3.4 於 `boardGroupActions.ts` 新增 `batchAutoAssignCases(applicationIds, operatorUserId)`：逐一呼叫 `autoAssignCaseToBoardGroup`，收集 per-id 結果，回傳 `{ total, success, failed, results }`（實作 spec「Batch auto-assignment and settings switch」之批次 scenarios）
- [x] 3.5 於 `boardGroupActions.ts` 新增 `fetchBoardGroupForCase(applicationId)`：回傳該案 assignment + group name + 當前 group members 清單（初版含每人投票狀態；task 7.3 會簡化）
- [x] 3.6 於 `boardGroupActions.ts` 新增 `submitBoardVote(applicationId, isApproved, comments, voterUserId)`：初版的投票 server action（task 7.3 將刪除此函式）
- [x] 3.7 修改 `src/app/actions/workflowActions.ts` 之 `advanceWorkflowStage`：於事務成功 COMMIT 後，若 toStage === 'board_review'，讀 `board_auto_assign` 設定；若為 `'true'` 呼叫 `autoAssignCaseToBoardGroup(applicationId, null)`，失敗 console.warn 但不回滾（實作 spec「Batch auto-assignment and settings switch」之 stage-advance-on scenario，對應 design「自動派案觸發點」）

## 4. 前端 UI

- [x] 4.1 新增元件 `src/components/BoardGroupManager.tsx`：顯示所有組別（name/priority/成員 chips/目前案件數/啟用狀態），新增表單（name/priority/member multi-select 至少一人）、inline 編輯、啟停用 toggle、刪除（含守門提示）（實作 spec「Board group CRUD server actions」全部 scenarios 之 UI 呈現）
- [x] 4.2 修改 `src/components/AdminPanel.tsx`：加入 `isChairman` 判斷，於 tab bar 新增「董事組別管理」tab（顯示條件 `isChairman || isAdmin`），內容渲染 `<BoardGroupManager />`（實作 spec「Chairman-only admin tab and settings」之 tab scenarios）
- [x] 4.3 修改 `src/components/SettingsPanel.tsx`：暴露 `board_auto_assign` 設定（實作 spec「Chairman-only admin tab and settings」之 setting scenario）
- [x] 4.4 修改 `src/components/CaseListPage.tsx`（依 design「UI 放置：批次派案走 CaseListPage 而非單獨頁」）：加入 filter「僅顯示未派案的董事審核案件」、批次自動派案按鈕（實作 spec「CaseListPage chairman workflow」全部 scenarios）
- [x] 4.5 [SUPERSEDED] 初版 `src/components/BoardVoteCard.tsx` 含投票按鈕；task 7.4 將改寫為純派組顯示卡片
- [x] 4.6 [SUPERSEDED] 初版 `src/App.tsx` 案件詳情整合投票介面；task 7.5 將移除投票 UI 並加 dirty-state 守門

## 5. 驗證（初版規劃，已被 task 7-9 取代）

- [x] 5.1 [SUPERSEDED by 9.1] 手動測試（組別 CRUD）
- [x] 5.2 [SUPERSEDED by 9.2] 手動測試（自動派案）
- [x] 5.3 [SUPERSEDED by 9.3] 手動測試（手動派案）
- [x] 5.4 [SUPERSEDED by 9.4] 手動測試（投票流程 → 共筆流程）
- [x] 5.5 [SUPERSEDED by 9.5] 手動測試（全員同意推進 → 儲存 + 通過推進）
- [x] 5.6 [SUPERSEDED by 9.6] 手動測試（重新指派）
- [x] 5.7 執行 `npm run build` 確認 TypeScript 嚴格模式通過

## 7. Pivot：移除個別投票、改為共筆代表模式（schema & server）

- [x] 7.1 於 `scripts/init_db.sql` 將 `board_review_votes` 的 CREATE TABLE / COMMENT 區塊改為 `DROP TABLE IF EXISTS board_review_votes;`（冪等）；對 `pg_wmcms` 與 `pg_wmcms_demo` 執行 DROP；驗證兩庫 table 已消失（實作 spec「No per-member vote table」全部 scenarios）
- [x] 7.2 修改 `boardGroupActions.ts` 的 `assignCaseToBoardGroup`：**移除**「重派時 DELETE 未投票 rows」的邏輯（整段 DELETE from board_review_votes 刪除）；只做 UPSERT `board_review_assignments`，不動 `applications.approved_amount` 與 `application_workflow.comments / is_approved`（實作 spec「Manual case assignment」之「Re-assignment preserves existing review draft」scenario 與 design「重派處理：只換 assignment，不動審核表單的現有資料」）
- [x] 7.3 修改 `boardGroupActions.ts`：**刪除** `submitBoardVote` 函式；**簡化** `fetchBoardGroupForCase`（回傳組員清單但不含 is_approved/comments/voted_at 欄位）；**新增** `saveBoardReviewDraft(applicationId, patch, operatorUserId)` 實作 design「儲存（draft）與推進（advance/reject）的分離」—— 事務內驗證（stage='board_review' AND status='1'、case 有 assignment、operator 為組員 OR chairman OR admin）、diff 計算、UPDATE applications/application_workflow、寫 audit `board_review.draft_save`（實作 spec「Save board review draft (collaborative edit)」全部 scenarios）

## 8. Pivot：UI 調整（移除投票介面、加共筆儲存）

- [x] 8.1 於 `src/app/actions/auditActions.ts` 的 `AuditAction` **移除** `'board_review.vote' | 'board_review.rejected' | 'board_review.advanced'`，**新增** `'board_review.draft_save'`；`AuditTargetType` **移除** `'board_vote'`（實作 spec「Audit trail extension」之型別 scenarios）
- [x] 8.2 改寫 `src/components/BoardVoteCard.tsx` 為純派組資訊卡片：移除投票按鈕、同意/否決 modal、is_approved 欄位顯示；保留組別名、派案模式、派案時間、組員姓名清單（實作 spec「Detail page board assignment card and re-assignment」之「Card is read-only for all viewers」scenario）
- [x] 8.3 修改 `src/App.tsx` 案件詳情：移除 `<BoardVoteCard />` 的 onVoted 相關流程（刷新仍可保留）；依 design「權限判定：chairman vs admin vs board_member」，修改現有「通過 / 不通過結案」按鈕加權限判斷：僅派組成員 OR chairman OR admin 可見/可按（非成員隱藏）；傳入 dirty state prop 給這兩顆按鈕，dirty=true 時 disabled 並顯示 tooltip「請先儲存編輯」（實作 spec「Board review edit permission and UI gating」與「Dirty-state guard on stage-advance and reject actions」全部 scenarios）
- [x] 8.4 修改 `src/components/ApplicationForm.tsx`（或對應的 board review 欄位元件）：新增「儲存」按鈕呼叫 `saveBoardReviewDraft`；追蹤 `initialValues` (approvedAmount/boardOpinion/boardApproved) vs 當前值計算 dirty；對非組員（以 `isBoardGroupMember || isChairman || isAdmin` 判斷）把欄位設 `readOnly`；儲存成功後由 parent `loadAppDetail` 刷新，新資料載入後 dirty 自動清除（實作 spec「Save board review draft」UI scenarios 與「Dirty-state guard」全部 scenarios）
- [x] 8.5 於 `src/App.tsx` 或 `boardGroupActions.ts` 提供「當前使用者是否為本案派組成員」的判斷資料源（例如 `fetchBoardGroupForCase` 結果中比對 `members.userId === loggedInUser.id`），供 ApplicationForm 與按鈕權限判斷使用

## 9. Pivot 後重新驗證

- [x] 9.1 手動測試（組別 CRUD）：chairman 建 2 個組別（G1 priority=1 含 board_01；G2 priority=2 含 board_02, board_03）；建立成員為空 / 同董事加兩組 → 被擋；supervisor_01 登入 → tab 不見
- [x] 9.2 手動測試（自動派案）：`board_auto_assign=true`；推 3 案進 board_review → 驗證第 1 案派 G1（priority=1 優先）、第 2 案派 G2（案件數少）、第 3 案派 G1（平手 priority 小）
- [x] 9.3 手動測試（手動派案）：`board_auto_assign=false`；案件進 board_review 無 assignment；chairman 用 CaseListPage filter 看到未派案件 → 批次自動派案或詳情頁手動指派；皆顯示正確
- [x] 9.4 手動測試（共筆儲存 + 權限）：case 派給 G2；board_02 登入詳情頁 → 審核區塊可編輯、看到「儲存」按鈕；board_01（不在 G2）登入同案 → 欄位 readOnly、無「儲存/通過/不通過」按鈕；admin 也能編輯；儲存後在 `audit_logs` 看到 `board_review.draft_save` 且 `detail.changedFields` 只含變動欄位
- [x] 9.5 手動測試（dirty state + 推進）：board_02 編輯金額但未儲存 → 「通過」「不通過結案」按鈕 disabled；按「儲存」後按鈕 enable；按「通過」→ 案件進 reimbursement、status='3'
- [x] 9.6 手動測試（重新指派不清空審核）：board_02 先儲存 `approvedAmount=80000 / comments='草案一'`；chairman 將案件重新指派給 G1；到 DB 確認 `applications.approved_amount` 仍是 80000、`application_workflow.comments` 仍是 '草案一'；board_01（新 G1 成員）登入可看到前組填寫的內容
- [x] 9.7 手動測試（重複儲存零變動）：board_02 連按兩次「儲存」且未改欄位 → 第二次不產生新 audit row（查 `SELECT COUNT(*) FROM audit_logs WHERE action='board_review.draft_save' AND target_id=...`）
- [x] 9.8 執行 `npm run build` 確認 TypeScript 嚴格模式通過
