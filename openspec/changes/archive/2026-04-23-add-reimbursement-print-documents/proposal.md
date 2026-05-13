## Why

會計在核銷階段需要列印三份紙本文件歸檔（審核意見表、醫療收據、領款收據），目前系統完全沒有列印功能，會計必須手動從各處抄資料到紙本範本，費時易錯。此外，董事審核意見目前存於 `application_workflow.comments`，會隨 stage 推進被覆寫 — 到核銷階段時原始審核意見已遺失，這個 schema 誤用必須在本 change 一併修正，否則審核意見表的核心資料印不出來。

## What Changes

- 在核銷撥款畫面（`ReimbursementPanel` / 對應分頁）新增「文件列印」區塊，顯示三顆按鈕，僅 `admin` 與 `accountant` 角色看得到
- 新增兩個 server-rendered 列印頁面（獨立 URL、新分頁開啟、A4 列印版面）：
  - `/print/review-opinion/[applicationId]` — 審核意見表
  - `/print/payment-receipt/[applicationId]` — 領款收據
- 醫療收據按鈕不需新頁面：從 `application_documents` 撈 `document_type_config.name = '醫療收據'` 的上傳檔案，開新分頁讓瀏覽器內建預覽 + `Ctrl+P` 列印；多份跳 modal 讓會計選
- **BREAKING**（schema 層但不影響既有資料）：新增 `applications.board_review_comments TEXT` 欄位，保存董事共同審核意見，不再依賴 `application_workflow.comments`
  - `saveBoardReviewDraft` 同步寫入此欄位
  - `retreatWorkflowStage` 退回 `board_review` 之前的 stage 時，連同派組/簽章一起清空此欄位
- 新增基金會 header 相關 system settings（8 個 key）：`org_full_name`、`org_license_no`、`org_registration_no`、`org_uniform_no`、`org_address`、`org_phone`、`org_fax`、`org_line_qr_url`
- 新增工具模組 `src/lib/numToChinese.ts`（金額阿拉伯數字 → 國字大寫，中間補零）
- 新增工具模組 `src/lib/rocDate.ts`（西元年 → 民國年格式化）
- `case_number` 第一碼解析成案件類別 A/B/C/D，用於兩份印表（類別對應固定字典，寫入 `src/lib/caseCategory.ts`）

## Non-Goals

- 不支援直接產生 PDF/DOCX 檔下載（全部走瀏覽器原生列印）
- 不做「一鍵列印全部三份」的合併列印
- 不支援董事個別獨立意見（維持整組一份共同 `board_review_comments`；若未來要拆到每位董事一人一份，屬另一個 change）
- 不在收件/外部收件 UI 新增案件類別選項（類別從 case_number 第一碼反推，不另存欄位）
- 不做系統簽章之外的手寫簽章支援

## Capabilities

### New Capabilities

- `reimbursement-document-printing`: 核銷階段列印三份紙本文件（審核意見表、醫療收據、領款收據）的路由、UI、資料組裝邏輯
- `board-review-comments-preservation`: 將董事審核意見從 stage-scoped 欄位（`application_workflow.comments`）搬到 case-scoped 欄位（`applications.board_review_comments`）以永久保存
- `organization-metadata-settings`: 基金會組織基本資料（名稱、統編、地址、QR 等）透過 system_settings 管理

### Modified Capabilities

(none — 退回清除審核意見的行為由新 capability `board-review-comments-preservation` 自行涵蓋，不擾動既有 `board-review-group-assignment` spec)

## Impact

- Affected specs:
  - 新增 `specs/reimbursement-document-printing/spec.md`
  - 新增 `specs/board-review-comments-preservation/spec.md`
  - 新增 `specs/organization-metadata-settings/spec.md`
- Affected code:
  - DB schema: `scripts/init_db.sql` 加欄位 + seed 8 個基金會 settings
  - `src/app/actions/settingsActions.ts` — `ensureDefaultSettings` 加 8 個預設 key
  - `src/app/actions/boardGroupActions.ts` — `saveBoardReviewDraft` 同步寫 `board_review_comments`
  - `src/app/actions/workflowActions.ts` — `retreatWorkflowStage` 退回清 `board_review_comments`
  - `src/app/print/review-opinion/[applicationId]/page.tsx`（新）
  - `src/app/print/payment-receipt/[applicationId]/page.tsx`（新）
  - `src/app/actions/printDocumentActions.ts`（新）— server actions 組裝印表資料
  - `src/lib/numToChinese.ts`（新）
  - `src/lib/rocDate.ts`（新）
  - `src/lib/caseCategory.ts`（新）
  - 核銷撥款畫面元件（待確認檔名，可能是 `ReimbursementPanel.tsx` 或 `BoardVoteCard` 之外的核銷區塊）新增「文件列印」區塊
  - `public/org-line-qr.png`（新，使用者提供的 QR 圖）
- Non-code:
  - 需人工把使用者提供的 LINE 志工 QR code 圖片放到 `public/org-line-qr.png`
