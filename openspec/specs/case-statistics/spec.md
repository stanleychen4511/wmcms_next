# case-statistics Specification

## Purpose

TBD - created by archiving change 'add-case-statistics'. Update Purpose after archive.

## Requirements

### Requirement: Statistics view access control

A new top-level view `view='stats'` SHALL render the Case Statistics page. The HomePage quick action card and the view itself SHALL only be reachable by users whose roles include `admin` OR `supervisor` OR `chairman` OR `board_member`. The corresponding server actions MUST also enforce role-based access (server-side check independent of UI), rejecting other callers with `{ success: false, error: '權限不足' }`.

#### Scenario: HomePage card hidden from case_officer

- **WHEN** a user with only `case_officer` role views the HomePage
- **THEN** the "案件統計" quick action card MUST NOT render

#### Scenario: HomePage card visible to chairman

- **WHEN** a user with `chairman` role views the HomePage
- **THEN** the "案件統計" quick action card MUST render and clicking it MUST navigate to `view='stats'`

#### Scenario: Direct invocation rejected for unauthorized role

- **WHEN** a user without any of admin/supervisor/chairman/board_member roles directly calls `fetchCaseStatistics(...)` server action
- **THEN** the action MUST return `{ success: false, error: '權限不足' }` and MUST NOT execute any aggregation


<!-- @trace
source: add-case-statistics
updated: 2026-04-23
code:
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - src/app/actions/userActions.ts
  - src/app/actions/workflowActions.ts
  - src/components/CaseStatisticsDrillDownModal.tsx
  - src/app/actions/intakeActions.ts
  - src/app/print/PrintButton.tsx
  - src/components/ReimbursementPrintPanel.tsx
  - public/org-line-qr.png
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - src/lib/numToChinese.ts
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - scripts/init_db.sql
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - src/app/actions/notificationActions.ts
  - src/lib/pdf/registerFonts.ts
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - src/components/NewApplicationPage.tsx
  - src/app/actions/careRecordActions.ts
  - src/lib/caseCategory.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/ApplicantHistoryPage.tsx
  - src/components/CareRecordModal.tsx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/App.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/printDocumentActions.ts
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - tmp/test-pdf.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/HomePage.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - package.json
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/app/actions/boardGroupActions.ts
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/caseStatisticsActions.ts
  - src/components/ExternalIntake.tsx
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/components/CaseStatisticsPage.tsx
  - src/app/actions/settingsActions.ts
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
-->

---
### Requirement: Status outcome definition

The statistics SHALL classify cases by `applications.status` as follows:
- "approved" (通過): `status IN ('3', '4')`
- "rejected" (不通過): `status = '2'`
- In-progress (`status = '1'`) SHALL NOT be counted in approved or rejected totals; the system MAY surface their count as a separate informational field.

#### Scenario: Approved counts only status 3 or 4

- **WHEN** the dataset has cases with statuses `['1', '2', '2', '3', '3', '4']` matching the date range
- **THEN** the approved count MUST be 3 (two `'3'` + one `'4'`); rejected count MUST be 2; in-progress MUST be 1

#### Scenario: In-progress excluded from rate calculations

- **WHEN** the report calculates approval rate
- **THEN** the denominator MUST be `(approved + rejected)`, NOT total cases including in-progress


<!-- @trace
source: add-case-statistics
updated: 2026-04-23
code:
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - src/app/actions/userActions.ts
  - src/app/actions/workflowActions.ts
  - src/components/CaseStatisticsDrillDownModal.tsx
  - src/app/actions/intakeActions.ts
  - src/app/print/PrintButton.tsx
  - src/components/ReimbursementPrintPanel.tsx
  - public/org-line-qr.png
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - src/lib/numToChinese.ts
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - scripts/init_db.sql
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - src/app/actions/notificationActions.ts
  - src/lib/pdf/registerFonts.ts
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - src/components/NewApplicationPage.tsx
  - src/app/actions/careRecordActions.ts
  - src/lib/caseCategory.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/ApplicantHistoryPage.tsx
  - src/components/CareRecordModal.tsx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/App.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/printDocumentActions.ts
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - tmp/test-pdf.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/HomePage.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - package.json
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/app/actions/boardGroupActions.ts
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/caseStatisticsActions.ts
  - src/components/ExternalIntake.tsx
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/components/CaseStatisticsPage.tsx
  - src/app/actions/settingsActions.ts
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
-->

