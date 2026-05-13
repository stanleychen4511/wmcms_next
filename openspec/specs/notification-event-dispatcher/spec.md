# notification-event-dispatcher Specification

## Purpose

TBD - created by archiving change 'add-line-event-notifications'. Update Purpose after archive.

## Requirements

### Requirement: Per-user notification channel preference

The `users` table SHALL include a column `notification_channels TEXT[] NOT NULL DEFAULT ARRAY['email']` whose values SHALL be a non-empty subset of `['email', 'line']`. A CHECK constraint SHALL enforce `array_length(notification_channels, 1) IS NOT NULL AND array_length(notification_channels, 1) >= 1`.

#### Scenario: Default is email only

- **WHEN** a new user row is created without specifying `notification_channels`
- **THEN** the column SHALL contain exactly `{email}`

#### Scenario: Empty array rejected

- **WHEN** an UPDATE attempts to set `notification_channels = '{}'`
- **THEN** PostgreSQL SHALL reject the update due to the CHECK constraint

#### Scenario: Both channels accepted

- **WHEN** an UPDATE sets `notification_channels = '{email,line}'`
- **THEN** the update SHALL succeed


<!-- @trace
source: add-line-event-notifications
updated: 2026-04-22
code:
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - scripts/init_db.sql
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/auditActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - src/app/actions/userActions.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - src/App.tsx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - src/app/api/line/webhook/route.ts
  - src/components/HomePage.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/lib/systemTemplates.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/app/actions/lineActions.ts
  - package.json
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
-->

---
### Requirement: Update user notification channels server action

The system SHALL provide `updateUserNotificationChannels(operatorUserId, channels)` that validates: (a) `channels.length >= 1`; (b) every value in `channels` is one of `['email', 'line']`; (c) if `'line'` is included, `users.line_user_id` for that user SHALL be non-null. On success it UPDATEs the row and writes audit `user.notification_channels_updated` with `detail.channels`.

#### Scenario: Empty channels rejected

- **WHEN** `updateUserNotificationChannels` is called with an empty array
- **THEN** the action SHALL return `{ success: false, error: '請至少選擇一個通知方式' }`

#### Scenario: Invalid channel value rejected

- **WHEN** `channels` contains `'sms'` or any value outside `['email', 'line']`
- **THEN** the action SHALL return a failure result without modifying the row

#### Scenario: LINE without binding rejected

- **WHEN** `channels` includes `'line'` but the user has `line_user_id IS NULL`
- **THEN** the action SHALL return `{ success: false, error: '尚未綁定 LINE 帳號，請先完成綁定' }`

#### Scenario: Successful update writes audit

- **WHEN** the action succeeds
- **THEN** an audit row with `action='user.notification_channels_updated'` and `detail.channels` SHALL be written


<!-- @trace
source: add-line-event-notifications
updated: 2026-04-22
code:
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - scripts/init_db.sql
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/auditActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - src/app/actions/userActions.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - src/App.tsx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - src/app/api/line/webhook/route.ts
  - src/components/HomePage.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/lib/systemTemplates.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/app/actions/lineActions.ts
  - package.json
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
-->

---
### Requirement: Notification dispatcher entry point

The system SHALL provide `notifyEvent(eventType, context)` as the single entry point for event-driven notifications. The dispatcher SHALL:
1. Read `system_settings.notification_dispatcher_enabled`; if `'false'`, return early without sending
2. Resolve recipient user ids by calling the resolver registered for `eventType`
3. For each recipient, read `notification_channels` and dispatch via each channel's send function
4. Record results in `notification_logs` and write one audit `notification.event_dispatched` per recipient with `detail.event_type`, `detail.recipient_user_id`, `detail.channels_used`, `detail.status_per_channel`
5. NEVER throw out of the dispatcher (all errors caught and logged)

#### Scenario: Disabled dispatcher returns early

- **WHEN** `notification_dispatcher_enabled = 'false'` and `notifyEvent` is called
- **THEN** no channel send function SHALL be invoked
- **AND** no `notification_logs` row SHALL be written

#### Scenario: Recipient with both channels gets both

- **WHEN** a recipient has `notification_channels = '{email,line}'` and the dispatcher fires
- **THEN** both `sendNotificationEmail` and `sendLineMessage` SHALL be invoked for that user
- **AND** one audit row SHALL be written with `channels_used = ['email', 'line']`

#### Scenario: Per-channel failure does not block other channels

