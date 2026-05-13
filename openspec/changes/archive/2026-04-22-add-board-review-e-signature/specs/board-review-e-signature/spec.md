## ADDED Requirements

### Requirement: Board review signatures schema

The system SHALL provide a `board_review_signatures` table with composite primary key `(application_id, signer_user_id)`, columns `application_id BIGINT REFERENCES applications(id) ON DELETE CASCADE`, `signer_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE`, `signature_data_url TEXT NOT NULL` (base64 PNG with `data:image/png;base64,` prefix), `content_hash TEXT NOT NULL` (SHA-256 hex), `signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `user_agent TEXT`, `ip_address TEXT`.

#### Scenario: Table present after init

- **WHEN** `scripts/init_db.sql` is executed
- **THEN** the `board_review_signatures` table SHALL exist with all columns

#### Scenario: One signature per signer per case

- **WHEN** a second INSERT attempts the same `(application_id, signer_user_id)` pair
- **THEN** PostgreSQL SHALL reject the INSERT unless upserted via ON CONFLICT

### Requirement: Content hash computation

The system SHALL provide `computeBoardReviewContentHash(applicationId)` returning a SHA-256 hex digest of the string `v1|{applicationId}|{approved_amount ?? 'null'}|{comments ?? 'null'}|{is_approved ?? 'null'}|{assigned_group_id}`. Field values SHALL be joined by the literal `|` separator. Null values SHALL be represented by the literal string `'null'` (not empty).

#### Scenario: Identical inputs produce identical hash

- **WHEN** the function is called twice without any DB change
- **THEN** both results SHALL be equal

#### Scenario: Content change alters hash

- **WHEN** `applications.approved_amount` changes from 100000 to 150000
- **THEN** the next computed hash SHALL differ from the previous

#### Scenario: Group reassignment alters hash

- **WHEN** `board_review_assignments.group_id` changes
- **THEN** the next computed hash SHALL differ

### Requirement: Signature submission with password re-auth

The system SHALL provide `submitBoardSignature(applicationId, signatureDataUrl, password, operatorUserId)` that validates (a) application status `'1'` AND workflow stage `'board_review'`, (b) the case has a row in `board_review_assignments`, (c) operatorUserId is a current member of the assigned group, (d) the provided `password` re-hashes to equal `users.password` for that user, and (e) the current recomputed content_hash matches. On success it UPSERTs one row into `board_review_signatures` (`signer_user_id = operatorUserId`) with the current hash, and writes an audit row `board_review.signature_added`.

#### Scenario: Non-member rejected

- **WHEN** a user who is not a current member of the assigned group calls `submitBoardSignature`
- **THEN** the action SHALL return a failure result and NOT insert

#### Scenario: Wrong password rejected

- **WHEN** the supplied `password` does not match the user's stored hash
- **THEN** the action SHALL return `{ success: false, error: '密碼錯誤' }`
- **AND** no row SHALL be written

#### Scenario: Signing allowed for chairman only if also group member

- **WHEN** a chairman who is NOT listed in `board_group_members` for the assigned group attempts to sign
- **THEN** the action SHALL return a failure result (chairman permission does NOT grant signing rights)

#### Scenario: Re-sign overwrites existing row

- **WHEN** the same user signs a second time (for example after a previous signature was invalidated)
- **THEN** the existing row SHALL be UPDATED (not duplicated)
- **AND** a new `board_review.signature_added` audit row SHALL be written with the new hash

### Requirement: Fetch signatures with validity state

The system SHALL provide `fetchBoardReviewSignatures(applicationId)` that returns the current content_hash plus a list keyed by current group member including fields `signerUserId`, `name` (decrypted), `account`, `status` (`'signed' | 'invalid' | 'pending'`), `signedAt` (nullable), `thumbnail` (nullable base64). A row is `'signed'` iff a signature exists AND its `content_hash` equals the current hash; `'invalid'` iff a signature exists but hash differs; `'pending'` iff no signature row exists.

#### Scenario: Signed and current

- **WHEN** a member has signed with hash matching the current state
- **THEN** their status SHALL be `'signed'`

#### Scenario: Content changed after signing

- **WHEN** a member signed, then the content_hash changed (e.g. save invalidated hash by definition would delete the row; this scenario covers the edge case where deletion fails), the retained row has a stale hash
- **THEN** their status SHALL be `'invalid'`

#### Scenario: Member never signed

- **WHEN** a current member has no row in `board_review_signatures`
- **THEN** their status SHALL be `'pending'`

### Requirement: Signature invalidation on content change

When `saveBoardReviewDraft` actually changes at least one tracked field (`approvedAmount`, `comments`, or `isApproved`), the system SHALL delete all rows in `board_review_signatures` for that application within the same transaction and write an audit row `board_review.signatures_invalidated` with `detail.reason = 'content_changed'` and `detail.invalidated_user_ids` listing the signers whose rows were deleted.

#### Scenario: Save with change invalidates

- **WHEN** the case has 2 signatures and `saveBoardReviewDraft` changes `comments`
- **THEN** after the transaction, `board_review_signatures` SHALL have 0 rows for this application
- **AND** one audit row with `action = 'board_review.signatures_invalidated'` SHALL be written

#### Scenario: Save with no change does not invalidate

- **WHEN** the caller submits a patch equal to the current values (no-op)
- **THEN** existing signatures SHALL remain

### Requirement: Signature invalidation on reassignment

When `assignCaseToBoardGroup` updates the `group_id` for an existing assignment (reassignment), the system SHALL delete all rows in `board_review_signatures` for that application within the same transaction and write an audit row `board_review.signatures_invalidated` with `detail.reason = 'reassigned'`.

#### Scenario: Reassignment invalidates old signatures

- **WHEN** case has signatures from group A members, chairman reassigns to group B
- **THEN** all old signatures SHALL be deleted
- **AND** audit reason SHALL be `'reassigned'`

### Requirement: Stage advance and close-rejected require full signatures

When the target stage transition originates from `board_review` (i.e. `advanceWorkflowStage(applicationId, 'board_review', 'reimbursement', ...)` or `closeCaseRejected` invoked while the case is in `board_review`), the server action SHALL, within its own transaction and before any UPDATE to `applications.status`, verify:
- let `memberCount` = count of rows in `board_group_members` for this case's assigned group;
- let `validCount` = count of rows in `board_review_signatures` where `application_id` matches AND `content_hash` equals the freshly recomputed current hash AND `signer_user_id` is also a current group member;

and require `memberCount > 0` AND `memberCount == validCount`. If the condition fails, the transaction SHALL ROLLBACK and return `{ success: false, error: '尚有 N 位組員未簽署（或簽章已因內容變動失效）' }`.

#### Scenario: All signed advances successfully

- **WHEN** all current group members have signed AND their hashes match current
- **THEN** `advanceWorkflowStage` SHALL succeed and `applications.status` SHALL become `'3'`

#### Scenario: One member unsigned blocks advance

- **WHEN** 2 of 3 members have signed
- **THEN** `advanceWorkflowStage` SHALL return the blocking error
- **AND** `applications.status` SHALL remain `'1'`

#### Scenario: Stale signature blocks close-rejected

- **WHEN** all members signed but then someone edited content invalidating the signatures
- **THEN** `closeCaseRejected` from board_review SHALL fail with the same blocking error

#### Scenario: Recently-added group member missing

- **WHEN** a group previously had 2 members, both signed, then a third member was added to the group
- **THEN** because `memberCount` is now 3 but `validCount` is 2, advance SHALL be blocked until the third signs

### Requirement: Audit trail

The system SHALL extend `AuditAction` with `'board_review.signature_added'` and `'board_review.signatures_invalidated'`. The `targetType` for `signature_added` SHALL be `'application'` with `target_id = applicationId`; `detail` SHALL include `content_hash` and `signer_user_id`. For `signatures_invalidated`, `targetType` SHALL be `'application'`, `detail` SHALL include `reason` (`'content_changed' | 'reassigned'`) and `invalidated_user_ids` array.

#### Scenario: AuditAction union includes new literals

- **WHEN** TypeScript compilation runs
- **THEN** `AuditAction` SHALL include both `'board_review.signature_added'` and `'board_review.signatures_invalidated'`

### Requirement: Signature panel UI

The application detail page SHALL, when `stage === 'board_review'`, render a `<BoardSignaturePanel>` component that lists each current group member's signature status (`signed` / `invalid` / `pending`). If the logged-in user is the row's member and status is not `signed`, the row SHALL expose a button "簽章" (or "重新簽章" when `invalid`) that opens a signature modal containing a `react-signature-canvas` drawing pad, a clear button, a password input, and a submit button.

#### Scenario: Panel visible on board_review only

- **WHEN** the case is in `admin_review` or `home_visit`
- **THEN** the `BoardSignaturePanel` SHALL NOT render

#### Scenario: Non-member sees panel read-only

- **WHEN** a board member who is NOT in the assigned group views the detail page
- **THEN** the panel SHALL list members with their statuses but SHALL NOT show the "簽章" button on any row

#### Scenario: Signing modal requires both drawing and password

- **WHEN** the modal is open and the user clicks submit with an empty drawing OR empty password
- **THEN** a client-side validation message SHALL appear and submission SHALL not be attempted

#### Scenario: Successful signing refreshes panel

- **WHEN** `submitBoardSignature` returns success
- **THEN** the modal SHALL close
- **AND** the panel SHALL refetch showing the user's row as `'signed'`

### Requirement: Advance buttons gated by signature completeness

The "通過" and "不通過結案" buttons in the case detail view SHALL be disabled when `stage === 'board_review'` AND not all current group members are in `'signed'` state. The tooltip SHALL state "尚有 N 位組員未簽章".

#### Scenario: Button disabled when not all signed

- **WHEN** 1 of 3 members has signed
- **THEN** the "通過" button SHALL be disabled
- **AND** the "不通過結案" button SHALL be disabled

#### Scenario: Button enabled when all signed

- **WHEN** all 3 of 3 members signed AND hashes are current
- **AND** no dirty edits exist (from the previous change's dirty-state guard)
- **THEN** both buttons SHALL be enabled

### Requirement: Pre-edit confirmation when signatures exist

The board review edit UI SHALL display a visible warning when editing a field while any signature exists; upon save, a confirmation dialog SHALL state "修改會使 N 個已簽名失效" and require explicit confirmation before `saveBoardReviewDraft` is called.

#### Scenario: Dialog appears when signatures exist

- **WHEN** 2 signatures exist and the user edits `comments` and presses 儲存
- **THEN** a confirm dialog SHALL appear stating the invalidation count before the server call is made

#### Scenario: No dialog when no signatures

- **WHEN** no signatures exist and the user presses 儲存
- **THEN** no dialog SHALL appear
