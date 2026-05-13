# application-referral-tracking Specification

## Purpose

TBD - created by archiving change 'add-referral-tracking'. Update Purpose after archive.

## Requirements

### Requirement: Application source code column

The `applications` table SHALL include an `application_way` column (`CHAR(1)`, `NOT NULL`, `DEFAULT '1'`) with a CHECK constraint restricting values to `'1'` (self-proposed) and `'2'` (referred). Existing rows SHALL be auto-populated with `'1'` via the column default.

#### Scenario: Column exists after init_db.sql runs

- **WHEN** `scripts/init_db.sql` is executed against a fresh or existing database
- **THEN** `applications.application_way` SHALL exist with type `CHAR(1)`, `NOT NULL`, `DEFAULT '1'`
- **AND** a CHECK constraint SHALL restrict values to `'1'` or `'2'`

#### Scenario: Legacy rows default to self-proposed

- **WHEN** the column is added to a database that already contains applications
- **THEN** every existing row SHALL have `application_way = '1'`

#### Scenario: Invalid value rejected

- **WHEN** an INSERT or UPDATE attempts to set `application_way` to `'3'` or any non-allowed value
- **THEN** PostgreSQL SHALL reject the statement due to the CHECK constraint


<!-- @trace
source: add-referral-tracking
updated: 2026-04-21
code:
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - src/app/actions/notificationActions.ts
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/templateActions.ts
  - scripts/init_db.sql
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - src/app/actions/pendingDocAlertActions.ts
  - src/app/actions/userActions.ts
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - scripts/seed_admin.mjs
  - src/app/actions/referralUnitActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/App.tsx
  - CLAUDE.md
  - src/components/ReferralUnitManager.tsx
  - ~$醫療補助管理系統_需求規格書.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/app/actions/applicationActions.ts
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - src/app/actions/workflowActions.ts
  - src/components/SettingsPanel.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - src/components/HomePage.tsx
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - scripts/README.txt
  - src/components/NewApplicationPage.tsx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - src/app/actions/settingsActions.ts
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
-->

---
### Requirement: Referral units dictionary table

