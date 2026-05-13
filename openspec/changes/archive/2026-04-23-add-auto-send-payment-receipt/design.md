## Context

前一個 change `add-reimbursement-print-documents` 完成了 HTML 列印頁讓會計可以印領款收據。本 change 在那之上加：「董事通過後自動寄 PDF 給申請人」。

關鍵差異與限制：
- 既有列印是 client-side（`window.print()`），無法產生 PDF Buffer 給 email 附件用
- Vercel Serverless 部署環境不適合 puppeteer（chromium 體積大、冷啟動慢、需要特殊 binaries）
- 既有的 `notificationDispatcher.notifyEvent` 設計是「resolve 多收件人 + 純文字/HTML 範本」，沒有附件路徑、也假設多人
- 申請人 email 目前在 schema 是 nullable 且某些 intake 路徑沒蒐集 → 自動寄送會大量失敗，必須先補強 intake validation
- 系統已有 `notification_templates` 表 + `notificationDispatcher` + `sendNotificationEmail`（用 nodemailer），可重用大部分管線

## Goals / Non-Goals

**Goals:**

- 推進 `board_review → reimbursement` 後，申請人在數秒內收到 Email + PDF 附件
- PDF 版面與既有 HTML 列印頁視覺一致（基金會 header、案件資料、金額國字大寫、簽名空欄）
- email 失敗不影響業務流程（fire-and-forget + 三層 try/catch，沿用既有 dispatcher 模式）
- 系統範本可由 admin 在後台編輯文字（受系統範本守門：不可刪、不可改名）
- 申請人 email 未來必填，新案件不再有「沒 email 寄不出」狀態

**Non-Goals:**

- 不擴展為「任意事件帶任意附件」的泛用框架；附件路徑只服務本事件
- 不做寄件失敗的自動重試（dispatcher 既有設計就是「不重試」，本 change 維持）
- 不修改既有 HTML 列印頁；PDF 是另一份元件，**不共用程式碼**（react-pdf 元件 vs HTML 是兩種 DOM）
- 不加任何 UI 顯示「已寄送 / 寄送失敗」狀態（看 audit log 即可）
- 不支援收件人 reply 的回填功能；申請人填完紙本就郵寄回基金會

## Decisions

### 採用 @react-pdf/renderer 而非 puppeteer

**選擇**：用 `@react-pdf/renderer` 在 Node.js runtime 直接產生 PDF Buffer，不啟動瀏覽器。

**為什麼不用 puppeteer**：
- Vercel Serverless function size 限制 50 MB（壓縮後）；包含 chromium 一定爆，需要 `@sparticuz/chromium` 等 workaround，部署複雜度高
- 冷啟動 chromium 要 5~10 秒，user 經驗差
- 維護成本高（chrome 版本、字型支援、CSS 差異）

**為什麼不用其他純 JS 庫**：
- `pdfkit`：純程式繪製，沒有 React 化的元件 API，要重做大量 layout
- `pdfmake`：JSON document model，Traditional Chinese 字型支援要手動 embed，且不是 React-ish
- `jspdf`：原本給 client-side 用，server 端能跑但中文字型支援差

**為什麼選 @react-pdf/renderer**：
- 元件化（`<Page>` `<View>` `<Text>` `<Image>`），易於 mirror 既有 HTML layout 的結構
- Node.js runtime 即可（純 JS），無 chromium 依賴
- 支援 `Font.register()` 載入 .ttf 處理中文
- 輸出 Buffer 直接給 nodemailer 當 attachment

**版面策略**：不嘗試共享程式碼。HTML 列印頁用 Tailwind + table，PDF 元件用 react-pdf 的 StyleSheet + View。視覺需保持高度一致（會計肉眼比對應大致相同），但 DOM 結構獨立。

### 中文字型走 Noto Sans TC

**選擇**：下載 `NotoSansTC-Regular.ttf` + `NotoSansTC-Bold.ttf` 放到 `public/fonts/`，react-pdf 在 server-side `Font.register()` 時用 `fs.readFileSync` 讀取。

**為什麼不引用 google fonts URL**：
- react-pdf server-side 需要實體檔案路徑
- 部署時 fetch URL 不穩定、會增加冷啟動時間
- 字型檔放專案內，build 一次即可

**檔案大小**：NotoSansTC Regular 約 17 MB，Bold 約 17 MB，共 ~35 MB。Vercel function 限 50 MB（壓縮後 zip）。需確認部署 size。**Migration Plan 中要驗證**。若超限，改用 subset 字型（只含繁中常用字）。

### 推進到 reimbursement 才觸發

**選擇**：觸發點放在 `advanceWorkflowStage` 之內，當 `fromStage === 'board_review' && toStage === 'reimbursement'` 時 fire-and-forget 觸發 `notifyEvent('case_payment_receipt_to_applicant', { applicationId })`。

**為什麼不放在 saveBoardReviewDraft（董事剛核准的瞬間）**：
- 董事可能反覆編輯草稿、再 confirm；多次 save 會多次寄信
- 推進階段 = 流程明確完成 board_review，是清晰的「進入核銷」事件
- 與既有 `case_entered_board_review` 事件 hook 位置一致（同一個 advance hook 內加新事件）

**每次推進都寄（依使用者決策）**：退回 board_review 再推進 → 又寄一次。Audit log 區分每次寄送（`detail.attempt_at`），會計可追蹤。

### Dispatcher 擴充

