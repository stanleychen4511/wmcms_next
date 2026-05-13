## Why

Phase 1 已完成 LINE 通路：可從後台手動推送訊息給「任意 LINE userId」。但**沒有任何系統使用者跟 LINE userId 的對應關係**，所以 Phase 3（事件觸發通知，例如「通知董事長未派案」「通知董事組成員未審核」）無法知道該推給誰。

Phase 2 補上這個關鍵橋樑：**讓系統使用者把自己的 LINE 帳號綁定到 system user**。完成後 Phase 3 可以這樣寫：

```
取得需要通知的 user_id 清單 → SELECT line_user_id FROM users WHERE id = ANY(...) AND line_user_id IS NOT NULL → 對每個 line_user_id 呼叫 sendLineMessage
```

綁定流程設計成「使用者自助操作」—— 不需要 admin 介入幫忙登記 userId（那是最差體驗的方案 C）。

## What Changes

### 資料模型

- `users` 表新增 `line_user_id TEXT UNIQUE`（nullable，未綁為 NULL，UNIQUE 確保一個 LINE 帳號只能綁一個系統 user）。
- 新增 `user_line_link_codes` 表（綁定碼暫存）：
  - `user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE`（一人一碼，產新碼會覆寫舊碼）
  - `code CHAR(6) NOT NULL`（6 位數字，方便手機輸入）
  - `expires_at TIMESTAMPTZ NOT NULL`（過期時間，預設 30 分鐘）
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - 額外 INDEX `(code)` 供 webhook 查詢

### Server actions（擴充 `lineActions.ts`）

- `generateLineLinkCode(operatorUserId)`：
  - 若該 user 已綁定 LINE → 回 `{ success: false, error: '此帳號已綁定 LINE，請先解除綁定' }`
  - 產 6 位隨機數字（`crypto.randomInt(100000, 999999)`）
  - UPSERT `user_line_link_codes`（覆寫舊碼）含 `expires_at = NOW() + 30 minutes`
  - 寫 audit `line.link_code_generated`，detail 含 expires_at（**不**含 code 本身，避免外洩）
  - 回 `{ success: true, data: { code, expiresAt } }`
- `unlinkLine(operatorUserId)`：
  - SELECT 該 user 的 `line_user_id`（記錄到 audit detail，便於回溯）
  - UPDATE `users.line_user_id = NULL`
  - 寫 audit `line.account_unlinked`，detail 含 `previous_line_user_id`
- `fetchLineLinkStatus(operatorUserId)`：
  - 回該 user 的綁定狀態：`{ linked: boolean, lineUserIdSuffix: string | null, pendingCode: { code, expiresAt } | null }`
  - `lineUserIdSuffix` = 末 6 碼（隱私）；前端不應拿到完整 userId
  - `pendingCode` = 目前未消化且未過期的綁定碼

### Webhook handler 改寫

`/api/line/webhook/route.ts` 的 message event 行為從「只寫 audit」改為：

1. 不論結果，仍寫 audit `line.webhook_received`（保留 Phase 1 行為）
2. 額外處理 message event：
   - 取出 `event.source.userId`（LINE userId）與 `event.message.text`
   - SELECT `users WHERE line_user_id = $1` → 若找到 → **不處理**（Phase 3 才做業務指令；本 phase 安靜）
   - 若沒找到（=未綁定）：
     - text 是否為 6 位數字？否 → 用 reply API 回覆「此 LINE 帳號尚未綁定。請至系統「個人設定」產生綁定碼後傳給我」
     - 是 6 位數字 → SELECT `user_line_link_codes WHERE code = $1 AND expires_at > NOW()` LIMIT 1
       - 找不到 → reply「綁定碼無效或已過期，請重新產生」
       - 找到 → 事務內：UPDATE `users SET line_user_id = $lineUserId WHERE id = $codeOwner`、DELETE `user_line_link_codes WHERE user_id = $codeOwner`、reply「綁定成功！您是 [系統姓名]」、寫 audit `line.account_linked` with `system_user_id` + `line_user_id`
     - 處理 UNIQUE 衝突（該 LINE userId 已被別的 user 綁過）→ reply「此 LINE 帳號已綁定其他系統使用者」、不更新 DB

