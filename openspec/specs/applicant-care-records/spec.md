# applicant-care-records Specification

## Purpose

TBD - created by archiving change 'add-applicant-care-records'. Update Purpose after archive.

## Requirements

### Requirement: Care records schema

The database SHALL contain a table `applicant_care_records` with the following columns:
- `id BIGSERIAL PRIMARY KEY`
- `applicant_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- `care_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE SET NULL` (the volunteer or social_worker who created the record)
- `care_date DATE NOT NULL`
- `summary TEXT NOT NULL`
- `media_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

A B-tree index SHALL exist on `applicant_user_id` to speed up per-applicant lookups. The schema SHALL be added by `scripts/init_db.sql` using `CREATE TABLE IF NOT EXISTS` for idempotent execution against both `pg_wmcms` and `pg_wmcms_demo` databases. Each column MUST have a `COMMENT ON COLUMN` description.

#### Scenario: Table present after init

- **WHEN** `scripts/init_db.sql` is executed against an existing or fresh database
- **THEN** `applicant_care_records` MUST exist with all listed columns and the `applicant_user_id` index

#### Scenario: Idempotent migration

- **WHEN** `scripts/init_db.sql` is executed twice consecutively
- **THEN** the second execution MUST succeed without error and MUST NOT alter or duplicate existing data

#### Scenario: media_urls defaults to empty array

- **WHEN** a row is inserted without specifying `media_urls`
- **THEN** the resulting row MUST have `media_urls = ARRAY[]::TEXT[]` (length 0); it MUST NOT be NULL

#### Scenario: Cascade on applicant deletion

- **WHEN** a user row referenced by `applicant_user_id` is deleted
- **THEN** all matching `applicant_care_records` rows MUST be deleted (ON DELETE CASCADE)


<!-- @trace
source: add-applicant-care-records
updated: 2026-04-23
code:
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/org-line-qr.png
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - scripts/init_db.sql
  - src/App.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - src/app/actions/workflowActions.ts
  - src/lib/numToChinese.ts
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/components/ReimbursementPrintPanel.tsx
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/components/UserSettingsPage.tsx
  - src/components/CareRecordModal.tsx
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/NotificationManager.tsx
  - src/lib/pdf/registerFonts.ts
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/app/actions/settingsActions.ts
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/notificationActions.ts
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - src/app/actions/userActions.ts
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - src/app/actions/printDocumentActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - src/components/ApplicantHistoryPage.tsx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/components/HomePage.tsx
  - src/app/api/line/webhook/route.ts
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/lib/caseCategory.ts
  - package.json
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - src/app/actions/lineActions.ts
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/components/ExternalIntake.tsx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/app/print/PrintButton.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - src/app/actions/careRecordActions.ts
  - tmp/test-pdf.ts
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/app/actions/notificationDispatcher.ts
  - src/app/actions/intakeActions.ts
-->

---
### Requirement: Create care record server action

The system SHALL provide `createCareRecord(operatorUserId, applicantUserId, careDate, summary, mediaUrls): Promise<ActionResult<{ id: string }>>` in `src/app/actions/careRecordActions.ts`. The action MUST:
- verify `operatorUserId` has the `volunteer` OR `social_worker` role (rejecting other roles)
- verify `applicantUserId` references an existing active user
- validate `careDate` is a valid date string and `summary` is non-empty
- normalize `mediaUrls` by trimming each entry and removing empties (NULL input is treated as empty array)
- INSERT the row with `care_user_id = operatorUserId`
- write an audit log entry with `action='care_record.created'`, `targetType='care_record'`, `targetId=newRowId`, and `detail` containing `applicant_user_id`, `care_date`, `summary_length`, `media_count`

#### Scenario: Volunteer creates a record

- **WHEN** a `volunteer` calls `createCareRecord(volunteerId, '14', '2026-04-22', '訪視概要', ['https://photos.google.com/album/...'])`
- **THEN** the action MUST INSERT a row with the given values; `care_user_id` MUST equal `volunteerId`; the action MUST return `{ success: true, data: { id: '<newId>' } }`

#### Scenario: Social worker creates a record

- **WHEN** a `social_worker` calls `createCareRecord(swId, '14', '2026-04-22', '電訪', [])`
- **THEN** the action MUST succeed; the row's `media_urls` MUST be an empty array

