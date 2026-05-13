## Why

依《核銷流程》文件以及與業務端後續討論，現行多層審核撥款流程仍缺：每階段具體檢核項目、各階段可見的累計撥款金額、會計階段彈性合併列印、個管師主動寄送領款收據、核銷階段才需要的存摺封面影本、以及醫療收據／領款收據按「每筆撥款」上傳的資料模型。同時舊的「進入核銷時自動寄信」機制因分批撥款需求已不合時宜，必須改為個管師手動觸發。

## What Changes

### 文件 scope 與上傳責任歸屬

- `document_type_config` 新增 `scope` 欄位（`'C'` case-level / `'D'` disbursement-level）。
- `application_documents` 新增 `disbursement_id`（nullable），與 `payment_disbursements.id` 關聯；`disbursement_id IS NULL` 表示 case-level。
- 領款收據、醫療收據改為 disbursement-level（每筆撥款各一份）。
- 領款收據由 case_officer 於個管階段（`review_stage='1'`）上傳；醫療收據由 accountant 於會計階段（`review_stage='3'`）上傳。
- 保險給付、生命故事同意刊登仍為 case-level。
- 新增 case-level 文件類型「存摺封面影本」（`phase='reimbursement'`、`is_required=true`、`allow_supplement=true`），於案件進入待核銷（`status='3'`）後解鎖上傳。

### 每階段【檢核】Checklist 守門

- `payment_disbursements` 新增 boolean 檢核欄位：
  - `officer_doc_check`（個管：領款收據已上傳）
  - `supervisor_doc_check`（主管：領款收據已確認無誤）
  - `accountant_medical_uploaded_check`、`accountant_amount_match_check`、`accountant_board_opinion_check`、`accountant_bank_setup_check`（會計四項）
  - `executive_final_check`（執行長：申請表、家訪、審核意見表確認）
- 各階段【送出】／【完成】按鈕在當階段所有 checkbox 勾選完成前 disabled。
- 退件原因強制填寫，最少字數可由 system_settings.`disbursement_reject_reason_min_chars` 設定（預設 10）。

### 累計撥款金額可見

- `DisbursementPanel` 頂部加入 summary 卡片，顯示「核定金額／已撥款累計／剩餘可撥」三個數字，所有角色階段一致呈現。
- 每筆撥款 row 標示「第 N 次撥款」（依 created_at 排序）。
- 累計金額 = 核定金額時，面板頂端顯示「✅ 本次補助已完成結案」橘色 banner，所有角色可見。

### 會計階段：彈性勾選列印 + 合併 PDF（**MODIFIED**）

- 會計階段保留現有列印區塊存取控制（accountant 或 admin），但將三個獨立列印按鈕改為勾選清單：
  - ☐ 審核意見表（case-level）
  - ☐ 醫療收據（當次撥款）
  - ☐ 領款收據（當次撥款）
- 會計勾選後按【列印】→ 系統合併所選文件為單一 PDF 並下載。
- 列印不守門（不影響 checklist 完成度）；列印動作寫 `audit_logs`，撥款 row 顯示「📄 已列印」badge 含時間／操作者。
- 「歷史撥款收據檢視」功能僅 accountant 角色於會計階段可見；其他角色看到的歷史列表不含檢視按鈕。

### 個管師主動產生並寄送領款收據（**BREAKING**：取代自動寄信）

- **移除**現行 `advanceWorkflowStage` 從 `board_review` 進入 `reimbursement` 時自動觸發 `case_payment_receipt_to_applicant` 事件的邏輯。
- 個管師建立每筆撥款後，於個管階段 row 內提供三步驟動作：
  1. 【產生領款收據】：用 template_files 套印申請人姓名／當次金額／日期，產生 PDF
  2. 【檢視】：以 SecureFilePreviewModal 預覽
  3. 【寄送 email 給申請人】：透過 notification 機制發送，附件為剛產生的 PDF；寫入 `notification_logs`
- 撥款 row 顯示三個 badge：已產生 / 已寄送 / 紙本掃描完成。
- 個管師【送出】至主管前，必須完成「已寄送 email + 紙本掃描完成 + officer_doc_check 勾選」三項。

