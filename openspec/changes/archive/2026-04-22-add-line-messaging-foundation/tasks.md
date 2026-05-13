## 1. 依賴與環境

- [x] 1.1 執行 `npm install @line/bot-sdk` 安裝官方 SDK（MIT license），確認 `package.json` 新增 `@line/bot-sdk` 於 `dependencies`（實作 spec「LINE SDK dependency」）
- [x] 1.2 於 `scripts/init_db.sql` 的 `notification_channels` seed INSERT 中，將 `'line'` 列 `is_enabled` 改為 `TRUE`（用 ON CONFLICT DO UPDATE），並對既有兩庫執行 `UPDATE notification_channels SET is_enabled = TRUE WHERE channel = 'line'`；驗證兩庫該列 is_enabled 為 TRUE。依 design「notification_channels.line 既有列的處理」決策，`config` JSONB 欄位留空不寫憑證（實作 spec「notification_channels line row enabled」scenario）

## 2. 型別與稽核

- [x] 2.1 於 `src/app/actions/auditActions.ts` 的 `AuditAction` 聯合型別新增 `'line.test_push' | 'line.webhook_received'`（實作 spec「Audit action types」scenario）

## 3. Webhook endpoint

- [x] 3.1 新增 `src/app/api/line/webhook/route.ts`（POST handler）：以 `await req.text()` 取 raw body（不可先 JSON.parse）；讀取 `process.env.LINE_CHANNEL_SECRET`，用 `@line/bot-sdk` 的 `validateSignature(rawBody, channelSecret, req.headers.get('x-line-signature'))`；驗證失敗回 `new NextResponse(null, { status: 401 })`（實作 spec「LINE webhook endpoint with signature verification」之 signature scenarios，與 design「SDK 用 `@line/bot-sdk`，不自己寫 HTTP」和「Webhook 端點路徑」）
- [x] 3.2 於驗證通過後，JSON.parse raw body 得 `events: LineEvent[]`；對每個 event 呼叫 `writeAuditLog({ action: 'line.webhook_received', targetType: 'notification', targetId: null, detail: { event_type, line_user_id, message_text?（截 200 字） } })`，body 不做業務邏輯；最後回 `new NextResponse('OK', { status: 200 })`（實作 spec「Phase 1 webhook handler is log-only」之 follow / message scenarios 與 design「事件處理：Phase 1 故意不做業務邏輯」）

## 4. Server action

- [x] 4.1 新增 `src/app/actions/lineActions.ts`，定義常數 `LINE_USER_ID_REGEX = /^U[0-9a-f]{32}$/`；新增 `sendLineMessage(lineUserId: string, text: string, operatorUserId: string)`：(a) 驗 env `LINE_CHANNEL_ACCESS_TOKEN` 存在否則回 `'LINE 憑證未設定'` 並仍寫 `notification_logs` status='failed'；(b) 驗 regex；(c) 以 `new Client({ channelAccessToken }).pushMessage(lineUserId, { type: 'text', text })` 發送；(d) 成功寫 `notification_logs` (channel='line', recipients JSON 陣列 `[{ user_id: null, name: lineUserId, email: '' }]`, subject='', body=text, template_id=NULL, status='sent')；失敗寫 `status='failed'` + `error_message`；任一結果都寫 `audit_logs` `action='line.test_push'` + `detail.line_user_id` + `detail.status`（實作 spec「sendLineMessage server action」全部 scenarios，依 design「憑證儲存：`.env.local` only，不進 DB」）

## 5. 後台 UI

- [x] 5.1 修改 `src/components/NotificationManager.tsx`：依 design「測試 UI 位置：整合進 NotificationManager」新增「LINE 測試推送」區塊卡片。顯示「LINE 憑證: 已設定 / 未設定」badge：以一個 server action `fetchLineCredentialStatus()` 回傳 `{ hasSecret, hasToken, tokenPreview: firstSixChars + '…' }`（避免將完整 token 傳到 client）；提供表單 `lineUserId` input + `text` textarea + 「發送測試」按鈕，呼叫 `sendLineMessage` 顯示成功 / 失敗 toast（實作 spec「Admin UI test push panel」全部 scenarios）
- [x] 5.2 於 `lineActions.ts` 新增 `fetchLineCredentialStatus()` server action（純讀 env，不涉及 DB；回傳 masked preview，不回傳完整 token）

## 6. 驗證

- [x] 6.1 本機測試（憑證缺失）：暫時把 `.env.local` 的 `LINE_CHANNEL_ACCESS_TOKEN` 註解 → `npm run dev` → 後台「LINE 測試推送」面板顯示「未設定」+ 按鈕 disabled；還原 env 後重啟 dev server → 顯示「已設定」
- [x] 6.2 本機測試（webhook 連通性）：啟動 `ngrok http 3000`、把 `https://xxx.ngrok.io/api/line/webhook` 貼到 LINE Developers Console 的 Webhook URL 並按「Verify」→ 應回 Success；在 DB 查 `SELECT * FROM audit_logs WHERE action='line.webhook_received' ORDER BY id DESC LIMIT 5` 看到 verify 事件
- [x] 6.3 本機測試（加好友 & 訊息）：以自己 LINE 掃官方帳號 QR code 加好友 → audit_logs 出現 `event_type='follow'` + `line_user_id=U...`；從 LINE app 傳訊息「hi」→ audit_logs 多出 `event_type='message'` + `message_text='hi'`；bot 不回應（Phase 1 預期行為）
- [x] 6.4 本機測試（push 成功）：從 audit_logs 抄出自己的 `line_user_id`；回後台「LINE 測試推送」填 userId + 「測試訊息 from 萬美系統」→ 按送出 → LINE 手機收到訊息、UI 顯示成功 toast、`notification_logs` 有一筆 `channel='line' / status='sent'`、`audit_logs` 有 `line.test_push` 一筆
- [x] 6.5 本機測試（push 錯誤）：輸入非 U 開頭的字串 → 被前端/後端擋；輸入看似合法但不存在的 `U00000000000000000000000000000000` → LINE API 回錯 → UI 顯示失敗訊息、`notification_logs` 有 `status='failed'` + `error_message` 含 LINE 錯誤描述
- [x] 6.6 執行 `npm run build` 確認 TypeScript 通過；執行 `npm run lint` 確認新增檔案無 new error
