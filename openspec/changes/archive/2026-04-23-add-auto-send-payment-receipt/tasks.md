## 1. 依賴與字型

- [x] 1.1 安裝 `@react-pdf/renderer`：`npm install @react-pdf/renderer`；確認 lock file 更新；驗證 `npm run build` 仍通過（依 design「採用 @react-pdf/renderer 而非 puppeteer」決策）
- [x] 1.2 下載 `NotoSansTC-Regular.ttf` 與 `NotoSansTC-Bold.ttf` 放到 `src/lib/pdf/fonts/`（若 Vercel build 打包失敗則 fallback 至 `public/fonts/`，於 design 之 Migration Plan 步驟 4 驗證）；於 README 或 source 註明 SIL Open Font License（依 design「中文字型走 Noto Sans TC」決策）
- [x] 1.3 新增 `src/lib/pdf/registerFonts.ts`：模組頂層呼叫 `Font.register({ family: 'NotoSansTC', fonts: [...] })`；以 `fs.existsSync` 守門，缺檔時 `console.warn('[pdf-fonts] missing')` 但不拋錯（實作 spec「PDF generation library and font registration」三個 scenarios；依 design「字型檔放 src/lib/pdf/fonts/」決策）

## 2. PDF 元件與產生函式

- [x] 2.1 新增 `src/lib/pdf/PaymentReceiptPdf.tsx`：用 `@react-pdf/renderer` 元件樹（`<Document><Page><View><Text>` 等）渲染領款收據；A4 portrait；版面 mirror 既有 `/print/payment-receipt/[id]/page.tsx` 的視覺；接收與 `fetchPaymentReceiptPrintData` 相同的 DTO（實作 spec「Payment receipt PDF component」全部四個 scenarios）
- [x] 2.2 新增 `src/lib/pdf/generatePaymentReceiptPdf.ts`：export `generatePaymentReceiptPdf(applicationId, operatorUserId): Promise<Buffer>`；先呼叫既有 `fetchPaymentReceiptPrintData`；auth 失敗（含「權限不足」）throw；成功則 `pdf(<PaymentReceiptPdf data={...} />).toBuffer()` 取得 Buffer 回傳（實作 spec「PDF buffer generation server function」全部三個 scenarios）

## 3. Email 與 Dispatcher 擴充