### 完成時通知所有相關人員

- `submitExecutiveStage` 完成（`review_stage` → `'9'`）時觸發通知：
  - 站內通知（in-app）：該撥款的 case_officer、supervisor、accountant
  - 申請人：依其 `notification_channels` 偏好（LINE／Email），無管道則略過
- 通知模板新增 `disbursement_completed`。

### 角色嚴格守門（已於前次完成，本提案僅明確列入規範）

- `rolesForStage()` 與 client-side `canActOnStage()` 一致，不再包含 admin bypass：個管→case_officer、主管→supervisor、會計→accountant、執行長→executive。

## Non-Goals

- 不變更現行的 4 階段 review_stage 流程（`'1'`～`'4'`、`'9'`）與串行守門（每案最多一筆 in-flight）。
- 不變更董事審核意見表的產生／簽署邏輯。
- 不調整現行 `notification_channels`、`notification_logs` 表結構，僅新增模板與觸發點。
- 不改寫已歸檔的 `add-multi-stage-disbursement-review` 既有 server actions 簽章；以追加欄位／新增 action 為主。

## Capabilities

### New Capabilities

- `disbursement-document-scope`: 文件 scope 區分（case-level vs disbursement-level）、醫療收據／領款收據／存摺封面影本之上傳權責與時機。
- `disbursement-stage-checklist`: 個管／主管／會計／執行長四階段 checklist 守門欄位與【送出】／【完成】按鈕的啟用條件、退件原因強制填寫規則。
- `disbursement-amount-tracking`: 核定金額／累計撥款／剩餘可撥摘要、第 N 次撥款標示、結案 banner 跨角色可見。
- `disbursement-officer-mailer`: 個管師於個管階段產生／檢視／寄送領款收據 email 之三步驟流程與守門條件。
- `disbursement-completion-notification`: 撥款完成時對 case_officer／supervisor／accountant／申請人之通知派送與模板。

### Modified Capabilities

- `reimbursement-document-printing`: 將「三個獨立列印按鈕」改為「勾選清單 + 合併單一 PDF + 列印 audit + 已列印 badge」；歷史收據檢視僅會計階段可見。
- `payment-receipt-auto-mailer`: 移除「進入 reimbursement 自動觸發」事件；改由個管師於每筆撥款手動觸發；保留事件名稱與 notification 派送基礎建設供新流程使用。

## Impact

- **Affected specs**：上述 5 個新 capability、2 個 modified capability。
- **Affected code**：
  - `scripts/init_db.sql`：新增欄位、新增文件類型、新增系統設定、新增通知模板。
  - `src/app/actions/paymentDisbursementActions.ts`：checklist 欄位讀寫、送出/完成守門、完成通知觸發。
  - `src/app/actions/workflowActions.ts`：移除 `advanceWorkflowStage` 自動觸發 `case_payment_receipt_to_applicant` 事件。
  - `src/app/actions/documentActions.ts`：`disbursement_id` 寫入路徑、scope 過濾。
  - `src/components/DisbursementPanel.tsx`：summary 卡片、每階段 checklist UI、第 N 次標示、結案 banner、個管寄信三步驟、會計勾選列印、歷史收據按角色限縮。
  - `src/components/ReviewList.tsx`：scope='C' 過濾，避免誤列 disbursement-level 文件。
  - `src/app/api/preview/...` 或新增 `src/app/api/disbursement-print/route.ts`：合併多 PDF 服務。
  - `src/components/SecureFilePreviewModal.tsx`：（如需要）支援存摺封面預覽。
  - `src/app/actions/notificationActions.ts`：新增 `disbursement_completed` 派送、個管寄信整合。
- **Affected DB**：`document_type_config.scope`、`application_documents.disbursement_id`、`payment_disbursements` 多個 boolean 檢核欄位、`system_settings` 新增 `disbursement_reject_reason_min_chars`、`document_type_config` 新增「存摺封面影本」、`notification_templates` 新增 `disbursement_completed`。
