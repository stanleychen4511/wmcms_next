## REMOVED Requirements

### Requirement: Auto-send event triggered on advance to reimbursement

**Reason**: Multi-tranche disbursement makes a single auto-send tied to stage advance unsuitable. Each disbursement now requires its own receipt send, triggered manually by the case officer per disbursement (see capability `disbursement-officer-mailer`).

**Migration**: Remove the `notifyEvent('case_payment_receipt_to_applicant', ...)` call from `advanceWorkflowStage` in `src/app/actions/workflowActions.ts`. The event name `case_payment_receipt_to_applicant`, its template, channels, and dispatcher remain in use; they are now triggered by the new server action `sendDisbursementPaymentReceiptEmail` defined in `disbursement-officer-mailer`. Existing audit and `notification_logs` schema is unchanged.

#### Scenario: Advance no longer fires event automatically

- **WHEN** `advanceWorkflowStage(appId, 'reimbursement', userId)` transitions a case from `board_review` to `reimbursement`
- **THEN** `notifyEvent('case_payment_receipt_to_applicant', ...)` MUST NOT be invoked by the advance action

#### Scenario: Manual officer trigger replaces the legacy auto-fire

- **WHEN** the case officer invokes `sendDisbursementPaymentReceiptEmail` for a disbursement at `review_stage = '1'`
- **THEN** the same event `case_payment_receipt_to_applicant` MUST fire and produce a `notification_logs` row with the originating disbursement metadata

## MODIFIED Requirements

### Requirement: Audit logging for payment receipt sends

Every successful or failed dispatch of `case_payment_receipt_to_applicant` MUST produce a `notification_logs` row. Rows produced under the new manual flow MUST include the originating `payment_disbursements.id` in the log's metadata so that per-disbursement send history is recoverable.

#### Scenario: Manual send writes log with disbursement linkage

- **WHEN** `sendDisbursementPaymentReceiptEmail(disbursementId, operatorUserId)` succeeds
- **THEN** a `notification_logs` row MUST be inserted whose metadata identifies `disbursementId` and whose `last_status = 'sent'`

#### Scenario: Repeated manual sends create independent logs

- **WHEN** the manual send action is invoked twice for the same disbursement
- **THEN** two separate `notification_logs` rows MUST exist, each timestamped at its own send time