#### Scenario: Other roles rejected

- **WHEN** an `admin` (without volunteer/social_worker role) calls `createCareRecord(...)`
- **THEN** the action MUST return `{ success: false, error: '權限不足' }` and MUST NOT INSERT

#### Scenario: Empty summary rejected

- **WHEN** `createCareRecord` is called with `summary = ''` or `summary` of only whitespace
- **THEN** the action MUST return `{ success: false, error: '請填寫關懷摘要' }` and MUST NOT INSERT

#### Scenario: Invalid applicant rejected

- **WHEN** `createCareRecord` is called with `applicantUserId` referencing a non-existent or inactive user
- **THEN** the action MUST return `{ success: false, error: '申請人不存在或已停用' }` and MUST NOT INSERT

#### Scenario: Empty / blank media URLs trimmed away

- **WHEN** `createCareRecord` is called with `mediaUrls = ['', '  ', 'https://example.com/x', null as any]`
- **THEN** the persisted `media_urls` MUST contain only `['https://example.com/x']`


<!-- @trace
source: add-applicant-care-records
updated: 2026-04-23
code:
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/org-line-qr.png
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - scripts/init_db.sql
  - src/App.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - src/app/actions/workflowActions.ts
  - src/lib/numToChinese.ts
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/components/ReimbursementPrintPanel.tsx
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/components/UserSettingsPage.tsx
  - src/components/CareRecordModal.tsx
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/NotificationManager.tsx
  - src/lib/pdf/registerFonts.ts
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/app/actions/settingsActions.ts
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/notificationActions.ts
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - src/app/actions/userActions.ts
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - src/app/actions/printDocumentActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - src/components/ApplicantHistoryPage.tsx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/components/HomePage.tsx
  - src/app/api/line/webhook/route.ts
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/lib/caseCategory.ts
  - package.json
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - src/app/actions/lineActions.ts
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/components/ExternalIntake.tsx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/app/print/PrintButton.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - src/app/actions/careRecordActions.ts
  - tmp/test-pdf.ts
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/app/actions/notificationDispatcher.ts
  - src/app/actions/intakeActions.ts
-->

---
### Requirement: Fetch care records by applicant

The system SHALL provide `fetchCareRecordsByApplicant(operatorUserId, applicantUserId): Promise<ActionResult<CareRecord[]>>` returning all care records for the given applicant ordered by `care_date DESC, created_at DESC`. The action MUST:
- verify `operatorUserId` has at least one of the roles: `volunteer`, `social_worker`, `admin`, `supervisor`
- return rows joined with the care worker's display name (decrypted from `users.name_enc`)
- return `[]` (not error) when the applicant has no records

`CareRecord` shape MUST include: `id`, `applicantUserId`, `careUserId`, `careUserName` (decrypted), `careDate`, `summary`, `mediaUrls`, `createdAt`, `updatedAt`.

#### Scenario: Authorized supervisor fetches list

- **WHEN** a `supervisor` calls `fetchCareRecordsByApplicant(supId, '14')` and applicant 14 has 3 records
- **THEN** the action MUST return `{ success: true, data: [<3 records>] }` ordered newest first; each record's `careUserName` MUST be the decrypted display name of the care worker

#### Scenario: Unauthorized role rejected

- **WHEN** a `case_officer` (without any of the four allowed roles) calls `fetchCareRecordsByApplicant(...)`
- **THEN** the action MUST return `{ success: false, error: '權限不足' }`

#### Scenario: Applicant with no records returns empty array

- **WHEN** `fetchCareRecordsByApplicant(authedUserId, applicantWithNoRecords)` is called
- **THEN** the action MUST return `{ success: true, data: [] }` (not an error)


