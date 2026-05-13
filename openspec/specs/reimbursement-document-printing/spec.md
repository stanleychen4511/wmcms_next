# reimbursement-document-printing Specification

## Purpose

TBD - created by archiving change 'add-reimbursement-print-documents'. Update Purpose after archive.

## Requirements

### Requirement: Reimbursement print panel visibility and access control

The reimbursement-stage UI SHALL render a "Document Printing" section containing exactly three buttons: "審核意見表" (Review Opinion Form), "醫療收據" (Medical Receipt), "領款收據" (Payment Receipt). The section SHALL only be visible to users whose roles include `admin` OR `accountant`. The print server actions SHALL ALSO enforce role-based access on the server side, independent of UI visibility.

#### Scenario: Section hidden from non-privileged role

- **WHEN** a user with only the `case_officer` role views the reimbursement-stage panel of any case
- **THEN** the "Document Printing" section MUST NOT render

#### Scenario: Section visible to admin

- **WHEN** a user with the `admin` role views the reimbursement-stage panel
- **THEN** the "Document Printing" section MUST render with all three buttons enabled

#### Scenario: Section visible to accountant

- **WHEN** a user with the `accountant` role views the reimbursement-stage panel
- **THEN** the "Document Printing" section MUST render with all three buttons enabled

#### Scenario: Direct URL access blocked for unauthorized role

- **WHEN** a `case_officer` user navigates directly to `/print/review-opinion/<applicationId>` or `/print/payment-receipt/<applicationId>`
- **THEN** the print page MUST return HTTP 403 or redirect to the home page; print data MUST NOT be returned


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
### Requirement: Review opinion form print page

The system SHALL expose a server-rendered route at `/print/review-opinion/[applicationId]` that produces a print-friendly A4 layout matching the foundation's paper template. The page SHALL contain: foundation header (organization name + form title), case category checkbox row (A/B/C/D with one checkbox marked based on `case_number` first character), case number, applicant name (decrypted), case description (sourced from `home_visit.subsidy_need_reason`), board reviewer signature block (all electronic signatures from `board_review_signatures` rendered side-by-side as `<img>` with each signer's decrypted name below), review opinion text (sourced from `applications.board_review_comments`, with fallback "（未保存審核意見）" if NULL), review result row (checkbox 准予補助 with approved amount in 新台幣 OR 不准予補助), and review date (sourced from `application_workflow.reviewed_at` where stage='reimbursement', formatted as 民國年月日).

#### Scenario: Page renders all required sections for a complete case

- **WHEN** an authorized user opens `/print/review-opinion/<id>` for a case with `applicationsboard_review_comments` set, signatures present, approved amount > 0, and case_number starting with 'A'
- **THEN** the rendered HTML MUST include the foundation header, the 'A' category checkbox marked, applicant name decrypted, all signatures rendered as images side-by-side with names below, the saved board review opinion text, the 准予補助 checkbox marked with the approved amount displayed, and the review date in 民國年月日 format

#### Scenario: NULL board_review_comments shows fallback text

- **WHEN** a case has `board_review_comments` IS NULL (e.g., legacy case from before this change)
- **THEN** the review opinion area MUST display "（未保存審核意見）" instead of empty whitespace

#### Scenario: case_number with non A-D first character marks no checkbox

- **WHEN** the case_number's first character is not in {A, B, C, D}
- **THEN** all four category checkboxes MUST render unmarked; the page MUST NOT throw

#### Scenario: Print button triggers browser print dialog

- **WHEN** the user clicks the "列印" button on the print page
- **THEN** `window.print()` MUST be invoked; the print preview MUST render only the form area (the print button MUST be hidden via `@media print`)


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
### Requirement: Payment receipt print page