- **WHEN** a recipient's email send fails with an SMTP error
- **THEN** the LINE send for that same recipient SHALL still be attempted
- **AND** `status_per_channel` SHALL reflect both outcomes (e.g. `{ email: 'failed', line: 'sent' }`)

#### Scenario: Per-recipient failure does not block other recipients

- **WHEN** an unhandled exception occurs while processing recipient A
- **THEN** the dispatcher SHALL continue with recipients B, C, ...
- **AND** an audit row SHALL still be written for the failed recipient (with status indicating failure)


<!-- @trace
source: add-line-event-notifications
updated: 2026-04-22
code:
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - scripts/init_db.sql
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/auditActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - src/app/actions/userActions.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - src/App.tsx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - src/app/api/line/webhook/route.ts
  - src/components/HomePage.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/lib/systemTemplates.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/app/actions/lineActions.ts
  - package.json
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
-->

---
### Requirement: Event resolver registration

The system SHALL register exactly two event types in the first version:
- `case_entered_board_review` with resolver returning all user ids that have the `chairman` role
- `case_assigned_to_board_group` with resolver returning all current member user ids of the assigned board group (using `context.groupId`)

#### Scenario: Chairman resolver returns chairman ids

- **WHEN** the dispatcher resolves recipients for `case_entered_board_review`
- **THEN** the result SHALL contain all user ids with the `chairman` role
- **AND** SHALL NOT contain users without that role

#### Scenario: Group member resolver returns current members

- **WHEN** the dispatcher resolves recipients for `case_assigned_to_board_group` with `context.groupId = 5`
- **THEN** the result SHALL contain all `board_group_members.user_id` where `group_id = 5`

#### Scenario: Unknown event type rejected

- **WHEN** `notifyEvent('unknown_event', {})` is called
- **THEN** the dispatcher SHALL log an error and return without action


<!-- @trace
source: add-line-event-notifications
updated: 2026-04-22
code:
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - scripts/init_db.sql
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/auditActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - src/app/actions/userActions.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - src/App.tsx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - src/app/api/line/webhook/route.ts
  - src/components/HomePage.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/lib/systemTemplates.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/app/actions/lineActions.ts
  - package.json
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
-->

---
### Requirement: System notification templates seeded

The `notification_templates` table SHALL be seeded with four system-protected rows:
- `line_case_entered_board_review` (channel='line')
- `email_case_entered_board_review` (channel='email')
- `line_case_assigned_to_board_group` (channel='line')
- `email_case_assigned_to_board_group` (channel='email')

Each template body MAY use placeholders such as `{{案號}}`, `{{申請人}}`, `{{申請金額}}`, `{{組別名稱}}`, `{{系統連結}}` rendered by the existing `applyPlaceholders` utility.

#### Scenario: Templates seeded on init

- **WHEN** `scripts/init_db.sql` runs on a fresh database
- **THEN** all four templates SHALL exist in `notification_templates`

#### Scenario: Delete attempt rejected

- **WHEN** `deleteTemplate` is invoked for a system-protected template name
- **THEN** the action SHALL return `{ success: false, error: '系統範本不可刪除' }`
- **AND** the row SHALL remain

#### Scenario: Edit allowed

- **WHEN** an admin edits the body of `line_case_entered_board_review`
- **THEN** the change SHALL persist (system protection only blocks delete)


<!-- @trace
source: add-line-event-notifications
updated: 2026-04-22
code:
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - scripts/init_db.sql
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/auditActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - src/app/actions/userActions.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - src/App.tsx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - src/app/api/line/webhook/route.ts
  - src/components/HomePage.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/lib/systemTemplates.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/app/actions/lineActions.ts
  - package.json
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
-->

---
### Requirement: System dispatcher enable setting

The `system_settings` table SHALL include a key `notification_dispatcher_enabled` with default value `'false'`. Admins SHALL be able to toggle it via the existing settings UI.

#### Scenario: Default seeded

- **WHEN** `ensureDefaultSettings` runs on a fresh database
- **THEN** a row with `key='notification_dispatcher_enabled'` and `value='false'` SHALL exist


<!-- @trace
source: add-line-event-notifications
updated: 2026-04-22
code:
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - scripts/init_db.sql
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/auditActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - src/app/actions/userActions.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - src/App.tsx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - src/app/api/line/webhook/route.ts
  - src/components/HomePage.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/lib/systemTemplates.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/app/actions/lineActions.ts
  - package.json
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
-->

