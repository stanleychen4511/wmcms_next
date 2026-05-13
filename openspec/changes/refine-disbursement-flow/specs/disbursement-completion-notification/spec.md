## ADDED Requirements

### Requirement: Completion notification template

A `notification_templates` row with key `disbursement_completed` SHALL exist with a default body referencing the application's case number, the completed disbursement's amount, and the cumulative amount. The seed MUST be idempotent (`INSERT ... ON CONFLICT DO NOTHING`).

#### Scenario: Template seeded by migration

- **WHEN** `scripts/init_db.sql` runs against a fresh or existing database
- **THEN** a `notification_templates` row with key `disbursement_completed` MUST exist after the run

### Requirement: Completion notification dispatched on executive completion

When `submitExecutiveStage` successfully transitions a disbursement from `review_stage = '4'` to `'9'`, the server action MUST dispatch the `disbursement_completed` notification event after the transaction commits. Dispatch MUST be fire-and-forget and MUST NOT roll back the stage completion if it fails. The dispatch payload MUST identify the disbursement and the application, and MUST resolve the recipient set per the next requirement.

#### Scenario: Successful completion dispatches

- **WHEN** an executive completes a disbursement
- **THEN** after commit, the dispatcher MUST be invoked once with event `disbursement_completed`

#### Scenario: Dispatch failure does not block

- **WHEN** the notification dispatcher throws an error during a successful completion
- **THEN** the disbursement MUST remain at `review_stage = '9'` and the action MUST return `{ success: true }`

### Requirement: Completion notification recipient set

The `disbursement_completed` dispatch MUST send in-app notifications to exactly the user IDs recorded on the disbursement row: `officer_user_id`, `supervisor_user_id`, `accountant_user_id`. The applicant MUST also be notified via every active channel configured in the applicant's `notification_channels` (such as Email or LINE); applicants without any active channel MUST be silently skipped. The executive who completed the disbursement MUST NOT receive a notification.

#### Scenario: Three internal recipients

- **WHEN** completion dispatches with all three internal user IDs populated
- **THEN** three in-app `notification_logs` rows MUST be created, one per internal user

#### Scenario: Applicant with email channel

- **WHEN** the applicant has an active Email notification channel
- **THEN** an Email send MUST be enqueued for the applicant in addition to internal in-app notifications

#### Scenario: Applicant without any channel

- **WHEN** the applicant has no active notification channel
- **THEN** no applicant-side delivery MUST be attempted and the dispatch MUST not raise an error