---
### Requirement: Date range filter on apply_at

The statistics SHALL filter cases by `applications.apply_at >= fromDate AND apply_at < (toDate + 1 day)` (inclusive of both ends in calendar-day semantics). Cases with `apply_at IS NULL` MUST be excluded.

#### Scenario: Inclusive range boundary

- **WHEN** `fromDate='2026-01-01'`, `toDate='2026-01-31'`, and a case has `apply_at='2026-01-31 23:59:00'`
- **THEN** that case MUST be included

#### Scenario: NULL apply_at excluded

- **WHEN** a case has `apply_at IS NULL` (orphan / partial intake)
- **THEN** that case MUST NOT appear in any aggregation

#### Scenario: Empty range returns zeros

- **WHEN** the range matches zero rows
- **THEN** the action MUST return `{ success: true }` with all dimension arrays empty and totals zero (NOT an error)


<!-- @trace
source: add-case-statistics
updated: 2026-04-23
code:
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - src/app/actions/userActions.ts
  - src/app/actions/workflowActions.ts
  - src/components/CaseStatisticsDrillDownModal.tsx
  - src/app/actions/intakeActions.ts
  - src/app/print/PrintButton.tsx
  - src/components/ReimbursementPrintPanel.tsx
  - public/org-line-qr.png
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - src/lib/numToChinese.ts
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - scripts/init_db.sql
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - src/app/actions/notificationActions.ts
  - src/lib/pdf/registerFonts.ts
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - src/components/NewApplicationPage.tsx
  - src/app/actions/careRecordActions.ts
  - src/lib/caseCategory.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/ApplicantHistoryPage.tsx
  - src/components/CareRecordModal.tsx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/App.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/printDocumentActions.ts
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - tmp/test-pdf.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/HomePage.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - package.json
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/app/actions/boardGroupActions.ts
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/caseStatisticsActions.ts
  - src/components/ExternalIntake.tsx
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/components/CaseStatisticsPage.tsx
  - src/app/actions/settingsActions.ts
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
-->

---
### Requirement: Top-level summary aggregation

`fetchCaseStatistics(operatorUserId, fromDate, toDate)` SHALL return a `total` object containing `approved`, `rejected`, `inProgress`, `approvalRate` (number 0..1, rounded to 4 decimals; 0 when denominator is 0).

#### Scenario: Approval rate basic calculation

- **WHEN** approved=6 and rejected=4
- **THEN** approvalRate MUST equal 0.6

#### Scenario: Zero-denominator approval rate

- **WHEN** both approved=0 and rejected=0
- **THEN** approvalRate MUST equal 0 (not NaN)


<!-- @trace
source: add-case-statistics
updated: 2026-04-23
code:
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - src/app/actions/userActions.ts
  - src/app/actions/workflowActions.ts
  - src/components/CaseStatisticsDrillDownModal.tsx
  - src/app/actions/intakeActions.ts
  - src/app/print/PrintButton.tsx
  - src/components/ReimbursementPrintPanel.tsx
  - public/org-line-qr.png
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - src/lib/numToChinese.ts
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - scripts/init_db.sql
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - src/app/actions/notificationActions.ts
  - src/lib/pdf/registerFonts.ts
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - src/components/NewApplicationPage.tsx
  - src/app/actions/careRecordActions.ts
  - src/lib/caseCategory.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/ApplicantHistoryPage.tsx
  - src/components/CareRecordModal.tsx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/App.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/printDocumentActions.ts
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - tmp/test-pdf.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/HomePage.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - package.json
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/app/actions/boardGroupActions.ts
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/caseStatisticsActions.ts
  - src/components/ExternalIntake.tsx
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/components/CaseStatisticsPage.tsx
  - src/app/actions/settingsActions.ts
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
-->

---
### Requirement: By case category dimension

The result SHALL include `byCategory: Array<{ category: 'A'|'B'|'C'|'D'|'unknown'; approved: number; rejected: number }>` covering all four categories (A/B/C/D) plus `'unknown'` when neither `application_type` nor case_number first character resolves to A-D. Categories with zero of both MUST still appear in the array (rendered with zeros), so the UI can show all rows.

#### Scenario: All four categories appear even with zero

- **WHEN** the dataset has only category B cases
- **THEN** `byCategory` MUST contain 4 entries (A=0/0, B=N/M, C=0/0, D=0/0); `'unknown'` MUST be omitted unless an unknown-category case exists