---
### Requirement: advanceWorkflowStage triggers event A

When `advanceWorkflowStage(applicationId, fromStage, toStage, ...)` succeeds AND `toStage === 'board_review'`, the action SHALL invoke `notifyEvent('case_entered_board_review', { applicationId })` AFTER the COMMIT in a non-blocking manner (fire-and-forget). Failures of the dispatcher SHALL NOT roll back the stage advance.

#### Scenario: Successful advance to board_review fires event A

- **WHEN** a case advances from `home_visit` to `board_review`
- **AND** the dispatcher is enabled
- **THEN** `notifyEvent('case_entered_board_review', { applicationId })` SHALL be invoked
- **AND** the stage advance SHALL succeed regardless of dispatcher outcome

#### Scenario: Advance to other stages does not fire event A

- **WHEN** a case advances from `admin_review` to `home_visit`
- **THEN** `notifyEvent('case_entered_board_review', ...)` SHALL NOT be invoked


<!-- @trace
source: add-line-event-notifications
updated: 2026-04-22
code:
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - scripts/init_db.sql
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/auditActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - src/app/actions/userActions.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - src/App.tsx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - src/app/api/line/webhook/route.ts
  - src/components/HomePage.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/lib/systemTemplates.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/app/actions/lineActions.ts
  - package.json
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
-->

---
### Requirement: assignCaseToBoardGroup triggers event B

When `assignCaseToBoardGroup` succeeds (whether first-assign, manual reassign, or auto), the action SHALL invoke `notifyEvent('case_assigned_to_board_group', { applicationId, groupId })` AFTER the COMMIT in a non-blocking manner.

#### Scenario: Manual assignment fires event B

- **WHEN** a chairman manually assigns a case to a group
- **THEN** `notifyEvent('case_assigned_to_board_group', { applicationId, groupId })` SHALL be invoked

#### Scenario: Auto assignment fires event B

- **WHEN** the auto-assignment path picks a group successfully
- **THEN** the same dispatcher call SHALL be invoked

#### Scenario: Reassignment fires event B again

- **WHEN** a chairman reassigns from group A to group B
- **THEN** `notifyEvent` SHALL be called with the NEW `groupId` so members of B (not A) receive the notification


<!-- @trace
source: add-line-event-notifications
updated: 2026-04-22
code:
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - scripts/init_db.sql
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/auditActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - src/app/actions/userActions.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - src/App.tsx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - src/app/api/line/webhook/route.ts
  - src/components/HomePage.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/lib/systemTemplates.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/app/actions/lineActions.ts
  - package.json
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
-->

---
### Requirement: Audit action types

The `AuditAction` union SHALL include the literals `'notification.event_dispatched'` and `'user.notification_channels_updated'`.

#### Scenario: TypeScript compilation includes literals

- **WHEN** the project builds
- **THEN** both literals SHALL appear in the union


<!-- @trace
source: add-line-event-notifications
updated: 2026-04-22
code:
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - scripts/init_db.sql
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/auditActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - src/app/actions/userActions.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - src/App.tsx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - src/app/api/line/webhook/route.ts
  - src/components/HomePage.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/lib/systemTemplates.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/app/actions/lineActions.ts
  - package.json
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
-->

---
### Requirement: Personal settings UI for notification channels

The personal settings page SHALL include a "通知接收方式" section with two checkboxes labeled `Email` and `LINE`. The LINE checkbox SHALL be disabled when the user has `line_user_id IS NULL`, with a tooltip directing the user to the LINE binding section. The submit action SHALL block submission with at least one checkbox unchecked when the user attempts to leave both unchecked.

#### Scenario: Default state reflects DB

- **WHEN** the page loads for a user with `notification_channels = '{email,line}'`
- **THEN** both checkboxes SHALL appear checked

#### Scenario: LINE checkbox disabled without binding

- **WHEN** the user has not bound a LINE account
- **THEN** the LINE checkbox SHALL be disabled
- **AND** a tooltip / inline help SHALL guide the user to bind LINE first

#### Scenario: Submit with all unchecked blocked

- **WHEN** the user unchecks both Email and LINE and clicks save
- **THEN** an inline error SHALL state "請至少選擇一個通知方式"
- **AND** the server action SHALL NOT be invoked

#### Scenario: Successful save reflects on next load

- **WHEN** the user saves `notification_channels = '{line}'` and reloads the page
- **THEN** only the LINE checkbox SHALL be checked


