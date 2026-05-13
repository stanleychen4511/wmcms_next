## Context

本專案已有 Email 通知渠道（`notification_channels.channel = 'email'`、透過 Nodemailer 發送、`notification_logs` 記錄）。LINE 整合屬於第二個通知渠道，應遵循同樣的資料模型以避免兩套系統。

LINE Messaging API 的技術特性：
- **Webhook 驗證**：LINE Platform 每次打 webhook 會附 `X-Line-Signature` header（value = HMAC-SHA256 of raw body using channel secret, base64 encoded）。驗證失敗的請求必須拒收。
- **Push Message 要求**：送訊需用 `channelAccessToken` 呼叫 `https://api.line.me/v2/bot/message/push`，target 是 LINE userId（U 開頭 33 位 hex）。
- **Webhook 時間限制**：LINE 期待 webhook 在數秒內回 200，超時會重試（可能造成重複事件）。

本 phase 只做基礎能力；Phase 2 會把 webhook 的 message handler 改為「處理綁定碼」；Phase 3 會加自動觸發邏輯。設計須為之後留彈性。

## Goals / Non-Goals

**Goals:**

- 可從 server action 推送訊息到任一 LINE userId。
- Webhook 端點能通過 LINE Verify 測試（LINE Console 的「Verify」按鈕）。
- 憑證從環境變數讀取，不寫 DB，避免雙源管理與資料外洩風險。
- 後台有可測試的 UI，方便 admin 確認通路 OK。
- 所有 push 與 webhook 事件寫 `audit_logs` + `notification_logs`（push 路徑）。

**Non-Goals:**

- 不做使用者 ↔ LINE userId 綁定（Phase 2）。
- 不做事件觸發（Phase 3）。
- 不支援 multicast / broadcast / rich menu / flex message。
- 不整合 LINE Login（OIDC 登入方式）。
- 不自己實作簽章驗證 / API 呼叫 —— 用官方 SDK 就夠。

## Decisions

### 憑證儲存：`.env.local` only，不進 DB

**選擇**：`LINE_CHANNEL_SECRET` 與 `LINE_CHANNEL_ACCESS_TOKEN` 只從 `process.env.*` 讀，DB 的 `notification_channels.config` JSONB 留空。

**Alternatives considered**：

1. *存 DB + 每次從 DB 取*：方便 admin 後台調整；但 LINE channel access token 是長期憑證（有效期數年），幾乎不會改；且憑證外洩後果嚴重，DB dump 時須注意遮罩。不值得。
2. *存 DB 加密欄位*：過度設計，.env 已是業界慣例。

Admin 如需更新 token，改 `.env` 後重啟 server 即可。

### SDK 用 `@line/bot-sdk`，不自己寫 HTTP

**選擇**：`npm install @line/bot-sdk`；webhook 簽章驗證用 `validateSignature()`；push 用 `new Client({ channelAccessToken }).pushMessage(to, messages)`。

**Alternatives considered**：

1. *純 fetch*：要自己處理 HMAC-SHA256 base64 比對、retry、rate-limit headers。沒有實質好處。

### Webhook 端點路徑

**選擇**：`/api/line/webhook`（POST）

- Next.js App Router 原生 API route，能取得 raw body（LINE 簽章需對 raw body 驗證，不能先 JSON.parse）。
- 取得 raw body 的方式：`await req.text()` 得 raw string、`JSON.parse` 前先算簽章。

### 事件處理：Phase 1 故意不做業務邏輯

**選擇**：只寫 audit log、不呼叫任何後續 action。

**理由**：
- 綁定流程（Phase 2）會使用 message event 接收綁定碼。若 Phase 1 就在 message handler 塞實作，Phase 2 改動風險大。
- Follow / Unfollow 事件 Phase 2 也會用（取得 LINE userId、處理取消綁定）。
- Phase 1 只保留「事件有收到、簽章有驗」的紀錄，代表通路通。

### 測試 UI 位置：整合進 NotificationManager

**選擇**：在 NotificationManager 頁面加「LINE 測試推送」卡片；不另開獨立頁。

**理由**：Email 管理已在這裡，LINE 同為通知渠道，集中管理語意最清楚。

### notification_channels.line 既有列的處理

既有 seed 為 `('line', FALSE, '{}')`；本 phase UPDATE `is_enabled=TRUE`。不動 `config` 欄位（留空以呼應「憑證只在 env」的決策）。

## Risks / Trade-offs

- **Webhook 事件不驗簽章可能被偽造**：Mitigation：在 handler 最開頭驗證 `X-Line-Signature`，失敗回 401。驗證用 SDK 的 `validateSignature`（內部是 timing-safe compare）。
- **Ngrok 免費版 URL 會變 → 每次重啟要更新 LINE Console**：Mitigation：文件化於 tasks；使用者可考慮付費版或 Cloudflare Tunnel reserved domain。此為開發環境 overhead，不影響正式部署。
- **Access token 可能過期或被撤銷**：Push 失敗時 `notification_logs.status='failed'` + `error_message` 記載。Mitigation：測試 UI 可快速驗證；真正的健康檢查留給 Phase 3 的監控。
- **測試 UI 可任意 push 給任意 LINE userId**：Mitigation：此功能限 admin 使用（已 gated by AdminPanel 的 isAdmin tab 顯示條件）；每次 push 寫 audit log `line.test_push` 可事後追蹤濫用。
- **Webhook 超時重試導致重複 audit log**：LINE 在 5 秒無回應會 retry；若 handler 太慢可能重複 log。Mitigation：Phase 1 handler 極簡（只寫 audit），執行時間 < 100ms，不太可能超時。
- **SDK 升級可能破壞簽章驗證介面**：Mitigation：鎖版本（`^` 允許 minor 升級，符合 SemVer 的話 API 不破）；CI build 通過即代表相容。