The system SHALL expose a server-rendered route at `/print/payment-receipt/[applicationId]` that produces a print-friendly A4 layout matching the foundation's paper template. The page SHALL contain: foundation header (org_full_name, org_license_no, org_registration_no, org_uniform_no, org_address, org_phone, org_fax sourced from system_settings, plus the LINE QR image from org_line_qr_url), an empty "此欄由基金會填寫" date and receipt number row (blank for handwriting), applicant name (decrypted), case number, ID number (decrypted), email and address rows (blank for handwriting since not currently in schema), category checkbox row (A/B/C/D), payment amount in Chinese big-character format (using `numToChinese` util on `applications.approved_amount`, with middle-zero rule), payment method row (blank checkboxes for handwriting), payee information block (blank), payee signature and date row (blank), and signature lines for 承辦人/主管/會計/執行長 (all blank).

#### Scenario: Foundation header populated from system_settings

- **WHEN** the page renders and system_settings has values for org_full_name, org_uniform_no, org_address, org_phone, org_fax
- **THEN** the rendered HTML MUST display these exact values in the header section

#### Scenario: Payment amount converted to Chinese big characters

- **WHEN** `applications.approved_amount` is 10500
- **THEN** the 領款金額 field MUST display "新臺幣 壹萬零伍佰元整"

#### Scenario: NULL approved_amount displays placeholder

- **WHEN** `applications.approved_amount` is NULL
- **THEN** the 領款金額 field MUST display blank Chinese-character slots ("仟佰拾萬仟佰拾元整") with no number filled

#### Scenario: Missing QR file gracefully handled

- **WHEN** `org_line_qr_url` points to a relative path and the file does not exist at that path
- **THEN** the QR area MUST render as an empty bordered box (NOT a broken-image icon); the rest of the page MUST render normally


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
### Requirement: Medical receipt direct-open behavior

The "醫療收據" button SHALL NOT open a generated print page. Instead, the system SHALL fetch all uploaded files from `application_documents` joined to `document_type_config` where `document_type_config.label = '醫療收據'` for the current application, and:
- if zero files exist, alert the user with text "該案尚未上傳醫療收據";
- if exactly one file exists, open that file's URL in a new browser tab;
- if two or more files exist, open a modal listing each file with an "開啟" button per file.

#### Scenario: No medical receipt uploaded

- **WHEN** an authorized user clicks "醫療收據" for a case with zero medical receipt uploads
- **THEN** an alert MUST display "該案尚未上傳醫療收據"; no new tab MUST open

#### Scenario: One medical receipt uploaded

- **WHEN** an authorized user clicks "醫療收據" for a case with exactly one medical receipt file at URL `https://example.com/r1.pdf`
- **THEN** a new browser tab MUST open at `https://example.com/r1.pdf`; no modal MUST appear

#### Scenario: Multiple medical receipts uploaded

- **WHEN** an authorized user clicks "醫療收據" for a case with three medical receipt files
- **THEN** a modal MUST appear listing all three files, each with an "開啟" button; clicking any "開啟" MUST open that file in a new tab


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
### Requirement: Print data assembly server actions

The system SHALL provide three server actions in `src/app/actions/printDocumentActions.ts`:
- `fetchReviewOpinionPrintData(applicationId, operatorUserId)` returning all data needed for the review opinion form
- `fetchPaymentReceiptPrintData(applicationId, operatorUserId)` returning all data needed for the payment receipt
- `fetchMedicalReceipts(applicationId, operatorUserId)` returning the list of uploaded medical receipt file URLs

Each action MUST verify that `operatorUserId` has the `admin` OR `accountant` role; if not, the action MUST return `{ success: false, error: '權限不足' }` and MUST NOT return data.

#### Scenario: Unauthorized user receives no data

- **WHEN** a non-admin non-accountant user (e.g., supervisor) calls `fetchReviewOpinionPrintData`
- **THEN** the action MUST return `{ success: false, error: '權限不足' }`; the returned object MUST NOT contain any case data

#### Scenario: Authorized accountant receives full data

