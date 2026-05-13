# pdf-document-generation Specification

## Purpose

TBD - created by archiving change 'add-auto-send-payment-receipt'. Update Purpose after archive.

## Requirements

### Requirement: PDF generation library and font registration

The system SHALL include `@react-pdf/renderer` as a dependency for server-side PDF generation. Traditional Chinese rendering SHALL be supported by registering a font family at module load time using `Font.register()` from `@react-pdf/renderer`. The font files (regular + bold weights) SHALL be loaded from a path inside the repository (not fetched from a remote URL at runtime). Module load MUST NOT throw if font files are missing — the system SHALL log a warning and continue with the library default font (which will not render Chinese correctly), so PDF generation can be diagnosed without crashing the entire app.

#### Scenario: Library installed and importable

- **WHEN** a server action calls `import { Document, Page } from '@react-pdf/renderer'`
- **THEN** the import MUST succeed at runtime; `pdf()` and `renderToBuffer` (or equivalent) MUST be available

#### Scenario: Font registered at startup

- **WHEN** the font registration module is first imported
- **THEN** `Font.register()` MUST be called for the Traditional Chinese font family with paths to local `.ttf` files for both `normal` and `bold` weights

#### Scenario: Missing font file logs and continues

- **WHEN** the font `.ttf` file is not found at the registered path
- **THEN** the registration MUST log `[pdf-fonts]` warning to console and MUST NOT throw; subsequent PDF generation MUST still produce a (possibly tofu-rendered) PDF


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
### Requirement: Payment receipt PDF component

The system SHALL provide a `PaymentReceiptPdf` React component (using `@react-pdf/renderer` primitives) that renders the same logical content as the HTML print page at `/print/payment-receipt/[applicationId]`: foundation header (8 org_* settings), date row auto-filled with current ROC date, applicant info (name + ID number + case number), category checkbox row marking the resolved category, payment amount in Chinese big characters using `numToChinese()`, and blank rows for payment method, payee, signature, and approver lines. The PDF SHALL be A4 portrait. The component SHALL accept the same DTO shape as `fetchPaymentReceiptPrintData` returns.

#### Scenario: Component renders to single A4 page

- **WHEN** `PaymentReceiptPdf` is rendered for a typical case
- **THEN** the produced PDF MUST be exactly 1 page sized A4 portrait

#### Scenario: Same data sources as HTML print page

- **WHEN** `PaymentReceiptPdf` is rendered with the same DTO that drives the HTML print page
- **THEN** all visible field values (applicant name, case number, ID number, category mark, amount in big characters, foundation header) MUST match the HTML print page's rendered output

#### Scenario: Missing approved amount renders blank slots

- **WHEN** `applications.approved_amount` is NULL
- **THEN** the 領款金額 row MUST render the empty placeholder text "新臺幣（大寫）仟 佰 拾 萬 仟 佰 拾 元整" (matching the HTML page behavior)

#### Scenario: Missing QR file omits image

- **WHEN** `org_line_qr_url` points to a path with no file present
- **THEN** the QR area MUST render as an empty bordered rectangle of the same dimensions; the PDF MUST NOT throw or produce a broken image marker


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
### Requirement: PDF buffer generation server function

The system SHALL provide an async function `generatePaymentReceiptPdf(applicationId, operatorUserId): Promise<Buffer>` (or equivalent stream-to-buffer) in `src/lib/pdf/generatePaymentReceiptPdf.ts`. The function SHALL: (a) call `fetchPaymentReceiptPrintData` with the operator's userId; (b) on auth failure throw an error containing "權限不足"; (c) on success render `PaymentReceiptPdf` to a `Buffer`; (d) return the Buffer.

#### Scenario: Successful generation returns non-empty Buffer

- **WHEN** an authorized operator calls `generatePaymentReceiptPdf(validId, operatorId)`
- **THEN** the function MUST resolve with a `Buffer` of length > 1000 bytes (a real PDF, not an empty/header-only file)

#### Scenario: Unauthorized caller rejected

- **WHEN** a non-admin non-accountant caller invokes `generatePaymentReceiptPdf`
- **THEN** the function MUST throw or reject with an error containing the substring "權限不足"

#### Scenario: Returned buffer starts with PDF magic bytes

- **WHEN** any successful call returns a buffer
- **THEN** the first 4 bytes MUST equal the ASCII sequence `%PDF`

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