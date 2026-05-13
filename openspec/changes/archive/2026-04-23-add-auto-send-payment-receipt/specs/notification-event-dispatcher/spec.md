## ADDED Requirements

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
