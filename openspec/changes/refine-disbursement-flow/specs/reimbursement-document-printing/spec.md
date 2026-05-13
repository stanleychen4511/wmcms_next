## MODIFIED Requirements

### Requirement: Reimbursement print panel visibility and access control

The reimbursement-stage UI SHALL render a "Document Printing" section ONLY inside the disbursement panel for rows whose `review_stage = '3'` (accountant stage). The section MUST be visible only to users whose roles include `accountant`. The `admin` role MUST NOT receive bypass visibility unless that user also holds `accountant`. The section SHALL replace the previous three independent print buttons with a checkbox list of three items — "審核意見表" (Review Opinion Form, case-level), "醫療收據" (Medical Receipt, this disbursement), "領款收據" (Payment Receipt, this disbursement) — and a single 【列印】 button.

When the accountant submits the print request, a server-side route MUST merge the selected source files into a single PDF and return it as the response body. The print server action MUST enforce role and stage access independently of UI visibility.

#### Scenario: Section hidden from non-accountant roles

- **WHEN** a user with only `case_officer`, `supervisor`, `executive`, or `admin` (without `accountant`) views the disbursement panel
- **THEN** the "Document Printing" section MUST NOT render

#### Scenario: Section visible to accountant only at stage 3

- **WHEN** a user with `accountant` role views a disbursement row at `review_stage = '3'`
- **THEN** the "Document Printing" section MUST render with three checkboxes and the 【列印】 button

#### Scenario: Section hidden at non-accountant stages

- **WHEN** a user with `accountant` role views a disbursement row at any stage other than `'3'`
- **THEN** the "Document Printing" section MUST NOT render

#### Scenario: Print with single selection

- **WHEN** an accountant ticks only "審核意見表" and clicks 【列印】
- **THEN** the response MUST be a single PDF containing only the review opinion form

#### Scenario: Print with multiple selections

- **WHEN** an accountant ticks "審核意見表", "醫療收據", and "領款收據" and clicks 【列印】
- **THEN** the response MUST be a single PDF containing the three sources merged in the displayed order

#### Scenario: Direct route access blocked for unauthorized role

- **WHEN** a `case_officer` user issues a direct request to the merge-print route
- **THEN** the route MUST return HTTP 403 and MUST NOT return any merged content

## ADDED Requirements

### Requirement: Print audit and badge

Each successful merge-print invocation MUST write an `audit_logs` row recording the operating user, timestamp, target `payment_disbursements.id`, and the list of selected document keys (`'opinion'`, `'medical'`, `'payment'`). The disbursement row MUST display a "📄 已列印" badge whenever at least one such audit log row exists; the badge MUST show the most recent print timestamp and operator name on hover.

#### Scenario: First print writes audit and shows badge

- **WHEN** an accountant prints any selection for the first time on a disbursement
- **THEN** an `audit_logs` row MUST exist for that print and the row MUST display the 已列印 badge

#### Scenario: Re-print updates timestamp shown

- **WHEN** an accountant prints again later
- **THEN** the badge MUST display the most recent print's timestamp

### Requirement: Historical receipt viewing limited to accountant stage

The disbursement panel's "view historical receipts" affordance — providing direct preview of payment and medical receipts uploaded against any past `payment_disbursements` row of the application — MUST be visible only to viewers whose roles include `accountant` AND who are viewing while the application is at status `'3'`. Other roles MAY see a read-only listing of past disbursements (amount, date, stage) but MUST NOT see file-preview controls.

#### Scenario: Accountant sees preview controls

- **WHEN** a user with `accountant` role views the disbursement panel of an application at `status = '3'`
- **THEN** each historical disbursement row MUST display a 檢視 control linked to its receipt files

#### Scenario: Non-accountant sees no preview controls

- **WHEN** a user with `case_officer`, `supervisor`, or `executive` role (without `accountant`) views the same panel
- **THEN** historical disbursement rows MUST display only summary fields and MUST NOT display preview controls