#### Scenario: application_type takes precedence over case_number

- **WHEN** a case has `application_type='B'` and `case_number='A115001'`
- **THEN** it MUST be counted under category B


<!-- @trace
source: add-case-statistics
updated: 2026-04-23
code:
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - src/app/actions/userActions.ts
  - src/app/actions/workflowActions.ts
  - src/components/CaseStatisticsDrillDownModal.tsx
  - src/app/actions/intakeActions.ts
  - src/app/print/PrintButton.tsx
  - src/components/ReimbursementPrintPanel.tsx
  - public/org-line-qr.png
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - src/lib/numToChinese.ts
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - scripts/init_db.sql
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - src/app/actions/notificationActions.ts
  - src/lib/pdf/registerFonts.ts
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - src/components/NewApplicationPage.tsx
  - src/app/actions/careRecordActions.ts
  - src/lib/caseCategory.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/ApplicantHistoryPage.tsx
  - src/components/CareRecordModal.tsx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/App.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/printDocumentActions.ts
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - tmp/test-pdf.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/HomePage.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - package.json
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/app/actions/boardGroupActions.ts
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/caseStatisticsActions.ts
  - src/components/ExternalIntake.tsx
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/components/CaseStatisticsPage.tsx
  - src/app/actions/settingsActions.ts
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
-->

---
### Requirement: By officer dimension

The result SHALL include `byOfficer: Array<{ officerId: string|null; officerName: string; approved: number; rejected: number }>` listing every officer who handled at least one approved-or-rejected case in the range. Cases with `officer_id IS NULL` MUST be aggregated under `officerId=null` with `officerName='（未派案）'`. Officer name MUST be decrypted from `users.name_enc` (fallback to account on decrypt failure).

#### Scenario: Officer name decrypted

- **WHEN** an officer with encrypted name '王小明' has 3 approved + 1 rejected cases
- **THEN** an entry `{ officerId: '<id>', officerName: '王小明', approved: 3, rejected: 1 }` MUST appear

#### Scenario: Unassigned cases bucketed

- **WHEN** 2 rejected cases have `officer_id IS NULL`
- **THEN** an entry `{ officerId: null, officerName: '（未派案）', approved: 0, rejected: 2 }` MUST appear


<!-- @trace
source: add-case-statistics
updated: 2026-04-23
code:
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - src/app/actions/userActions.ts
  - src/app/actions/workflowActions.ts
  - src/components/CaseStatisticsDrillDownModal.tsx
  - src/app/actions/intakeActions.ts
  - src/app/print/PrintButton.tsx
  - src/components/ReimbursementPrintPanel.tsx
  - public/org-line-qr.png
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - src/lib/numToChinese.ts
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - scripts/init_db.sql
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - src/app/actions/notificationActions.ts
  - src/lib/pdf/registerFonts.ts
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - src/components/NewApplicationPage.tsx
  - src/app/actions/careRecordActions.ts
  - src/lib/caseCategory.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/ApplicantHistoryPage.tsx
  - src/components/CareRecordModal.tsx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/App.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/printDocumentActions.ts
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - tmp/test-pdf.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/HomePage.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - package.json
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/app/actions/boardGroupActions.ts
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/caseStatisticsActions.ts
  - src/components/ExternalIntake.tsx
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/components/CaseStatisticsPage.tsx
  - src/app/actions/settingsActions.ts
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
-->

---
### Requirement: By application source dimension

The result SHALL include `bySource: { selfApply: { approved, rejected }, referrals: Array<{ referralUnitId: string|null; referralUnitName: string; approved, rejected }> }`. Self-apply (`application_way='1'`) is aggregated as a single bucket. Referrals (`application_way='2'`) MUST be grouped by `referral_unit_id`, with the referral unit's `name` joined; cases where `application_way='2'` but `referral_unit_id IS NULL` MUST be aggregated under `referralUnitId=null, referralUnitName='（未指定單位）'`.

#### Scenario: Self-apply aggregated separately

- **WHEN** 5 self-apply cases (3 approved, 2 rejected) and 2 referral cases exist
- **THEN** `bySource.selfApply` MUST equal `{ approved: 3, rejected: 2 }` and `bySource.referrals` MUST contain entries for the referral cases only

#### Scenario: Referral unit name displayed

