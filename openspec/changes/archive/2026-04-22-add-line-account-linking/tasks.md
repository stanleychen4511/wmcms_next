## 1. 資料庫 Schema

- [x] 1.1 於 `scripts/init_db.sql` 對 `users` 加 `ALTER TABLE users ADD COLUMN IF NOT EXISTS line_user_id TEXT UNIQUE`，補 COMMENT；對既有兩庫透過 MCP 套用（實作 spec「Users table line_user_id column」全部 scenarios）
- [x] 1.2 於 `scripts/init_db.sql` 新增資料表 `user_line_link_codes`（user_id PK / code CHAR(6) NOT NULL / expires_at / created_at + INDEX 於 code），補 COMMENT；對兩庫套用（實作 spec「User line link codes table」全部 scenarios）
- [x] 1.3 於 `scripts/init_db.sql` 與 `settingsActions.ensureDefaultSettings` 加入 `line_official_account_id` 預設空字串；對兩庫 INSERT ON CONFLICT DO NOTHING（實作 spec「System setting for bot account id」scenario）

## 2. 型別與稽核

- [x] 2.1 於 `src/app/actions/auditActions.ts` 的 `AuditAction` 聯合型別新增 `'line.link_code_generated' | 'line.account_linked' | 'line.account_unlinked'`（實作 spec「Audit action types」scenario）

## 3. Server Actions（擴充 lineActions.ts）

- [x] 3.1 於 `src/app/actions/lineActions.ts` 新增 internal helper `replyLineMessage(replyToken, text)`：用 `messagingApi.MessagingApiClient` 的 `replyMessage` API；依 design「Reply API 失敗的容錯」失敗時 console.error 不重試（實作 spec「Reply API helper」scenario）
- [x] 3.2 新增 `generateLineLinkCode(operatorUserId)`：先 SELECT `users.line_user_id`，已綁定回錯；用 `crypto.randomInt(100000, 999999)` 產 6 碼；UPSERT `user_line_link_codes`（PK user_id 自動覆寫舊碼）`expires_at = NOW() + INTERVAL '30 minutes'`；寫 audit `line.link_code_generated` 但 detail **不含** code 值，僅含 expires_at（實作 spec「Generate line link code server action」全部 scenarios，依 design「綁定碼一人一碼（PK = user_id）vs 多碼歷史」與「綁定碼長度與字元集：6 位純數字」決策）
- [x] 3.3 新增 `unlinkLine(operatorUserId)`：SELECT 該 user 的 `line_user_id` 作 audit detail；若已為 null 直接成功 return（不寫 audit）；否則 UPDATE 設 NULL，寫 audit `line.account_unlinked` with `detail.previous_line_user_id`（實作 spec「Unlink line account server action」全部 scenarios）
- [x] 3.4 新增 `fetchLineLinkStatus(operatorUserId)`：SELECT `users.line_user_id` + `user_line_link_codes WHERE user_id = $1 AND expires_at > NOW()`；組成 `{ linked, lineUserIdSuffix: linked ? userId.slice(-6) : null, pendingCode }`；**完整 line_user_id 不傳前端**（實作 spec「Fetch line link status for personal settings UI」全部 scenarios，依 design「`line_user_id` 完整值不傳到前端」）

## 4. Webhook handler 改寫

- [x] 4.1 修改 `src/app/api/line/webhook/route.ts` 之 message event 處理（保留 audit log 行為不動），新增「依綁定狀態派送」邏輯，依 design「Webhook 收訊邏輯：先查 line_user_id，後查 link_code」流程；此修改對應 design「Spec 修改：line-messaging-foundation 的 log-only 約束」之 MODIFIED requirement：先 SELECT `users WHERE line_user_id = source.userId`；找到 → return（已綁定者沉默）；未找到再判 text 是否為 `/^\d{6}$/`：(a) 否 → 用 `replyLineMessage` 回引導訊息；(b) 是 → SELECT `user_line_link_codes WHERE code = $1 AND expires_at > NOW()`，找到則事務 UPDATE users + DELETE link_code + 寫 audit `line.account_linked`（detail.system_user_id + line_user_id）+ 取對應 user 姓名（decryptAES）回 reply「綁定成功！您是 [姓名]」；UNIQUE 衝突 catch 回「此 LINE 帳號已綁定其他系統使用者」；找不到 row 回「綁定碼無效或已過期」（實作 spec「Webhook resolves binding state on message events」全部 scenarios）
- [x] 4.2 修改 follow event 處理：保留現有 audit；額外用 `replyLineMessage` 對加好友者送一句歡迎詞「歡迎！請至系統「個人設定」產生 6 位綁定碼後傳給我以完成帳號連結」（實作 spec MODIFIED「Phase 1 webhook handler is log-only」之 follow scenario）

