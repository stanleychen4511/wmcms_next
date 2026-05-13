# case-basics-editing Specification

## Purpose

TBD - created by archiving change 'allow-editing-case-basics-in-admin-review'. Update Purpose after archive.

## Requirements

### Requirement: Server action for editing case basics

The system SHALL provide a server action `updateApplicationBasics(applicationId, patch, operatorUserId)` that updates an application's `application_way`, `referral_unit_id`, and the applicant's encrypted name fields (`users.name_enc` / `name_iv` / `name_bidx`) within a single database transaction. The `patch` argument SHALL be a partial object whose keys SHALL be chosen from `applicantName`, `applicationWay`, and `referralUnitId`; omitted keys mean "no change". The `application_type` column SHALL NOT be modifiable through this action — it is locked to preserve consistency with `case_number`'s first-letter prefix.

#### Scenario: Partial patch touches only provided fields

- **WHEN** the action is called with a patch containing only `applicationWay`
- **THEN** only `applications.application_way` (and `referral_unit_id` if normalization applies) SHALL be updated
- **AND** `users.name_enc`, `applications.application_type`, and any other column SHALL NOT be modified

#### Scenario: Full patch updates editable fields atomically

- **WHEN** the action is called with `applicantName`, `applicationWay`, and `referralUnitId` set and validation passes
- **THEN** a single transaction SHALL update both `users` (name fields) and `applications` (way + referral_unit_id)
- **AND** on any SQL error the entire transaction SHALL roll back

#### Scenario: applicationType key ignored

- **WHEN** a caller includes `applicationType` in the patch (e.g. via TypeScript `any` cast)
- **THEN** the server action SHALL NOT update `applications.application_type`
- **AND** the audit log (if written) SHALL NOT include `applicationType` in `changedFields`


<!-- @trace
source: allow-editing-case-basics-in-admin-review
updated: 2026-04-21
code:
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - scripts/seed_admin.mjs
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - scripts/seed_users.mjs
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/app/actions/userActions.ts
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/templateActions.ts
  - src/components/AdminPanel.tsx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/components/HomePage.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - src/components/EditCaseBasicsModal.tsx
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - scripts/init_db.sql
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - src/app/actions/settingsActions.ts
  - src/app/actions/auditActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/app/actions/notificationActions.ts
  - scripts/README.txt
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/app/actions/referralUnitActions.ts
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - src/App.tsx
  - src/app/actions/applicationActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/banners/banner_1776382867741.png
  - src/components/CaseListPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - CLAUDE.md
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - src/components/ReferralUnitManager.tsx
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
-->

---
### Requirement: Editing restricted to admin-review stage

The server action SHALL reject any call when the target application's `status` is not `'1'` OR its current `application_workflow.stage` is not `'admin_review'`. The action SHALL return `{ success: false, error: ... }` without performing any UPDATE.

#### Scenario: Closed case rejected

- **WHEN** the target application has `status = '2'` (審核未通過)
- **THEN** the action SHALL return a failure result
- **AND** no database rows SHALL be modified

#### Scenario: Home visit stage rejected

- **WHEN** the target application has `status = '1'` but `application_workflow.stage = 'home_visit'`
- **THEN** the action SHALL return a failure result with an error indicating the stage is no longer editable

#### Scenario: Admin-review stage allowed

- **WHEN** the target application has `status = '1'` AND `application_workflow.stage = 'admin_review'`
- **THEN** the action SHALL proceed to permission checks


<!-- @trace
source: allow-editing-case-basics-in-admin-review
updated: 2026-04-21
code:
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - scripts/seed_admin.mjs
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - scripts/seed_users.mjs
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/app/actions/userActions.ts
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/templateActions.ts
  - src/components/AdminPanel.tsx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/components/HomePage.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - src/components/EditCaseBasicsModal.tsx
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - scripts/init_db.sql
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - src/app/actions/settingsActions.ts
  - src/app/actions/auditActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/app/actions/notificationActions.ts
  - scripts/README.txt
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/app/actions/referralUnitActions.ts
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - src/App.tsx
  - src/app/actions/applicationActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/banners/banner_1776382867741.png
  - src/components/CaseListPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - CLAUDE.md
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - src/components/ReferralUnitManager.tsx
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
-->