- **WHEN** referral_unit `id=5` has name '台大醫院' and 4 cases
- **THEN** an entry `{ referralUnitId: '5', referralUnitName: '台大醫院', approved: ..., rejected: ... }` MUST appear in `bySource.referrals`


<!-- @trace
source: add-case-statistics
updated: 2026-04-23
code:
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - src/app/actions/userActions.ts
  - src/app/actions/workflowActions.ts
  - src/components/CaseStatisticsDrillDownModal.tsx
  - src/app/actions/intakeActions.ts
  - src/app/print/PrintButton.tsx
  - src/components/ReimbursementPrintPanel.tsx
  - public/org-line-qr.png
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - src/lib/numToChinese.ts
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - scripts/init_db.sql
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - src/app/actions/notificationActions.ts
  - src/lib/pdf/registerFonts.ts
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - src/components/NewApplicationPage.tsx
  - src/app/actions/careRecordActions.ts
  - src/lib/caseCategory.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/ApplicantHistoryPage.tsx
  - src/components/CareRecordModal.tsx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/App.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/printDocumentActions.ts
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - tmp/test-pdf.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/HomePage.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - package.json
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/app/actions/boardGroupActions.ts
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/caseStatisticsActions.ts
  - src/components/ExternalIntake.tsx
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/components/CaseStatisticsPage.tsx
  - src/app/actions/settingsActions.ts
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
-->

---
### Requirement: By month dimension

The result SHALL include `byMonth: Array<{ yearMonth: string; approved: number; rejected: number }>` where `yearMonth` is `YYYY-MM` derived from `apply_at`. Months between `fromDate` and `toDate` with zero cases MUST also appear (filling gaps), so trend lines are visually continuous.

#### Scenario: Sparse month gaps filled

- **WHEN** the range is 2026-01-01 to 2026-04-30 and only Jan and Mar have cases
- **THEN** `byMonth` MUST contain 4 entries: 2026-01, 2026-02 (zeros), 2026-03, 2026-04 (zeros)

#### Scenario: Month derived from apply_at year-month

- **WHEN** a case has `apply_at='2026-03-15'`
- **THEN** it MUST be aggregated under `yearMonth='2026-03'`


<!-- @trace
source: add-case-statistics
updated: 2026-04-23
code:
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - src/app/actions/userActions.ts
  - src/app/actions/workflowActions.ts
  - src/components/CaseStatisticsDrillDownModal.tsx
  - src/app/actions/intakeActions.ts
  - src/app/print/PrintButton.tsx
  - src/components/ReimbursementPrintPanel.tsx
  - public/org-line-qr.png
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - src/lib/numToChinese.ts
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - scripts/init_db.sql
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - src/app/actions/notificationActions.ts
  - src/lib/pdf/registerFonts.ts
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - src/components/NewApplicationPage.tsx
  - src/app/actions/careRecordActions.ts
  - src/lib/caseCategory.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/ApplicantHistoryPage.tsx
  - src/components/CareRecordModal.tsx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/App.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/printDocumentActions.ts
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - tmp/test-pdf.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/HomePage.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - package.json
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/app/actions/boardGroupActions.ts
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/caseStatisticsActions.ts
  - src/components/ExternalIntake.tsx
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/components/CaseStatisticsPage.tsx
  - src/app/actions/settingsActions.ts
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
-->

---
### Requirement: CSV export

The page SHALL provide a "下載 CSV" button that exports the current statistics view as a single CSV file (UTF-8 with BOM for Excel compatibility). The CSV MUST contain four sections separated by blank rows, in this order: top-level summary, by category, by officer, by source (self-apply line + referrals), by month. Each section MUST start with a heading row labeling the section, followed by column headers and data rows. The download filename MUST be `case_statistics_{fromDate}_to_{toDate}.csv`.

#### Scenario: CSV downloads with BOM

- **WHEN** the user clicks "下載 CSV"
- **THEN** the browser MUST trigger a file download with the named filename and the file's first 3 bytes MUST be the UTF-8 BOM (`EF BB BF`)

#### Scenario: All four dimensions present in CSV

- **WHEN** the CSV is opened
- **THEN** it MUST contain section headings labeled "總覽", "依類別", "依承辦人", "依案件來源", "依月份"

#### Scenario: Empty stats produces a valid CSV with zero rows

- **WHEN** the date range matches zero cases
- **THEN** the CSV MUST still download successfully with section headers and `0` in summary numbers