- **WHEN** an accountant calls `fetchReviewOpinionPrintData` for a valid application
- **THEN** the action MUST return `{ success: true, data: {...} }` containing case_number, decrypted applicant name, board signatures with names, board_review_comments, approved_amount, review date, and category code


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
### Requirement: Case category derivation from case_number

The system SHALL provide a `resolveCategory(app)` utility in `src/lib/caseCategory.ts` that returns 'A', 'B', 'C', 'D', or null. The utility MUST first check `app.application_type` (the existing CHAR(1) column on `applications`); if that value is one of A/B/C/D it MUST be returned. Only when `application_type` is NULL or invalid SHALL the utility fall back to parsing the first character of `app.case_number`. The utility SHALL ALSO export `parseCategory(caseNumber)` (the lower-level case_number parser) and `CATEGORY_LABEL` mapping each category code to its full Chinese name. Both print pages SHALL use `resolveCategory` to determine which category checkbox to mark.

#### Scenario: application_type takes precedence

- **WHEN** `resolveCategory({ application_type: 'B', case_number: 'A115001' })` is called
- **THEN** it MUST return `'B'` (the column value, not the case_number prefix)

#### Scenario: Fallback to case_number when application_type is NULL

- **WHEN** `resolveCategory({ application_type: null, case_number: 'D115002' })` is called
- **THEN** it MUST return `'D'`

#### Scenario: Invalid first character returns null

- **WHEN** `parseCategory('X115001')` or `parseCategory('')` or `parseCategory(null)` is called
- **THEN** it MUST return `null` and MUST NOT throw

#### Scenario: Both sources invalid returns null

- **WHEN** `resolveCategory({ application_type: null, case_number: 'X115001' })` is called
- **THEN** it MUST return `null`

#### Scenario: Category labels match foundation form text

- **WHEN** the print pages render the category checkbox row
- **THEN** the labels MUST be exactly: A=「自費醫療補助」, B=「臨終安寧自費醫療補助」, C=「預立醫療照護諮商補助」, D=「醫事人員進修補助」


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
### Requirement: Number-to-Chinese amount conversion utility

The system SHALL provide `numToChinese(amount: number)` in `src/lib/numToChinese.ts` that converts a non-negative integer to traditional Chinese big-character format using digits 零壹貳參肆伍陸柒捌玖 and units 拾佰仟萬. Middle zeros within a number SHALL be rendered as a single 「零」 character; trailing zeros within a unit SHALL be omitted. Amount of 0 SHALL render as 「零」. The utility MUST handle integers up to 9,999,999; behavior beyond that is unspecified but MUST NOT throw.

#### Scenario: Basic conversion

- **WHEN** `numToChinese(1234)` is called
- **THEN** it MUST return `'壹仟貳佰參拾肆'`

#### Scenario: Middle zero rendered

- **WHEN** `numToChinese(10500)` is called
- **THEN** it MUST return `'壹萬零伍佰'`

#### Scenario: Trailing-unit zero omitted

- **WHEN** `numToChinese(1000000)` is called
- **THEN** it MUST return `'壹佰萬'`

#### Scenario: Zero amount

- **WHEN** `numToChinese(0)` is called
- **THEN** it MUST return `'零'`


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
### Requirement: ROC date formatting utility

The system SHALL provide `formatRocDate(dateInput, sep)` in `src/lib/rocDate.ts` that converts a `Date` or ISO string to a 民國年 string formatted as `民國{year} 年 {month} 月 {day} 日` (default sep). Null or undefined input SHALL return an empty string. ROC year SHALL be calculated as Gregorian year - 1911.

#### Scenario: Gregorian to ROC conversion

- **WHEN** `formatRocDate('2026-04-22')` is called
- **THEN** it MUST return `'民國115 年 4 月 22 日'`

#### Scenario: Null input returns empty

- **WHEN** `formatRocDate(null)` is called
- **THEN** it MUST return `''` and MUST NOT throw

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