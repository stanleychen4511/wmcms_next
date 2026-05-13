## 1. 資料庫 Schema 與設定

- [x] 1.1 於 `scripts/init_db.sql` 對 `users` 加 `ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_channels TEXT[] NOT NULL DEFAULT ARRAY['email']`，並用 `DO $$ ... IF NOT EXISTS pg_constraint ...$$` 加 CHECK：`CHECK (array_length(notification_channels, 1) IS NOT NULL AND array_length(notification_channels, 1) >= 1)`；補 COMMENT；對 pg_wmcms / pg_wmcms_demo 兩庫套用。依 design「使用者偏好：`users.notification_channels TEXT[]`」決策（取代分欄/獨立表/JSONB 等選項）（實作 spec「Per-user notification channel preference」全部 scenarios，依 design「`notification_channels TEXT[]` 的 CHECK 語法」陷阱）
- [x] 1.2 於 `scripts/init_db.sql` 與 `settingsActions.ensureDefaultSettings` 加 `notification_dispatcher_enabled` 預設 `'false'`，含 description；對兩庫 INSERT ON CONFLICT DO NOTHING（實作 spec「System dispatcher enable setting」scenario）
- [x] 1.3 於 `scripts/init_db.sql` seed 4 筆系統範本到 `notification_templates`（INSERT WHERE NOT EXISTS 確保冪等）：
  - line_case_entered_board_review (channel='line') / body 含 {{案號}}, {{申請人}}, {{申請金額}}
  - email_case_entered_board_review (channel='email') / subject「【萬美基金會】新案件待派組」/ body 同上但允許 HTML
  - line_case_assigned_to_board_group (channel='line') / body 含 {{案號}}, {{申請人}}, {{組別名稱}}
  - email_case_assigned_to_board_group (channel='email') / subject「【萬美基金會】您所屬組別有新案件待審」/ body 同上
  - 對兩庫套用（實作 spec「System notification templates seeded」之 seeded scenario）

## 2. 型別與稽核

- [x] 2.1 於 `src/app/actions/auditActions.ts` 的 `AuditAction` 聯合型別新增 `'notification.event_dispatched' | 'user.notification_channels_updated'`；移除 phase 3 舊 propose 規劃但未實作的 `'line.event_notification_sent'`（若已加入）（實作 spec「Audit action types」scenario）

## 3. 系統範本守門

- [x] 3.1 於 `src/app/actions/notificationActions.ts` 之 `deleteTemplate` 加守門：定義 `SYSTEM_TEMPLATE_NAMES = new Set(['line_case_entered_board_review', 'email_case_entered_board_review', 'line_case_assigned_to_board_group', 'email_case_assigned_to_board_group'])`；若被刪除目標的 name 在此 set → return `{ success: false, error: '系統範本不可刪除' }`（實作 spec「System notification templates seeded」之「Delete attempt rejected」scenario，依 design「範本命名與保護」）
- [x] 3.2 確認 `updateTemplate` 對系統範本仍可編輯（無守門）；簡單測試對 `line_case_entered_board_review` 改 body 應成功（實作 spec「Edit allowed」scenario）

## 4. 使用者通知偏好

- [x] 4.1 於 `src/app/actions/userActions.ts` 新增 `updateUserNotificationChannels(operatorUserId, channels: string[])`：(a) channels.length >= 1；(b) 每個值屬 `['email', 'line']`；(c) 若含 'line' 則 SELECT `users.line_user_id` 必須非 null；通過則 UPDATE users.notification_channels；寫 audit `user.notification_channels_updated` with `detail.channels`（實作 spec「Update user notification channels server action」全部 scenarios）
- [x] 4.2 於 `src/app/actions/userActions.ts` 新增 `fetchUserNotificationChannels(operatorUserId)` 回傳 `{ channels: string[], lineLinked: boolean }`，供前端 UI 渲染初始狀態與決定 LINE checkbox 是否 disabled

## 5. Dispatcher 主邏輯（新檔 notificationDispatcher.ts）

- [x] 5.1 新增 `src/app/actions/notificationDispatcher.ts`，定義 `type EventType = 'case_entered_board_review' | 'case_assigned_to_board_group'`；export `notifyEvent(eventType: EventType, context: any): Promise<void>` 主入口（實作 spec「Notification dispatcher entry point」全部 scenarios）；先讀 `notification_dispatcher_enabled`（依 design「總開關 `notification_dispatcher_enabled`」決策），'false' 直接 return（實作 spec「Disabled dispatcher returns early」scenario）
- [x] 5.2 於 `notificationDispatcher.ts` 內定義 `RESOLVERS: Record<EventType, (ctx: any) => Promise<string[]>>`：依 design「事件 hardcode vs 資料驅動」決策實作兩個 resolver：(a) `case_entered_board_review` 查 SELECT u.id FROM users u JOIN user_roles ur JOIN roles r WHERE r.code='chairman' AND u.is_active=true；(b) `case_assigned_to_board_group` 查 SELECT user_id FROM board_group_members WHERE group_id=$1（實作 spec「Event resolver registration」全部 scenarios）
- [x] 5.3 於 `notificationDispatcher.ts` 實作核心 dispatch 流程：對 resolver 結果中每位 userId → SELECT `notification_channels` + `line_user_id` + `email`；對 channels 陣列每個 channel：渲染對應範本（template name = `{channel}_{eventType}`，用 applyPlaceholders）→ 依 design「渲染失敗的容錯」失敗（範本不存在等）log audit + skip 該 channel 不拋錯；成功則呼叫對應 send 函式（'email' → sendNotificationEmail；'line' → sendLineMessage）；累計 status_per_channel；寫 audit `notification.event_dispatched` 含 detail.event_type / recipient_user_id / channels_used / status_per_channel（實作 spec「Recipient with both channels gets both」scenario）
- [x] 5.4 於 `notificationDispatcher.ts` 包三層 try/catch（依 design「dispatcher 錯誤隔離」）：channel 失敗不影響同 user 其他 channel；user 失敗不影響其他 user；整個 dispatcher 拋錯被 catch 不外溢（實作 spec「Per-channel failure does not block other channels」與「Per-recipient failure does not block other recipients」scenarios）
- [x] 5.5 於 `notificationDispatcher.ts` 為 placeholder 渲染準備 context loader：`case_entered_board_review` 載 application 案號 / 申請人姓名（解密）/ 申請金額；`case_assigned_to_board_group` 額外載 group name；組合為 `{ '案號': ..., '申請人': ..., '申請金額': ..., '組別名稱': ..., '系統連結': ... }` 給 applyPlaceholders（依 design「訊息範本內容（placeholders）」）

