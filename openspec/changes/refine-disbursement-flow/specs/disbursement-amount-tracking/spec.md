## ADDED Requirements

### Requirement: Disbursement summary card visible to all roles

The `DisbursementPanel` component SHALL render a summary card at the top showing three values for the current application: approved amount (核定金額), cumulative disbursed amount (已撥款累計), and remaining amount (剩餘可撥). The card MUST be visible regardless of the viewer's role or the application's current `review_stage`.

Cumulative disbursed amount MUST equal the sum of `amount` columns of all `payment_disbursements` rows for the application whose `review_stage = '9'` (completed). Remaining amount MUST equal approved amount minus cumulative disbursed amount.

#### Scenario: Empty case shows zero cumulative

- **WHEN** an application has no completed disbursements
- **THEN** the summary card MUST show cumulative `0` and remaining equal to approved amount

#### Scenario: One completed disbursement

- **WHEN** an application with approved amount 100,000 has one completed disbursement of 50,000
- **THEN** the summary card MUST show approved 100,000, cumulative 50,000, remaining 50,000

#### Scenario: In-flight disbursement excluded from cumulative

- **WHEN** an application has one disbursement at `review_stage = '3'` (in flight) of amount 30,000
- **THEN** that amount MUST NOT contribute to cumulative; cumulative MUST count only `review_stage = '9'` rows

### Requirement: Per-disbursement sequence label

Each disbursement row in the panel MUST display a label "第 N 次撥款" where N is the 1-based ordinal of the row when sorted by `created_at` ascending among the application's `payment_disbursements`.

#### Scenario: Two disbursement case

- **WHEN** an application has disbursements created at times t1 < t2
- **THEN** the row for t1 MUST be labeled "第 1 次撥款" and the row for t2 MUST be labeled "第 2 次撥款"

### Requirement: Completion banner

When the cumulative disbursed amount equals the approved amount, the `DisbursementPanel` MUST render a banner reading "✅ 本次補助已完成結案" near the top of the panel. The banner MUST be visible to viewers of any role.

#### Scenario: Cumulative reaches approved amount

- **WHEN** an application's cumulative disbursed amount becomes equal to its approved amount
- **THEN** the completion banner MUST render

#### Scenario: Cumulative below approved amount

- **WHEN** cumulative disbursed amount is less than approved amount
- **THEN** the completion banner MUST NOT render