---
### Requirement: Permission restricted to case officer or admin

The server action SHALL allow the UPDATE only when `operatorUserId` equals `applications.officer_id` OR when `operatorUserId` is associated with the `admin` role in `user_roles`. Any other caller SHALL receive a failure response without modification.

#### Scenario: Case officer allowed

- **WHEN** `operatorUserId` equals `applications.officer_id`
- **THEN** the action SHALL proceed past the permission check

#### Scenario: Admin allowed regardless of officer assignment

- **WHEN** `operatorUserId` is not the case officer but holds the `admin` role
- **THEN** the action SHALL proceed past the permission check

#### Scenario: Unrelated officer rejected

- **WHEN** `operatorUserId` is another case officer that is neither this case's officer nor an admin
- **THEN** the action SHALL return a failure result with an error about permission
- **AND** no database rows SHALL be modified


<!-- @trace
source: allow-editing-case-basics-in-admin-review
updated: 2026-04-21
code:
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - scripts/seed_admin.mjs
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - scripts/seed_users.mjs
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/app/actions/userActions.ts
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/templateActions.ts
  - src/components/AdminPanel.tsx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/components/HomePage.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - src/components/EditCaseBasicsModal.tsx
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - scripts/init_db.sql
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - src/app/actions/settingsActions.ts
  - src/app/actions/auditActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/app/actions/notificationActions.ts
  - scripts/README.txt
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/app/actions/referralUnitActions.ts
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - src/App.tsx
  - src/app/actions/applicationActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/banners/banner_1776382867741.png
  - src/components/CaseListPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - CLAUDE.md
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - src/components/ReferralUnitManager.tsx
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
-->

---
### Requirement: Referral unit validated when application way is referred

When the patch sets `applicationWay = '2'` (directly or leaves it as the existing value `'2'`), the server action SHALL verify that `referralUnitId` is non-null, exists in `referral_units`, and has `is_active = TRUE`. Setting `applicationWay = '1'` SHALL force `referral_unit_id` to `NULL` regardless of any `referralUnitId` in the patch.

#### Scenario: Referred with missing unit rejected

- **WHEN** the resulting `application_way` would be `'2'` but `referralUnitId` is `null` or missing
- **THEN** the action SHALL return a failure result

#### Scenario: Referred with inactive unit rejected

- **WHEN** the resulting `application_way` would be `'2'` and `referralUnitId` points to a unit with `is_active = FALSE`
- **THEN** the action SHALL return a failure result

#### Scenario: Self-proposed forces unit to null

- **WHEN** the patch sets `applicationWay = '1'` and also includes `referralUnitId = '5'`
- **THEN** the persisted `applications.referral_unit_id` SHALL be `NULL`


<!-- @trace
source: allow-editing-case-basics-in-admin-review
updated: 2026-04-21
code:
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - scripts/seed_admin.mjs
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - scripts/seed_users.mjs
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/app/actions/userActions.ts
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/templateActions.ts
  - src/components/AdminPanel.tsx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/components/HomePage.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - src/components/EditCaseBasicsModal.tsx
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - scripts/init_db.sql
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - src/app/actions/settingsActions.ts
  - src/app/actions/auditActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/app/actions/notificationActions.ts
  - scripts/README.txt
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/app/actions/referralUnitActions.ts
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - src/App.tsx
  - src/app/actions/applicationActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/banners/banner_1776382867741.png
  - src/components/CaseListPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - CLAUDE.md
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - src/components/ReferralUnitManager.tsx
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
-->

---
### Requirement: Applicant name update re-encrypts and re-indexes

