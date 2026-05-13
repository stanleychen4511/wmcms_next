## ADDED Requirements

### Requirement: Email required at all applicant intake entry points

All UI entry points that create a new applicant + application record SHALL render the email field as a required input (HTML `required` attribute + visible asterisk indicator) and SHALL block form submission when email is empty or invalid. The affected entry points are: `src/components/NewApplicationPage.tsx` (internal staff-created), `src/components/ExternalIntake.tsx` (external public-facing), and any future intake components that call `createNewApplication` or external intake server actions.

#### Scenario: Internal new application form blocks empty email

- **WHEN** a case officer opens NewApplicationPage and tries to submit without filling email
- **THEN** the browser MUST display the native required-field validation error; the form MUST NOT submit; no server action MUST be invoked

#### Scenario: External intake form blocks empty email

- **WHEN** an external user opens the public intake form (`/apply` route) and tries to submit without filling email
- **THEN** the form MUST display a clear required-field error in Traditional Chinese (e.g., "請填寫 Email"); the submission MUST NOT proceed

#### Scenario: Asterisk indicator visible

- **WHEN** any intake form renders the email field
- **THEN** the field label MUST include a visible required indicator (e.g., red asterisk `*` or text `（必填）`)

### Requirement: Server-side email validation

All server actions that create an applicant user record SHALL validate that `email` is non-empty AND matches a basic RFC-style regex (a valid local part, `@`, and a domain with TLD). Validation MUST run before any DB writes. On failure, the action SHALL return `{ success: false, error: '請填寫有效的 Email 地址' }` and MUST NOT create the user or application.

#### Scenario: Empty email rejected

- **WHEN** `createNewApplication` is called with `email = ''` or `email = undefined`
- **THEN** it MUST return `{ success: false, error: '請填寫有效的 Email 地址' }` and MUST NOT insert any rows

#### Scenario: Invalid format rejected

- **WHEN** `createNewApplication` is called with `email = 'not-an-email'`
- **THEN** it MUST return `{ success: false, error: '請填寫有效的 Email 地址' }` and MUST NOT insert any rows

#### Scenario: Valid email accepted

- **WHEN** `createNewApplication` is called with `email = 'someone@example.com'` and other required fields valid
- **THEN** the call MUST proceed normally; the created `users` row MUST have the email persisted

#### Scenario: External intake server action enforces same rule

- **WHEN** the external intake server action receives `email = ''`
- **THEN** it MUST return the same error string and MUST NOT create any records

### Requirement: Existing data not migrated

The DB column `users.email` SHALL remain nullable to preserve existing applicant records that lack email. This change SHALL NOT add a NOT NULL constraint and SHALL NOT backfill missing emails. Only NEW applicants created after this change MUST satisfy the validation.

#### Scenario: Schema unchanged for nullability

- **WHEN** querying `\d users` after this change is deployed
- **THEN** `email` column MUST still be marked nullable (`is_nullable = 'YES'`)

#### Scenario: Existing applicants without email remain valid

- **WHEN** a query reads any existing applicant row where `email IS NULL`
- **THEN** the read MUST succeed; no constraint violation MUST occur