<!-- @trace
source: add-case-statistics
updated: 2026-04-23
code:
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - src/app/actions/userActions.ts
  - src/app/actions/workflowActions.ts
  - src/components/CaseStatisticsDrillDownModal.tsx
  - src/app/actions/intakeActions.ts
  - src/app/print/PrintButton.tsx
  - src/components/ReimbursementPrintPanel.tsx
  - public/org-line-qr.png
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - src/lib/numToChinese.ts
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - scripts/init_db.sql
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - src/app/actions/notificationActions.ts
  - src/lib/pdf/registerFonts.ts
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - src/components/NewApplicationPage.tsx
  - src/app/actions/careRecordActions.ts
  - src/lib/caseCategory.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/ApplicantHistoryPage.tsx
  - src/components/CareRecordModal.tsx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/App.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/printDocumentActions.ts
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - tmp/test-pdf.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/HomePage.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - package.json
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/app/actions/boardGroupActions.ts
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/caseStatisticsActions.ts
  - src/components/ExternalIntake.tsx
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/components/CaseStatisticsPage.tsx
  - src/app/actions/settingsActions.ts
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
-->

---
### Requirement: Drill-down by dimension value

`fetchCaseStatisticsDrillDown(operatorUserId, fromDate, toDate, dimension, dimensionValue, outcome)` SHALL return the case list matching the given dimension/outcome filter. Parameters:
- `dimension`: one of `'category' | 'officer' | 'source' | 'month'`
- `dimensionValue`: string identifier (e.g., `'B'` for category, officer userId, `'self'` or `referral:<unitId>` for source, `'2026-03'` for month)
- `outcome`: `'approved' | 'rejected'`

The returned list MUST contain `{ caseId, caseNumber, applicantName (decrypted), applyAt, approvedAmount, latestComment }` ordered by `apply_at DESC`. `latestComment` SHALL be the most recent `application_workflow.comments` for that case (or empty string if none). The action MUST enforce the same role gate as `fetchCaseStatistics`.

#### Scenario: Drill-down by category B rejected

- **WHEN** an admin calls `fetchCaseStatisticsDrillDown(adminId, '2026-01-01', '2026-04-30', 'category', 'B', 'rejected')`
- **THEN** the returned list MUST contain exactly the cases that are category B AND status='2' AND apply_at within range

#### Scenario: Drill-down by officer approved

- **WHEN** dimension='officer' and dimensionValue='5' and outcome='approved'
- **THEN** results MUST contain only cases with officer_id=5 AND status IN ('3','4') within range

#### Scenario: Drill-down by source self

- **WHEN** dimension='source' and dimensionValue='self' and outcome='rejected'
- **THEN** results MUST contain only cases with application_way='1' AND status='2' within range

#### Scenario: Drill-down by referral unit

- **WHEN** dimension='source' and dimensionValue='referral:5' and outcome='approved'
- **THEN** results MUST contain only cases with application_way='2' AND referral_unit_id=5 AND status IN ('3','4')

#### Scenario: Drill-down latestComment included

- **WHEN** any returned case has at least one application_workflow row
- **THEN** `latestComment` MUST equal the most recent stage's `comments` (text); otherwise it MUST be empty string


<!-- @trace
source: add-case-statistics
updated: 2026-04-23
code:
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - src/app/actions/userActions.ts
  - src/app/actions/workflowActions.ts
  - src/components/CaseStatisticsDrillDownModal.tsx
  - src/app/actions/intakeActions.ts
  - src/app/print/PrintButton.tsx
  - src/components/ReimbursementPrintPanel.tsx
  - public/org-line-qr.png
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - src/lib/numToChinese.ts
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - scripts/init_db.sql
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - src/app/actions/notificationActions.ts
  - src/lib/pdf/registerFonts.ts
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - src/components/NewApplicationPage.tsx
  - src/app/actions/careRecordActions.ts
  - src/lib/caseCategory.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/ApplicantHistoryPage.tsx
  - src/components/CareRecordModal.tsx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/App.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/printDocumentActions.ts
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - tmp/test-pdf.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/HomePage.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - package.json
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/app/actions/boardGroupActions.ts
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/caseStatisticsActions.ts
  - src/components/ExternalIntake.tsx
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/components/CaseStatisticsPage.tsx
  - src/app/actions/settingsActions.ts
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
-->

---
### Requirement: Audit logging on view

