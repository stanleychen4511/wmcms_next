# pending-doc-alert-threshold Specification

## Purpose

TBD - created by archiving change 'add-pending-doc-alert-threshold'. Update Purpose after archive.

## Requirements

### Requirement: Configurable pending-doc notification threshold

The system SHALL provide a configurable threshold (`pending_doc_notification_threshold` in `system_settings`) that defines the number of pending-document reminder notifications after which a case is flagged for case-officer attention. The default value SHALL be `3`. Administrators SHALL be able to update this value through the existing settings panel.

#### Scenario: Default threshold seeded on database initialization

- **WHEN** `ensureDefaultSettings` runs against a fresh database
- **THEN** `system_settings` SHALL contain a row with key `pending_doc_notification_threshold` and value `'3'`

#### Scenario: Administrator updates threshold

- **WHEN** an administrator sets `pending_doc_notification_threshold` to `'5'` via the settings panel
- **THEN** subsequent threshold checks SHALL treat 5 as the trigger count
- **AND** the change SHALL be persisted in `system_settings`


<!-- @trace
source: add-pending-doc-alert-threshold
updated: 2026-04-21
code:
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - CLAUDE.md
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - scripts/seed_users.mjs
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/App.tsx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/app/actions/templateActions.ts
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/userActions.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - scripts/seed_admin.mjs
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/applicationActions.ts
  - src/components/CaseListPage.tsx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - src/components/HomePage.tsx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - scripts/init_db.sql
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - src/app/actions/notificationActions.ts
  - ~$醫療補助管理系統_需求規格書.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/settingsActions.ts
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/components/ReviewList.tsx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - scripts/README.txt
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
-->

---
### Requirement: Notification flag for pending-doc reminders

The system SHALL provide a boolean column `is_pending_doc_reminder` on `notification_logs` (default `FALSE`) and SHALL allow `sendNotificationEmail` callers to mark a notification as a pending-document reminder. Only notifications with `status = 'sent'` AND `is_pending_doc_reminder = TRUE` SHALL be counted toward the threshold.

#### Scenario: Sender marks email as pending-doc reminder

- **WHEN** a case officer sends an email with the "pending-doc reminder" checkbox enabled
- **THEN** the resulting `notification_logs` row SHALL have `is_pending_doc_reminder = TRUE`

#### Scenario: Failed sends are not counted

- **WHEN** an email send fails (`notification_logs.status = 'failed'`) even with the reminder flag set
- **THEN** the row SHALL NOT contribute to the per-case reminder count

#### Scenario: Default checkbox state for cases with missing documents

- **WHEN** the case-officer opens `SendNotificationModal` for a case currently flagged by `fetchPendingDocAlerts`
- **THEN** the "pending-doc reminder" checkbox SHALL be pre-checked
- **AND** the officer SHALL be able to uncheck it before sending

#### Scenario: Default checkbox state for cases without missing documents

- **WHEN** the case-officer opens `SendNotificationModal` for a case NOT flagged by `fetchPendingDocAlerts`
- **THEN** the "pending-doc reminder" checkbox SHALL default to unchecked


<!-- @trace
source: add-pending-doc-alert-threshold
updated: 2026-04-21
code:
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - CLAUDE.md
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - scripts/seed_users.mjs
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/App.tsx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/app/actions/templateActions.ts
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/userActions.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - scripts/seed_admin.mjs
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/applicationActions.ts
  - src/components/CaseListPage.tsx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - src/components/HomePage.tsx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - scripts/init_db.sql
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - src/app/actions/notificationActions.ts
  - ~$醫療補助管理系統_需求規格書.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/settingsActions.ts
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/components/ReviewList.tsx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - scripts/README.txt
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
-->

---
### Requirement: Threshold-reached query for case officers

The system SHALL expose `fetchPendingDocThresholdAlerts(officerId)` returning all non-closed cases assigned to that officer whose pending-doc reminder count is greater than or equal to the configured threshold. Each result SHALL include application id, case number, applicant name (decrypted), reminder count, last reminder timestamp, and missing-doc count.

#### Scenario: Case at threshold is returned

- **WHEN** an officer's case has 3 successfully sent reminders and the threshold is 3
- **AND** the case status is not `'2'` or `'4'`
- **THEN** `fetchPendingDocThresholdAlerts` SHALL return that case

#### Scenario: Closed case is excluded

- **WHEN** a case has 5 reminders but `applications.status = '2'` (rejected) or `'4'` (settled)
- **THEN** the case SHALL NOT be returned

#### Scenario: Case below threshold is excluded

- **WHEN** a case has 2 reminders and the threshold is 3
- **THEN** the case SHALL NOT be returned

#### Scenario: Threshold change reflected immediately

- **WHEN** the administrator lowers the threshold from 3 to 2
- **AND** an officer subsequently calls `fetchPendingDocThresholdAlerts`
- **THEN** cases with reminder count `>= 2` SHALL be returned without any data migration


<!-- @trace
source: add-pending-doc-alert-threshold
updated: 2026-04-21
code:
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - CLAUDE.md
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - scripts/seed_users.mjs
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/App.tsx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/app/actions/templateActions.ts
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/userActions.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - scripts/seed_admin.mjs
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/applicationActions.ts
  - src/components/CaseListPage.tsx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - src/components/HomePage.tsx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - scripts/init_db.sql
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - src/app/actions/notificationActions.ts
  - ~$醫療補助管理系統_需求規格書.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/settingsActions.ts
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/components/ReviewList.tsx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - scripts/README.txt
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
-->

