# LINE 通知 Webhook 設定指南

本文說明萬美基金會補助管理系統如何設定 LINE Messaging API webhook，讓系統可以：

- 接收使用者傳送給 LINE bot 的訊息。
- 讓使用者用 6 位數綁定碼綁定系統帳號與 LINE 帳號。
- 透過 LINE 推播系統通知。
- 在後台測試 LINE 推播是否正常。

適用對象：

- 系統管理員
- 維運人員
- 部署正式環境的人員

目前系統的 LINE webhook endpoint：

```text
POST /api/line/webhook
```

正式環境 webhook URL 格式：

```text
https://你的正式網域/api/line/webhook
```

範例：

```text
https://wmcms.example.org/api/line/webhook
```

> 注意：LINE Webhook 必須使用可公開連線的 HTTPS URL。本機 `localhost` 不能直接填到 LINE Developers Console，除非使用 ngrok、Cloudflare Tunnel 等工具建立公開 HTTPS URL。

---

## 1. 系統目前 LINE 整合架構

### 1.1 相關程式位置

| 用途 | 檔案 |
|---|---|
| LINE webhook endpoint | `src/app/api/line/webhook/route.ts` |
| LINE 推播、回覆、帳號綁定邏輯 | `src/app/actions/lineActions.ts` |
| 後台通知管理與 LINE 測試推播 UI | `src/components/NotificationManager.tsx` |
| 個人設定頁 LINE 綁定 UI | `src/components/UserSettingsPage.tsx` |
| 系統參數預設值 | `src/app/actions/settingsActions.ts` |
| DB 初始化與 LINE 欄位、通知範本 | `scripts/init_db.sql` |

### 1.2 使用到的資料表與欄位

| 資料表 / 欄位 | 用途 |
|---|---|
| `users.line_user_id` | LINE 帳號綁定後儲存 LINE userId。 |
| `user_line_link_codes` | 暫存 6 位數 LINE 綁定碼，預設 30 分鐘失效。 |
| `notification_channels` | 通知渠道設定，包含 `line`。 |
| `notification_templates` | LINE 通知範本，例如董事審核、派組、撥款完成通知。 |
| `notification_logs` | LINE 測試推播與通知紀錄。 |
| `audit_logs` | webhook 收到事件、產生綁定碼、綁定 LINE、測試推播等稽核紀錄。 |
| `system_settings.line_official_account_id` | LINE 官方帳號 ID，例如 `@123abc`，個人設定頁會用來產生加好友連結。 |
| `system_settings.notification_dispatcher_enabled` | 通知派送總開關。必須為 `true`，事件通知才會真的送出 Email / LINE。 |
| `system_settings.org_line_qr_url` | LINE 加入志工 QR code 圖片路徑。此設定與 webhook 本身無直接關係，但同屬 LINE 顯示設定。 |

---

## 2. 必要前置條件

設定前請先確認：

1. 已有 LINE Developers 帳號。
2. 已有 LINE Official Account。
3. 已建立或啟用 Messaging API channel。
4. 系統已部署到公開 HTTPS 網域。
5. 正式環境可以設定環境變數。
6. 系統資料庫已套用最新 schema，至少需包含：
   - `users.line_user_id`
   - `user_line_link_codes`
   - `notification_channels`
   - LINE 相關 `notification_templates`
   - `system_settings.line_official_account_id`

---

## 3. LINE Developers Console 設定

### 3.1 進入 Messaging API Channel

1. 打開 LINE Developers Console。
2. 選擇對應的 Provider。
3. 選擇要串接的 Messaging API channel。
4. 進入該 channel 的設定頁。

### 3.2 取得 Channel Secret

在 channel 的 Basic settings 或相關設定區找到：

```text
Channel secret
```

將此值設定到系統環境變數：

```env
LINE_CHANNEL_SECRET=你的 Channel Secret
```

用途：

- webhook 收到 LINE 平台請求時，系統會使用 `LINE_CHANNEL_SECRET` 驗證 `x-line-signature`。
- 驗證失敗時，系統會回傳 `401`，且不處理該 webhook event。

系統驗證位置：

```text
src/app/api/line/webhook/route.ts
```

### 3.3 發行 Channel Access Token