<!-- @trace
source: add-applicant-care-records
updated: 2026-04-23
code:
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/org-line-qr.png
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - scripts/init_db.sql
  - src/App.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - src/app/actions/workflowActions.ts
  - src/lib/numToChinese.ts
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/components/ReimbursementPrintPanel.tsx
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/components/UserSettingsPage.tsx
  - src/components/CareRecordModal.tsx
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/NotificationManager.tsx
  - src/lib/pdf/registerFonts.ts
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/app/actions/settingsActions.ts
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/notificationActions.ts
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - src/app/actions/userActions.ts
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - src/app/actions/printDocumentActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - src/components/ApplicantHistoryPage.tsx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/components/HomePage.tsx
  - src/app/api/line/webhook/route.ts
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/lib/caseCategory.ts
  - package.json
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - src/app/actions/lineActions.ts
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/components/ExternalIntake.tsx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/app/print/PrintButton.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - src/app/actions/careRecordActions.ts
  - tmp/test-pdf.ts
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/app/actions/notificationDispatcher.ts
  - src/app/actions/intakeActions.ts
-->

---
### Requirement: Update care record server action

The system SHALL provide `updateCareRecord(operatorUserId, recordId, careDate, summary, mediaUrls)`. The action MUST:
- load the existing record; if not found, return `{ success: false, error: '紀錄不存在' }`
- verify `operatorUserId === record.care_user_id` (only the original creator may edit); otherwise return `{ success: false, error: '只有建立者可以編輯此紀錄' }`
- apply the same validation rules as `createCareRecord` (non-empty summary, valid date, normalized URLs)
- UPDATE the row, set `updated_at = NOW()`, write audit `care_record.updated` with `detail.changedFields` listing which of (careDate, summary, mediaUrls) actually changed

#### Scenario: Creator edits own record

- **WHEN** the original creator calls `updateCareRecord(creatorId, recordId, '2026-04-23', '更新後摘要', ['https://...'])`
- **THEN** the action MUST UPDATE the row, set `updated_at`, return `{ success: true }`, and write an audit entry with the changed fields

#### Scenario: Non-creator (even admin) cannot edit

- **WHEN** an admin (not the original creator) calls `updateCareRecord(adminId, recordId, ...)`
- **THEN** the action MUST return `{ success: false, error: '只有建立者可以編輯此紀錄' }`; the row MUST remain unchanged

#### Scenario: Update with no actual changes writes audit with empty changedFields

- **WHEN** the creator calls `updateCareRecord` with values identical to the existing row
- **THEN** the UPDATE MAY still execute, but the audit entry's `detail.changedFields` MUST be `[]`


<!-- @trace
source: add-applicant-care-records
updated: 2026-04-23
code:
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/org-line-qr.png
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - scripts/init_db.sql
  - src/App.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - src/app/actions/workflowActions.ts
  - src/lib/numToChinese.ts
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/components/ReimbursementPrintPanel.tsx
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/components/UserSettingsPage.tsx
  - src/components/CareRecordModal.tsx
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/NotificationManager.tsx
  - src/lib/pdf/registerFonts.ts
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/app/actions/settingsActions.ts
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/notificationActions.ts
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - src/app/actions/userActions.ts
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - src/app/actions/printDocumentActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - src/components/ApplicantHistoryPage.tsx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/components/HomePage.tsx
  - src/app/api/line/webhook/route.ts
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/lib/caseCategory.ts
  - package.json
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - src/app/actions/lineActions.ts
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/components/ExternalIntake.tsx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/app/print/PrintButton.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - src/app/actions/careRecordActions.ts
  - tmp/test-pdf.ts
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/app/actions/notificationDispatcher.ts
  - src/app/actions/intakeActions.ts
-->

---
### Requirement: Delete care record server action

The system SHALL provide `deleteCareRecord(operatorUserId, recordId)`. The action MUST allow deletion when EITHER (a) `operatorUserId === record.care_user_id` (creator) OR (b) `operatorUserId` has the `admin` role. Other callers MUST be rejected with `{ success: false, error: '權限不足' }`. On success the action MUST DELETE the row and write audit `care_record.deleted` with `detail.applicant_user_id`, `detail.care_user_id`, `detail.care_date`, `detail.deleted_by_role` (`'creator'` or `'admin'`).

#### Scenario: Creator deletes own record

- **WHEN** the original creator calls `deleteCareRecord(creatorId, recordId)`
- **THEN** the row MUST be DELETED; an audit entry with `deleted_by_role='creator'` MUST be written

#### Scenario: Admin deletes any record

- **WHEN** an admin (not the creator) calls `deleteCareRecord(adminId, recordId)`
- **THEN** the row MUST be DELETED; the audit entry MUST contain `deleted_by_role='admin'`