When the patch includes a non-empty `applicantName` that differs from the current decrypted name on the applicant user, the server action SHALL generate a new IV and produce fresh `name_enc`, `name_iv`, and `name_bidx` (blind index computed with the applicant user's existing `search_salt`).

#### Scenario: Name change updates all three fields

- **WHEN** the stored name is "王小名" and `applicantName = "王小明"` is provided
- **THEN** the `users` row for `applicants.id = applications.applicant_id` SHALL have new values for `name_enc`, `name_iv`, and `name_bidx`

#### Scenario: Same name is a no-op

- **WHEN** the stored name equals the provided `applicantName`
- **THEN** no UPDATE SHALL be issued against `users`

#### Scenario: Name length limit enforced

- **WHEN** `applicantName` is an empty string or has length greater than 50 characters
- **THEN** the action SHALL return a failure result without modifying any row


<!-- @trace
source: allow-editing-case-basics-in-admin-review
updated: 2026-04-21
code:
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - scripts/seed_admin.mjs
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - scripts/seed_users.mjs
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/app/actions/userActions.ts
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/templateActions.ts
  - src/components/AdminPanel.tsx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/components/HomePage.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - src/components/EditCaseBasicsModal.tsx
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - scripts/init_db.sql
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - src/app/actions/settingsActions.ts
  - src/app/actions/auditActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/app/actions/notificationActions.ts
  - scripts/README.txt
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/app/actions/referralUnitActions.ts
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - src/App.tsx
  - src/app/actions/applicationActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/banners/banner_1776382867741.png
  - src/components/CaseListPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - CLAUDE.md
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - src/components/ReferralUnitManager.tsx
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
-->

---
### Requirement: Audit log records before and after diff

The server action SHALL write an entry to `audit_logs` with `action = 'application.basics_update'`, `target_type = 'application'`, `target_id = applicationId`, and `detail` containing three keys: `changedFields` (array of field names actually changed), `before` (object with the prior values only of changed fields), and `after` (object with the new values only of changed fields). If no field actually changed, the action SHALL NOT write any audit entry.

#### Scenario: AuditAction type includes new action

- **WHEN** TypeScript compilation runs
- **THEN** the `AuditAction` union in `src/app/actions/auditActions.ts` SHALL include `'application.basics_update'`

#### Scenario: Single field change logs minimal diff

- **WHEN** only `applicationWay` changes from `'1'` to `'2'`（含 referralUnitId 變更為有效單位）
- **THEN** `audit_logs.detail.changedFields` SHALL contain `"applicationWay"` and `"referralUnitId"`
- **AND** `detail.before` SHALL contain only those two fields with old values
- **AND** `detail.after` SHALL contain only those two fields with new values

#### Scenario: No changes means no audit entry

- **WHEN** the patch values all equal the current stored values
- **THEN** no new row SHALL be inserted into `audit_logs`


<!-- @trace
source: allow-editing-case-basics-in-admin-review
updated: 2026-04-21
code:
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - scripts/seed_admin.mjs
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - scripts/seed_users.mjs
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/app/actions/userActions.ts
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/templateActions.ts
  - src/components/AdminPanel.tsx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/components/HomePage.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - src/components/EditCaseBasicsModal.tsx
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - scripts/init_db.sql
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - src/app/actions/settingsActions.ts
  - src/app/actions/auditActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/app/actions/notificationActions.ts
  - scripts/README.txt
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/app/actions/referralUnitActions.ts
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - src/App.tsx
  - src/app/actions/applicationActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/banners/banner_1776382867741.png
  - src/components/CaseListPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - CLAUDE.md
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - src/components/ReferralUnitManager.tsx
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
-->

---
### Requirement: Detail page surfaces the edit button conditionally

The application detail UI SHALL display a "編輯案件基本資訊" button near the case source strip when all three conditions hold: `appDetail.status === '1'`, `appDetail.stage === 'admin_review'`, and (`loggedInUser.id === appDetail.officerId` OR `loggedInUser.roles` includes `'admin'`). When any condition is false, the button SHALL NOT render.

#### Scenario: Case officer sees button on admin_review case

- **WHEN** the logged-in user is the case's officer AND stage is admin_review AND status is '1'
- **THEN** the "編輯案件基本資訊" button SHALL be visible

#### Scenario: Admin sees button regardless of officer

- **WHEN** the logged-in user has the admin role AND stage is admin_review AND status is '1'
- **THEN** the button SHALL be visible

#### Scenario: Button hidden on home-visit stage

- **WHEN** the case's current stage is `home_visit`
- **THEN** the button SHALL NOT render

#### Scenario: Button hidden on closed case

- **WHEN** the case status is `'2'` or `'4'`
- **THEN** the button SHALL NOT render

#### Scenario: Button hidden from unrelated officers

- **WHEN** the logged-in user is a case officer who is not this case's officer AND is not an admin
- **THEN** the button SHALL NOT render


<!-- @trace
source: allow-editing-case-basics-in-admin-review
updated: 2026-04-21
code:
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - scripts/seed_admin.mjs
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - scripts/seed_users.mjs
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/app/actions/userActions.ts
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/templateActions.ts
  - src/components/AdminPanel.tsx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/components/HomePage.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - src/components/EditCaseBasicsModal.tsx
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - scripts/init_db.sql
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - src/app/actions/settingsActions.ts
  - src/app/actions/auditActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/app/actions/notificationActions.ts
  - scripts/README.txt
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/app/actions/referralUnitActions.ts
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - src/App.tsx
  - src/app/actions/applicationActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/banners/banner_1776382867741.png
  - src/components/CaseListPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - CLAUDE.md
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - src/components/ReferralUnitManager.tsx
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
-->

---
### Requirement: Edit modal fields and validation

The edit modal SHALL present: a required name text field (≤ 50 chars), a READ-ONLY display of the application type with an explanatory note that it cannot be changed, an application-way radio group (self-proposed / referred), and a conditional referral-unit select that appears only when "referred" is selected and loads active units via `fetchActiveReferralUnits`. Client-side validation SHALL block submission when name is empty, name exceeds 50 chars, or application-way is "referred" but no unit is chosen.

#### Scenario: Application type displayed as read-only

- **WHEN** the modal opens
- **THEN** the application type SHALL be rendered as a static label (not a select input)
- **AND** a note SHALL inform the user that changing the type requires closing the case as rejected and creating a new one

#### Scenario: Switching to self-proposed clears unit state

- **WHEN** the user selects "referred", picks a unit, then switches back to "self-proposed"
- **THEN** the submitted patch SHALL carry `referralUnitId = null`

#### Scenario: Submit disabled until all validations pass

- **WHEN** the user enters an empty name
- **THEN** the submit button SHALL be disabled or submission SHALL be rejected with an inline error

#### Scenario: Successful submit refreshes detail view

- **WHEN** the submit succeeds
- **THEN** the modal SHALL close
- **AND** the detail view SHALL re-fetch and display the updated fields (name, type, way, unit)

<!-- @trace
source: allow-editing-case-basics-in-admin-review
updated: 2026-04-21
code:
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - scripts/seed_admin.mjs
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - scripts/seed_users.mjs
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/app/actions/userActions.ts
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/templateActions.ts
  - src/components/AdminPanel.tsx
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/components/HomePage.tsx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - src/components/EditCaseBasicsModal.tsx
  - src/components/SettingsPanel.tsx
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - scripts/init_db.sql
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - src/app/actions/settingsActions.ts
  - src/app/actions/auditActions.ts
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/app/actions/notificationActions.ts
  - scripts/README.txt
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - src/app/actions/referralUnitActions.ts
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - src/App.tsx
  - src/app/actions/applicationActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/banners/banner_1776382867741.png
  - src/components/CaseListPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - CLAUDE.md
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - src/components/ReferralUnitManager.tsx
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
-->