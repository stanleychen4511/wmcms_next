## Why

目前董事審選（board_review）階段是「任一董事一人作審」的單點流程（`application_workflow` 一列帶 `reviewer_id`）。實務上基金會有多位董事，需以「組別」為單位審查：一位董事長（chairman）將案件派發到某組，組內任一董事代表組別填寫審核結果（組員間已達共識後共筆）。這樣的合議制既能分工（董事長可依案件類型指派給最合適的組別），又能讓組員彼此看見同組成員的編輯進度。

目前系統無法：
1. 建立/維護董事組別（哪些董事在哪一組、組別優先序）。
2. 將案件派發給一個組別，且限定該組別成員才能編輯董事審核欄位。
3. 依「最少案件 → 高優先序」自動分配工作量。
4. 讓同組成員在提交最終審核（通過／不通過結案）前以「儲存」按鈕共筆暫存，並避免誤按「進入下一階段」造成未儲存的編輯消失。

導入本功能使董事審查流程與實務一致、工作量平均、並讓董事長擁有派案決策權。

## What Changes

### 資料模型（schema）

- 新增資料表 `board_groups`：id / name（唯一）/ priority（整數，小者優先）/ is_active / created_at / updated_at。
- 新增資料表 `board_group_members`：group_id + user_id 複合主鍵，記錄組員。每位 user 僅屬於一組（UNIQUE (user_id) 當 is_active 組別）。
- 新增資料表 `board_review_assignments`：application_id（UNIQUE，每案目前只派一組）/ group_id / assigned_at / assigned_by（chairman user id）/ assign_mode（'auto' | 'manual'）。
- 系統設定新增 `board_auto_assign`（'true' / 'false'，預設 'false'）。
- **不建立** `board_review_votes` 表（原設計中每位董事一列的投票表 —— 組員共筆模式下不需要，若既有環境已建立須 DROP）。

### 後端 server actions（新檔 `boardGroupActions.ts`）

- `fetchAllBoardGroups()`：含 members 清單與目前進行中案件數（用於「工作量排序」）。
- `fetchActiveBoardGroups()`：僅 is_active，供派案下拉。
- `createBoardGroup(name, priority, memberUserIds, operatorUserId)`：至少一名董事成員；建立時 audit。
- `updateBoardGroup(id, name, priority, memberUserIds, operatorUserId)`：可改名、改優先序、增減成員。
- `toggleBoardGroupActive(id, isActive, operatorUserId)`：停用不影響既有已派案件。
- `deleteBoardGroup(id, operatorUserId)`：僅在無任何 assignments 引用時允許；否則回錯（建議改以停用）。
- `assignCaseToBoardGroup(applicationId, groupId, operatorUserId, mode)`：將案件派給某組別；UPSERT `board_review_assignments`（若案件已派過會覆寫）。
- `autoAssignCaseToBoardGroup(applicationId, operatorUserId?)`：依「目前案件數最少，平手時 priority 最小」選組別，呼叫 `assignCaseToBoardGroup(mode='auto')`。
- `batchAutoAssignCases(applicationIds, operatorUserId)`：批次呼叫 `autoAssignCaseToBoardGroup`，回傳每筆成功/失敗。
- `saveBoardReviewDraft(applicationId, { approvedAmount, comments, isApproved }, operatorUserId)`：事務驗證權限（派組成員 OR chairman OR admin）、階段（board_review）、status='1'；UPDATE `applications.approved_amount` 與 `application_workflow.comments / is_approved`（覆寫，last write wins）；寫 audit `board_review.draft_save` 含 before/after。此為共筆暫存，不推進案件狀態。
- `fetchBoardGroupForCase(applicationId)`：回傳該案的 group 資訊 + 當前組員清單（供詳情頁顯示）。不再含投票狀態欄位。
- **刪除** `submitBoardVote`（不再使用）。

### 現有流程整合

- `createNewApplication` 無改動（案件建立仍由承辦人開始於 admin_review）。
- 案件進 board_review 階段（由既有 `advanceWorkflowStage` 或新的提交路徑觸發）時：若系統設定 `board_auto_assign='true'` → 自動呼叫 `autoAssignCaseToBoardGroup`；否則不派（董事長手動派）。
- `board_review` 階段的「通過 → 進入核銷」與「不通過結案」仍由**既有按鈕**觸發（`advanceWorkflowStage` / `closeCaseRejected`），但加三道守門：
  1. 按鈕限「派組成員 OR chairman OR admin」可見/可按；非成員 disabled。
  2. 若「董事審核」欄位（核准金額 / 審核意見 / 審核結果）有編輯異動但**未按儲存**，兩顆按鈕 disabled，直到點擊「儲存」把當前值寫入 DB。
  3. 前端以 dirty state（比對當前 input vs 最新 server 值）判斷。

### 角色與權限

- 董事長（`chairman`）：可 CRUD 董事組別、手動派案、重新指派、切換自動派開關；可編輯任一案件的董事審核區塊（取代組員）；可看所有組別案件進度。
- 董事（`board_member`）：僅能編輯/儲存**自己所屬組別被派到的案件**之董事審核區塊；可檢視其他組案件進度但不能編輯。
- admin：與 chairman 等權。

### UI

- **後台管理**新增 tab「董事組別管理」（`isChairman` or `isAdmin` 才顯示）：
  - 組別清單（name / priority / 成員 chips / 目前進行中案件數 / 啟用狀態）
  - 新增 / inline 編輯 / 加減成員 / 啟停用
  - 系統設定區塊顯示 `board_auto_assign` 開關（可透過現有 `SettingsPanel` 暴露即可，此頁 optional 再加一個 shortcut）
