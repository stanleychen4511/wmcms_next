# line-account-linking Specification

## Purpose

TBD - created by archiving change 'add-line-account-linking'. Update Purpose after archive.

## Requirements

### Requirement: Users table line_user_id column

The `users` table SHALL include a column `line_user_id TEXT UNIQUE` (nullable). A non-null value indicates the user has linked their LINE account; the value SHALL be the LINE userId (format: `U` + 32 hex characters). The UNIQUE constraint guarantees one LINE account maps to at most one system user.

#### Scenario: Column present after init

- **WHEN** `scripts/init_db.sql` is executed
- **THEN** `users.line_user_id` SHALL exist as nullable TEXT with UNIQUE constraint

#### Scenario: Duplicate LINE userId rejected

- **WHEN** an UPDATE attempts to set the same `line_user_id` on two different `users` rows
- **THEN** PostgreSQL SHALL reject the second UPDATE due to the UNIQUE constraint


<!-- @trace
source: add-line-account-linking
updated: 2026-04-22
code:
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - scripts/init_db.sql
  - src/app/api/line/webhook/route.ts
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/lineActions.ts
  - src/components/SettingsPanel.tsx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/App.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - package.json
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - src/app/actions/settingsActions.ts
  - src/components/HomePage.tsx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
-->

---
### Requirement: User line link codes table