3. follow event 行為不變（仍只寫 audit），但可額外 reply 一句歡迎詞引導使用者綁定：「歡迎！請至系統「個人設定」產生 6 位綁定碼後傳給我以完成帳號連結」

### 新增 LINE Reply 能力

於 `lineActions.ts` 新增 internal helper `replyLineMessage(replyToken, text)`：用 SDK 的 `replyMessage` API（reply token 限時 1 分鐘且僅一次有效，但**不消耗 push 配額**，這對 LINE 免費方案重要）。webhook handler 直接呼叫此 helper。

### 後台 UI

- 於現有後台導覽加「個人設定」按鈕（任何登入使用者可見）。
- 新增頁面 `src/components/UserSettingsPage.tsx`：
  - 「LINE 綁定」區塊：
    - 顯示綁定狀態（已綁定 LINE 帳號末 6 碼 / 未綁定）
    - 未綁定 + 無待消化綁定碼：顯示「產生綁定碼」按鈕
    - 未綁定 + 有待消化綁定碼：顯示該碼（大字、可一鍵複製）+ 倒數計時 + 操作步驟（加 bot 為好友 → 傳此 6 碼給 bot）
    - 已綁定：顯示末 6 碼 + 「解除綁定」按鈕
  - 操作步驟區包含 bot 加好友連結（從 `system_settings.line_official_account_id` 讀取 @id，前端組成 `https://line.me/R/ti/p/@xxx`）
- `system_settings` 新增 key `line_official_account_id`（預設空，admin 在後台「系統參數設定」可填入 bot 的 @id 例如 `@123abcde`）

### AuditAction 擴充

- `AuditAction` 新增 `'line.link_code_generated' | 'line.account_linked' | 'line.account_unlinked'`

## Non-Goals (optional)

- **不**做事件觸發的自動通知（Phase 3）。
- **不**做業務指令訊息處理（例如使用者傳「我的案件」就回覆案件清單）。
- **不**做帳號連結的雙向校驗（例如綁定後系統再寫一次到 LINE 的 audience 等高級功能）。
- **不**支援多帳號綁定（一個系統 user 對一個 LINE userId）；若有需求需另設計。
- **不**做綁定碼到期 cron 清理（過期碼不回收 DB 空間，數量極少不影響；webhook 查詢時加 `expires_at > NOW()` 即可過濾）。
- **不**做 LINE Login（OIDC 登入），這是另一條技術路線。

## Capabilities

### New Capabilities

- `line-account-linking`: LINE 帳號 ↔ 系統 user 的雙向綁定能力。包含 6 碼綁定碼產生、webhook 收碼後寫入對應、解綁、後台個人設定 UI。

### Modified Capabilities

- `line-messaging-foundation`: webhook 的 message event 行為從「Phase 1 log-only」擴展為「處理綁定流程」；reply API 能力新增。

## Impact

- **Affected specs**：
  - 新增 `specs/line-account-linking/spec.md`
  - 修改 `specs/line-messaging-foundation/spec.md`：移除「Phase 1 webhook handler is log-only」嚴格限制，改為「webhook handler dispatches by binding state」
- **Affected code**：
  - `scripts/init_db.sql`：`users` 加 `line_user_id` 欄位；新增 `user_line_link_codes` 表；`system_settings` 加 `line_official_account_id` 預設；補 COMMENT
  - `src/app/actions/lineActions.ts`：擴充 `generateLineLinkCode` / `unlinkLine` / `fetchLineLinkStatus` / `replyLineMessage`
  - `src/app/actions/auditActions.ts`：`AuditAction` 追加 3 個字面值
  - `src/app/api/line/webhook/route.ts`：message event handler 改寫
  - 新增元件 `src/components/UserSettingsPage.tsx`：個人設定頁（LINE 綁定區塊）
  - `src/App.tsx`：加 `'user_settings'` view + 對應導覽按鈕（AppHeader 或 HomePage 快速功能）
  - `src/components/SettingsPanel.tsx`：暴露 `line_official_account_id` 系統設定
- **Dependencies**：無新增 npm 套件（沿用 Phase 1 安裝的 `@line/bot-sdk`）
- **資料移轉**：既有 users 全部 `line_user_id = NULL`；不需 backfill。