<!-- @trace
source: add-line-event-notifications
updated: 2026-04-22
code:
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - scripts/init_db.sql
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/auditActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - src/app/actions/userActions.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - src/App.tsx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - src/app/api/line/webhook/route.ts
  - src/components/HomePage.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/lib/systemTemplates.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/app/actions/lineActions.ts
  - package.json
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
-->

---
### Requirement: NotificationManager UI shows system templates as un-deletable

The "通知範本" tab SHALL render the delete button for system-protected templates as disabled with a tooltip "系統範本不可刪除".

#### Scenario: System template delete disabled

- **WHEN** the admin opens the templates list
- **THEN** the delete button for any of the four `*_case_entered_board_review` / `*_case_assigned_to_board_group` rows SHALL be disabled

<!-- @trace
source: add-line-event-notifications
updated: 2026-04-22
code:
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - scripts/init_db.sql
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/auditActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - src/app/actions/userActions.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - src/App.tsx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - src/app/api/line/webhook/route.ts
  - src/components/HomePage.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/lib/systemTemplates.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/app/actions/lineActions.ts
  - package.json
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
-->

---
### Requirement: Email send with attachments

The `sendNotificationEmail` server action SHALL accept an optional `attachments` parameter of shape `{ filename: string; content: Buffer; contentType: string }[]`. When provided, the array SHALL be passed through to nodemailer's `sendMail` `attachments` field unchanged. When omitted or empty, behavior SHALL be identical to the pre-existing call signature (no attachments). This parameter is OPTIONAL and backwards compatible — all existing callers MUST continue to work without modification.

#### Scenario: Backward compatible call without attachments

- **WHEN** an existing caller invokes `sendNotificationEmail(appId, recipients, subject, body, templateId, senderUserId)` without the attachments parameter
- **THEN** the call MUST behave exactly as before; no attachment MUST be attached to the email

#### Scenario: Attachment passed through to nodemailer

- **WHEN** a caller invokes `sendNotificationEmail(..., { isPendingDocReminder: false, attachments: [{ filename: 'doc.pdf', content: pdfBuffer, contentType: 'application/pdf' }] })`
- **THEN** nodemailer's `sendMail` MUST receive an `attachments` array with one entry whose `filename`, `content`, and `contentType` match the input

#### Scenario: notification_logs row records attachment count

- **WHEN** a send with N attachments succeeds
- **THEN** the `notification_logs` row inserted by this call MUST record either the attachment count or filenames in a JSON column (`subject` row may include suffix marker), so audits can detect "this email had attachments"


<!-- @trace
source: add-auto-send-payment-receipt
updated: 2026-04-23
code:
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/applicationActions.ts
  - src/app/actions/intakeActions.ts
  - src/components/NewApplicationPage.tsx
  - src/components/ReimbursementPrintPanel.tsx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/UserSettingsPage.tsx
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/lib/pdf/registerFonts.ts
  - src/app/actions/boardGroupActions.ts
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/lib/numToChinese.ts
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - src/app/print/PrintButton.tsx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/org-line-qr.png
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/api/line/webhook/route.ts
  - src/lib/caseCategory.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - src/components/HomePage.tsx
  - src/lib/rocDate.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - src/app/actions/printDocumentActions.ts
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - src/components/SettingsPanel.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/components/ExternalIntake.tsx
  - src/components/NotificationManager.tsx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/lineActions.ts
  - src/app/actions/settingsActions.ts
  - src/app/actions/userActions.ts
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - scripts/init_db.sql
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/app/actions/notificationActions.ts
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - src/app/actions/notificationDispatcher.ts
  - src/app/actions/workflowActions.ts
  - src/lib/pdf/fonts/LICENSE.md
  - package.json
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - tmp/test-pdf.ts
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - src/App.tsx
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
-->

---
### Requirement: Per-event channel filter

The dispatcher SHALL support a per-event channel restriction registered alongside the resolver. When an event has a configured channel restriction (e.g., `case_payment_receipt_to_applicant` is restricted to `['email']`), the dispatcher MUST only attempt the listed channels for that event regardless of the recipient's `notification_channels` setting. Channels NOT in the restriction list MUST NOT be attempted, MUST NOT count as `'failed'` in `status_per_channel`, and MUST NOT trigger any send call.

#### Scenario: Restricted event skips non-allowed channel