The system SHALL provide a `user_line_link_codes` table with `user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE`, `code CHAR(6) NOT NULL`, `expires_at TIMESTAMPTZ NOT NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, plus an index on `(code)` for webhook lookup. The PK on `user_id` enforces one active code per user (UPSERT overwrites prior code).

#### Scenario: Table present after init

- **WHEN** `scripts/init_db.sql` is executed
- **THEN** `user_line_link_codes` SHALL exist with all specified columns

#### Scenario: One code per user enforced

- **WHEN** generating a new code for a user that already has a row
- **THEN** the existing row SHALL be UPDATED (no duplicate row created)


<!-- @trace
source: add-line-account-linking
updated: 2026-04-22
code:
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - scripts/init_db.sql
  - src/app/api/line/webhook/route.ts
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/lineActions.ts
  - src/components/SettingsPanel.tsx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/App.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - package.json
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - src/app/actions/settingsActions.ts
  - src/components/HomePage.tsx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
-->

---
### Requirement: Generate line link code server action

The system SHALL provide `generateLineLinkCode(operatorUserId)` that produces a fresh 6-digit numeric code valid for 30 minutes. The action SHALL fail if the user is already linked to a LINE account. On success it UPSERTs `user_line_link_codes` and writes an audit row `line.link_code_generated`. The audit `detail` SHALL NOT include the code value (only `expires_at`).

#### Scenario: Already-linked user blocked

- **WHEN** the operator user already has `users.line_user_id` not null
- **THEN** the action SHALL return `{ success: false, error: '此帳號已綁定 LINE，請先解除綁定' }`
- **AND** no row SHALL be inserted into `user_line_link_codes`

#### Scenario: Successful generation

- **WHEN** an unlinked user invokes the action
- **THEN** a row in `user_line_link_codes` SHALL exist for that user with a 6-character numeric `code` and `expires_at` set to ~30 minutes from now
- **AND** an audit row with `action='line.link_code_generated'` SHALL be written
- **AND** `audit_logs.detail` SHALL NOT contain the literal code value

#### Scenario: Re-generation overwrites old code

- **WHEN** the user generates a code, then generates again before completing binding
- **THEN** the second call SHALL overwrite the first row in `user_line_link_codes`
- **AND** the prior code SHALL no longer be valid (lookup by old code returns nothing)


<!-- @trace
source: add-line-account-linking
updated: 2026-04-22
code:
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - scripts/init_db.sql
  - src/app/api/line/webhook/route.ts
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/lineActions.ts
  - src/components/SettingsPanel.tsx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/App.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - package.json
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - src/app/actions/settingsActions.ts
  - src/components/HomePage.tsx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
-->

---
### Requirement: Webhook resolves binding state on message events

When the LINE webhook receives a `message` event, the handler SHALL:

1. Look up `users WHERE line_user_id = event.source.userId`.
2. If found, the handler SHALL NOT reply nor perform any binding action (Phase 3 may add business commands).
3. If not found:
   - If the message text is a 6-digit numeric string, the handler SHALL look up `user_line_link_codes WHERE code = $text AND expires_at > NOW()`.
     - If a matching row exists, the handler SHALL within a single transaction UPDATE `users.line_user_id = event.source.userId` for the matched user, DELETE the link_code row, write audit `line.account_linked` (detail: system_user_id, line_user_id), and reply via reply token "綁定成功！您是 [系統姓名]".
     - If a UNIQUE violation occurs (the LINE userId is already bound to another system user), reply "此 LINE 帳號已綁定其他系統使用者" without modifying any row.
     - If no matching row exists, reply "綁定碼無效或已過期".
   - If the text is not a 6-digit numeric string, reply "此 LINE 帳號尚未綁定。請至系統「個人設定」產生綁定碼後傳給我".

#### Scenario: Linked user message is silent

- **WHEN** a linked user sends any text to the bot
- **THEN** the handler SHALL NOT call reply API
- **AND** SHALL NOT modify any DB row except the existing audit log entry

#### Scenario: Valid binding code links the account

- **WHEN** an unlinked user sends a 6-digit code that matches an unexpired `user_line_link_codes` row
- **THEN** the linked user's `line_user_id` SHALL be set to the sender's LINE userId
- **AND** the link code row SHALL be deleted
- **AND** an audit `line.account_linked` row SHALL be written
- **AND** the bot SHALL reply with a success message including the linked user's display name

#### Scenario: Expired code rejected

- **WHEN** an unlinked user sends a 6-digit code where `expires_at <= NOW()`
- **THEN** the bot SHALL reply "綁定碼無效或已過期"
- **AND** no DB write SHALL occur (besides the standard webhook audit)

#### Scenario: Invalid format gets guidance reply

- **WHEN** an unlinked user sends "你好"
- **THEN** the bot SHALL reply with the guidance message

#### Scenario: LINE userId already bound elsewhere

- **WHEN** an unlinked LINE userId X sends a valid code, but X is already in `users.line_user_id` of another row (impossible if uniqueness was respected, but defensive)
- **THEN** the UPDATE SHALL fail due to UNIQUE constraint
- **AND** the bot SHALL reply "此 LINE 帳號已綁定其他系統使用者"


<!-- @trace
source: add-line-account-linking
updated: 2026-04-22
code:
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - scripts/init_db.sql
  - src/app/api/line/webhook/route.ts
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/lineActions.ts
  - src/components/SettingsPanel.tsx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/App.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - package.json
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - src/app/actions/settingsActions.ts
  - src/components/HomePage.tsx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
-->

---
### Requirement: Reply API helper

The system SHALL provide an internal helper `replyLineMessage(replyToken, text)` that calls the LINE Messaging API reply endpoint via the SDK's `replyMessage`. This helper SHALL be used by the webhook handler to respond to events without consuming the push message quota.

#### Scenario: Reply does not consume push quota

- **WHEN** the webhook handler replies to an event
- **THEN** the SDK call SHALL be `replyMessage` (not `pushMessage`)


<!-- @trace
source: add-line-account-linking
updated: 2026-04-22
code:
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - scripts/init_db.sql
  - src/app/api/line/webhook/route.ts
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/lineActions.ts
  - src/components/SettingsPanel.tsx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/App.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - package.json
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - src/app/actions/settingsActions.ts
  - src/components/HomePage.tsx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
-->

---
### Requirement: Unlink line account server action

The system SHALL provide `unlinkLine(operatorUserId)` that sets the user's `line_user_id` to NULL and writes an audit row `line.account_unlinked` whose `detail` includes `previous_line_user_id`.

#### Scenario: Successful unlink

- **WHEN** a linked user invokes `unlinkLine`
- **THEN** their `users.line_user_id` SHALL be NULL
- **AND** an audit row with `action='line.account_unlinked'` SHALL be written

#### Scenario: Unlink unlinked user is no-op

- **WHEN** an already-unlinked user invokes `unlinkLine`
- **THEN** the action SHALL return `{ success: true }` without writing audit


<!-- @trace
source: add-line-account-linking
updated: 2026-04-22
code:
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - scripts/init_db.sql
  - src/app/api/line/webhook/route.ts
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/lineActions.ts
  - src/components/SettingsPanel.tsx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/App.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - package.json
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - src/app/actions/settingsActions.ts
  - src/components/HomePage.tsx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
-->

---
### Requirement: Fetch line link status for personal settings UI

The system SHALL provide `fetchLineLinkStatus(operatorUserId)` returning `{ linked, lineUserIdSuffix, pendingCode }` where:
- `linked` is boolean (true iff `users.line_user_id` is not null)
- `lineUserIdSuffix` is the last 6 characters of the linked LINE userId, or null
- `pendingCode` is `{ code, expiresAt }` if an unexpired row exists in `user_line_link_codes`, else null

The full LINE userId SHALL NOT be returned to the client.

#### Scenario: Linked status with suffix

- **WHEN** the user's `line_user_id = 'U1234567890abcdef1234567890abcdef'`
- **THEN** `linked` SHALL be true and `lineUserIdSuffix` SHALL equal `'abcdef'`

#### Scenario: Unlinked with active pending code

- **WHEN** the user is unlinked but has an unexpired link code `'123456'`
- **THEN** `linked` SHALL be false, `lineUserIdSuffix` SHALL be null, and `pendingCode` SHALL be `{ code: '123456', expiresAt: ... }`

#### Scenario: Unlinked without pending code

- **WHEN** the user has neither `line_user_id` nor any `user_line_link_codes` row
- **THEN** all three fields SHALL indicate empty (linked=false, suffix=null, pendingCode=null)


<!-- @trace
source: add-line-account-linking
updated: 2026-04-22
code:
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - scripts/init_db.sql
  - src/app/api/line/webhook/route.ts
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/lineActions.ts
  - src/components/SettingsPanel.tsx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/App.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - package.json
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - src/app/actions/settingsActions.ts
  - src/components/HomePage.tsx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
-->

---
### Requirement: Personal settings UI for LINE binding

The system SHALL provide a personal settings page accessible to all logged-in users. The page SHALL include a "LINE 綁定" section with three states:

1. **Linked**: shows the bound LINE userId suffix (last 6 chars) and an "解除綁定" button.
2. **Unlinked, no pending code**: shows a "產生綁定碼" button.
3. **Unlinked, pending code**: shows the 6-digit code in large monospace font with copy-to-clipboard, the expiration countdown, an explicit add-friend link to the bot, and step-by-step instructions.

The add-friend link SHALL be `https://line.me/R/ti/p/{lineOfficialAccountId}` where `lineOfficialAccountId` comes from `system_settings` key `line_official_account_id`.