## 5. 前端 UI

- [x] 5.1 新增元件 `src/components/UserSettingsPage.tsx`：props `{ userId, username, onBack }`；包含「LINE 綁定」區塊；呼叫 `fetchLineLinkStatus` 取狀態；三種顯示狀態（已綁/未綁無碼/未綁有碼）依 design 邏輯切換；未綁無碼時「產生綁定碼」按鈕呼叫 `generateLineLinkCode`；未綁有碼顯示大字 6 碼 + copy button + 倒數計時 + bot 加好友連結 + 操作步驟；已綁顯示末 6 碼 + 「解除綁定」按鈕（含 confirm dialog）呼叫 `unlinkLine`；操作完成後 refetch 狀態（實作 spec「Personal settings UI for LINE binding」全部 scenarios）
- [x] 5.2 於 `src/App.tsx` 新增 `view='user_settings'` state 與 render 分支，將 `<UserSettingsPage />` 接入；於 `AppHeader` 或 `HomePage` 快速功能新增「個人設定」按鈕讓任何登入使用者可進入；從 `UserSettingsPage` 的 onBack 設 `view='home'`
- [x] 5.3 依 design「bot 加好友連結來源：`system_settings.line_official_account_id`」，於 `UserSettingsPage` 內取 bot 加好友連結：呼叫 `fetchSetting('line_official_account_id', '')` 取 `@id`，組 `https://line.me/R/ti/p/${atId}`；若 admin 尚未填 → 顯示提示「請聯絡管理員設定 LINE 官方帳號 ID」（實作 spec「Personal settings UI for LINE binding」之 add-friend link）
- [x] 5.4 於 `src/components/SettingsPanel.tsx` 暴露 `line_official_account_id` 設定（label 「LINE 官方帳號 ID」、hint「LINE bot 的 @id（例：@123abcde）；使用者個人設定頁的「加好友」連結會用此值組成」、unit 空字串）

## 6. 驗證

- [x] 6.1 schema 驗證：對 `pg_wmcms` 與 `pg_wmcms_demo` 兩庫執行 `\d users` 確認 `line_user_id` 欄位存在且 UNIQUE；`\d user_line_link_codes` 確認 PK 為 user_id；`SELECT value FROM system_settings WHERE key='line_official_account_id'` 應回空字串
- [x] 6.2 手動測試（產生綁定碼 + 完成綁定）：以 `officer_01` 登入 → 個人設定 → 「產生綁定碼」→ 顯示 6 碼；用 LINE app 傳此 6 碼給 bot → LINE 收到「綁定成功！您是 承辦一」訊息；DB 查 `SELECT line_user_id FROM users WHERE account='officer_01'` 應有值；`audit_logs` 有 `line.link_code_generated` + `line.account_linked` 各一筆
- [x] 6.3 手動測試（重複碼 / 過期碼）：產生新碼會覆蓋舊碼（用舊碼傳 bot → 回「無效或已過期」）；手動 UPDATE 該 row `expires_at = NOW() - INTERVAL '1 minute'` → 再傳碼 → 回「無效或已過期」
- [x] 6.4 手動測試（已綁定使用者）：上述 officer_01 已綁；再傳任何訊息給 bot（包括另一個 6 位數字）→ bot 完全沉默、audit 仍寫 `line.webhook_received`
- [x] 6.5 手動測試（未綁 + 非 6 碼）：用另一支 LINE 帳號加 bot → 收到歡迎詞 + 操作引導；傳「你好」→ 回引導訊息「請至系統個人設定產生綁定碼…」
- [x] 6.6 手動測試（解綁）：officer_01 個人設定按「解除綁定」→ confirm → 成功；DB 該 user `line_user_id` 應為 NULL；audit 有 `line.account_unlinked` + `detail.previous_line_user_id`；之後 officer_01 可再產新碼綁另一個或同一個 LINE 帳號
- [x] 6.7 手動測試（UNIQUE 衝突）：A 帳號已綁 LINE_X；B 帳號產新碼後用 LINE_X 同一支手機傳碼 → bot 回「此 LINE 帳號已綁定其他系統使用者」；B `users.line_user_id` 仍為 NULL
- [x] 6.8 執行 `npm run build` 確認 TypeScript 通過；執行 `npm run lint` 無新 error
