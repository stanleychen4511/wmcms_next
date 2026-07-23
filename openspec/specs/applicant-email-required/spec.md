# applicant-email-required Specification

## Purpose

TBD - created by archiving change 'add-auto-send-payment-receipt'. Update Purpose after archive.

## Requirements

### Requirement: Email required for self applications

All self-application UI entry points that create a new applicant + application record SHALL render the applicant email field as a required input (HTML `required` attribute + visible asterisk indicator) and SHALL block form submission when email is empty or invalid. For external referrals, the applicant email field SHALL be hidden and only the referral contact email SHALL be required and verified. The affected entry points are: `src/components/NewApplicationPage.tsx` (internal staff-created), `src/components/ExternalIntake.tsx` (external public-facing), and any future intake components that call `createNewApplication` or external intake server actions.

#### Scenario: Internal new application form blocks empty email

- **WHEN** a case officer opens NewApplicationPage and tries to submit without filling email
- **THEN** the browser MUST display the native required-field validation error; the form MUST NOT submit; no server action MUST be invoked

#### Scenario: External intake form blocks empty email

- **WHEN** an external user opens the public intake form (`/apply` route) and tries to submit without filling email
- **THEN** the form MUST display a clear required-field error in Traditional Chinese (e.g., "請填寫 Email"); the submission MUST NOT proceed

#### Scenario: Asterisk indicator visible

- **WHEN** any intake form renders the email field
- **THEN** the field label MUST include a visible required indicator (e.g., red asterisk `*` or text `（必填）`)


<!-- @trace
source: add-auto-send-payment-receipt
updated: 2026-04-23
code:
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/applicationActions.ts
  - src/app/actions/intakeActions.ts
  - src/components/NewApplicationPage.tsx
  - src/components/ReimbursementPrintPanel.tsx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/UserSettingsPage.tsx
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/lib/pdf/registerFonts.ts
  - src/app/actions/boardGroupActions.ts
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/lib/numToChinese.ts
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - src/app/print/PrintButton.tsx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/org-line-qr.png
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/api/line/webhook/route.ts
  - src/lib/caseCategory.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - src/components/HomePage.tsx
  - src/lib/rocDate.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - src/app/actions/printDocumentActions.ts
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - src/components/SettingsPanel.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/components/ExternalIntake.tsx
  - src/components/NotificationManager.tsx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/lineActions.ts
  - src/app/actions/settingsActions.ts
  - src/app/actions/userActions.ts
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - scripts/init_db.sql
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/app/actions/notificationActions.ts
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - src/app/actions/notificationDispatcher.ts
  - src/app/actions/workflowActions.ts
  - src/lib/pdf/fonts/LICENSE.md
  - package.json
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - tmp/test-pdf.ts
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - src/App.tsx
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
-->

---
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


<!-- @trace
source: add-auto-send-payment-receipt
updated: 2026-04-23
code:
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/applicationActions.ts
  - src/app/actions/intakeActions.ts
  - src/components/NewApplicationPage.tsx
  - src/components/ReimbursementPrintPanel.tsx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/UserSettingsPage.tsx
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/lib/pdf/registerFonts.ts
  - src/app/actions/boardGroupActions.ts
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/lib/numToChinese.ts
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - src/app/print/PrintButton.tsx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/org-line-qr.png
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/api/line/webhook/route.ts
  - src/lib/caseCategory.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - src/components/HomePage.tsx
  - src/lib/rocDate.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - src/app/actions/printDocumentActions.ts
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - src/components/SettingsPanel.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/components/ExternalIntake.tsx
  - src/components/NotificationManager.tsx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/lineActions.ts
  - src/app/actions/settingsActions.ts
  - src/app/actions/userActions.ts
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - scripts/init_db.sql
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/app/actions/notificationActions.ts
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - src/app/actions/notificationDispatcher.ts
  - src/app/actions/workflowActions.ts
  - src/lib/pdf/fonts/LICENSE.md
  - package.json
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - tmp/test-pdf.ts
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - src/App.tsx
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
-->

---
### Requirement: Existing data not migrated

The DB column `users.email` SHALL remain nullable to preserve existing applicant records that lack email. This change SHALL NOT add a NOT NULL constraint and SHALL NOT backfill missing emails. Only NEW applicants created after this change MUST satisfy the validation.

#### Scenario: Schema unchanged for nullability

- **WHEN** querying `\d users` after this change is deployed
- **THEN** `email` column MUST still be marked nullable (`is_nullable = 'YES'`)

#### Scenario: Existing applicants without email remain valid

- **WHEN** a query reads any existing applicant row where `email IS NULL`
- **THEN** the read MUST succeed; no constraint violation MUST occur

<!-- @trace
source: add-auto-send-payment-receipt
updated: 2026-04-23
code:
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/applicationActions.ts
  - src/app/actions/intakeActions.ts
  - src/components/NewApplicationPage.tsx
  - src/components/ReimbursementPrintPanel.tsx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/UserSettingsPage.tsx
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/lib/pdf/registerFonts.ts
  - src/app/actions/boardGroupActions.ts
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/lib/numToChinese.ts
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - src/app/print/PrintButton.tsx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/org-line-qr.png
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/api/line/webhook/route.ts
  - src/lib/caseCategory.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - src/components/HomePage.tsx
  - src/lib/rocDate.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - src/app/actions/printDocumentActions.ts
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - src/components/SettingsPanel.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/components/ExternalIntake.tsx
  - src/components/NotificationManager.tsx
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/lineActions.ts
  - src/app/actions/settingsActions.ts
  - src/app/actions/userActions.ts
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - scripts/init_db.sql
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/app/actions/notificationActions.ts
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - src/app/actions/notificationDispatcher.ts
  - src/app/actions/workflowActions.ts
  - src/lib/pdf/fonts/LICENSE.md
  - package.json
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - tmp/test-pdf.ts
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - src/App.tsx
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
-->