在 Messaging API 設定中找到 Channel access token 區塊，發行 long-lived token 或依 LINE Console 目前提供的方式建立 access token。

將 token 設定到系統環境變數：

```env
LINE_CHANNEL_ACCESS_TOKEN=你的 Channel Access Token
```

用途：

- webhook 收到 follow / message event 時，系統用它回覆 LINE 訊息。
- 系統後台「LINE 測試推送」用它發送 push message。
- 系統事件通知透過 LINE 推播時也會用到。

### 3.4 設定 Webhook URL

在 LINE Developers Console 的 Messaging API webhook 設定區填入：

```text
https://你的正式網域/api/line/webhook
```

範例：

```text
https://wmcms.example.org/api/line/webhook
```

請確認：

- 必須是 HTTPS。
- 不可是 localhost。
- 不可被公司防火牆、Basic Auth、IP 白名單擋住。
- URL path 必須完整包含 `/api/line/webhook`。

### 3.5 開啟 Use webhook

在 Messaging API 設定中啟用：

```text
Use webhook: Enabled
```

若未開啟，LINE 不會把使用者傳訊息、加入好友等事件送到系統。

### 3.6 驗證 Webhook URL

LINE Developers Console 通常提供 Verify 按鈕。

點 Verify 後，預期結果：

- LINE Console 顯示成功。
- 系統 endpoint 回傳 HTTP 200。
- 若系統有收到事件，`audit_logs` 可能會出現 `line.webhook_received`。

若 Verify 失敗，請看本文「常見錯誤與排查」。

---

## 4. 系統環境變數設定

### 4.1 本機開發環境

在 `.env.local` 加入：

```env
LINE_CHANNEL_SECRET=你的 Channel Secret
LINE_CHANNEL_ACCESS_TOKEN=你的 Channel Access Token
```

修改 `.env.local` 後，必須重啟 dev server。

```powershell
npm run dev
```

或依目前啟動方式重新啟動 Next.js。

### 4.2 正式環境

若部署在 Vercel：

1. 進入 Vercel 專案。
2. Settings。
3. Environment Variables。
4. 新增：

```env
LINE_CHANNEL_SECRET=你的 Channel Secret
LINE_CHANNEL_ACCESS_TOKEN=你的 Channel Access Token
```

5. 重新部署正式環境。

若部署在其他平台，請用該平台提供的環境變數設定方式。

### 4.3 不要提交憑證

請勿把以下資訊 commit 到 git：

- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `.env.local`

這些值屬於正式憑證，外洩後可能造成他人偽造 webhook 或濫發 LINE 訊息。

---

## 5. 系統後台設定

### 5.1 設定 LINE 官方帳號 ID

系統使用 `line_official_account_id` 產生個人設定頁的「加 LINE bot 為好友」連結。

設定值格式：

```text
@xxxxxx
```

例如：

```text
@wanmei
```

使用位置：

```text
src/components/UserSettingsPage.tsx
```

產生的加好友連結格式：

```text
https://line.me/R/ti/p/{@id}
```

如果此設定為空，使用者在個人設定頁會看到提示：

```text
請聯絡管理員設定 LINE 官方帳號 ID（系統設定 → line_official_account_id）
```

### 5.2 開啟通知派送總開關

系統事件通知是否真的發送，由此設定控制：

```text
notification_dispatcher_enabled
```

正式要啟用通知時，設定為：

```text
true
```

若為 `false`：

- webhook 仍可接收綁定碼。
- 後台 LINE 測試推播仍可測試憑證。
- 事件發生時不會真的派送 Email / LINE 通知。

### 5.3 確認 LINE 通知渠道啟用

資料表：

```sql
SELECT channel, is_enabled
FROM notification_channels
WHERE channel = 'line';
```

預期：

```text
line | true
```

`scripts/init_db.sql` 目前會插入並啟用 `line` channel。

---

## 6. 使用者 LINE 綁定流程

這是目前系統設計的綁定方式。

### 6.1 使用者產生綁定碼

使用者登入系統後：

1. 進入「個人設定」。
2. 在「LINE 帳號綁定」區塊點選產生綁定碼。
3. 系統產生 6 位數字綁定碼。
4. 綁定碼預設 30 分鐘失效。

