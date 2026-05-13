## Why

目前系統的通知機制只有 Email（透過 Nodemailer + SMTP）。承辦人對「未派案」「未審核」「補件警示」等待辦事項只能靠登入系統查看；即時性不足，主管與董事長常錯過重要時機。

LINE 是本專案使用者日常開啟頻率最高的通訊工具。整合 LINE Messaging API 後可達到「即時推播到使用者手機」的效果，降低案件積壓風險。

本 change 是 LINE 整合的 **Phase 1 基礎設施**：只做最小可行的技術底層（SDK、webhook、push action、後台設定），**不做**使用者綁定（Phase 2）與事件自動觸發（Phase 3）。目的是讓 Phase 2/3 有穩固的地基可以建立。

## What Changes

### 依賴

- 安裝 `@line/bot-sdk`（MIT 免費，LINE 官方維護，TypeScript 原生支援）。

### 環境變數

- `.env.local` 既有已由使用者寫入 `LINE_CHANNEL_SECRET` 與 `LINE_CHANNEL_ACCESS_TOKEN`；程式碼透過 `process.env.*` 讀取。

### Webhook 端點

- 新增 Next.js App Router API route `src/app/api/line/webhook/route.ts`（POST handler）。
- 驗證 `X-Line-Signature` header（HMAC-SHA256 with channel secret）；驗證失敗直接回 401。
- 收到事件後：
  - `follow` / `unfollow` / `message`：寫 audit `line.webhook_received`，`detail` 含 event type + LINE userId（之後 Phase 2 綁定會改寫 message handler）。
  - 其他 event type：log 但不處理。
- 回應 LINE Platform 200 OK（LINE 要求 webhook 在數秒內回應）。
- 本 phase webhook 的業務邏輯**故意留空**，只做 log，確保 webhook 通路先通。

### Server action `sendLineMessage`

新檔 `src/app/actions/lineActions.ts`：
- 主要函式 `sendLineMessage(lineUserId, text, operatorUserId)`：
  - 驗證 `lineUserId` 格式（U 開頭 33 位 hex）
  - 從 env 取 access token；若 token 未設定 → 回 `{ success: false, error: 'LINE 憑證未設定' }`
  - 呼叫 LINE Push API（透過 `@line/bot-sdk` 的 `Client.pushMessage`）
  - 成功寫入 `notification_logs` (channel='line', recipients=[{user_id: null, name: lineUserId, email: ''}], subject='', body=text, template_id=null, status='sent')
  - 失敗同樣寫 `notification_logs`（status='failed', error_message=...）
  - 寫 audit `line.test_push` 含 recipient + 結果

### 後台 UI

- `NotificationManager`（既有後台通知管理頁）新增分頁或區塊「LINE 測試推送」：
  - 顯示憑證讀取狀態（✅ 已設定 / ❌ 未設定），access token 以 masked 形式顯示（前 6 碼 + `…`）
  - 測試表單：輸入 LINE userId + 文字 → 按「發送測試」→ 呼叫 `sendLineMessage` → 顯示結果 toast
  - 說明文字：如何取得 LINE userId（加好友後從 webhook log 中查，或之後 Phase 2 綁定流程）

### notification_channels 資料

- 既有 seed 已有 `('line', FALSE, '{}')` 列。本 phase 於 `ensureDefaultSettings` 等效流程中確保該列存在且將 `is_enabled = TRUE`；config JSONB 留空（實際從 env 讀，不存 DB 避免憑證雙源）。

### AuditAction 擴充

- `AuditAction` 新增 `'line.test_push'`、`'line.webhook_received'`

## Non-Goals (optional)

- **Phase 1 不做**：使用者綁定（`users.line_user_id` 欄位、綁定碼、webhook 接收綁定碼訊息並建立對應）→ 留給 Phase 2。
- **Phase 1 不做**：事件觸發的自動通知（案件進 board_review 未派 / 審核待辦）→ 留給 Phase 3。
- **Phase 1 不做**：LINE 通知範本（雖然 `notification_templates` 的 `channel='line'` 已支援，但不設計專屬 LINE 格式、也不做 flex message / rich menu）。
- 不整合 Messaging API 的其他能力（reply message、image、video、location、rich menu 等）。
- 不處理付費方案升級 / 超額訊息計費（由 LINE Official Account Manager 處理）。
- 不支援 multicast（一次發給多人）；首版只做單點 push。

## Capabilities

### New Capabilities

- `line-messaging-foundation`: LINE Messaging API 基礎整合 —— SDK 安裝、webhook 端點（含簽章驗證 + 事件 log）、單點 push server action、後台測試介面、稽核紀錄。

### Modified Capabilities

(none)

## Impact

- **Affected specs**：新增 `specs/line-messaging-foundation/spec.md`
- **Affected code**：
  - `package.json`：新增 `@line/bot-sdk` 依賴
  - `src/app/api/line/webhook/route.ts`：新檔（POST handler + 簽章驗證 + 事件 log）
  - `src/app/actions/lineActions.ts`：新檔（`sendLineMessage` + 其他 helper）
  - `src/app/actions/auditActions.ts`：`AuditAction` 追加 2 個字面值
  - `src/components/NotificationManager.tsx`：新增「LINE 測試推送」UI 區塊
  - `scripts/init_db.sql`：確保 `notification_channels` seed 的 `line` 列 `is_enabled=TRUE`（既有 row 可用 UPDATE 或 seed 的 ON CONFLICT DO UPDATE）
- **Dependencies**：新增 `@line/bot-sdk`（MIT license，每週下載 ~30k，TypeScript 原生支援）
- **環境需求**：
  - `.env.local` 含 `LINE_CHANNEL_SECRET` 與 `LINE_CHANNEL_ACCESS_TOKEN`（使用者已設定）
  - 本機開發需 ngrok 或類似 tunnel 提供 HTTPS URL 予 LINE Platform 打 webhook
  - LINE Developers Console 的 Messaging API Channel 已建立（使用者已完成）
- **資料移轉**：既有 `notification_channels` 的 `line` 列 is_enabled 改為 TRUE（UPDATE 一次即可，對兩個 DB 各一次）
