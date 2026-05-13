## Why

Phase 1（基礎通路）+ Phase 2（帳號綁定）已具備「對特定 user 推 LINE」能力，但目前**沒有任何路徑會自動觸發**。使用者提出的實務情境是「動作發生時即時通知」—— 不是「逾期催促」：

- 案件從家訪階段推進到董事審選 → 需要**立即**通知董事長派案
- 董事長派組完成 → 需要**立即**通知該組成員有新案件待審

這是典型的「事件驅動 + 多 channel」通知模型，且每位使用者應該能自選接收方式（Email / LINE / 兩者）。Email 屬現場已有的管道，LINE 是 Phase 1-2 建立的新管道；本 phase 把兩者整合於同一個 dispatcher 下。

## What Changes

### 資料模型

- `users` 表加 `notification_channels TEXT[]`（預設 `'{email}'`）—— 每位使用者的偏好渠道陣列，至少含一個值；UI 驗證 + DB CHECK `array_length(notification_channels, 1) >= 1`。
- 新增 system_settings key `notification_dispatcher_enabled`（boolean，預設 `'false'`）—— 全域總開關，admin 測試完所有事件後手動打開。

### 事件定義（首版 2 個，hardcode 於程式）

```ts
type NotificationEventType = 'case_entered_board_review' | 'case_assigned_to_board_group';

// 事件 → 收件人解析 resolver（程式內寫死）
case_entered_board_review  → 所有 chairman 角色的 users
case_assigned_to_board_group → 該案件指派組別的當前全部組員
```

### 通知範本（每事件 × 每 channel 一份，共 4 份）

seed 到 `notification_templates`：
- `line_case_entered_board_review` (channel='line')
- `email_case_entered_board_review` (channel='email')
- `line_case_assigned_to_board_group` (channel='line')
- `email_case_assigned_to_board_group` (channel='email')

命名慣例：`{channel}_{event_type}`。系統範本不可刪（沿用既有守門機制）。

### 統一 dispatcher（新檔 `notificationDispatcher.ts`）

- `notifyEvent(eventType, context)`：
  1. 讀 `notification_dispatcher_enabled` 設定；`false` 直接 return（安靜失敗）
  2. 呼叫事件對應的 resolver 取得 `recipientUserIds`
  3. 對每位 user SELECT 其 `notification_channels` 偏好
  4. 對每個偏好 channel 渲染對應範本（apply placeholders）並發送
  5. 每筆結果寫 `notification_logs` + audit `notification.event_dispatched` with `detail.channels_used`
- 失敗不中斷：某 user 的 email 失敗，LINE 仍會嘗試送；某 user 失敗不影響其他 user

### 觸發點整合（改寫既有 server actions）

- `workflowActions.ts` 之 `advanceWorkflowStage`：事務 COMMIT 後，若 `toStage === 'board_review'` → 非阻塞呼叫 `notifyEvent('case_entered_board_review', { applicationId })`
- `boardGroupActions.ts` 之 `assignCaseToBoardGroup`：事務 COMMIT 後，不論 first-assign / reassign → 非阻塞呼叫 `notifyEvent('case_assigned_to_board_group', { applicationId, groupId })`

兩者都是「COMMIT 後」的 fire-and-forget，dispatcher 失敗不回滾業務事務。

### 使用者偏好 UI

- `UserSettingsPage.tsx`（Phase 2 建立）加「通知接收方式」區塊：
  - 兩個 checkbox：`Email` / `LINE`
  - 若使用者尚未綁定 LINE → LINE checkbox disabled + tooltip 引導到綁定區塊
  - 至少勾一個；若想取消全部 → UI 擋「請至少保留一個通知方式」

- 新增 server action `updateUserNotificationChannels(operatorUserId, channels)` 於 `userActions.ts`：
  - 驗證 channels.length >= 1 且每個值屬於 `['email', 'line']`
  - 驗證選 'line' 時該 user 必須已綁定 LINE（`line_user_id IS NOT NULL`）
  - UPDATE users.notification_channels，寫 audit `user.notification_channels_updated`

### AuditAction 擴充

- 新增 `'notification.event_dispatched'` —— dispatcher 每次 dispatch 完成寫一筆，`detail.event_type` + `detail.recipient_user_id` + `detail.channels_used` + `detail.status_per_channel`
- 新增 `'user.notification_channels_updated'` —— 使用者變更偏好

### NotificationManager UI

- 「通知範本」分頁顯示新增的 4 筆系統範本，刪除按鈕 disabled + tooltip
- （選擇性）新增「事件對照」小區塊，列出首版 2 個事件與對應範本 name，方便 admin 理解對應關係

## Non-Goals (optional)

- 不做 cron 逾期重推（推一次就結束；若使用者錯過就錯過）
- 不做 per-event per-user 偏好（只做全域 per-user，所有事件共用同一組 channels）
- 不支援 admin 新增新事件（事件 hardcode，新增事件屬工程變更）
- 不支援 SMS / LINE Flex Message
- 不支援訊息送達狀態回查（LINE Push 沒原生回執；只記送出成功/失敗）
- 不做 deep link 跳回系統（首版純文字）
- 不支援「延遲發送」或「批次彙總」—— 每個事件觸發即送，可能同一位 user 短時間收到多則類似訊息

## Capabilities

### New Capabilities

- `notification-event-dispatcher`: 事件驅動通知派送，整合 LINE 與 Email 兩個 channel，支援 per-user channel 偏好；事件發生時由 business action 呼叫 dispatcher 即時推送。

### Modified Capabilities

(none)

## Impact

- **Affected specs**：新增 `specs/notification-event-dispatcher/spec.md`
- **Affected code**：
  - `scripts/init_db.sql`：
    - `users` 加 `notification_channels TEXT[] NOT NULL DEFAULT ARRAY['email']` + CHECK 至少一個
    - `system_settings` 新增 `notification_dispatcher_enabled='false'`
    - `notification_templates` seed 4 筆新範本
  - `src/app/actions/settingsActions.ts`：`ensureDefaultSettings` 加新 key
  - `src/app/actions/auditActions.ts`：`AuditAction` 加 2 個字面值
  - 新檔 `src/app/actions/notificationDispatcher.ts`：`notifyEvent()` + resolver 查詢 + 範本渲染
  - `src/app/actions/workflowActions.ts`：`advanceWorkflowStage` COMMIT 後觸發 dispatcher
  - `src/app/actions/boardGroupActions.ts`：`assignCaseToBoardGroup` COMMIT 後觸發 dispatcher
  - `src/app/actions/userActions.ts`：新增 `updateUserNotificationChannels` + `fetchUserNotificationChannels`
  - `src/components/UserSettingsPage.tsx`：新增「通知接收方式」區塊 UI
  - `src/components/SettingsPanel.tsx`：暴露 `notification_dispatcher_enabled` toggle
  - `src/components/NotificationManager.tsx`：系統範本刪除守門（沿用現有模式）
- **Dependencies**：無新增 npm 套件
- **資料移轉**：既有 users 全部 `notification_channels` DEFAULT 為 `{'email'}`（保留原行為）；admin 可之後逐一或批次調整
- **部署**：**不需** Vercel Cron（移除）；dispatcher 由 business action 觸發即可
