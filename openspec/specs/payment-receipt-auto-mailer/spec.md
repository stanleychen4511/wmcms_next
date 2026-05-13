# payment-receipt-auto-mailer Specification

## Purpose

TBD - created by archiving change 'add-auto-send-payment-receipt'. Update Purpose after archive.

## Requirements

### Requirement: Auto-send event triggered on advance to reimbursement

The `advanceWorkflowStage` server action SHALL trigger a new event `case_payment_receipt_to_applicant` whenever the advance transitions from `board_review` to `reimbursement`. The trigger SHALL be fire-and-forget (`void notifyEvent(...).catch(...)`) so failures MUST NOT roll back the stage advance. The trigger MUST fire AFTER the stage UPDATE COMMIT but adjacent to (and independent of) the existing `case_entered_board_review` trigger.

#### Scenario: Advance from board_review to reimbursement fires event

- **WHEN** `advanceWorkflowStage(appId, 'reimbursement', userId)` is called for a case currently in `board_review`
- **THEN** after the transaction commits, `notifyEvent('case_payment_receipt_to_applicant', { applicationId: appId })` MUST be invoked

#### Scenario: Other advances do NOT fire the event

- **WHEN** `advanceWorkflowStage` advances from `admin_review` to `home_visit` (or any non `board_review→reimbursement` transition)
- **THEN** the new event MUST NOT fire

#### Scenario: Notification failure does not block the advance

- **WHEN** the advance succeeds but `notifyEvent` throws an error
- **THEN** the case MUST be in `reimbursement` stage; the function MUST return `{ success: true }`

#### Scenario: Repeated advance triggers repeated send

- **WHEN** a case is retreated from `reimbursement` back to `board_review` then re-advanced to `reimbursement`
- **THEN** the event MUST fire again on each advance; each send MUST produce its own audit row


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
### Requirement: Single-applicant resolver

The dispatcher SHALL resolve `case_payment_receipt_to_applicant` to a list containing exactly one user_id: `applications.applicant_id` for the given application. If `applications.applicant_id` is NULL or refers to a non-existent or inactive user, the resolver MUST return an empty array (silent skip).

#### Scenario: Returns the applicant user

- **WHEN** the resolver runs for a case with `applicant_id = 14`
- **THEN** it MUST return `['14']`

#### Scenario: Inactive applicant skipped

- **WHEN** the resolver runs for a case whose applicant has `is_active = false`
- **THEN** it MUST return `[]`


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
### Requirement: Email-only channel for this event

For the event `case_payment_receipt_to_applicant`, the dispatcher SHALL send only via the `email` channel regardless of the recipient's `notification_channels` setting. The `line` channel MUST NOT be attempted for this event even if the applicant has `line_user_id` set and `'line'` in their channels.

#### Scenario: Email-only delivery

- **WHEN** the applicant's `notification_channels = '{email,line}'` and `line_user_id` is set
- **THEN** the dispatcher MUST send only the email; no LINE message MUST be pushed; the audit log entry's `channels_used` MUST be `['email']`

#### Scenario: Applicant without email skipped

- **WHEN** the applicant's `email` is NULL or empty
- **THEN** the dispatcher MUST NOT attempt to send; the audit log entry's `status_per_channel.email` MUST be `'skipped'` with reason `'applicant_email_missing'`


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
### Requirement: PDF attachment generated and attached

When dispatching `case_payment_receipt_to_applicant`, the dispatcher SHALL call `generatePaymentReceiptPdf(applicationId, systemOperatorUserId)` to obtain a PDF buffer, and pass it as an email attachment with filename `領款收據_{caseNumber}.pdf` and content type `application/pdf`. If PDF generation fails, the dispatcher SHALL log the error, write an audit entry with status `'failed'`, and MUST NOT send the email (no email-without-attachment fallback).

#### Scenario: PDF attached with case-specific filename

- **WHEN** the dispatch succeeds for application `case_number='A115001'`
- **THEN** the sent email MUST contain exactly one attachment with filename `領款收據_A115001.pdf` and contentType `application/pdf`

#### Scenario: PDF generation failure aborts send

- **WHEN** `generatePaymentReceiptPdf` throws
- **THEN** no email MUST be sent; an audit entry MUST be written with `action='notification.payment_receipt_sent'` and `detail.status='failed'` containing the error message


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
### Requirement: System email template seeded

`scripts/init_db.sql` SHALL idempotently seed a row in `notification_templates` with `name='email_case_payment_receipt_to_applicant'`, `channel='email'`, `status=1`, fixed subject "萬美基金會申請通過通知", and a body that includes the placeholders `{{申請人}}`, `{{案號}}`, `{{申請金額}}`, `{{核定金額}}` plus instructional text directing the applicant to print the attachment, fill in payee details, and mail it back to the foundation. The template name SHALL be added to `SYSTEM_TEMPLATE_NAMES` in `src/lib/systemTemplates.ts` so it is protected from deletion and rename via the existing system-template guard.

#### Scenario: Template present after init

- **WHEN** `scripts/init_db.sql` is executed against a fresh database
- **THEN** `SELECT name, channel, status FROM notification_templates WHERE name='email_case_payment_receipt_to_applicant'` MUST return one row with `channel='email'` and `status=1`

#### Scenario: Template protected from deletion

- **WHEN** an admin attempts `deleteTemplate(id)` on the `email_case_payment_receipt_to_applicant` row
- **THEN** the call MUST return `{ success: false, error: '系統範本不可刪除' }`

#### Scenario: Template body editable

- **WHEN** an admin updates the body of `email_case_payment_receipt_to_applicant` via `updateTemplate`
- **THEN** the call MUST succeed; the next dispatch MUST use the updated body

#### Scenario: Body placeholders rendered

- **WHEN** the dispatcher renders the body for a case with applicant `'王小明'`, `case_number='A115001'`, `apply_amount=80000`, `approved_amount=50000`
- **THEN** the rendered body MUST contain the literal substrings `'王小明'`, `'A115001'`, `'80,000'` (or `'80000'` depending on format), and `'50,000'` (or `'50000'`)


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
### Requirement: Audit logging for payment receipt sends

For each invocation of `case_payment_receipt_to_applicant` dispatch, the system SHALL write an audit log entry with `action='notification.payment_receipt_sent'`, `targetType='application'`, `targetId=applicationId`, and `detail` containing at least: `applicantUserId`, `recipientEmail` (or null), `pdfBytes` (or null), `status` (`'sent'` | `'failed'` | `'skipped_no_email'`), and `errorMessage` (or null). This is in addition to the existing `notification.event_dispatched` entry written by the dispatcher.

#### Scenario: Successful send writes both audits

- **WHEN** the dispatch succeeds
- **THEN** the database MUST contain two new audit rows for this case: one with `action='notification.event_dispatched'` and one with `action='notification.payment_receipt_sent'` and `detail.status='sent'`

#### Scenario: Skipped due to no email writes status_skipped audit

- **WHEN** the applicant has no email and dispatch is skipped
- **THEN** an audit row MUST be written with `action='notification.payment_receipt_sent'` and `detail.status='skipped_no_email'` and `detail.recipientEmail=null`


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
### Requirement: Audit action types extended

The `AuditAction` union type in `src/app/actions/auditActions.ts` SHALL include the new literal `'notification.payment_receipt_sent'`.

#### Scenario: TypeScript compilation accepts the new literal

- **WHEN** code calls `writeAuditLog({ action: 'notification.payment_receipt_sent', ... })`
- **THEN** the TypeScript compiler MUST accept it without error

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