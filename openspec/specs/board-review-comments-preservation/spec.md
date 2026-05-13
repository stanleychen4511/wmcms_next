# board-review-comments-preservation Specification

## Purpose

TBD - created by archiving change 'add-reimbursement-print-documents'. Update Purpose after archive.

## Requirements

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


<!-- @trace
source: add-reimbursement-print-documents
updated: 2026-04-23
code:
  - src/components/HomePage.tsx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/app/actions/notificationActions.ts
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/components/SettingsPanel.tsx
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - src/app/actions/notificationDispatcher.ts
  - scripts/init_db.sql
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - src/lib/rocDate.ts
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/print/PrintButton.tsx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/app/actions/userActions.ts
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - src/App.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/app/actions/printDocumentActions.ts
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/banners/banner_1776382867741.png
  - package.json
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/components/ReimbursementPrintPanel.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - src/lib/numToChinese.ts
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - src/app/actions/settingsActions.ts
  - src/lib/caseCategory.ts
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
-->

---
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


<!-- @trace
source: add-reimbursement-print-documents
updated: 2026-04-23
code:
  - src/components/HomePage.tsx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/app/actions/notificationActions.ts
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/components/SettingsPanel.tsx
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - src/app/actions/notificationDispatcher.ts
  - scripts/init_db.sql
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - src/lib/rocDate.ts
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/print/PrintButton.tsx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/app/actions/userActions.ts
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - src/App.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/app/actions/printDocumentActions.ts
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/banners/banner_1776382867741.png
  - package.json
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/components/ReimbursementPrintPanel.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - src/lib/numToChinese.ts
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - src/app/actions/settingsActions.ts
  - src/lib/caseCategory.ts
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
-->

---
### Requirement: Stage advance does not overwrite board_review_comments

`advanceWorkflowStage` SHALL NOT modify `applications.board_review_comments` under any circumstances. After advancing from `board_review` to `reimbursement`, the value MUST persist exactly as left by the most recent `saveBoardReviewDraft`.

#### Scenario: Advance preserves comments

- **WHEN** a case has `board_review_comments = '通過'` and `advanceWorkflowStage(appId, 'reimbursement', ...)` is called
- **THEN** after the advance `applications.board_review_comments` MUST still equal `'通過'`


<!-- @trace
source: add-reimbursement-print-documents
updated: 2026-04-23
code:
  - src/components/HomePage.tsx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/app/actions/notificationActions.ts
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/components/SettingsPanel.tsx
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - src/app/actions/notificationDispatcher.ts
  - scripts/init_db.sql
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - src/lib/rocDate.ts
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/print/PrintButton.tsx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/app/actions/userActions.ts
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - src/App.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/app/actions/printDocumentActions.ts
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/banners/banner_1776382867741.png
  - package.json
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/components/ReimbursementPrintPanel.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - src/lib/numToChinese.ts
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - src/app/actions/settingsActions.ts
  - src/lib/caseCategory.ts
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
-->

---
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

<!-- @trace
source: add-reimbursement-print-documents
updated: 2026-04-23
code:
  - src/components/HomePage.tsx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/app/actions/notificationActions.ts
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/components/SettingsPanel.tsx
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - src/app/actions/notificationDispatcher.ts
  - scripts/init_db.sql
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - src/lib/rocDate.ts
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/print/PrintButton.tsx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/app/actions/userActions.ts
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - src/App.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/app/actions/printDocumentActions.ts
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/banners/banner_1776382867741.png
  - package.json
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/components/ReimbursementPrintPanel.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - src/lib/numToChinese.ts
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - src/app/actions/settingsActions.ts
  - src/lib/caseCategory.ts
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
-->