- `SettingsPanel` 暴露新設定 `board_auto_assign`（labels / hint 同既有模式）。
- **申請案件管理頁**（CaseListPage）：
  - 為 chairman 身分新增 filter「僅顯示未派案的董事審核案件」（條件：stage=board_review AND 沒有 board_review_assignments 列）。
  - row 可批次勾選，工具列出現「批次自動派案」按鈕 → 呼叫 `batchAutoAssignCases`。
  - 每筆 row 可「手動指派組別」（下拉選組 → `assignCaseToBoardGroup(mode='manual')`）。
- **案件詳情頁（board_review 階段）**：
  - 顯示派案資訊（組別名、派案模式、派案時間）+ 組員清單（純顯示，無投票狀態）—— 由 `BoardVoteCard` 元件負責。
  - 若登入者為 chairman/admin：顯示「指派 / 重新指派」按鈕（下拉另一組別 → 覆寫）。
- **ApplicationForm 董事審核區塊**（現有）新增「儲存」按鈕：
  - 按下呼叫 `saveBoardReviewDraft`；成功後刷新詳情、清 dirty state。
  - 欄位（核准金額 / 審核意見 / 審核結果 Radio）對非組員 readOnly；編輯中若 dirty，下方「通過 / 不通過結案」按鈕 disabled。
- `AuditAction` 擴充：`board_group.create / update / toggle_active / delete`、`board_review.assign`、`board_review.reassign`、`board_review.draft_save`。
- `AuditTargetType` 擴充：`board_group`、`board_assignment`。
- **刪除**之前規劃過但不再使用的 audit action：`board_review.vote`、`board_review.rejected`、`board_review.advanced`；target type `board_vote`。

## Non-Goals (optional)

- 不支援一位董事跨多組別（schema UNIQUE 限制 one-to-one at most）。若未來有需要再做延伸。
- 不採用個別投票機制（已於 ingest 移除原規劃的 `board_review_votes` 表與 `submitBoardVote` action）；改為共筆代表模式。
- 不提供「組長」概念或最終決策權；組員平等，任一組員按「儲存」「通過」「不通過結案」即生效。
- 不保留每次儲存的歷史版本於資料表（僅 audit_logs 記錄 before/after 供追溯）；current value 以 last write wins 覆寫。
- 不提供「逾期未審自動提醒」（未來可另外做通知排程延伸）。

## Capabilities

### New Capabilities

- `board-review-group-assignment`: 董事組別維護、case 到 group 的派案（手動/自動）、組員共筆代表審核（儲存 + 通過/不通過）、權限限制於派組成員、工作量平均演算法。

### Modified Capabilities

(none)

## Impact

- **Affected specs**：新增 `specs/board-review-group-assignment/spec.md`
- **Affected code**：
  - `scripts/init_db.sql`：保留已建立的 3 個 table（`board_groups` / `board_group_members` / `board_review_assignments`）、`board_auto_assign` 預設值；**刪除** `board_review_votes` 表與對應 COMMENT
  - `src/app/actions/boardGroupActions.ts`：**移除** `submitBoardVote`；**簡化** `fetchBoardGroupForCase` 的回傳（無投票欄位）；**新增** `saveBoardReviewDraft`
  - `src/app/actions/settingsActions.ts`：`ensureDefaultSettings` 加入 `board_auto_assign`（已完成）
  - `src/app/actions/auditActions.ts`：`AuditAction` 移除 `board_review.vote / rejected / advanced`、新增 `board_review.draft_save`；`AuditTargetType` 移除 `board_vote`
  - `src/app/actions/workflowActions.ts`：`advanceWorkflowStage` 於目標 stage='board_review' 且 `board_auto_assign='true'` 時觸發 `autoAssignCaseToBoardGroup`（已完成）
  - `src/app/actions/applicationActions.ts`：`fetchCaseSummaries` 加入 `assignedBoardGroupId`（已完成）
  - `src/components/BoardGroupManager.tsx`：後台組別管理（已完成，保留）
  - `src/components/AdminPanel.tsx`：新增「董事組別管理」tab（已完成，保留）
  - `src/components/SettingsPanel.tsx`：暴露 `board_auto_assign`（已完成）
  - `src/components/CaseListPage.tsx`：filter 與批次派案工具列（已完成，保留）
  - `src/components/BoardVoteCard.tsx`：**移除投票按鈕、同意/否決 modal**；改為純派組資訊卡片
  - `src/App.tsx` 案件詳情區塊：移除投票介面引用；「通過 / 不通過結案」按鈕加 dirty-state 與成員權限守門
  - `src/components/ApplicationForm.tsx`：董事審核區塊新增「儲存」按鈕、dirty-state 追蹤、非組員 readOnly
  - `src/types.ts`：無需新增型別
- **Dependencies**：無新增 npm 套件
- **資料移轉**：
  - 既有進行中 board_review 案件在功能上線時**不會**自動派案；董事長需手動派案一次。
  - 已執行過初版 apply 的環境需 `DROP TABLE IF EXISTS board_review_votes;`（於 `init_db.sql` 加 `DROP TABLE IF EXISTS` 冪等語句，並對 `pg_wmcms` / `pg_wmcms_demo` 兩庫執行一次）。
