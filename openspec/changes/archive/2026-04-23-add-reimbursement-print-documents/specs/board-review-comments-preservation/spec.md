## ADDED Requirements

### Requirement: Persistent board review comments column

The `applications` table SHALL contain a nullable `board_review_comments TEXT` column to permanently store the consolidated board review opinion for each case. This column SHALL be independent of `application_workflow.comments` (which is stage-scoped and overwritten on stage advance). The column SHALL be added by `scripts/init_db.sql` using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for idempotent execution against both `pg_wmcms` and `pg_wmcms_demo` databases.

#### Scenario: Column present after init

- **WHEN** `scripts/init_db.sql` is executed against an existing database
- **THEN** `applications.board_review_comments` MUST exist with type `TEXT` and be nullable

#### Scenario: Idempotent migration

- **WHEN** `scripts/init_db.sql` is executed twice consecutively
- **THEN** the second execution MUST succeed without error and MUST NOT alter existing column data

#### Scenario: Column documented

- **WHEN** the database COMMENT for `applications.board_review_comments` is queried
- **THEN** it MUST contain a description identifying it as the permanent board review opinion store, independent of workflow stage

### Requirement: saveBoardReviewDraft writes both comments fields

The `saveBoardReviewDraft` server action SHALL, within a single transaction, update both `application_workflow.comments` (existing behavior) AND `applications.board_review_comments` whenever the comments field is included in the patch. If only `isApproved` or `approvedAmount` changes (no comments change), `applications.board_review_comments` MUST NOT be touched. Both UPDATEs MUST be in the same transaction so a failure of either MUST roll back both.

#### Scenario: Comments-only patch updates both fields

- **WHEN** `saveBoardReviewDraft(appId, { comments: '通過，金額合理' }, userId)` is called
- **THEN** after commit `application_workflow.comments` AND `applications.board_review_comments` MUST both equal `'通過，金額合理'`

#### Scenario: Approved-amount-only patch leaves comments untouched

- **WHEN** `saveBoardReviewDraft(appId, { approvedAmount: 50000 }, userId)` is called against a case where `board_review_comments` is currently `'原意見'`
- **THEN** after commit `applications.board_review_comments` MUST still equal `'原意見'`

#### Scenario: Empty string comments persists as NULL on both fields

- **WHEN** `saveBoardReviewDraft(appId, { comments: '' }, userId)` is called
- **THEN** after commit both `application_workflow.comments` and `applications.board_review_comments` MUST be NULL (matching existing trim-to-NULL convention)

#### Scenario: Transaction rollback on failure

- **WHEN** the `application_workflow` UPDATE succeeds but the `applications` UPDATE fails for any reason
- **THEN** the transaction MUST roll back; both fields MUST remain at their pre-call values

### Requirement: Stage advance does not overwrite board_review_comments

`advanceWorkflowStage` SHALL NOT modify `applications.board_review_comments` under any circumstances. After advancing from `board_review` to `reimbursement`, the value MUST persist exactly as left by the most recent `saveBoardReviewDraft`.

#### Scenario: Advance preserves comments

- **WHEN** a case has `board_review_comments = '通過'` and `advanceWorkflowStage(appId, 'reimbursement', ...)` is called
- **THEN** after the advance `applications.board_review_comments` MUST still equal `'通過'`

### Requirement: Retreat clears board_review_comments

`retreatWorkflowStage` SHALL set `applications.board_review_comments = NULL` whenever the target stage is `admin_review` or `home_visit` (i.e., earlier than `board_review`). This clearing MUST occur in the same transaction as the existing clearing of `board_review_assignments` and `board_review_signatures`.

#### Scenario: Retreat to home_visit clears comments

- **WHEN** a case has `board_review_comments = '通過'` and `retreatWorkflowStage(appId, 'visit', ...)` is called
- **THEN** after the call `applications.board_review_comments` MUST be NULL

#### Scenario: Retreat to admin_review clears comments

- **WHEN** a case has `board_review_comments = '通過'` and `retreatWorkflowStage(appId, 'admin_review', ...)` is called
- **THEN** after the call `applications.board_review_comments` MUST be NULL

#### Scenario: Retreat with no prior comments is a no-op

- **WHEN** `retreatWorkflowStage` is called with target stage `'visit'` against a case where `board_review_comments` is already NULL
- **THEN** the UPDATE MUST execute (or be skipped) without error; the field MUST remain NULL