**選擇**：
- 在 `notificationDispatcher.ts` 的 `EventType` 加上 `case_payment_receipt_to_applicant`
- 該事件的 resolver 簽名仍為 `(ctx) => Promise<string[]>`，但只回 1 個 user_id（申請人）
- Dispatcher loop 不變（仍是 per-recipient × per-channel）；本事件 channels 強制只走 email（line 不送）— resolver 之後加一道 channel filter
- `sendNotificationEmail` 簽名加 optional `attachments?: { filename: string; content: Buffer; contentType: string }[]`，透傳給 nodemailer 的 `sendMail`
- 在 dispatcher 內為本事件特化邏輯：渲染範本前先呼叫 `generatePaymentReceiptPdf(applicationId)` → 拿到 Buffer → 組成 attachments 陣列傳給 send

**為什麼不另開新的 dispatcher 函式**：
- 既有 `notifyEvent` 已有完善的三層錯誤隔離 + audit 寫入；複用比另寫穩
- 本事件的「單一收件人 + 附件」差異不大到要 fork

**為什麼不擴展所有事件支援附件**：
- YAGNI；目前只此事件需要
- 未來若要泛用，再 refactor

### 申請人 email 必填的 migration

**選擇**：
- intake UI 端：`<input required>` + client-side validation
- server action 端：嚴格驗證 email 格式（regex / zod schema），缺失或格式錯回 `{ success: false, error: '...' }`
- **既有資料 migration**：不強制更新既有 NULL email 的 user rows（`users.email` schema 不加 NOT NULL，避免破壞既有資料）
- 既有沒 email 的申請人若被推進到 reimbursement → dispatcher resolver 回空陣列（或 user 的 channel 為空）→ 安靜跳過、寫 audit `failed_no_email`
- 新建立的案件保證有 email，自然消化

**為什麼不加 DB NOT NULL**：
- 既有資料會 backfill 困難（沒人知道每個申請人的 email）
- 加約束會 break 既有 update 路徑
- 改靠 server-side validation 防護新進資料即可

### 系統範本守門加入新範本

**選擇**：在 `src/lib/systemTemplates.ts` 的 `SYSTEM_TEMPLATE_NAMES` Set 加入 `'email_case_payment_receipt_to_applicant'`。`init_db.sql` seed 該範本（subject + body）。

**範本內容**（subject 由使用者指定，body 加 placeholder）：
- subject: `萬美基金會申請通過通知`
- body: 含 `{{申請人}}` `{{案號}}` `{{申請金額}}` `{{核定金額}}` 與固定文字「您的補助申請已通過審核，請列印附件之領款收據，填寫具領人資料後郵寄回基金會。」

### Audit 行為

**選擇**：
- 沿用既有 `notification.event_dispatched`（每位收件人一筆）— 本事件就是 1 筆/案件
- 額外新增 `notification.payment_receipt_sent`，detail 含 `applicationId / pdfBytes / status / errorMessage`，方便會計查 PDF 是否真的產生 + 寄出

## Risks / Trade-offs

- **[Vercel function size 限制]** 字型檔 ~35 MB 加上 @react-pdf/renderer 套件可能逼近 50 MB 上限 → Migration Plan 第 4 步要實測；若超限改用 subset 字型（從 Noto subset to 常用 5000 字約 3 MB）
- **[PDF 渲染失敗]** react-pdf 對某些 CSS 屬性支援不全，複雜 layout 可能 render 不對 → 設計時保持 layout 簡單（避免 grid、複雜 flex）；測試環境先預覽
- **[email 大小]** PDF 附件 200 KB ~ 1 MB（含字型 embed）；單封信不會超過 SMTP 上限（一般 25 MB），無風險
- **[字型授權]** Noto Sans TC 是 SIL Open Font License，可商用、可內嵌 → 安全；要在 README 提及授權
- **[既有資料無 email]** 推進到 reimbursement 時 resolver 回空 → 完全靜默；會計可能不知道為何申請人沒收到 → 在 audit log 寫 `error_message: 'applicant_email_missing'` 讓會計可查
- **[email 必填造成既有 intake flow 中斷]** 外部收件 / 內部建案 UI 改 required 可能讓承辦人卡關 → 上線前確認所有 intake 入口都已修改且 UI 顯示明確錯誤訊息
- **[退回再推進重寄]** 申請人可能收到多封信 → 接受（依決策），audit log 區分次數讓會計可解釋

## Migration Plan

1. 開發環境先 `npm install @react-pdf/renderer` + 下載 Noto Sans TC ttf 到 `public/fonts/`
2. 實作 PDF 元件 → 在開發環境用測試 server action 產生一份範例 PDF 確認版面與字型 OK
3. 實作 dispatcher 整合 → 開發環境推進案件 → 確認 email 收到 + 附件可開
4. **`npm run build` 後檢查 .next/ 與 Vercel function bundle size**（若超過 50 MB → 改 subset 字型）
5. 部署：先 `psql -f scripts/init_db.sql` seed 新範本
6. Code 部署後：開啟總開關（`notification_dispatcher_enabled='true'`，若還沒開）
7. 既有未結案案件下次推進到 reimbursement 自動觸發；既有資料無 email 者靜默跳過 + audit 記錄
8. Rollback：移除 `advanceWorkflowStage` 內的 trigger 即可；其他基礎設施（PDF lib / 範本）保留無害

## Open Questions

- 字型檔放 `public/fonts/` 還是 `src/lib/pdf/fonts/`？前者瀏覽器可載（不需要）+ 部署算靜態資產；後者更乾淨（只 server 用）。建議放 `src/lib/pdf/fonts/` 配合 `Font.register({ family, src: path.join(process.cwd(), 'src/lib/pdf/fonts/...') })`，但需驗證 Vercel build 是否打包該目錄。實作時若打包失敗則 fallback `public/fonts/`。
- email 必填修改範圍是否含「外部收件」（外部使用者填表）？預設是的，但外部使用者可能不熟操作 → 提供清楚錯誤訊息與「為什麼需要 email」說明文字
