## ADDED Requirements

### Requirement: Auto-send event triggered on advance to reimbursement

The `advanceWorkflowStage` server action SHALL trigger a new event `case_payment_receipt_to_applicant` whenever the advance transitions from `board_review` to `reimbursement`. The trigger SHALL be fire-and-forget (`void notifyEvent(...).catch(...)`) so failures MUST NOT roll back the stage advance. The trigger MUST fire AFTER the stage UPDATE COMMIT but adjacent to (and independent of) the existing `case_entered_board_review` trigger.

#### Scenario: Advance from board_review to reimbursement fires event

- **WHEN** `advanceWorkflowStage(appId, 'reimbursement', userId)` is called for a case currently in `board_review`
- **THEN** after the transaction commits, `notifyEvent('case_payment_receipt_to_applicant', { applicationId: appId })` MUST be invoked

#### Scenario: Other advances do NOT fire the event

- **WHEN** `advanceWorkflowStage` advances from `admin_review` to `home_visit` (or any non `board_review→reimbursement` transition)
- **THEN** the new event MUST NOT fire

#### Scenario: Notification failure does not block the advance

- **WHEN** the advance succeeds but `notifyEvent` throws an error
- **THEN** the case MUST be in `reimbursement` stage; the function MUST return `{ success: true }`

#### Scenario: Repeated advance triggers repeated send

- **WHEN** a case is retreated from `reimbursement` back to `board_review` then re-advanced to `reimbursement`
- **THEN** the event MUST fire again on each advance; each send MUST produce its own audit row

### Requirement: Single-applicant resolver

The dispatcher SHALL resolve `case_payment_receipt_to_applicant` to a list containing exactly one user_id: `applications.applicant_id` for the given application. If `applications.applicant_id` is NULL or refers to a non-existent or inactive user, the resolver MUST return an empty array (silent skip).

#### Scenario: Returns the applicant user

- **WHEN** the resolver runs for a case with `applicant_id = 14`
- **THEN** it MUST return `['14']`

#### Scenario: Inactive applicant skipped

- **WHEN** the resolver runs for a case whose applicant has `is_active = false`
- **THEN** it MUST return `[]`

### Requirement: Email-only channel for this event

For the event `case_payment_receipt_to_applicant`, the dispatcher SHALL send only via the `email` channel regardless of the recipient's `notification_channels` setting. The `line` channel MUST NOT be attempted for this event even if the applicant has `line_user_id` set and `'line'` in their channels.

#### Scenario: Email-only delivery

- **WHEN** the applicant's `notification_channels = '{email,line}'` and `line_user_id` is set
- **THEN** the dispatcher MUST send only the email; no LINE message MUST be pushed; the audit log entry's `channels_used` MUST be `['email']`

#### Scenario: Applicant without email skipped

- **WHEN** the applicant's `email` is NULL or empty
- **THEN** the dispatcher MUST NOT attempt to send; the audit log entry's `status_per_channel.email` MUST be `'skipped'` with reason `'applicant_email_missing'`

### Requirement: PDF attachment generated and attached

When dispatching `case_payment_receipt_to_applicant`, the dispatcher SHALL call `generatePaymentReceiptPdf(applicationId, systemOperatorUserId)` to obtain a PDF buffer, and pass it as an email attachment with filename `領款收據_{caseNumber}.pdf` and content type `application/pdf`. If PDF generation fails, the dispatcher SHALL log the error, write an audit entry with status `'failed'`, and MUST NOT send the email (no email-without-attachment fallback).

#### Scenario: PDF attached with case-specific filename

- **WHEN** the dispatch succeeds for application `case_number='A115001'`
- **THEN** the sent email MUST contain exactly one attachment with filename `領款收據_A115001.pdf` and contentType `application/pdf`

#### Scenario: PDF generation failure aborts send

- **WHEN** `generatePaymentReceiptPdf` throws
- **THEN** no email MUST be sent; an audit entry MUST be written with `action='notification.payment_receipt_sent'` and `detail.status='failed'` containing the error message

### Requirement: System email template seeded

`scripts/init_db.sql` SHALL idempotently seed a row in `notification_templates` with `name='email_case_payment_receipt_to_applicant'`, `channel='email'`, `status=1`, fixed subject "萬美基金會申請通過通知", and a body that includes the placeholders `{{申請人}}`, `{{案號}}`, `{{申請金額}}`, `{{核定金額}}` plus instructional text directing the applicant to print the attachment, fill in payee details, and mail it back to the foundation. The template name SHALL be added to `SYSTEM_TEMPLATE_NAMES` in `src/lib/systemTemplates.ts` so it is protected from deletion and rename via the existing system-template guard.

#### Scenario: Template present after init

- **WHEN** `scripts/init_db.sql` is executed against a fresh database
- **THEN** `SELECT name, channel, status FROM notification_templates WHERE name='email_case_payment_receipt_to_applicant'` MUST return one row with `channel='email'` and `status=1`

#### Scenario: Template protected from deletion

- **WHEN** an admin attempts `deleteTemplate(id)` on the `email_case_payment_receipt_to_applicant` row
- **THEN** the call MUST return `{ success: false, error: '系統範本不可刪除' }`

#### Scenario: Template body editable

- **WHEN** an admin updates the body of `email_case_payment_receipt_to_applicant` via `updateTemplate`
- **THEN** the call MUST succeed; the next dispatch MUST use the updated body

#### Scenario: Body placeholders rendered

- **WHEN** the dispatcher renders the body for a case with applicant `'王小明'`, `case_number='A115001'`, `apply_amount=80000`, `approved_amount=50000`
- **THEN** the rendered body MUST contain the literal substrings `'王小明'`, `'A115001'`, `'80,000'` (or `'80000'` depending on format), and `'50,000'` (or `'50000'`)

### Requirement: Audit logging for payment receipt sends

For each invocation of `case_payment_receipt_to_applicant` dispatch, the system SHALL write an audit log entry with `action='notification.payment_receipt_sent'`, `targetType='application'`, `targetId=applicationId`, and `detail` containing at least: `applicantUserId`, `recipientEmail` (or null), `pdfBytes` (or null), `status` (`'sent'` | `'failed'` | `'skipped_no_email'`), and `errorMessage` (or null). This is in addition to the existing `notification.event_dispatched` entry written by the dispatcher.

#### Scenario: Successful send writes both audits

- **WHEN** the dispatch succeeds
- **THEN** the database MUST contain two new audit rows for this case: one with `action='notification.event_dispatched'` and one with `action='notification.payment_receipt_sent'` and `detail.status='sent'`

#### Scenario: Skipped due to no email writes status_skipped audit

- **WHEN** the applicant has no email and dispatch is skipped
- **THEN** an audit row MUST be written with `action='notification.payment_receipt_sent'` and `detail.status='skipped_no_email'` and `detail.recipientEmail=null`

### Requirement: Audit action types extended

The `AuditAction` union type in `src/app/actions/auditActions.ts` SHALL include the new literal `'notification.payment_receipt_sent'`.

#### Scenario: TypeScript compilation accepts the new literal

- **WHEN** code calls `writeAuditLog({ action: 'notification.payment_receipt_sent', ... })`
- **THEN** the TypeScript compiler MUST accept it without error