#### Scenario: Unlinked user generates code and sees instructions

- **WHEN** an unlinked user opens personal settings and clicks "產生綁定碼"
- **THEN** a 6-digit code SHALL appear, along with the add-friend link and step instructions
- **AND** the page SHALL display the expiration countdown

#### Scenario: Linked user sees suffix and unlink button

- **WHEN** a linked user opens the page
- **THEN** the suffix of their bound LINE userId SHALL be shown
- **AND** an "解除綁定" button SHALL be enabled

#### Scenario: Unlink with confirmation

- **WHEN** the user clicks "解除綁定" and confirms
- **THEN** `unlinkLine` SHALL be invoked and the page SHALL refetch showing the "unlinked" state


<!-- @trace
source: add-line-account-linking
updated: 2026-04-22
code:
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - scripts/init_db.sql
  - src/app/api/line/webhook/route.ts
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/lineActions.ts
  - src/components/SettingsPanel.tsx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/App.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - package.json
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - src/app/actions/settingsActions.ts
  - src/components/HomePage.tsx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
-->

---
### Requirement: Audit action types

The `AuditAction` union SHALL include the literals `'line.link_code_generated'`, `'line.account_linked'`, `'line.account_unlinked'`.

#### Scenario: TypeScript compilation includes literals

- **WHEN** the project builds
- **THEN** all three literals SHALL be present in `AuditAction`


<!-- @trace
source: add-line-account-linking
updated: 2026-04-22
code:
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - scripts/init_db.sql
  - src/app/api/line/webhook/route.ts
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/lineActions.ts
  - src/components/SettingsPanel.tsx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/App.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - package.json
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - src/app/actions/settingsActions.ts
  - src/components/HomePage.tsx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
-->

---
### Requirement: System setting for bot account id

The `system_settings` table SHALL include a key `line_official_account_id` (default empty string). When set to a non-empty value (typically `@xxxxxx`), the personal settings UI SHALL use it to construct the bot's add-friend URL.

#### Scenario: Default seeded

- **WHEN** `ensureDefaultSettings` runs against a fresh database
- **THEN** a row with `key = 'line_official_account_id'` and `value = ''` SHALL exist

<!-- @trace
source: add-line-account-linking
updated: 2026-04-22
code:
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - src/components/UserSettingsPage.tsx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - scripts/init_db.sql
  - src/app/api/line/webhook/route.ts
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/lineActions.ts
  - src/components/SettingsPanel.tsx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/App.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - package.json
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - src/app/actions/settingsActions.ts
  - src/components/HomePage.tsx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
-->