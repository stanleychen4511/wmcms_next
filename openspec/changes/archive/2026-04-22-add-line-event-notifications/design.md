## Context

既有狀態（Phase 1+2 完成）：
- `sendLineMessage(lineUserId, text, operatorUserId)` 可推 LINE 給單一 userId
- `sendNotificationEmail(applicationId, recipients, subject, body, templateId, senderUserId, isPendingDocReminder)` 可發 Email
- `users.line_user_id` 對應系統 user ↔ LINE 帳號
- `notification_templates` 表支援 channel 區分（email/line/sms）
- `notification_logs` 統一記錄所有渠道的推送結果

**待填的缺口**：
1. 無統一 dispatcher —— 每個呼叫點各自決定用哪個 channel
2. 使用者無偏好設定 —— 無法「想用 LINE 就只用 LINE」
3. 無事件觸發 —— business action 完成後不會通知

本 phase 建立「事件 → dispatcher → per-user 偏好 → channel 分送」的完整鏈路。

## Goals / Non-Goals

**Goals:**

- `notifyEvent(eventType, context)` 單一入口，呼叫者不需知道 channel 細節
- 每位 user 自選接收 channel（至少 1 個）
- 即時觸發（business action COMMIT 後 fire-and-forget）
- 事件失敗不影響 business 事務主流程
- 完整 audit：每次 dispatch 記錄事件類型、收件人、實際使用的 channel、送達狀態

**Non-Goals:**

- 不做 per-event per-user 偏好
- 不做 cron 逾期重推
- 不支援自訂新事件（admin 不能在 UI 新增 event type）
- 不做 delay / batch / throttle（每次觸發立即送）

## Decisions

### 事件 hardcode vs 資料驅動

**選擇**：事件類型 hardcode 於 TypeScript union type + resolver function 寫在程式。

```ts
type EventType = 'case_entered_board_review' | 'case_assigned_to_board_group';
const RESOLVERS: Record<EventType, (ctx: any) => Promise<string[]>> = {
    case_entered_board_review: async () => getAllChairmanUserIds(),
    case_assigned_to_board_group: async (ctx) => getGroupMemberUserIds(ctx.groupId),
};
```

**Alternatives considered**：

1. *資料驅動（admin UI 新增事件、設 trigger/resolver）*：類似 Zapier／IFTTT，巨大工程。基金會需求量有限，過度設計。
2. *每 server action 自己塞 sendLineMessage/sendNotificationEmail*：違反單一職責，無法統一改 channel 偏好邏輯。

### 使用者偏好：`users.notification_channels TEXT[]`

**選擇**：單一陣列欄位，值域限 `['email', 'line']`，預設 `{email}`，CHECK 至少 1 個。

**Alternatives considered**：

1. *分開 `notify_email BOOLEAN` + `notify_line BOOLEAN`*：新增 channel（例如未來 SMS）要改 schema。
2. *獨立表 `user_notification_preferences(user_id, channel)`*：多一張表、查詢多一次 JOIN。對首版量級過度設計。
3. *JSONB `{ email: true, line: false }`*：key 驗證較弱。TEXT[] + CHECK 更嚴格。

TEXT[] 靈活、DB 層有 CHECK、語意清楚。

### dispatcher 錯誤隔離

三層 try/catch：
1. **per-channel**：某 user 的 email 失敗 → LINE 仍嘗試
2. **per-user**：某 user 整體失敗 → 其他 user 不受影響
3. **dispatcher 整體**：整個 dispatcher 拋錯 → 不回滾業務事務（業務 action 已 COMMIT）

觸發點寫法：
```ts
await client.query('COMMIT');
// ↓ 以下不在事務內
void notifyEvent('case_entered_board_review', { applicationId })
    .catch(err => console.error('[notify]', err));
```

`void` + `.catch` 確保 business action 不被通知失敗影響。

### 範本命名與保護

命名慣例：`{channel}_{event_type}`。識別系統範本 = `notification_templates.name` 屬 `SYSTEM_TEMPLATE_NAMES` set。

系統範本：
- `line_case_entered_board_review`
- `email_case_entered_board_review`
- `line_case_assigned_to_board_group`
- `email_case_assigned_to_board_group`

UI 刪除按鈕 disabled + tooltip；server `deleteTemplate` 檢查 name 在 set 內 → 拒絕。

### 訊息範本內容（placeholders）

**`case_entered_board_review`** context: `{ applicationId }`
placeholders：`{{案號}}`, `{{申請人}}`, `{{申請金額}}`, `{{系統連結}}`（若有 domain env）

**`case_assigned_to_board_group`** context: `{ applicationId, groupId }`
placeholders：`{{案號}}`, `{{申請人}}`, `{{組別名稱}}`, `{{系統連結}}`

Email 範本 body 可用 HTML（既有 sendNotificationEmail 已將 `\n` 轉 `<br>`）；LINE 純文字。

### 觸發點的非阻塞實作

**選擇**：`void fn().catch(...)` pattern（fire-and-forget）。

**Alternatives considered**：

1. *await 並 try/catch*：會拖慢業務 action 回應時間（LINE API 呼叫約 0.5–2 秒）。
2. *丟到隊列 (BullMQ 等)*：需額外 Redis 依賴。首版 overkill。

Next.js server actions 在 Node runtime 下 `void` 的 promise 仍會被執行（不會被 GC 掉），足夠可靠。

### 總開關 `notification_dispatcher_enabled`

預設 `false`，admin 測試完所有事件 + channel 後手動打開。理由：
- 剛部署時避免誤發一堆訊息給真實使用者
- 若未來某 channel（LINE API 或 SMTP）異常，可快速關閉整個通知系統

設計成「dispatcher 層級」開關（不是每事件獨立開關），因為首版只有 2 個事件沒必要細切。

### 渲染失敗的容錯

若某 channel 的範本不存在（例如 admin 不小心刪了 DB 範本、或 seed 沒跑）：
- dispatcher log 一筆「template missing」audit 並跳過該 channel
- 不拋 error、不 retry
- 下次事件觸發時再試（admin 修好範本自然恢復）

## Risks / Trade-offs

- **Business action 已 COMMIT 但 dispatcher 失敗**：使用者看到案件狀態更新、但沒收到通知。Mitigation：`audit_logs` 會記錄失敗，admin 可事後補寄或人工通知。首版接受此 trade-off。
- **使用者只選 LINE 但未綁定**：`updateUserNotificationChannels` 會拒絕；若 DB 端透過 SQL 直接改 → dispatcher 跳過該 channel（等同該 user 沒有有效 channel）。Mitigation：UI 擋 + server 雙重驗證。
- **短時間密集事件轟炸**：admin 連續派組 5 個案件 → 組員 LINE 收到 5 則訊息。可接受（每則都有意義）；若未來抱怨可加 batch / throttle。
- **`notification_dispatcher_enabled=false` 時事件仍發生但不通知 → 使用者抱怨沒收到**：admin 忘記開啟。Mitigation：UI hint 強提醒，audit_logs 仍會記錄「dispatcher disabled」。
- **per-channel 範本需同步編輯**：改 LINE 範本時 admin 可能忘記改 email 版本，造成不一致。Mitigation：NotificationManager UI 「事件對照」區塊並列顯示同事件的兩個範本，方便比對。
- **`notification_channels TEXT[]` 的 CHECK 語法**：PostgreSQL 支援 `CHECK (array_length(notification_channels, 1) >= 1)`，但空陣列 `{}` 時 `array_length` 回 NULL（NULL >= 1 = NULL 而非 false）→ 需要 `array_length IS NOT NULL AND array_length >= 1`。實作時須注意這個陷阱。