- **WHEN** event `case_payment_receipt_to_applicant` (restricted to `['email']`) dispatches to a recipient whose `notification_channels = ['email', 'line']`
- **THEN** the dispatcher MUST send only via email; the audit log entry's `channels_used` MUST equal `['email']`; no LINE push MUST be attempted

#### Scenario: Unrestricted event respects user preference

- **WHEN** an existing event such as `case_entered_board_review` (no channel restriction) dispatches to the same recipient
- **THEN** the dispatcher MUST attempt both channels per the recipient's preference (existing behavior preserved)

#### Scenario: Event registry exposes restriction

- **WHEN** internal code looks up the channel restriction for `case_payment_receipt_to_applicant`
- **THEN** it MUST return `['email']`


<!-- @trace
source: add-auto-send-payment-receipt
updated: 2026-04-23
code:
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/applicationActions.ts
  - src/app/actions/intakeActions.ts
  - src/components/NewApplicationPage.tsx
  - src/components/ReimbursementPrintPanel.tsx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/UserSettingsPage.tsx
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/lib/pdf/registerFonts.ts
  - src/app/actions/boardGroupActions.ts
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/lib/numToChinese.ts
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - src/app/print/PrintButton.tsx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/org-line-qr.png
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/api/line/webhook/route.ts
  - src/lib/caseCategory.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - src/components/HomePage.tsx
  - src/lib/rocDate.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - src/app/actions/printDocumentActions.ts
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - src/components/SettingsPanel.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/components/ExternalIntake.tsx
  - src/components/NotificationManager.tsx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/lineActions.ts
  - src/app/actions/settingsActions.ts
  - src/app/actions/userActions.ts
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - scripts/init_db.sql
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/app/actions/notificationActions.ts
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - src/app/actions/notificationDispatcher.ts
  - src/app/actions/workflowActions.ts
  - src/lib/pdf/fonts/LICENSE.md
  - package.json
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - tmp/test-pdf.ts
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - src/App.tsx
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
-->

---
### Requirement: case_payment_receipt_to_applicant event registered

The dispatcher SHALL recognize a new event type `case_payment_receipt_to_applicant`. The event SHALL be added to the `EventType` union, registered in the resolver registry (returning the applicant's user_id), and registered with channel restriction `['email']`. The event SHALL pre-render the email body using the existing template lookup (`email_case_payment_receipt_to_applicant`) and the placeholder loader extended to provide `{{核定金額}}` (sourced from `applications.approved_amount`).

#### Scenario: Event type accepted by notifyEvent

- **WHEN** code calls `notifyEvent('case_payment_receipt_to_applicant', { applicationId: '5' })`
- **THEN** the call MUST type-check; the dispatcher MUST execute the registered resolver

#### Scenario: Placeholder 核定金額 available

- **WHEN** the dispatcher renders the body for this event with a case where `approved_amount = 50000`
- **THEN** the placeholder `{{核定金額}}` MUST be substituted with `'50,000'` (or `'50000'`)

#### Scenario: Disabled dispatcher returns early for this event

- **WHEN** `notification_dispatcher_enabled = 'false'` and the event fires
- **THEN** the dispatcher MUST return without sending or generating any PDF (existing global enable rule applies)

<!-- @trace
source: add-auto-send-payment-receipt
updated: 2026-04-23
code:
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/applicationActions.ts
  - src/app/actions/intakeActions.ts
  - src/components/NewApplicationPage.tsx
  - src/components/ReimbursementPrintPanel.tsx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/UserSettingsPage.tsx
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/lib/pdf/registerFonts.ts
  - src/app/actions/boardGroupActions.ts
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/lib/numToChinese.ts
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - src/app/print/PrintButton.tsx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/org-line-qr.png
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/api/line/webhook/route.ts
  - src/lib/caseCategory.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - src/components/HomePage.tsx
  - src/lib/rocDate.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - src/app/actions/printDocumentActions.ts
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - src/components/SettingsPanel.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/components/ExternalIntake.tsx
  - src/components/NotificationManager.tsx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/lineActions.ts
  - src/app/actions/settingsActions.ts
  - src/app/actions/userActions.ts
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - scripts/init_db.sql
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/app/actions/notificationActions.ts
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - src/app/actions/notificationDispatcher.ts
  - src/app/actions/workflowActions.ts
  - src/lib/pdf/fonts/LICENSE.md
  - package.json
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - tmp/test-pdf.ts
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - src/App.tsx
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
-->