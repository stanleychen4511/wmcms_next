# organization-metadata-settings Specification

## Purpose

TBD - created by archiving change 'add-reimbursement-print-documents'. Update Purpose after archive.

## Requirements

### Requirement: Organization metadata settings seeded

The `system_settings` table SHALL contain eight keys describing the foundation's static metadata, seeded idempotently by both `scripts/init_db.sql` and `ensureDefaultSettings`:

| Key | Default value |
|-----|---------------|
| `org_full_name` | `財團法人萬美基金會` |
| `org_license_no` | `衛部醫字第 1121668099 號` |
| `org_registration_no` | `113 證他字第 000974 號` |
| `org_uniform_no` | `93155400` |
| `org_address` | `106005 台北市大安區金山南路二段 165 號 4 樓` |
| `org_phone` | `(02) 2321-2777` |
| `org_fax` | `(02) 2321-3828` |
| `org_line_qr_url` | `/org-line-qr.png` |

All values SHALL be stored as TEXT. Seeding SHALL use `INSERT ... ON CONFLICT (key) DO NOTHING` so existing values are preserved.

#### Scenario: All eight keys present after init

- **WHEN** `scripts/init_db.sql` is executed on a fresh database
- **THEN** a `SELECT key FROM system_settings WHERE key LIKE 'org_%'` MUST return exactly eight rows: org_full_name, org_license_no, org_registration_no, org_uniform_no, org_address, org_phone, org_fax, org_line_qr_url

#### Scenario: Re-running init preserves existing values

- **WHEN** an admin has changed `org_phone` to `(02) 9999-9999` and `scripts/init_db.sql` is executed again
- **THEN** `org_phone` MUST retain `(02) 9999-9999`; the ON CONFLICT DO NOTHING clause MUST NOT overwrite it

#### Scenario: ensureDefaultSettings backfills missing keys

- **WHEN** a DB instance is missing one or more org_* keys (e.g., upgraded from before this change) and `ensureDefaultSettings()` is called
- **THEN** all missing org_* keys MUST be inserted with their default values; existing keys MUST remain unchanged


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
### Requirement: Settings panel exposes organization metadata

The `SettingsPanel` admin UI SHALL register all eight `org_*` keys in `SETTING_LABEL`, `SETTING_HINT`, `SETTING_INPUT_TYPE`, and (where applicable) `SETTING_UNIT`. All eight MUST use `INPUT_TYPE = 'text'`. Labels MUST be in Traditional Chinese and MUST clearly indicate their purpose. Admins MUST be able to edit and save each key through the existing save-button flow.

#### Scenario: Admin sees organization setting rows

- **WHEN** an admin opens the "系統參數設定" tab
- **THEN** all eight org_* keys MUST appear as editable rows alongside existing settings

#### Scenario: Admin can update organization phone

- **WHEN** an admin changes the value of `org_phone` and clicks Save
- **THEN** the new value MUST be persisted to the DB; subsequent loads MUST display the new value; an audit log MUST be written


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
### Requirement: Print pages read organization metadata at render time

The `/print/review-opinion/[applicationId]` and `/print/payment-receipt/[applicationId]` server components SHALL read organization metadata from `system_settings` at request time (not from compiled constants), so that changes made via the admin UI take effect without redeployment.

#### Scenario: Updated header appears on next print

- **WHEN** an admin updates `org_address` via the settings panel at time T
- **THEN** any print page rendered at time > T MUST display the new address


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
### Requirement: LINE QR asset location and fallback

The LINE volunteer QR image SHALL be served from `public/org-line-qr.png` (the default referenced by `org_line_qr_url`). If an administrator changes `org_line_qr_url` to a different path or URL, the payment receipt print page SHALL use the new value. If the referenced file does not exist, the QR area SHALL render as a bordered empty box — the page MUST NOT display a broken-image icon.

#### Scenario: Default URL points to bundled asset

- **WHEN** the payment receipt page renders with default `org_line_qr_url = '/org-line-qr.png'`
- **THEN** the QR image MUST load from the static `public/` asset

#### Scenario: Missing QR file shows empty box

- **WHEN** `org_line_qr_url` is set to a path whose file does not exist
- **THEN** the QR area MUST render as an empty bordered container of the same dimensions; no broken-image icon MUST appear in the printed output

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