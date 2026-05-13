## ADDED Requirements

### Requirement: Officer-triggered receipt generation

A new server action `generateDisbursementPaymentReceipt(disbursementId, operatorUserId)` SHALL produce a PDF payment receipt for the given disbursement using the existing `template_files` payment-receipt template, populated with the applicant name, the disbursement's `amount`, and the current date. The action MUST be permitted only when the operator has `case_officer` role AND the disbursement's `review_stage = '1'`. Upon success the action MUST return the generated file storage path or signed URL.

#### Scenario: Officer generates at stage 1

- **WHEN** a case officer invokes `generateDisbursementPaymentReceipt` for a disbursement at `review_stage = '1'`
- **THEN** the action MUST produce a PDF and return its access path

#### Scenario: Non-officer rejected

- **WHEN** a user without `case_officer` role invokes `generateDisbursementPaymentReceipt`
- **THEN** the action MUST return `{ success: false }`

#### Scenario: Wrong stage rejected

- **WHEN** a case officer invokes the action while the disbursement is at any stage other than `'1'`
- **THEN** the action MUST return `{ success: false }`

### Requirement: Officer-triggered receipt preview

The disbursement panel UI MUST render a 【檢視】 button on each disbursement row at stage `'1'` for the case officer that opens `SecureFilePreviewModal` against the most recently generated receipt PDF. The button MUST be disabled until at least one receipt has been generated for that disbursement.

#### Scenario: Preview after generation

- **WHEN** a case officer has invoked `generateDisbursementPaymentReceipt` and clicks 【檢視】
- **THEN** the modal MUST render the generated PDF inline without download

#### Scenario: Preview disabled before generation

- **WHEN** no receipt has been generated yet for the disbursement
- **THEN** 【檢視】 MUST be disabled

### Requirement: Officer-triggered receipt email

A new server action `sendDisbursementPaymentReceiptEmail(disbursementId, operatorUserId)` SHALL dispatch the existing `case_payment_receipt_to_applicant` notification event for the given disbursement, attaching the most recently generated receipt PDF. The action MUST be permitted only when the operator has `case_officer` role, the disbursement is at `review_stage = '1'`, and a receipt PDF has previously been generated. Each invocation MUST create its own `notification_logs` row recording the disbursement linkage.

#### Scenario: Officer sends email successfully

- **WHEN** a case officer invokes `sendDisbursementPaymentReceiptEmail` after generating a receipt
- **THEN** the notification dispatcher MUST be invoked with the receipt PDF as attachment and a `notification_logs` row MUST be inserted with `last_status = 'sent'`

#### Scenario: Send without prior generation

- **WHEN** the action is invoked without any previously generated receipt PDF for the disbursement
- **THEN** the action MUST return `{ success: false }` and MUST NOT enqueue any notification

#### Scenario: Resend on retry

- **WHEN** a case officer invokes the action twice for the same disbursement
- **THEN** each invocation MUST create a separate `notification_logs` row

### Requirement: Disbursement row badges

Each disbursement row at stage `'1'` MUST display three badges reflecting state:

- 已產生 — visible when at least one receipt PDF has been generated for the disbursement
- 已寄送 — visible when the latest `notification_logs` row for `case_payment_receipt_to_applicant` linked to this disbursement has `last_status = 'sent'`
- 紙本掃描完成 — visible when an `application_documents` row exists with `disbursement_id` matching and document type "領款收據"

#### Scenario: Newly created disbursement

- **WHEN** a disbursement has just been created and no receipt generated yet
- **THEN** none of the three badges MUST display

#### Scenario: Generated only

- **WHEN** the receipt has been generated but no email sent and no scan uploaded
- **THEN** only 已產生 MUST display

#### Scenario: Full happy path

- **WHEN** receipt generated, email successfully sent, and paper scan uploaded
- **THEN** all three badges MUST display