The system SHALL provide a `referral_units` table containing `id BIGSERIAL PK`, `name TEXT NOT NULL UNIQUE`, `contact_info TEXT`, `sort_order INT NOT NULL DEFAULT 0`, `is_active BOOLEAN NOT NULL DEFAULT TRUE`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, and `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.

#### Scenario: Table created on init

- **WHEN** `scripts/init_db.sql` is executed
- **THEN** the `referral_units` table SHALL exist with all specified columns and constraints

#### Scenario: Duplicate name rejected

- **WHEN** an INSERT attempts to create a referral unit with a name that already exists
- **THEN** PostgreSQL SHALL reject the statement due to the UNIQUE constraint on `name`


<!-- @trace
source: add-referral-tracking
updated: 2026-04-21
code:
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - src/app/actions/notificationActions.ts
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/templateActions.ts
  - scripts/init_db.sql
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - src/app/actions/pendingDocAlertActions.ts
  - src/app/actions/userActions.ts
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - scripts/seed_admin.mjs
  - src/app/actions/referralUnitActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/App.tsx
  - CLAUDE.md
  - src/components/ReferralUnitManager.tsx
  - ~$醫療補助管理系統_需求規格書.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/app/actions/applicationActions.ts
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - src/app/actions/workflowActions.ts
  - src/components/SettingsPanel.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - src/components/HomePage.tsx
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - scripts/README.txt
  - src/components/NewApplicationPage.tsx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - src/app/actions/settingsActions.ts
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
-->

---
### Requirement: Application referral unit foreign key

The `applications` table SHALL include a nullable `referral_unit_id BIGINT` column referencing `referral_units(id)` with `ON DELETE SET NULL`. The column SHALL be meaningful only when `application_way = '2'`; callers SHALL write `NULL` when `application_way = '1'`.

#### Scenario: FK column present

- **WHEN** the schema is inspected
- **THEN** `applications.referral_unit_id` SHALL exist as nullable `BIGINT` with FK to `referral_units(id) ON DELETE SET NULL`

#### Scenario: Deleting a referenced unit nullifies the FK

- **WHEN** a referral unit row is hard-deleted while at least one application references it
- **THEN** the application rows SHALL have `referral_unit_id` set to `NULL`
- **AND** no application rows SHALL be deleted


<!-- @trace
source: add-referral-tracking
updated: 2026-04-21
code:
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - src/app/actions/notificationActions.ts
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/templateActions.ts
  - scripts/init_db.sql
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - src/app/actions/pendingDocAlertActions.ts
  - src/app/actions/userActions.ts
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - scripts/seed_admin.mjs
  - src/app/actions/referralUnitActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/App.tsx
  - CLAUDE.md
  - src/components/ReferralUnitManager.tsx
  - ~$醫療補助管理系統_需求規格書.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/app/actions/applicationActions.ts
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - src/app/actions/workflowActions.ts
  - src/components/SettingsPanel.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - src/components/HomePage.tsx
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - scripts/README.txt
  - src/components/NewApplicationPage.tsx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - src/app/actions/settingsActions.ts
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
-->

---
### Requirement: Referral unit server actions

The system SHALL expose server actions for querying and managing referral units:

- `fetchActiveReferralUnits()` returns units where `is_active = TRUE`, ordered by `sort_order ASC, name ASC`.
- `fetchAllReferralUnits()` returns every unit regardless of active state, same ordering.
- `createReferralUnit(name, contactInfo, sortOrder, operatorUserId)` inserts a row and writes an audit log entry.
- `updateReferralUnit(id, name, contactInfo, sortOrder, operatorUserId)` updates a row and writes an audit log entry.
- `toggleReferralUnitActive(id, isActive, operatorUserId)` flips the flag and writes an audit log entry.

#### Scenario: Active fetch excludes disabled units

- **WHEN** `fetchActiveReferralUnits` is called and one unit has `is_active = FALSE`
- **THEN** the disabled unit SHALL NOT appear in the returned list

#### Scenario: Duplicate name on create returns error

- **WHEN** `createReferralUnit` is invoked with a name already used by another unit
- **THEN** the action SHALL return `{ success: false, error: ... }` without inserting
- **AND** no audit log entry SHALL be written

#### Scenario: Toggle writes audit log

- **WHEN** `toggleReferralUnitActive(id, false, userId)` succeeds
- **THEN** `audit_logs` SHALL contain a row with `action = 'referral_unit.toggle_active'`, `target_type = 'referral_unit'`, `target_id = id`, and `detail.is_active = false`


<!-- @trace
source: add-referral-tracking
updated: 2026-04-21
code:
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - src/app/actions/notificationActions.ts
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/templateActions.ts
  - scripts/init_db.sql
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - src/app/actions/pendingDocAlertActions.ts
  - src/app/actions/userActions.ts
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - scripts/seed_admin.mjs
  - src/app/actions/referralUnitActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/App.tsx
  - CLAUDE.md
  - src/components/ReferralUnitManager.tsx
  - ~$醫療補助管理系統_需求規格書.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/app/actions/applicationActions.ts
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - src/app/actions/workflowActions.ts
  - src/components/SettingsPanel.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - src/components/HomePage.tsx
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - scripts/README.txt
  - src/components/NewApplicationPage.tsx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - src/app/actions/settingsActions.ts
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
-->

---
### Requirement: New application form captures source

The `NewApplicationPage` SHALL present a required radio group "案件來源" (self-proposed / referred) and a conditional dropdown "轉介單位" that appears only when "referred" is selected.

#### Scenario: Default selection is self-proposed

- **WHEN** the page first loads
- **THEN** the radio "自提" SHALL be pre-selected
- **AND** the referral unit dropdown SHALL be hidden

#### Scenario: Referred shows unit dropdown

- **WHEN** the user selects "轉介"
- **THEN** a dropdown populated from `fetchActiveReferralUnits` SHALL become visible
- **AND** the submit button SHALL remain disabled until a unit is chosen

#### Scenario: No active units message

- **WHEN** the user selects "轉介" and `fetchActiveReferralUnits` returns an empty array
- **THEN** an inline message "請先至後台建立轉介單位" SHALL be displayed in place of the dropdown
- **AND** the form SHALL NOT be submittable with `application_way = '2'`

#### Scenario: Switching back to self-proposed clears unit

- **WHEN** the user picks "轉介", selects a unit, then switches back to "自提"
- **THEN** the stored `referralUnitId` state SHALL be cleared to `null`
- **AND** the submitted payload SHALL have `referralUnitId = null`


<!-- @trace
source: add-referral-tracking
updated: 2026-04-21
code:
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - src/app/actions/notificationActions.ts
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/templateActions.ts
  - scripts/init_db.sql
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - src/app/actions/pendingDocAlertActions.ts
  - src/app/actions/userActions.ts
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - scripts/seed_admin.mjs
  - src/app/actions/referralUnitActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/App.tsx
  - CLAUDE.md
  - src/components/ReferralUnitManager.tsx
  - ~$醫療補助管理系統_需求規格書.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/app/actions/applicationActions.ts
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - src/app/actions/workflowActions.ts
  - src/components/SettingsPanel.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - src/components/HomePage.tsx
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - scripts/README.txt
  - src/components/NewApplicationPage.tsx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - src/app/actions/settingsActions.ts
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
-->

---
### Requirement: createNewApplication validates referral fields

`createNewApplication` SHALL accept `applicationWay` and `referralUnitId` parameters, persist them, and validate that: (a) when `applicationWay = '2'`, `referralUnitId` MUST be a positive integer pointing to an active unit; (b) when `applicationWay = '1'`, `referralUnitId` MUST be stored as `NULL` regardless of input.

#### Scenario: Self-proposed stores null unit

- **WHEN** `createNewApplication` is called with `applicationWay = '1'` and any `referralUnitId` value
- **THEN** the inserted row SHALL have `application_way = '1'` and `referral_unit_id = NULL`

#### Scenario: Referred with invalid unit rejected

- **WHEN** `createNewApplication` is called with `applicationWay = '2'` and a `referralUnitId` that does not exist or has `is_active = FALSE`
- **THEN** the action SHALL return `{ success: false, error: ... }`
- **AND** no application row SHALL be inserted (transaction rolled back)

#### Scenario: Referred with valid unit succeeds

- **WHEN** `createNewApplication` is called with `applicationWay = '2'` and a valid active `referralUnitId`
- **THEN** the inserted row SHALL have `application_way = '2'` and `referral_unit_id = <provided id>`


<!-- @trace
source: add-referral-tracking
updated: 2026-04-21
code:
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - src/app/actions/notificationActions.ts
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/templateActions.ts
  - scripts/init_db.sql
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - src/app/actions/pendingDocAlertActions.ts
  - src/app/actions/userActions.ts
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - scripts/seed_admin.mjs
  - src/app/actions/referralUnitActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/App.tsx
  - CLAUDE.md
  - src/components/ReferralUnitManager.tsx
  - ~$醫療補助管理系統_需求規格書.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/app/actions/applicationActions.ts
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - src/app/actions/workflowActions.ts
  - src/components/SettingsPanel.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - src/components/HomePage.tsx
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - scripts/README.txt
  - src/components/NewApplicationPage.tsx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - src/app/actions/settingsActions.ts
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
-->

---
### Requirement: Admin can manage referral units

The admin panel SHALL include a dedicated tab "轉介單位管理" (accessible only to users with the `admin` role) that supports: listing all units (active + inactive), adding a new unit, inline-editing name / contact info / sort order, and toggling active state.

#### Scenario: Tab visible to admins

- **WHEN** a user with the `admin` role opens `AdminPanel`
- **THEN** a tab labeled "轉介單位管理" SHALL be visible in the tab bar

#### Scenario: Tab hidden from non-admins

- **WHEN** a user without the `admin` role opens `AdminPanel`
- **THEN** the "轉介單位管理" tab SHALL NOT appear

#### Scenario: Add new unit

- **WHEN** the admin fills the new-unit form with a unique name and submits
- **THEN** the unit SHALL appear in the list
- **AND** `fetchActiveReferralUnits` SHALL include the new unit on the next call

#### Scenario: Toggle active state

- **WHEN** the admin clicks the active toggle for an existing unit
- **THEN** `toggleReferralUnitActive` SHALL be invoked
- **AND** the unit's row SHALL reflect the new state without a full page reload
- **AND** the dropdown in `NewApplicationPage` SHALL reflect the change next time it is opened


<!-- @trace
source: add-referral-tracking
updated: 2026-04-21
code:
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - src/app/actions/notificationActions.ts
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/templateActions.ts
  - scripts/init_db.sql
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - src/app/actions/pendingDocAlertActions.ts
  - src/app/actions/userActions.ts
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - scripts/seed_admin.mjs
  - src/app/actions/referralUnitActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/App.tsx
  - CLAUDE.md
  - src/components/ReferralUnitManager.tsx
  - ~$醫療補助管理系統_需求規格書.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/app/actions/applicationActions.ts
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - src/app/actions/workflowActions.ts
  - src/components/SettingsPanel.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - src/components/HomePage.tsx
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - scripts/README.txt
  - src/components/NewApplicationPage.tsx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - src/app/actions/settingsActions.ts
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
-->

---
### Requirement: Application detail shows referral info

The application detail view SHALL display the case source ("自提" / "轉介") and, when applicable, the referral unit name.

#### Scenario: Self-proposed case displays source only

- **WHEN** the detail view renders a case with `application_way = '1'`
- **THEN** the UI SHALL show "案件來源: 自提"
- **AND** SHALL NOT show any referral unit label

#### Scenario: Referred case displays source and unit

- **WHEN** the detail view renders a case with `application_way = '2'` and `referral_unit_id` pointing to a valid unit
- **THEN** the UI SHALL show "案件來源: 轉介" and the unit name

#### Scenario: Referred case with deleted unit shows fallback

- **WHEN** the detail view renders a case with `application_way = '2'` but `referral_unit_id IS NULL` (unit was hard-deleted)
- **THEN** the UI SHALL show "案件來源: 轉介（單位已刪除）"


<!-- @trace
source: add-referral-tracking
updated: 2026-04-21
code:
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - src/app/actions/notificationActions.ts
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/templateActions.ts
  - scripts/init_db.sql
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - src/app/actions/pendingDocAlertActions.ts
  - src/app/actions/userActions.ts
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - scripts/seed_admin.mjs
  - src/app/actions/referralUnitActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/App.tsx
  - CLAUDE.md
  - src/components/ReferralUnitManager.tsx
  - ~$醫療補助管理系統_需求規格書.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/app/actions/applicationActions.ts
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - src/app/actions/workflowActions.ts
  - src/components/SettingsPanel.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - src/components/HomePage.tsx
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - scripts/README.txt
  - src/components/NewApplicationPage.tsx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - src/app/actions/settingsActions.ts
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
-->

---
### Requirement: Audit trail for referral unit management

The system SHALL extend the `AuditAction` union in `src/app/actions/auditActions.ts` with the literals `'referral_unit.create'`, `'referral_unit.update'`, `'referral_unit.toggle_active'`, and the `AuditTargetType` union with `'referral_unit'`. Each referral-unit CRUD server action SHALL write a corresponding audit entry.

#### Scenario: AuditAction type includes referral unit actions

- **WHEN** TypeScript compilation runs
- **THEN** `AuditAction` SHALL include `'referral_unit.create'`, `'referral_unit.update'`, `'referral_unit.toggle_active'`
- **AND** `AuditTargetType` SHALL include `'referral_unit'`

#### Scenario: Create writes audit log

- **WHEN** `createReferralUnit` successfully inserts a row
- **THEN** `audit_logs` SHALL contain a row with `action = 'referral_unit.create'`, `target_type = 'referral_unit'`, `target_id = <new id>`, and `detail.name = <provided name>`

<!-- @trace
source: add-referral-tracking
updated: 2026-04-21
code:
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - src/app/actions/notificationActions.ts
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/templateActions.ts
  - scripts/init_db.sql
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - src/app/actions/pendingDocAlertActions.ts
  - src/app/actions/userActions.ts
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - scripts/seed_admin.mjs
  - src/app/actions/referralUnitActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/App.tsx
  - CLAUDE.md
  - src/components/ReferralUnitManager.tsx
  - ~$醫療補助管理系統_需求規格書.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - src/app/actions/applicationActions.ts
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - src/app/actions/workflowActions.ts
  - src/components/SettingsPanel.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - src/components/HomePage.tsx
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - scripts/README.txt
  - src/components/NewApplicationPage.tsx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - src/app/actions/settingsActions.ts
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
-->