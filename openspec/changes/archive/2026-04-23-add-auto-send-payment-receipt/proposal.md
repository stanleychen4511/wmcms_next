## Why

董事審核通過、案件推進到核銷階段時，目前需要會計手動：(1) 印領款收據紙本 (2) 打電話/寫信通知申請人來基金會領取或填表寄回。流程慢、容易漏通知。自動化此步驟可以讓申請人在案件通過當下立即收到「請列印領款收據填寫並郵寄回函」的 Email + PDF 附件，縮短整體核銷週期。

此 change 同時補足前一個 change（`add-reimbursement-print-documents`）遺留的 server-side PDF 產生能力 — 目前列印只走瀏覽器，無法當作 email 附件用。

## What Changes

- 新增 server-side PDF 產生能力：採用 `@react-pdf/renderer`（無需 chromium、Vercel Serverless 友善），建立領款收據的 PDF 元件版本（與既有 HTML 列印頁版面對應，但不共用程式碼）
- 在 `advanceWorkflowStage` 從 `board_review` 推進到 `reimbursement` 的 hook 內，觸發新事件 `case_payment_receipt_to_applicant`
- 此事件 dispatcher 行為與既有事件不同（單一收件人 = 申請人 + 帶 PDF 附件），需擴充 `notificationDispatcher` 的能力
- 新增系統 Email 範本 `email_case_payment_receipt_to_applicant`（受系統範本守門：不可刪、不可改名）：
  - 主旨：`萬美基金會申請通過通知`
  - 內文 placeholder：`{{申請人}}` `{{案號}}` `{{申請金額}}` `{{核定金額}}`，固定文字「請列印附件之領款收據，填寫完畢後郵寄回函至基金會」
- **BREAKING（intake 表單行為變更）**：申請人 email **強制必填** — 修改 `ExternalIntake.tsx`、`NewApplicationPage.tsx` 等所有建立 applicant 帳號的入口，email 由可選改為必填；後端 server actions（`createNewApplication` / 外部收件 action）一併加 server-side validation
- **每次推進都重寄**（依使用者決策）：退回 board_review 後再推進會再次寄送，audit log 記每次寄送
- 新增 audit action `notification.payment_receipt_sent`（detail 含 pdf size、recipient email、是否成功）

## Non-Goals

- 不做「自動撥款」自動化 — 僅自動寄收據；實際撥款仍由會計手動處理
- 不做「申請人線上簽收 / 線上回填」— 流程仍是紙本郵寄
- 不做「重寄按鈕」UI — 退回 board_review 再推進即會重寄；不另開後台「重寄」按鈕
- 不擴展到其他事件附件需求 — dispatcher 的附件能力只為本事件設計，泛用化留給未來 change
- 不引入 puppeteer / chromium 依賴
- 不修改既有 HTML 列印頁（`/print/payment-receipt/...`）— PDF 是另一份元件樹，雖然版面相似但獨立維護
- 不處理「申請人 email 異動 / 發送失敗的補救流程」— 失敗只 log audit，UI 顯示需另開 change

## Capabilities

### New Capabilities

- `pdf-document-generation`: server-side PDF 產生工具與領款收據 PDF 元件
- `payment-receipt-auto-mailer`: 推進到 reimbursement 時自動寄 PDF 給申請人的事件、resolver、dispatcher 整合
- `applicant-email-required`: 申請人 email 全面改為必填（intake 端 UI + server action validation）

### Modified Capabilities

- `notification-event-dispatcher`: 擴充支援單一收件人事件 + email 附件（既有的 `notifyEvent` 限定多收件人 + 純文字/HTML 信，需要加附件參數路徑）

## Impact

- Affected specs:
  - 新增 `specs/pdf-document-generation/spec.md`
  - 新增 `specs/payment-receipt-auto-mailer/spec.md`
  - 新增 `specs/applicant-email-required/spec.md`
  - 修改 `specs/notification-event-dispatcher/spec.md`（新增附件支援需求）
- Affected code:
  - 新依賴：`package.json` 加 `@react-pdf/renderer`（含其 peer deps）
  - 新增 `src/lib/pdf/PaymentReceiptPdf.tsx` — react-pdf 元件樹，渲染領款收據
  - 新增 `src/lib/pdf/registerFonts.ts` — 註冊繁中字型（NotoSansTC 或專案既有字型）
  - 新增字型檔到 `public/fonts/`（或下載至 build time）
  - 新增 `src/lib/pdf/generatePaymentReceiptPdf.ts` — 產生 Buffer 的 server function
  - 修改 `src/app/actions/notificationDispatcher.ts` — 新增 EventType `case_payment_receipt_to_applicant`、resolver（單一申請人）、附件路徑
  - 修改 `src/app/actions/notificationActions.ts` — `sendNotificationEmail` 加可選 `attachments` 參數透傳給 nodemailer
  - 修改 `src/app/actions/workflowActions.ts` — `advanceWorkflowStage` 觸發新事件（與既有 `case_entered_board_review` 相鄰）
  - 修改 `src/app/actions/auditActions.ts` — `AuditAction` union 加 `'notification.payment_receipt_sent'`
  - 修改 `src/lib/systemTemplates.ts` — 新增 `email_case_payment_receipt_to_applicant` 至守門 set
  - 修改 `scripts/init_db.sql` — seed 新範本
  - 修改 intake 端 UI：`src/components/NewApplicationPage.tsx`、`src/components/ExternalIntake.tsx`、`src/app/apply/page.tsx`（若有）— email 必填
  - 修改 intake 端 server actions：`src/app/actions/applicationActions.ts` 之 `createNewApplication`、`src/app/actions/intakeActions.ts` — email 必填驗證
- 兩庫需執行：`scripts/init_db.sql`（idempotent）— seed 新範本