#### Scenario: Non-creator non-admin rejected

- **WHEN** a `social_worker` (other than the creator and not an admin) calls `deleteCareRecord(...)`
- **THEN** the action MUST return `{ success: false, error: '權限不足' }`; the row MUST remain

#### Scenario: Non-existent record handled

- **WHEN** `deleteCareRecord` is called with `recordId` that doesn't exist
- **THEN** the action MUST return `{ success: false, error: '紀錄不存在' }`; no audit entry MUST be written


<!-- @trace
source: add-applicant-care-records
updated: 2026-04-23
code:
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/org-line-qr.png
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - scripts/init_db.sql
  - src/App.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - src/app/actions/workflowActions.ts
  - src/lib/numToChinese.ts
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/components/ReimbursementPrintPanel.tsx
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/components/UserSettingsPage.tsx
  - src/components/CareRecordModal.tsx
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/NotificationManager.tsx
  - src/lib/pdf/registerFonts.ts
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/app/actions/settingsActions.ts
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/notificationActions.ts
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - src/app/actions/userActions.ts
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - src/app/actions/printDocumentActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - src/components/ApplicantHistoryPage.tsx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/components/HomePage.tsx
  - src/app/api/line/webhook/route.ts
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/lib/caseCategory.ts
  - package.json
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - src/app/actions/lineActions.ts
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/components/ExternalIntake.tsx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/app/print/PrintButton.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - src/app/actions/careRecordActions.ts
  - tmp/test-pdf.ts
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/app/actions/notificationDispatcher.ts
  - src/app/actions/intakeActions.ts
-->

---
### Requirement: Care records tab in ApplicantHistoryPage

`src/components/ApplicantHistoryPage.tsx` SHALL render an additional tab labeled "關懷紀錄" alongside any existing tabs. The tab MUST be visible only when the logged-in user has at least one of: `volunteer`, `social_worker`, `admin`, `supervisor`. When inactive (user lacks the role), the tab MUST NOT render. When the user has the role but no role to create (only view), the "新增關懷紀錄" button MUST NOT render — but list and detail rows MUST still display.

#### Scenario: Tab hidden from case_officer

- **WHEN** a user with only `case_officer` role views the page
- **THEN** the "關懷紀錄" tab MUST NOT render

#### Scenario: Tab visible to volunteer with create button

- **WHEN** a `volunteer` views the page
- **THEN** the "關懷紀錄" tab MUST render; the "新增關懷紀錄" button MUST be visible

#### Scenario: Supervisor sees tab but no create button

- **WHEN** a user with only `supervisor` role views the page
- **THEN** the "關懷紀錄" tab MUST render; the "新增關懷紀錄" button MUST NOT render

#### Scenario: List rendered newest first

- **WHEN** the tab opens for an applicant with 3 records
- **THEN** the list MUST render 3 rows ordered by `care_date DESC, created_at DESC`; each row MUST show `careDate`, `careUserName`, summary preview (first 80 chars), and a count of `mediaUrls`


<!-- @trace
source: add-applicant-care-records
updated: 2026-04-23
code:
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/org-line-qr.png
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - scripts/init_db.sql
  - src/App.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - src/app/actions/workflowActions.ts
  - src/lib/numToChinese.ts
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/components/ReimbursementPrintPanel.tsx
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/components/UserSettingsPage.tsx
  - src/components/CareRecordModal.tsx
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/NotificationManager.tsx
  - src/lib/pdf/registerFonts.ts
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/app/actions/settingsActions.ts
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/notificationActions.ts
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - src/app/actions/userActions.ts
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - src/app/actions/printDocumentActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - src/components/ApplicantHistoryPage.tsx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/components/HomePage.tsx
  - src/app/api/line/webhook/route.ts
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/lib/caseCategory.ts
  - package.json
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - src/app/actions/lineActions.ts
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/components/ExternalIntake.tsx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/app/print/PrintButton.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - src/app/actions/careRecordActions.ts
  - tmp/test-pdf.ts
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/app/actions/notificationDispatcher.ts
  - src/app/actions/intakeActions.ts
-->

---
### Requirement: Create / edit care record UI modal