相關程式：

```text
src/app/actions/lineActions.ts
generateLineLinkCode()
```

相關資料表：

```text
user_line_link_codes
```

### 6.2 使用者加入 LINE bot 好友

使用者可以透過：

- 個人設定頁的「加 LINE bot 為好友」連結。
- 或掃描官方帳號 QR code。

### 6.3 使用者在 LINE 對話傳送 6 位數綁定碼

使用者在 LINE 中傳送綁定碼後：

1. LINE 平台送 webhook 到 `/api/line/webhook`。
2. 系統驗證 `x-line-signature`。
3. 系統檢查該 LINE userId 是否已綁定。
4. 若未綁定且訊息為 6 位數，系統查詢 `user_line_link_codes`。
5. 若綁定碼有效，系統將 LINE userId 寫入 `users.line_user_id`。
6. 系統刪除該使用者的綁定碼。
7. 系統回覆 LINE 綁定結果。
8. 系統寫入 `audit_logs`，action 為 `line.account_linked`。

相關程式：

```text
src/app/api/line/webhook/route.ts
src/app/actions/lineActions.ts
consumeLinkCodeFromWebhook()
```

### 6.4 完成後勾選 LINE 通知

綁定完成後，使用者可在個人設定頁的通知接收方式勾選 LINE。

若尚未綁定 LINE，LINE 選項會不可勾選。

---

## 7. Webhook 收到事件後的處理邏輯

目前 webhook 支援下列事件：

### 7.1 message event

當使用者傳訊息給 LINE bot：

1. 系統取得 `source.userId`、文字訊息與 `replyToken`。
2. 若 `line_user_id` 已綁定系統使用者：
   - 目前不回覆。
   - 未來可擴充成查詢進度或指令功能。
3. 若尚未綁定且訊息是 6 位數：
   - 嘗試視為綁定碼。
4. 若尚未綁定且訊息不是 6 位數：
   - 回覆引導文字，請使用者到系統產生綁定碼。

### 7.2 follow event

當使用者加入 LINE bot 好友：

1. 系統收到 follow event。
2. 若有 `replyToken`，系統回覆歡迎與綁定說明。

### 7.3 其他 event

目前系統只寫入 `audit_logs`，不做業務處理。

---

## 8. 後台 LINE 測試推播

系統管理員可用「通知管理」中的「LINE 測試推送」確認 token 與 LINE userId 是否可用。

路徑：

```text
後台管理 / 通知管理 / LINE 測試推送
```

此頁會顯示：

- 是否已設定 `LINE_CHANNEL_SECRET`
- 是否已設定 `LINE_CHANNEL_ACCESS_TOKEN`
- token 前幾碼預覽，不會顯示完整 token

測試方式：

1. 先讓某個帳號完成 LINE 綁定。
2. 從 `audit_logs` 找到 `line.webhook_received`，確認該使用者的 `line_user_id`。
3. 或從資料庫查詢已綁定帳號的 `users.line_user_id`。
4. 在 LINE 測試推送輸入 LINE userId。
5. 輸入測試訊息。
6. 送出。

成功時：

- 手機 LINE 應收到訊息。
- `notification_logs` 會新增 `channel='line'` 且 `status='sent'` 的紀錄。
- `audit_logs` 會新增 `action='line.test_push'` 的紀錄。

失敗時：

- UI 會顯示錯誤。
- `notification_logs` 會記錄 `status='failed'` 與 `error_message`。
- `audit_logs` 會記錄失敗原因。

---

## 9. 驗證與排查 SQL

### 9.1 檢查 LINE channel 是否啟用

```sql
SELECT channel, is_enabled, config
FROM notification_channels
WHERE channel = 'line';
```

### 9.2 檢查 LINE 相關系統參數

```sql
SELECT key, value, description
FROM system_settings
WHERE key IN (
  'line_official_account_id',
  'notification_dispatcher_enabled',
  'org_line_qr_url'
)
ORDER BY key;
```

### 9.3 檢查最近 webhook event

```sql
SELECT id, created_at, action, detail
FROM audit_logs
WHERE action = 'line.webhook_received'
ORDER BY created_at DESC
LIMIT 20;
```

