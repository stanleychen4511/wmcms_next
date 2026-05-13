## ADDED Requirements

### Requirement: Document type scope classification

The `document_type_config` table SHALL include a `scope CHAR(1) NOT NULL DEFAULT 'C'` column where `'C'` indicates case-level (one document per application) and `'D'` indicates disbursement-level (one document per `payment_disbursements` row). Existing rows MUST default to `'C'`. The "醫療收據" (medical receipt) and "領款收據" (payment receipt) rows MUST be updated to scope `'D'`. All other existing rows MUST remain `'C'`.

#### Scenario: Existing case-level rows unchanged

- **WHEN** the migration runs against a database that already contains document type config rows
- **THEN** every existing row except 醫療收據 and 領款收據 MUST have `scope = 'C'`

#### Scenario: Receipt rows reclassified to disbursement scope

- **WHEN** the migration runs
- **THEN** the rows whose name matches "醫療收據" or "領款收據" MUST have `scope = 'D'`

### Requirement: Application document disbursement linkage

The `application_documents` table SHALL include a `disbursement_id BIGINT NULL REFERENCES payment_disbursements(id)` column. A row with `disbursement_id IS NULL` represents a case-level document. A row with non-null `disbursement_id` represents a disbursement-level document and MUST have its `document_type` resolve to a `document_type_config` row whose `scope = 'D'`.

#### Scenario: Case-level document insert

- **WHEN** `uploadApplicationDocument` is invoked for a document type whose config has `scope = 'C'`
- **THEN** the inserted row MUST have `disbursement_id IS NULL`

#### Scenario: Disbursement-level document insert

- **WHEN** `uploadApplicationDocument` is invoked with a non-null `disbursementId` argument and the document type has `scope = 'D'`
- **THEN** the inserted row MUST have `disbursement_id = <provided id>`

#### Scenario: Scope mismatch rejected

- **WHEN** the upload caller provides `disbursementId` for a document type whose `scope = 'C'`, OR omits `disbursementId` for a document type whose `scope = 'D'`
- **THEN** the server action MUST return `{ success: false, error: <message> }` and MUST NOT insert any row

### Requirement: Payment receipt is uploaded by case officer at officer stage

The payment receipt (領款收據) for each `payment_disbursements` row SHALL be uploaded by a user whose roles include `case_officer` while that disbursement's `review_stage = '1'`. Uploads from any other role or while the disbursement is in any other stage MUST be rejected by the server action.

#### Scenario: Officer uploads at stage '1'

- **WHEN** a `case_officer` uploads a payment receipt against a disbursement whose `review_stage = '1'`
- **THEN** the server action MUST insert a new `application_documents` row with the disbursement linkage and return success

#### Scenario: Non-officer rejected

- **WHEN** a user without `case_officer` role attempts to upload a payment receipt for any disbursement
- **THEN** the server action MUST return `{ success: false }` and MUST NOT insert a row

#### Scenario: Wrong stage rejected

- **WHEN** a `case_officer` attempts to upload a payment receipt against a disbursement whose `review_stage` is not `'1'`
- **THEN** the server action MUST return `{ success: false }`

### Requirement: Medical receipt is uploaded by accountant at accountant stage

The medical receipt (醫療收據) for each `payment_disbursements` row SHALL be uploaded by a user whose roles include `accountant` while that disbursement's `review_stage = '3'`. Uploads from any other role or stage MUST be rejected.

#### Scenario: Accountant uploads at stage '3'

- **WHEN** an `accountant` uploads a medical receipt against a disbursement whose `review_stage = '3'`
- **THEN** the upload MUST succeed with the row linked to the disbursement

#### Scenario: Officer cannot upload medical receipt

- **WHEN** a `case_officer` attempts to upload a medical receipt
- **THEN** the server action MUST return `{ success: false }`

### Requirement: Bankbook cover is a case-level reimbursement-phase document

The `document_type_config` table MUST contain a row with name "存摺封面影本", `scope = 'C'`, `phase = 'reimbursement'`, `is_required = true`, `allow_supplement = true`. UI for uploading this document MUST be locked until the application's `status = '3'` (reimbursement). The pending-document alert mechanism MUST treat this row identically to other case-level required documents.

#### Scenario: Upload locked before reimbursement

- **WHEN** an application has `status` of `'1'` (review in progress) and a user views the document upload UI
- **THEN** the bankbook cover upload control MUST be disabled or hidden

#### Scenario: Upload available at reimbursement

- **WHEN** an application transitions to `status = '3'`
- **THEN** the bankbook cover upload control MUST become enabled for case_officer

#### Scenario: Pending alert respects threshold

- **WHEN** an application has `status = '3'`, today minus `apply_at` is at least `system_settings.pending_doc_alert_days`, and the bankbook cover row's `status` is not `'1'`
- **THEN** the case MUST appear in `fetchPendingDocAlerts` results