The system SHALL provide `src/components/CareRecordModal.tsx` for both create and edit flows. The modal MUST contain:
- Read-only display of applicant name (passed by parent)
- Date input (required, default = today in `<input type="date">`)
- Textarea for summary (required, no max length)
- Dynamic media URL list — each row a `<input type="url">` + remove button; an "新增連結" button appends a blank row
- Save and Cancel buttons; Save MUST be disabled while in-flight or if summary is empty

#### Scenario: Open in create mode pre-fills today

- **WHEN** the modal opens with `mode='create'`
- **THEN** the date input MUST default to today's local date in `YYYY-MM-DD` format; summary MUST be empty; `mediaUrls` MUST start with one empty row

#### Scenario: Open in edit mode pre-fills existing values

- **WHEN** the modal opens with `mode='edit'` and an existing record
- **THEN** all three fields (date, summary, mediaUrls) MUST be pre-filled from the record

#### Scenario: Add and remove media URL rows

- **WHEN** user clicks "新增連結"
- **THEN** a new empty `<input type="url">` row MUST appear; user MAY remove any row via its trash button

#### Scenario: Empty summary disables Save

- **WHEN** summary input is empty or only whitespace
- **THEN** the Save button MUST be disabled; clicking it MUST be a no-op

#### Scenario: Save success closes modal and refreshes list

- **WHEN** Save returns `{ success: true }`
- **THEN** the modal MUST close; the parent ApplicantHistoryPage MUST re-fetch the records list (so the new/updated record appears)

#### Scenario: Save failure displays error

- **WHEN** Save returns `{ success: false, error: '...' }`
- **THEN** the modal MUST stay open; the error message MUST appear at the bottom of the modal in red


<!-- @trace
source: add-applicant-care-records
updated: 2026-04-23
code:
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/org-line-qr.png
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - scripts/init_db.sql
  - src/App.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - src/app/actions/workflowActions.ts
  - src/lib/numToChinese.ts
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/components/ReimbursementPrintPanel.tsx
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/components/UserSettingsPage.tsx
  - src/components/CareRecordModal.tsx
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/NotificationManager.tsx
  - src/lib/pdf/registerFonts.ts
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/app/actions/settingsActions.ts
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/notificationActions.ts
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - src/app/actions/userActions.ts
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - src/app/actions/printDocumentActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - src/components/ApplicantHistoryPage.tsx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/components/HomePage.tsx
  - src/app/api/line/webhook/route.ts
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/lib/caseCategory.ts
  - package.json
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - src/app/actions/lineActions.ts
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/components/ExternalIntake.tsx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/app/print/PrintButton.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - src/app/actions/careRecordActions.ts
  - tmp/test-pdf.ts
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/app/actions/notificationDispatcher.ts
  - src/app/actions/intakeActions.ts
-->

---
### Requirement: Audit action types extended

The `AuditAction` union in `src/app/actions/auditActions.ts` SHALL include the new literals `'care_record.created'`, `'care_record.updated'`, and `'care_record.deleted'`. The `AuditTargetType` union SHALL include `'care_record'`.

#### Scenario: TypeScript accepts new audit action literals

- **WHEN** code calls `writeAuditLog({ action: 'care_record.created', targetType: 'care_record', ... })`
- **THEN** the TypeScript compiler MUST accept it without error

<!-- @trace
source: add-applicant-care-records
updated: 2026-04-23
code:
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/org-line-qr.png
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - scripts/init_db.sql
  - src/App.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - src/app/actions/workflowActions.ts
  - src/lib/numToChinese.ts
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/components/ReimbursementPrintPanel.tsx
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/components/UserSettingsPage.tsx
  - src/components/CareRecordModal.tsx
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/NotificationManager.tsx
  - src/lib/pdf/registerFonts.ts
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/app/actions/settingsActions.ts
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/notificationActions.ts
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - src/app/actions/userActions.ts
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - src/app/actions/printDocumentActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - src/components/ApplicantHistoryPage.tsx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/components/HomePage.tsx
  - src/app/api/line/webhook/route.ts
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/lib/caseCategory.ts
  - package.json
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - src/app/actions/lineActions.ts
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/components/ExternalIntake.tsx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/app/print/PrintButton.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - src/app/actions/careRecordActions.ts
  - tmp/test-pdf.ts
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/app/actions/notificationDispatcher.ts
  - src/app/actions/intakeActions.ts
-->