### 9.4 檢查 LINE 綁定狀態

```sql
SELECT id, account, line_user_id
FROM users
WHERE line_user_id IS NOT NULL
ORDER BY id DESC;
```

### 9.5 檢查尚未過期的綁定碼

```sql
SELECT user_id, code, expires_at, created_at
FROM user_line_link_codes
WHERE expires_at > NOW()
ORDER BY created_at DESC;
```

### 9.6 檢查 LINE 測試推播紀錄

```sql
SELECT id, created_at, channel, status, error_message, body
FROM notification_logs
WHERE channel = 'line'
ORDER BY created_at DESC
LIMIT 20;
```

---

## 10. 常見錯誤與排查

### 10.1 LINE Console Verify 失敗

可能原因：

- Webhook URL 不正確。
- 網域不是 HTTPS。
- 正式環境尚未部署。
- server 回傳 500。
- `LINE_CHANNEL_SECRET` 未設定。
- LINE Platform 打不到該 URL。

排查：

1. 確認 URL：

   ```text
   https://你的正式網域/api/line/webhook
   ```

2. 確認正式環境已設定：

   ```env
   LINE_CHANNEL_SECRET
   LINE_CHANNEL_ACCESS_TOKEN
   ```

3. 確認改完環境變數後有重新部署。
4. 查看正式環境 log 是否出現：

   ```text
   LINE channel secret not configured
   ```

5. 若有 401，通常是 signature 驗證失敗或沒有 `x-line-signature`。

### 10.2 Webhook 回 401

可能原因：

- LINE Channel Secret 填錯。
- 使用了不同 channel 的 Channel Secret。
- request body 在到達程式前被 proxy 修改。
- header `x-line-signature` 被移除。

系統目前做法：

- 先用 `req.text()` 取得 raw body。
- 再用 `@line/bot-sdk` 的 `validateSignature(rawBody, channelSecret, signature)` 驗證。

這是正確方向，請避免在驗證前先 JSON parse body。

### 10.3 Webhook 回 500

常見原因：

- `LINE_CHANNEL_SECRET` 未設定。
- 資料庫連線異常。
- 程式處理 event 時發生例外。

排查：

- 看正式環境 server log。
- 查 `audit_logs` 是否有收到 `line.webhook_received`。
- 查資料庫是否可正常連線。

### 10.4 使用者傳 6 位數綁定碼但綁定失敗

可能原因：

- 綁定碼過期。
- 綁定碼輸入錯誤。
- 使用者已綁定其他 LINE 帳號。
- 同一個 LINE userId 已被其他系統使用者綁定。
- `users.line_user_id` unique constraint 擋下重複綁定。

排查：

```sql
SELECT user_id, code, expires_at, created_at
FROM user_line_link_codes
WHERE code = '使用者輸入的六位數';
```

若查不到或 `expires_at < NOW()`，請使用者重新產生綁定碼。

### 10.5 後台 LINE 測試推播失敗

可能原因：

- `LINE_CHANNEL_ACCESS_TOKEN` 未設定。
- access token 錯誤或已失效。
- LINE userId 格式錯誤。
- 使用者尚未加官方帳號好友。
- 使用者封鎖官方帳號。

系統要求 LINE userId 格式：

```text
U + 32 位 hex
```

範例格式：

```text
U0123456789abcdef0123456789abcdef
```

排查：

```sql
SELECT id, created_at, channel, status, error_message
FROM notification_logs
WHERE channel = 'line'
ORDER BY created_at DESC
LIMIT 20;
```

### 10.6 使用者個人設定頁沒有加好友連結

原因通常是 `line_official_account_id` 未設定。

檢查：

```sql
SELECT key, value
FROM system_settings
WHERE key = 'line_official_account_id';
```

設定值需包含 `@`：

```text
@xxxxxx
```

---

## 11. 正式上線檢查表

上線前逐項確認：

