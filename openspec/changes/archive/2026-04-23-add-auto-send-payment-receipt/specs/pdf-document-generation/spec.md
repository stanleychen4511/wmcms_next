## ADDED Requirements

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
