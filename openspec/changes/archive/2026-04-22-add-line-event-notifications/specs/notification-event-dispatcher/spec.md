## ADDED Requirements

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

### Requirement: System dispatcher enable setting

The `system_settings` table SHALL include a key `notification_dispatcher_enabled` with default value `'false'`. Admins SHALL be able to toggle it via the existing settings UI.

#### Scenario: Default seeded

- **WHEN** `ensureDefaultSettings` runs on a fresh database
- **THEN** a row with `key='notification_dispatcher_enabled'` and `value='false'` SHALL exist

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

### Requirement: Audit action types

The `AuditAction` union SHALL include the literals `'notification.event_dispatched'` and `'user.notification_channels_updated'`.

#### Scenario: TypeScript compilation includes literals

- **WHEN** the project builds
- **THEN** both literals SHALL appear in the union

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

### Requirement: NotificationManager UI shows system templates as un-deletable

The "通知範本" tab SHALL render the delete button for system-protected templates as disabled with a tooltip "系統範本不可刪除".

#### Scenario: System template delete disabled

- **WHEN** the admin opens the templates list
- **THEN** the delete button for any of the four `*_case_entered_board_review` / `*_case_assigned_to_board_group` rows SHALL be disabled
