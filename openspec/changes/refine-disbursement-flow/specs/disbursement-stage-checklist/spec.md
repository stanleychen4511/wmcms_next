## ADDED Requirements

### Requirement: Stage checklist columns on payment_disbursements

The `payment_disbursements` table SHALL include the following boolean columns, all `NOT NULL DEFAULT FALSE`:

- `officer_doc_check`
- `supervisor_doc_check`
- `accountant_medical_uploaded_check`
- `accountant_amount_match_check`
- `accountant_board_opinion_check`
- `accountant_bank_setup_check`
- `executive_final_check`

These columns persist whether each stage's checklist items have been confirmed by the operator.

#### Scenario: Default state on row creation

- **WHEN** a new `payment_disbursements` row is inserted by `createDisbursement`
- **THEN** all seven check columns MUST be `FALSE`

#### Scenario: Reject resets only later-stage checks

- **WHEN** `rejectDisbursement` moves a disbursement from stage `'3'` back to stage `'2'`
- **THEN** `accountant_medical_uploaded_check`, `accountant_amount_match_check`, `accountant_board_opinion_check`, `accountant_bank_setup_check`, `executive_final_check` MUST be reset to `FALSE`
- **AND** earlier-stage checks (`officer_doc_check`, `supervisor_doc_check`) MUST remain unchanged

### Requirement: Officer stage submission gate

`submitOfficerStage` MUST refuse to advance from stage `'1'` to `'2'` unless ALL of the following are true:
- the calling user has the `case_officer` role
- `officer_doc_check = TRUE`
- the disbursement has a payment receipt document linked (an `application_documents` row whose `disbursement_id` matches and whose document type name is "領款收據")
- the most recent `notification_logs` row for event `case_payment_receipt_to_applicant` linked to this disbursement is `last_status = 'sent'`

#### Scenario: All conditions met

- **WHEN** a case officer calls `submitOfficerStage` with `officer_doc_check = TRUE`, payment receipt scanned and email sent
- **THEN** the disbursement's `review_stage` MUST become `'2'` and `officer_user_id`, `officer_signed_at` MUST be populated

#### Scenario: Checklist not ticked

- **WHEN** `submitOfficerStage` is invoked while `officer_doc_check = FALSE`
- **THEN** the action MUST return `{ success: false, error: <reason> }` and the row MUST remain at stage `'1'`

#### Scenario: Email not sent yet

- **WHEN** `submitOfficerStage` is invoked but no successful `case_payment_receipt_to_applicant` send exists for this disbursement
- **THEN** the action MUST return `{ success: false }`

### Requirement: Supervisor stage submission gate

`submitSupervisorStage` MUST refuse to advance from stage `'2'` to `'3'` unless the calling user has `supervisor` role AND `supervisor_doc_check = TRUE`.

#### Scenario: Supervisor gates on doc check

- **WHEN** a supervisor invokes `submitSupervisorStage` while `supervisor_doc_check = FALSE`
- **THEN** the action MUST return `{ success: false }`

#### Scenario: Supervisor advance succeeds

- **WHEN** a supervisor invokes `submitSupervisorStage` while `supervisor_doc_check = TRUE`
- **THEN** the disbursement's `review_stage` MUST become `'3'` and `supervisor_user_id`, `supervisor_signed_at` MUST be populated

### Requirement: Accountant stage submission gate

`submitAccountantStage` MUST refuse to advance from stage `'3'` to `'4'` unless the calling user has `accountant` role AND ALL of `accountant_medical_uploaded_check`, `accountant_amount_match_check`, `accountant_board_opinion_check`, `accountant_bank_setup_check` are `TRUE`.

#### Scenario: Any accountant check missing

- **WHEN** an accountant invokes `submitAccountantStage` while any of the four accountant check columns is `FALSE`
- **THEN** the action MUST return `{ success: false }`

#### Scenario: All accountant checks complete

- **WHEN** an accountant invokes `submitAccountantStage` with all four accountant checks `TRUE`
- **THEN** the disbursement's `review_stage` MUST become `'4'` and `accountant_user_id`, `accountant_signed_at` MUST be populated

### Requirement: Executive stage completion gate

`submitExecutiveStage` MUST refuse to mark a disbursement complete (transition `review_stage` from `'4'` to `'9'`) unless the calling user has `executive` role AND `executive_final_check = TRUE`.

#### Scenario: Executive completes with check

- **WHEN** an executive invokes `submitExecutiveStage` while `executive_final_check = TRUE`
- **THEN** the disbursement's `review_stage` MUST become `'9'`, `executive_user_id` and `executive_signed_at` MUST be populated, and the completion notification MUST be triggered

#### Scenario: Executive missing final check

- **WHEN** an executive invokes `submitExecutiveStage` while `executive_final_check = FALSE`
- **THEN** the action MUST return `{ success: false }` and the disbursement MUST remain at stage `'4'`

### Requirement: Reject reason minimum length

A new `system_settings` row with `key = 'disbursement_reject_reason_min_chars'` SHALL exist with default integer value `10`. `rejectDisbursement` MUST require the `reason` argument to be a string whose trimmed length is at least the value of this setting; otherwise it MUST return `{ success: false }` without changing the row.

#### Scenario: Reason too short

- **WHEN** `rejectDisbursement` is called with a `reason` whose trimmed length is less than the configured minimum
- **THEN** the action MUST return `{ success: false }` and the disbursement row MUST be unchanged

#### Scenario: Reason meets minimum

- **WHEN** `rejectDisbursement` is called with a `reason` whose trimmed length is at least the configured minimum
- **THEN** the action MUST proceed and persist the reason in `rejected_reason`

### Requirement: UI submit button disabled until checklist complete

The disbursement panel UI MUST disable the stage's submit/complete button while any required checklist boolean for the operator's current stage is `FALSE`. Disabled buttons MUST present a tooltip naming the missing item.

#### Scenario: Officer button disabled

- **WHEN** a case officer views their stage `'1'` row with `officer_doc_check = FALSE`
- **THEN** the 【送出】 button MUST be disabled

#### Scenario: Officer button enabled when checklist complete

- **WHEN** the case officer ticks the checklist (transitioning `officer_doc_check` to `TRUE`), the payment receipt is uploaded, and the receipt email has been sent successfully
- **THEN** the 【送出】 button MUST become enabled