The system SHALL write an audit log entry with `action='case_statistics.viewed'`, `targetType='event'`, and `detail` containing `from`, `to`, and `operatorRole` (the highest-priority role from admin > supervisor > chairman > board_member) each time `fetchCaseStatistics` succeeds. The drill-down action SHALL NOT write a separate audit entry per call (drill-down is read-only and high-frequency; the parent fetch already audits).

#### Scenario: Successful fetch writes audit

- **WHEN** an admin calls `fetchCaseStatistics(adminId, '2026-01-01', '2026-04-30')` and it succeeds
- **THEN** an audit row MUST exist with `action='case_statistics.viewed'`, `user_id=adminId`, `detail.from='2026-01-01'`, `detail.to='2026-04-30'`, `detail.operatorRole='admin'`

#### Scenario: Unauthorized fetch does not audit

- **WHEN** an unauthorized caller invokes `fetchCaseStatistics`
- **THEN** the action MUST return the access-denied error without writing any audit row


<!-- @trace
source: add-case-statistics
updated: 2026-04-23
code:
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - src/app/actions/userActions.ts
  - src/app/actions/workflowActions.ts
  - src/components/CaseStatisticsDrillDownModal.tsx
  - src/app/actions/intakeActions.ts
  - src/app/print/PrintButton.tsx
  - src/components/ReimbursementPrintPanel.tsx
  - public/org-line-qr.png
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - src/lib/numToChinese.ts
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - scripts/init_db.sql
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - src/app/actions/notificationActions.ts
  - src/lib/pdf/registerFonts.ts
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - src/components/NewApplicationPage.tsx
  - src/app/actions/careRecordActions.ts
  - src/lib/caseCategory.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/ApplicantHistoryPage.tsx
  - src/components/CareRecordModal.tsx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/App.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/printDocumentActions.ts
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - tmp/test-pdf.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/HomePage.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - package.json
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/app/actions/boardGroupActions.ts
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/caseStatisticsActions.ts
  - src/components/ExternalIntake.tsx
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/components/CaseStatisticsPage.tsx
  - src/app/actions/settingsActions.ts
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
-->

---
### Requirement: Audit action types extended

The `AuditAction` union in `src/app/actions/auditActions.ts` SHALL include the new literal `'case_statistics.viewed'`.

#### Scenario: TypeScript accepts new audit literal

- **WHEN** code calls `writeAuditLog({ action: 'case_statistics.viewed', targetType: 'event', ... })`
- **THEN** the TypeScript compiler MUST accept it without error


<!-- @trace
source: add-case-statistics
updated: 2026-04-23
code:
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - src/app/actions/userActions.ts
  - src/app/actions/workflowActions.ts
  - src/components/CaseStatisticsDrillDownModal.tsx
  - src/app/actions/intakeActions.ts
  - src/app/print/PrintButton.tsx
  - src/components/ReimbursementPrintPanel.tsx
  - public/org-line-qr.png
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - src/lib/numToChinese.ts
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - scripts/init_db.sql
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - src/app/actions/notificationActions.ts
  - src/lib/pdf/registerFonts.ts
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - src/components/NewApplicationPage.tsx
  - src/app/actions/careRecordActions.ts
  - src/lib/caseCategory.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/ApplicantHistoryPage.tsx
  - src/components/CareRecordModal.tsx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/App.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/printDocumentActions.ts
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - tmp/test-pdf.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/HomePage.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - package.json
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/app/actions/boardGroupActions.ts
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/caseStatisticsActions.ts
  - src/components/ExternalIntake.tsx
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/components/CaseStatisticsPage.tsx
  - src/app/actions/settingsActions.ts
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
-->

---
### Requirement: UI date range and dimension table rendering

The Case Statistics page SHALL render a date range selector (default = current month: 1st to today) and four dimension tables: 依類別 / 依承辦人 / 依案件來源 / 依月份. Each cell containing a non-zero number MUST be a clickable button that opens the drill-down modal with the corresponding (dimension, dimensionValue, outcome). Cells with value 0 SHALL render as plain text (not clickable). The page MUST display the top-level summary (approved / rejected / approvalRate) at the top, plus the in-progress count as a separate informational note.

#### Scenario: Default date range = current month

- **WHEN** the page first loads
- **THEN** the date range picker MUST default `fromDate` to the first day of the current month (local time) and `toDate` to today

#### Scenario: Non-zero cell is clickable