## 6. 觸發點整合（改寫既有 server actions）

- [x] 6.1 修改 `src/app/actions/workflowActions.ts` 之 `advanceWorkflowStage`：於事務 COMMIT 後（已有的 audit log + maybeAutoAssign 之後），若 `toStage === 'board_review'` → `void notifyEvent('case_entered_board_review', { applicationId }).catch(err => console.error('[notify]', err))`；依 design「觸發點的非阻塞實作」用 fire-and-forget（實作 spec「advanceWorkflowStage triggers event A」全部 scenarios）
- [x] 6.2 修改 `src/app/actions/boardGroupActions.ts` 之 `assignCaseToBoardGroup`：於事務 COMMIT 後（不論 first-assign / reassign），`void notifyEvent('case_assigned_to_board_group', { applicationId, groupId }).catch(...)`；reassign 路徑用新的 groupId 而非舊的（實作 spec「assignCaseToBoardGroup triggers event B」全部 scenarios 含 reassignment）

## 7. 後台 UI

- [x] 7.1 修改 `src/components/UserSettingsPage.tsx`（Phase 2 建立）新增「通知接收方式」區塊：呼叫 `fetchUserNotificationChannels` 取初始狀態；兩個 checkbox（Email、LINE）；LINE checkbox `disabled={!lineLinked}` + tooltip「請先完成 LINE 綁定」；按下「儲存」前 client-side 擋至少 1 個未勾錯誤；提交呼叫 `updateUserNotificationChannels`（實作 spec「Personal settings UI for notification channels」全部 scenarios）
- [x] 7.2 修改 `src/components/SettingsPanel.tsx`：在 SETTING_LABEL/UNIT/HINT/INPUT_TYPE 新增 `notification_dispatcher_enabled`（boolean toggle），hint「全域通知派送總開關。關閉時所有事件觸發都不會推送，但事件仍會發生（不影響業務）。建議測試完所有事件 OK 後才開啟」（沿用 Phase 2 實作的 boolean toggle）
- [x] 7.3 修改 `src/components/NotificationManager.tsx` 之「通知範本」tab：定義同樣的 SYSTEM_TEMPLATE_NAMES set；對 row 若 name 在 set 中，刪除按鈕加 `disabled` + tooltip「系統範本不可刪除」（實作 spec「NotificationManager UI shows system templates as un-deletable」scenario）

## 8. 驗證

- [x] 8.1 schema 驗證：兩庫查 `\d users` 確認 `notification_channels` 欄位 + CHECK；查 `SELECT key FROM system_settings WHERE key='notification_dispatcher_enabled'`；查 `SELECT name, channel FROM notification_templates WHERE name LIKE '%_case_%'` 應有 4 筆
- [x] 8.2 手動測試（dispatcher 關閉）：保留 `notification_dispatcher_enabled='false'`（預設）；建一案件推進到 board_review → chairman 不會收到通知；DB 也不會有新 audit `notification.event_dispatched` 列
- [x] 8.3 手動測試（dispatcher 開啟 + Email only user）：admin 把總開關打開；確認 chairman_01 的 `notification_channels='{email}'`、SMTP 設定 OK；推進案件 → chairman_01 收 Email、不收 LINE；audit 列 `channels_used=['email']`
- [x] 8.4 手動測試（雙 channel user）：另一 chairman（已綁 LINE）將自己 `notification_channels` 改為 `{email,line}`；下一次事件觸發 → 該 chairman Email + LINE 都收到、audit `channels_used=['email','line']`
- [x] 8.5 手動測試（事件 B + 派組）：建案推進到 board_review；chairman 派組到 G2；G2 成員（已綁 LINE 的）立即收到 LINE「您所屬組別有新案件待審」；重新指派到 G1 → 改 G1 成員收到（G2 不收）
- [x] 8.6 手動測試（個人設定 UI）：未綁 LINE 的 user 進個人設定 → LINE checkbox disabled + tooltip；嘗試取消所有 channel 按儲存 → 被擋；只保留 line 但未綁定 → server 回錯
- [x] 8.7 手動測試（系統範本不可刪 / 可改）：在 NotificationManager 通知範本找 `email_case_entered_board_review` → 刪除按鈕 disabled；嘗試直接呼叫 deleteTemplate → 回 `'系統範本不可刪除'`；改 body 後存 → 成功（下次 dispatcher 用新文案）
- [x] 8.8 手動測試（dispatcher 失敗不影響業務）：暫時把 LINE_CHANNEL_ACCESS_TOKEN 改錯 → 推進案件到 board_review → 案件成功推進、chairman 的 LINE 推送失敗但 audit 有記錄（status_per_channel 顯示 line='failed'）；email 仍正常送
- [x] 8.9 執行 `npm run build` 確認 TypeScript 通過、`npm run lint` 無新 error