- [ ] LINE Developers Console 已建立 Messaging API channel。
- [ ] 已取得 Channel Secret。
- [ ] 已發行 Channel Access Token。
- [ ] 正式環境已設定 `LINE_CHANNEL_SECRET`。
- [ ] 正式環境已設定 `LINE_CHANNEL_ACCESS_TOKEN`。
- [ ] 正式環境已重新部署。
- [ ] Webhook URL 設為 `https://正式網域/api/line/webhook`。
- [ ] LINE Developers Console 已開啟 Use webhook。
- [ ] LINE Developers Console Verify 成功。
- [ ] 系統 `line_official_account_id` 已設定。
- [ ] 系統 `notification_dispatcher_enabled` 已視需求設為 `true`。
- [ ] `notification_channels.line` 為啟用。
- [ ] 測試帳號可在個人設定產生 LINE 綁定碼。
- [ ] 手機 LINE 加 bot 好友後可完成綁定。
- [ ] 後台 LINE 測試推播成功。
- [ ] `audit_logs` 可看到 `line.webhook_received`、`line.account_linked`、`line.test_push`。
- [ ] `notification_logs` 可看到 LINE 測試推播結果。

---

## 12. 本機測試方式

若要在本機測 webhook，需要讓 LINE Platform 能打到本機。

常見方式：

- ngrok
- Cloudflare Tunnel
- 其他可提供公開 HTTPS tunnel 的工具

流程：

1. 啟動本機 dev server。

   ```powershell
   npm run dev
   ```

2. 開 tunnel 到本機 Next.js port，例如 `3000`。
3. tunnel 會提供公開 HTTPS URL，例如：

   ```text
   https://abc123.ngrok-free.app
   ```

4. LINE Developers Console webhook URL 填：

   ```text
   https://abc123.ngrok-free.app/api/line/webhook
   ```

5. `.env.local` 設定：

   ```env
   LINE_CHANNEL_SECRET=你的 Channel Secret
   LINE_CHANNEL_ACCESS_TOKEN=你的 Channel Access Token
   ```

6. 重啟 dev server。
7. 在 LINE Developers Console 點 Verify。
8. 用手機加 bot 好友並傳送綁定碼測試。

---

## 13. 安全注意事項

### 13.1 必須驗證 webhook signature

系統目前已驗證 `x-line-signature`，不要移除這段邏輯。

目的：

- 確認 webhook 真的來自 LINE Platform。
- 避免外部偽造 webhook 綁定使用者 LINE 帳號。

### 13.2 不要記錄完整 token

後台只顯示 token 前幾碼預覽，不顯示完整 token。

禁止：

- 把 `LINE_CHANNEL_ACCESS_TOKEN` 印在 log。
- 把 Channel Secret 放在前端。
- 把 `.env.local` commit。

### 13.3 LINE userId 屬於個資/識別資料

`users.line_user_id` 可識別使用者 LINE 帳號，應視為敏感資料。

注意：

- 不要在一般 UI 顯示完整 LINE userId。
- 若需查詢，限管理員或維運人員使用。
- 對外截圖或客服紀錄不要包含完整 LINE userId。

---

## 14. 相關官方文件

- LINE Messaging API overview  
  https://developers.line.biz/en/docs/messaging-api/overview/

- Build a bot  
  https://developers.line.biz/en/docs/messaging-api/building-bot/

- Receive messages webhook  
  https://developers.line.biz/en/docs/messaging-api/receiving-messages/

- Verify webhook URL  
  https://developers.line.biz/en/docs/messaging-api/verify-webhook-url/

- Verify webhook signature  
  https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/

- Send messages  
  https://developers.line.biz/en/docs/messaging-api/sending-messages/

- Get LINE user IDs  
  https://developers.line.biz/en/docs/messaging-api/getting-user-ids/

---

## 15. 快速摘要

最少要做這幾件事：

1. LINE Developers Console 建好 Messaging API channel。
2. 正式環境設定：

   ```env
   LINE_CHANNEL_SECRET=...
   LINE_CHANNEL_ACCESS_TOKEN=...
   ```

3. LINE Developers Console webhook URL 填：

   ```text
   https://正式網域/api/line/webhook
   ```

4. 開啟 Use webhook。
5. 點 Verify 確認成功。
6. 系統設定 `line_official_account_id`。
7. 使用者到個人設定產生 6 位數綁定碼。
8. 使用者加 LINE bot 好友並傳送綁定碼。
9. 後台 LINE 測試推播確認可收到訊息。