---
### Requirement: Visual surfacing of threshold-reached cases

The system SHALL surface threshold-reached cases to the responsible case officer in three locations: the home page, the case-list page, and the case-detail page.

#### Scenario: Home page shows count and list

- **WHEN** an officer with at least one threshold-reached case loads the home page
- **THEN** a "達補件提醒門檻案件" section SHALL be visible with a red badge showing the count
- **AND** the section SHALL list each affected case with a link to its detail page

#### Scenario: Case list filter and badge

- **WHEN** an officer activates the "已達補件提醒門檻" filter on the case list page
- **THEN** only threshold-reached cases SHALL be shown
- **AND** each row SHALL display an orange badge "已提醒 N 次"

#### Scenario: Detail page reminder counter

- **WHEN** an officer opens any non-closed case
- **THEN** the detail page SHALL display "未補件提醒已發送 N / M 次" where N is the current count and M is the configured threshold


<!-- @trace
source: add-pending-doc-alert-threshold
updated: 2026-04-21
code:
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - CLAUDE.md
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - scripts/seed_users.mjs
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/App.tsx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/app/actions/templateActions.ts
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/userActions.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - scripts/seed_admin.mjs
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/applicationActions.ts
  - src/components/CaseListPage.tsx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - src/components/HomePage.tsx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - scripts/init_db.sql
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - src/app/actions/notificationActions.ts
  - ~$醫療補助管理系統_需求規格書.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/settingsActions.ts
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/components/ReviewList.tsx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - scripts/README.txt
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
-->

---
### Requirement: Reject-and-close suggestion banner

When a case has reached the reminder threshold and is still open, the system SHALL display a prominent suggestion on the case-detail page recommending closure with status `'2'` (審核未通過). The system SHALL provide a one-click action that opens a confirmation modal requiring the officer to enter a closing reason of at least 5 characters before invoking `closeCase`.

#### Scenario: Banner appears for threshold-reached open case

- **WHEN** the officer opens a case with reminder count `>= threshold` and `applications.status NOT IN ('2','4')`
- **THEN** a red banner SHALL appear at the top of the detail page with the text "建議以不通過結案" and a button labeled "立即結案"

#### Scenario: Reason is required

- **WHEN** the officer clicks "立即結案" and submits the modal with a reason shorter than 5 characters
- **THEN** the system SHALL reject the submission and display an inline validation error

#### Scenario: Successful rejection close

- **WHEN** the officer submits a valid reason
- **THEN** `closeCase(applicationId, '2', reason)` SHALL be invoked
- **AND** an `audit_logs` entry with action `pending_doc.threshold_close` SHALL be written, containing `reminder_count`, `reason`, and `last_reminder_at` in `detail`

#### Scenario: Banner hidden after close

- **WHEN** the case is successfully closed via the banner action
- **THEN** the banner SHALL NOT be shown on subsequent visits to the detail page
- **AND** the case SHALL NOT appear in `fetchPendingDocThresholdAlerts` results


<!-- @trace
source: add-pending-doc-alert-threshold
updated: 2026-04-21
code:
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - CLAUDE.md
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - scripts/seed_users.mjs
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/App.tsx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/app/actions/templateActions.ts
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/userActions.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - scripts/seed_admin.mjs
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/applicationActions.ts
  - src/components/CaseListPage.tsx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - src/components/HomePage.tsx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - scripts/init_db.sql
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - src/app/actions/notificationActions.ts
  - ~$醫療補助管理系統_需求規格書.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/settingsActions.ts
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/components/ReviewList.tsx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - scripts/README.txt
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
-->

---
### Requirement: Audit trail for reminder marking and threshold close

The system SHALL include `pending_doc_reminder: true` in the `detail` payload of the existing `notification.send` audit entry whenever a notification is sent with `is_pending_doc_reminder = TRUE`, and SHALL register a new audit action `pending_doc.threshold_close` in the `AuditAction` union for use by the reject-and-close action.

#### Scenario: Notification audit includes reminder flag

- **WHEN** an email is sent with the reminder flag set
- **THEN** the `audit_logs.detail` JSON SHALL contain `"pending_doc_reminder": true`

#### Scenario: AuditAction union includes new action

- **WHEN** TypeScript compilation runs
- **THEN** `AuditAction` in `src/app/actions/auditActions.ts` SHALL include the literal `'pending_doc.threshold_close'`

<!-- @trace
source: add-pending-doc-alert-threshold
updated: 2026-04-21
code:
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - CLAUDE.md
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - scripts/seed_users.mjs
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/App.tsx
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - src/app/actions/templateActions.ts
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/userActions.ts
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - scripts/seed_admin.mjs
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/applicationActions.ts
  - src/components/CaseListPage.tsx
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - src/components/HomePage.tsx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - scripts/init_db.sql
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - src/app/actions/notificationActions.ts
  - ~$醫療補助管理系統_需求規格書.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/settingsActions.ts
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/components/ReviewList.tsx
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - scripts/README.txt
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
-->