- [x] 3.1 修改 `src/app/actions/notificationActions.ts` 之 `sendNotificationEmail`：簽名加 optional `attachments?: { filename: string; content: Buffer; contentType: string }[]`；透傳給 nodemailer.sendMail；既有呼叫者不需改（實作 spec「Email send with attachments」全部三個 scenarios）
- [x] 3.2 修改 `src/app/actions/notificationDispatcher.ts` 加入 per-event channel 限制：建立常數 `EVENT_CHANNEL_RESTRICTIONS: Partial<Record<EventType, string[]>>`，內含 `case_payment_receipt_to_applicant: ['email']`；dispatch loop 呼叫 send 前以此限制過濾 channels；被過濾的 channel 不出現在 status_per_channel（實作 spec「Per-event channel filter」全部三個 scenarios + spec「Email-only channel for this event」全部兩個 scenarios；依 design「Dispatcher 擴充」決策）
- [x] 3.3 修改 `src/app/actions/notificationDispatcher.ts`：將 `'case_payment_receipt_to_applicant'` 加入 `EventType` union；於 `RESOLVERS` 註冊新 resolver（SELECT applicant_id FROM applications WHERE id=x，含 is_active 守門 join users）（實作 spec「Single-applicant resolver」兩個 scenarios + spec「case_payment_receipt_to_applicant event registered」三個 scenarios）
- [x] 3.4 修改 `src/app/actions/notificationDispatcher.ts` 之 placeholder loader：為本事件額外提供 `{{核定金額}}`（從 applications.approved_amount，以 toLocaleString 格式化）（實作 spec「case_payment_receipt_to_applicant event registered」之「Placeholder 核定金額 available」scenario）
- [x] 3.5 修改 `src/app/actions/notificationDispatcher.ts`：當事件為 `case_payment_receipt_to_applicant` 時，dispatch 前先呼叫 `generatePaymentReceiptPdf(applicationId, applicant_id_as_operator)` 取得 Buffer；組成 `[{ filename: `領款收據_${case_number}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]`；傳給 sendNotificationEmail 的 attachments；PDF 失敗則 throw（spec 規範 dispatcher 已 catch + 寫 audit）（實作 spec「PDF attachment generated and attached」兩個 scenarios）
- [x] 3.6 修改 `src/app/actions/notificationDispatcher.ts`：本事件 dispatch 完成後，**額外**寫一筆 audit `notification.payment_receipt_sent`，detail 含 applicantUserId / recipientEmail / pdfBytes / status / errorMessage（與既有 event_dispatched 並存）（實作 spec「Audit logging for payment receipt sends」兩個 scenarios）

## 4. 觸發點

- [x] 4.1 修改 `src/app/actions/workflowActions.ts` 之 `advanceWorkflowStage`：在 board_review→reimbursement 推進的 COMMIT 之後，加入 `void notifyEvent('case_payment_receipt_to_applicant', { applicationId }).catch(err => console.error('[notify] case_payment_receipt_to_applicant failed:', err))`；fire-and-forget；位置與既有 `case_entered_board_review` trigger 並列在同一條件分支（實作 spec「Auto-send event triggered on advance to reimbursement」全部四個 scenarios；依 design「推進到 reimbursement 才觸發」決策）

## 5. 系統範本與守門

- [x] 5.1 於 `scripts/init_db.sql` seed 範本 `email_case_payment_receipt_to_applicant`（channel='email', status=1, subject='萬美基金會申請通過通知', body 含 {{申請人}} {{案號}} {{申請金額}} {{核定金額}} 與「您的補助申請已通過審核，請列印附件之領款收據，填寫具領人資料後郵寄回基金會」）；INSERT WHERE NOT EXISTS 冪等；對 pg_wmcms 與 pg_wmcms_demo 兩庫套用（實作 spec「System email template seeded」全部四個 scenarios）
- [x] 5.2 修改 `src/lib/systemTemplates.ts`：在 `SYSTEM_TEMPLATE_NAMES` Set 加入 `'email_case_payment_receipt_to_applicant'`，自動受既有 deleteTemplate / updateTemplate 改名守門保護（實作 spec「System email template seeded」之「Template protected from deletion」與「Template body editable」scenarios；依 design「系統範本守門加入新範本」決策）

## 6. 型別與稽核

- [x] 6.1 於 `src/app/actions/auditActions.ts` 之 `AuditAction` union 新增 `'notification.payment_receipt_sent'`（實作 spec「Audit action types extended」scenario；依 design「Audit 行為」決策）

## 7. 申請人 Email 必填

- [x] 7.1 修改 `src/components/NewApplicationPage.tsx`：email input 加 `required` 屬性；label 加紅色 `*` 必填指示；client-side 提交前驗證非空 + email 格式（實作 spec「Email required at all applicant intake entry points」之「Internal new application form blocks empty email」與「Asterisk indicator visible」scenarios）
- [x] 7.2 修改 `src/components/ExternalIntake.tsx`：同 7.1 套用 required + 必填指示 + 格式驗證；錯誤訊息「請填寫 Email」用繁中（實作 spec「Email required at all applicant intake entry points」之「External intake form blocks empty email」scenario）
- [x] 7.3 修改 `src/app/actions/applicationActions.ts` 之 `createNewApplication`：在任何 DB 寫入之前 validate `email` 為非空且符合 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`；失敗 return `{ success: false, error: '請填寫有效的 Email 地址' }`（實作 spec「Server-side email validation」全部四個 scenarios 中的內部建案路徑）
- [x] 7.4 修改 `src/app/actions/intakeActions.ts`（外部收件 server action）：套用相同 email validation；錯誤訊息一致（實作 spec「Server-side email validation」之「External intake server action enforces same rule」scenario）
- [x] 7.5 確認 `users.email` 欄位**仍為 nullable**（不加 NOT NULL constraint）；不對既有資料做 backfill；scripts/init_db.sql 不變更該欄位 schema（實作 spec「Existing data not migrated」兩個 scenarios；依 design「申請人 email 必填的 migration」決策）

## 8. 驗證與部署檢查

- [x] 8.1 schema/seed 驗證：兩庫查 `SELECT name, status FROM notification_templates WHERE name='email_case_payment_receipt_to_applicant'` 應有 1 列且 status=1
- [x] 8.2 PDF render 驗證：寫一個臨時 `tmp/test-pdf.mjs`（或 server action 直接呼叫）對某個 applicationId 跑 `generatePaymentReceiptPdf` → 將 Buffer 寫入 `tmp/test.pdf` → 用 PDF reader 開啟確認版面、中文、金額大寫無誤
- [x] 8.3 端到端測試（dispatcher 開啟）：建立有 email 的申請人 + 案件 → 推進到 board_review → 派組 → 簽章 → 推進到 reimbursement → 確認申請人信箱收到信、附件可開、內容正確
- [x] 8.4 端到端測試（無 email 申請人）：手動把某既有 case 的 applicant.email 設為 NULL → 推進到 reimbursement → 確認 audit 寫 `status='skipped_no_email'`、無 email 寄出、業務流程不中斷
- [x] 8.5 端到端測試（重複推進）：把 8.3 的案件退回 board_review 再推進 → 申請人收到第二封信、第二筆 audit `notification.payment_receipt_sent`
- [x] 8.6 端到端測試（必填驗證）：在 NewApplicationPage / ExternalIntake 嘗試送空 email → 被 client + server 雙層擋下；送 `'foo'` 也被擋
- [x] 8.7 PDF 失敗隔離驗證：暫時把字型檔改名 → 推進案件 → email 失敗但案件成功進入 reimbursement；audit 有 `payment_receipt_sent` with `status='failed'`
- [x] 8.8 部署 size 驗證：`npm run build` 後檢查 `.next/` 與 Vercel function bundle size；若超過 50 MB 切到 subset 字型（依 design Migration Plan 第 4 步）
- [x] 8.9 執行 `npm run build` + `npm run lint` 通過