- **WHEN** the byCategory table shows category B with `approved=5, rejected=2`
- **THEN** the "5" cell MUST be a clickable button; clicking it MUST open the drill-down modal with dimension='category', dimensionValue='B', outcome='approved'

#### Scenario: Zero cell not clickable

- **WHEN** a cell shows 0
- **THEN** that cell MUST render as plain text without click handler

#### Scenario: In-progress shown separately

- **WHEN** the range has 2 in-progress cases (status='1')
- **THEN** the page MUST display a small note like "進行中（不列入統計）：2 筆" near the summary; the 2 MUST NOT be added to approved or rejected totals


<!-- @trace
source: add-case-statistics
updated: 2026-04-23
code:
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - src/app/actions/userActions.ts
  - src/app/actions/workflowActions.ts
  - src/components/CaseStatisticsDrillDownModal.tsx
  - src/app/actions/intakeActions.ts
  - src/app/print/PrintButton.tsx
  - src/components/ReimbursementPrintPanel.tsx
  - public/org-line-qr.png
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - src/lib/numToChinese.ts
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - scripts/init_db.sql
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - src/app/actions/notificationActions.ts
  - src/lib/pdf/registerFonts.ts
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - src/components/NewApplicationPage.tsx
  - src/app/actions/careRecordActions.ts
  - src/lib/caseCategory.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/ApplicantHistoryPage.tsx
  - src/components/CareRecordModal.tsx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/App.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/printDocumentActions.ts
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - tmp/test-pdf.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/HomePage.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - package.json
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/app/actions/boardGroupActions.ts
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/caseStatisticsActions.ts
  - src/components/ExternalIntake.tsx
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/components/CaseStatisticsPage.tsx
  - src/app/actions/settingsActions.ts
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
-->

---
### Requirement: Drill-down modal shows case list

The drill-down modal SHALL display the case list from `fetchCaseStatisticsDrillDown` in a table with columns: 案號 / 申請人 / 收件日期 / 核准金額 / 最近一筆審核意見. The modal title MUST indicate the filter (e.g., "類別 B - 不通過案件 (5 筆)"). Clicking a row MAY navigate to the case detail page (using existing `setSelectedAppId` + `setView('detail')` flow); this is OPTIONAL.

#### Scenario: Modal title reflects filter

- **WHEN** the modal opens for category B rejected
- **THEN** the title MUST contain the substring "類別 B" AND "不通過"

#### Scenario: Empty list shows placeholder

- **WHEN** `fetchCaseStatisticsDrillDown` returns an empty array
- **THEN** the modal MUST display a placeholder text like "（無資料）" instead of an empty table

<!-- @trace
source: add-case-statistics
updated: 2026-04-23
code:
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - src/app/actions/userActions.ts
  - src/app/actions/workflowActions.ts
  - src/components/CaseStatisticsDrillDownModal.tsx
  - src/app/actions/intakeActions.ts
  - src/app/print/PrintButton.tsx
  - src/components/ReimbursementPrintPanel.tsx
  - public/org-line-qr.png
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - src/lib/pdf/fonts/NotoSansTC-Regular.ttf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - src/lib/numToChinese.ts
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/notificationDispatcher.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - scripts/init_db.sql
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - src/app/actions/notificationActions.ts
  - src/lib/pdf/registerFonts.ts
  - src/lib/rocDate.ts
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - src/app/actions/applicationActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - src/app/print/review-opinion/[applicationId]/page.tsx
  - src/components/NewApplicationPage.tsx
  - src/app/actions/careRecordActions.ts
  - src/lib/caseCategory.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - src/lib/pdf/PaymentReceiptPdf.tsx
  - src/components/ApplicantHistoryPage.tsx
  - src/components/CareRecordModal.tsx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/App.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/printDocumentActions.ts
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/lib/pdf/fonts/NotoSansTC-Bold.ttf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - tmp/test-pdf.ts
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/HomePage.tsx
  - src/lib/systemTemplates.ts
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - src/lib/pdf/generatePaymentReceiptPdf.tsx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - package.json
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/app/actions/boardGroupActions.ts
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/caseStatisticsActions.ts
  - src/components/ExternalIntake.tsx
  - src/app/print/payment-receipt/[applicationId]/page.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/lib/pdf/fonts/LICENSE.md
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382899855.png
  - src/components/CaseStatisticsPage.tsx
  - src/app/actions/settingsActions.ts
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
-->