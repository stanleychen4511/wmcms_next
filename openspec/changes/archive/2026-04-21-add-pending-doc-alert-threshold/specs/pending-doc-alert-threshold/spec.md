## ADDED Requirements

### Requirement: Configurable pending-doc notification threshold

The system SHALL provide a configurable threshold (`pending_doc_notification_threshold` in `system_settings`) that defines the number of pending-document reminder notifications after which a case is flagged for case-officer attention. The default value SHALL be `3`. Administrators SHALL be able to update this value through the existing settings panel.

#### Scenario: Default threshold seeded on database initialization

- **WHEN** `ensureDefaultSettings` runs against a fresh database
- **THEN** `system_settings` SHALL contain a row with key `pending_doc_notification_threshold` and value `'3'`

#### Scenario: Administrator updates threshold

- **WHEN** an administrator sets `pending_doc_notification_threshold` to `'5'` via the settings panel
- **THEN** subsequent threshold checks SHALL treat 5 as the trigger count
- **AND** the change SHALL be persisted in `system_settings`

### Requirement: Notification flag for pending-doc reminders

The system SHALL provide a boolean column `is_pending_doc_reminder` on `notification_logs` (default `FALSE`) and SHALL allow `sendNotificationEmail` callers to mark a notification as a pending-document reminder. Only notifications with `status = 'sent'` AND `is_pending_doc_reminder = TRUE` SHALL be counted toward the threshold.

#### Scenario: Sender marks email as pending-doc reminder

- **WHEN** a case officer sends an email with the "pending-doc reminder" checkbox enabled
- **THEN** the resulting `notification_logs` row SHALL have `is_pending_doc_reminder = TRUE`

#### Scenario: Failed sends are not counted

- **WHEN** an email send fails (`notification_logs.status = 'failed'`) even with the reminder flag set
- **THEN** the row SHALL NOT contribute to the per-case reminder count

#### Scenario: Default checkbox state for cases with missing documents

- **WHEN** the case-officer opens `SendNotificationModal` for a case currently flagged by `fetchPendingDocAlerts`
- **THEN** the "pending-doc reminder" checkbox SHALL be pre-checked
- **AND** the officer SHALL be able to uncheck it before sending

#### Scenario: Default checkbox state for cases without missing documents

- **WHEN** the case-officer opens `SendNotificationModal` for a case NOT flagged by `fetchPendingDocAlerts`
- **THEN** the "pending-doc reminder" checkbox SHALL default to unchecked

### Requirement: Threshold-reached query for case officers

The system SHALL expose `fetchPendingDocThresholdAlerts(officerId)` returning all non-closed cases assigned to that officer whose pending-doc reminder count is greater than or equal to the configured threshold. Each result SHALL include application id, case number, applicant name (decrypted), reminder count, last reminder timestamp, and missing-doc count.

#### Scenario: Case at threshold is returned

- **WHEN** an officer's case has 3 successfully sent reminders and the threshold is 3
- **AND** the case status is not `'2'` or `'4'`
- **THEN** `fetchPendingDocThresholdAlerts` SHALL return that case

#### Scenario: Closed case is excluded

- **WHEN** a case has 5 reminders but `applications.status = '2'` (rejected) or `'4'` (settled)
- **THEN** the case SHALL NOT be returned

#### Scenario: Case below threshold is excluded

- **WHEN** a case has 2 reminders and the threshold is 3
- **THEN** the case SHALL NOT be returned

#### Scenario: Threshold change reflected immediately

- **WHEN** the administrator lowers the threshold from 3 to 2
- **AND** an officer subsequently calls `fetchPendingDocThresholdAlerts`
- **THEN** cases with reminder count `>= 2` SHALL be returned without any data migration

### Requirement: Visual surfacing of threshold-reached cases

The system SHALL surface threshold-reached cases to the responsible case officer in three locations: the home page, the case-list page, and the case-detail page.

#### Scenario: Home page shows count and list

- **WHEN** an officer with at least one threshold-reached case loads the home page
- **THEN** a "達補件提醒門檻案件" section SHALL be visible with a red badge showing the count
- **AND** the section SHALL list each affected case with a link to its detail page

#### Scenario: Case list filter and badge

- **WHEN** an officer activates the "已達補件提醒門檻" filter on the case list page
- **THEN** only threshold-reached cases SHALL be shown
- **AND** each row SHALL display an orange badge "已提醒 N 次"

#### Scenario: Detail page reminder counter

- **WHEN** an officer opens any non-closed case
- **THEN** the detail page SHALL display "未補件提醒已發送 N / M 次" where N is the current count and M is the configured threshold

### Requirement: Reject-and-close suggestion banner

When a case has reached the reminder threshold and is still open, the system SHALL display a prominent suggestion on the case-detail page recommending closure with status `'2'` (審核未通過). The system SHALL provide a one-click action that opens a confirmation modal requiring the officer to enter a closing reason of at least 5 characters before invoking `closeCase`.

#### Scenario: Banner appears for threshold-reached open case

- **WHEN** the officer opens a case with reminder count `>= threshold` and `applications.status NOT IN ('2','4')`
- **THEN** a red banner SHALL appear at the top of the detail page with the text "建議以不通過結案" and a button labeled "立即結案"

#### Scenario: Reason is required

- **WHEN** the officer clicks "立即結案" and submits the modal with a reason shorter than 5 characters
- **THEN** the system SHALL reject the submission and display an inline validation error

#### Scenario: Successful rejection close

- **WHEN** the officer submits a valid reason
- **THEN** `closeCase(applicationId, '2', reason)` SHALL be invoked
- **AND** an `audit_logs` entry with action `pending_doc.threshold_close` SHALL be written, containing `reminder_count`, `reason`, and `last_reminder_at` in `detail`

#### Scenario: Banner hidden after close

- **WHEN** the case is successfully closed via the banner action
- **THEN** the banner SHALL NOT be shown on subsequent visits to the detail page
- **AND** the case SHALL NOT appear in `fetchPendingDocThresholdAlerts` results

### Requirement: Audit trail for reminder marking and threshold close

The system SHALL include `pending_doc_reminder: true` in the `detail` payload of the existing `notification.send` audit entry whenever a notification is sent with `is_pending_doc_reminder = TRUE`, and SHALL register a new audit action `pending_doc.threshold_close` in the `AuditAction` union for use by the reject-and-close action.

#### Scenario: Notification audit includes reminder flag

- **WHEN** an email is sent with the reminder flag set
- **THEN** the `audit_logs.detail` JSON SHALL contain `"pending_doc_reminder": true`

#### Scenario: AuditAction union includes new action

- **WHEN** TypeScript compilation runs
- **THEN** `AuditAction` in `src/app/actions/auditActions.ts` SHALL include the literal `'pending_doc.threshold_close'`
