# board-review-group-assignment Specification

## Purpose

TBD - created by archiving change 'add-board-group-assignment'. Update Purpose after archive.

## Requirements

### Requirement: Board groups schema and maintenance

The system SHALL provide a `board_groups` table with columns `id BIGSERIAL PK`, `name TEXT NOT NULL UNIQUE`, `priority INT NOT NULL DEFAULT 0`, `is_active BOOLEAN NOT NULL DEFAULT TRUE`, `created_at` and `updated_at` timestamps. The system SHALL provide a `board_group_members` table with composite primary key `(group_id, user_id)` where `group_id` REFERENCES `board_groups(id) ON DELETE CASCADE` and `user_id` REFERENCES `users(id) ON DELETE CASCADE`, with a UNIQUE constraint on `user_id` so that one user belongs to at most one group.

#### Scenario: Tables present after init

- **WHEN** `scripts/init_db.sql` is executed
- **THEN** `board_groups` and `board_group_members` SHALL exist with the specified columns and constraints

#### Scenario: Duplicate group name rejected

- **WHEN** two groups are inserted with the same `name`
- **THEN** PostgreSQL SHALL reject the second INSERT due to the UNIQUE constraint

#### Scenario: Assigning a user to two groups rejected

- **WHEN** `board_group_members` already has a row for `user_id = X` and another INSERT tries to add the same user to a different group
- **THEN** PostgreSQL SHALL reject the second INSERT due to the UNIQUE(user_id) constraint


<!-- @trace
source: add-board-group-assignment
updated: 2026-04-22
code:
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - src/app/actions/templateActions.ts
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/App.tsx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/NewApplicationPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - scripts/README.txt
  - src/app/actions/referralUnitActions.ts
  - CLAUDE.md
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - scripts/init_db.sql
  - src/app/actions/applicationActions.ts
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/types.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/HomePage.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/components/BoardGroupManager.tsx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardVoteCard.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/components/SettingsPanel.tsx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - scripts/seed_admin.mjs
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/app/actions/notificationActions.ts
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/userActions.ts
  - src/components/ReferralUnitManager.tsx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/boardGroupActions.ts
-->

---
### Requirement: Board group CRUD server actions

The system SHALL provide server actions `fetchAllBoardGroups()`, `fetchActiveBoardGroups()`, `createBoardGroup(name, priority, memberUserIds, operatorUserId)`, `updateBoardGroup(id, name, priority, memberUserIds, operatorUserId)`, `toggleBoardGroupActive(id, isActive, operatorUserId)`, and `deleteBoardGroup(id, operatorUserId)`. `createBoardGroup` and `updateBoardGroup` SHALL require at least one member user id. `deleteBoardGroup` SHALL fail if any row in `board_review_assignments` references the group.

#### Scenario: Create requires at least one member

- **WHEN** `createBoardGroup` is invoked with an empty `memberUserIds` array
- **THEN** the action SHALL return a failure result without inserting

#### Scenario: Delete with assignments rejected

- **WHEN** `deleteBoardGroup` is invoked for a group that has one or more rows in `board_review_assignments`
- **THEN** the action SHALL return a failure result indicating the group must be deactivated instead

#### Scenario: Toggle active does not touch existing assignments

- **WHEN** `toggleBoardGroupActive(id, false, userId)` succeeds
- **THEN** existing rows in `board_review_assignments` for that group SHALL remain unchanged
- **AND** the group SHALL NOT appear in `fetchActiveBoardGroups` results

#### Scenario: Audit trail written for each CRUD op

- **WHEN** any of create/update/toggle/delete succeeds
- **THEN** a corresponding row SHALL appear in `audit_logs` with one of actions `board_group.create`, `board_group.update`, `board_group.toggle_active`, `board_group.delete`, target_type `board_group`, target_id equal to the group id


<!-- @trace
source: add-board-group-assignment
updated: 2026-04-22
code:
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - src/app/actions/templateActions.ts
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/App.tsx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/NewApplicationPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - scripts/README.txt
  - src/app/actions/referralUnitActions.ts
  - CLAUDE.md
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - scripts/init_db.sql
  - src/app/actions/applicationActions.ts
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/types.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/HomePage.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/components/BoardGroupManager.tsx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardVoteCard.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/components/SettingsPanel.tsx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - scripts/seed_admin.mjs
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/app/actions/notificationActions.ts
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/userActions.ts
  - src/components/ReferralUnitManager.tsx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/boardGroupActions.ts
-->

---
### Requirement: Board review assignments schema

The system SHALL provide a `board_review_assignments` table with columns `application_id BIGINT PK REFERENCES applications(id) ON DELETE CASCADE`, `group_id BIGINT NOT NULL REFERENCES board_groups(id)`, `assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `assigned_by BIGINT REFERENCES users(id)`, `assign_mode TEXT NOT NULL CHECK (assign_mode IN ('auto', 'manual'))`. The `application_id` SHALL be the primary key so each case has at most one current assignment.

#### Scenario: Table constraints enforced

- **WHEN** an INSERT sets `assign_mode = 'foo'`
- **THEN** the CHECK constraint SHALL reject the row

#### Scenario: Deleting application cascades assignment

- **WHEN** a row in `applications` is deleted
- **THEN** its row in `board_review_assignments` SHALL be deleted via CASCADE


<!-- @trace
source: add-board-group-assignment
updated: 2026-04-22
code:
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - src/app/actions/templateActions.ts
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/App.tsx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/NewApplicationPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - scripts/README.txt
  - src/app/actions/referralUnitActions.ts
  - CLAUDE.md
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - scripts/init_db.sql
  - src/app/actions/applicationActions.ts
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/types.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/HomePage.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/components/BoardGroupManager.tsx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardVoteCard.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/components/SettingsPanel.tsx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - scripts/seed_admin.mjs
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/app/actions/notificationActions.ts
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/userActions.ts
  - src/components/ReferralUnitManager.tsx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/boardGroupActions.ts
-->

---
### Requirement: No per-member vote table

The system SHALL NOT maintain a per-member vote table. Board review results SHALL be recorded as a single representative entry using the existing `applications.approved_amount` and `application_workflow.comments / is_approved` columns, written via `saveBoardReviewDraft`.

#### Scenario: Legacy vote table removed

- **WHEN** `scripts/init_db.sql` runs against an environment that previously had `board_review_votes`
- **THEN** the `board_review_votes` table SHALL be dropped via `DROP TABLE IF EXISTS`

#### Scenario: Fresh install does not create the vote table

- **WHEN** `scripts/init_db.sql` runs against a fresh database
- **THEN** no `board_review_votes` table SHALL exist


<!-- @trace
source: add-board-group-assignment
updated: 2026-04-22
code:
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - src/app/actions/templateActions.ts
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/App.tsx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/NewApplicationPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - scripts/README.txt
  - src/app/actions/referralUnitActions.ts
  - CLAUDE.md
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - scripts/init_db.sql
  - src/app/actions/applicationActions.ts
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/types.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/HomePage.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/components/BoardGroupManager.tsx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardVoteCard.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/components/SettingsPanel.tsx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - scripts/seed_admin.mjs
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/app/actions/notificationActions.ts
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/userActions.ts
  - src/components/ReferralUnitManager.tsx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/boardGroupActions.ts
-->

---
### Requirement: Manual case assignment

The system SHALL provide `assignCaseToBoardGroup(applicationId, groupId, operatorUserId, mode)` that UPSERTs a row in `board_review_assignments`. The action SHALL only proceed when the application has `status = '1'` AND workflow stage is `'board_review'`. The operator SHALL be an admin or have the `chairman` role.

Re-assignment (when a row already exists) SHALL update the `group_id`, `assigned_at`, `assigned_by`, and `assign_mode` columns only; it SHALL NOT clear `applications.approved_amount` or `application_workflow.comments / is_approved` (the new group inherits the existing audit state and may overwrite via `saveBoardReviewDraft`).

#### Scenario: Only chairman or admin may assign

- **WHEN** `assignCaseToBoardGroup` is called by a user without the `chairman` or `admin` role
- **THEN** the action SHALL return a failure result and NOT modify any row

#### Scenario: Assignment requires board_review stage

- **WHEN** the target application is in `admin_review` stage
- **THEN** the action SHALL return a failure result

#### Scenario: Re-assignment preserves existing review draft

- **WHEN** a case currently has `approved_amount = 100000` and `workflow.comments = '草案一'` and the chairman re-assigns to a new group
- **THEN** `board_review_assignments.group_id` SHALL become the new group
- **AND** `applications.approved_amount` SHALL remain `100000`
- **AND** `application_workflow.comments` SHALL remain `'草案一'`
- **AND** an audit row with action `board_review.reassign` SHALL be written


<!-- @trace
source: add-board-group-assignment
updated: 2026-04-22
code:
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - src/app/actions/templateActions.ts
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/App.tsx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/NewApplicationPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - scripts/README.txt
  - src/app/actions/referralUnitActions.ts
  - CLAUDE.md
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - scripts/init_db.sql
  - src/app/actions/applicationActions.ts
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/types.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/HomePage.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/components/BoardGroupManager.tsx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardVoteCard.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/components/SettingsPanel.tsx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - scripts/seed_admin.mjs
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/app/actions/notificationActions.ts
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/userActions.ts
  - src/components/ReferralUnitManager.tsx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/boardGroupActions.ts
-->

---
### Requirement: Auto-assignment algorithm

The system SHALL provide `autoAssignCaseToBoardGroup(applicationId, operatorUserId)` that selects the target group as: the active group with at least one member whose count of currently-open `board_review` assignments is smallest; ties are broken by smallest `priority`. On success it SHALL call the same UPSERT as manual assignment with `mode = 'auto'`. If no eligible group exists, the action SHALL return failure with error `'無可用董事組別'` and perform no DB writes.

#### Scenario: Group with fewer open cases is chosen

- **WHEN** group A has 2 open board_review cases and group B has 1
- **AND** both are active with at least one member
- **THEN** auto-assignment SHALL choose group B

#### Scenario: Tie broken by priority

- **WHEN** group A and group B both have 0 open cases
- **AND** group A has `priority = 2`, group B has `priority = 1`
- **THEN** auto-assignment SHALL choose group B (lower priority number wins)

#### Scenario: Inactive or empty groups skipped

- **WHEN** group A has 0 cases but `is_active = FALSE`, and group B has 5 cases and is active with members
- **THEN** auto-assignment SHALL choose group B (A is ignored)

#### Scenario: No eligible group returns error

- **WHEN** all groups are inactive OR have no members
- **THEN** auto-assignment SHALL return `{ success: false, error: '無可用董事組別' }`


<!-- @trace
source: add-board-group-assignment
updated: 2026-04-22
code:
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - src/app/actions/templateActions.ts
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/App.tsx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/NewApplicationPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - scripts/README.txt
  - src/app/actions/referralUnitActions.ts
  - CLAUDE.md
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - scripts/init_db.sql
  - src/app/actions/applicationActions.ts
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/types.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/HomePage.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/components/BoardGroupManager.tsx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardVoteCard.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/components/SettingsPanel.tsx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - scripts/seed_admin.mjs
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/app/actions/notificationActions.ts
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/userActions.ts
  - src/components/ReferralUnitManager.tsx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/boardGroupActions.ts
-->

---
### Requirement: Batch auto-assignment and settings switch

The system SHALL provide `batchAutoAssignCases(applicationIds, operatorUserId)` that iterates over the given ids, calling `autoAssignCaseToBoardGroup` for each, and returns a summary `{ total, success, failed }` with per-id results. The system SHALL seed and honor a `system_settings` key `board_auto_assign` with values `'true'` / `'false'` (default `'false'`). When the key is `'true'`, the moment a case reaches `board_review` stage via `advanceWorkflowStage`, the system SHALL attempt `autoAssignCaseToBoardGroup` automatically (non-blocking: stage advance SHALL succeed even if assignment fails; a console warning SHALL be logged).

#### Scenario: Default setting value seeded

- **WHEN** `ensureDefaultSettings` runs against a fresh database
- **THEN** `system_settings` SHALL contain `board_auto_assign = 'false'`

#### Scenario: Stage advance with auto assign on

- **WHEN** `board_auto_assign = 'true'` and a case is advanced into `board_review`
- **THEN** the case SHALL end up with a row in `board_review_assignments`
- **AND** an audit row `board_review.assign` with `detail.mode = 'auto'` SHALL be written

#### Scenario: Auto assign failure does not roll back advance

- **WHEN** auto-assignment fails because no eligible group exists
- **THEN** the stage advance SHALL still succeed (application is in `board_review` stage)
- **AND** no `board_review_assignments` row SHALL exist for that case


<!-- @trace
source: add-board-group-assignment
updated: 2026-04-22
code:
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - src/app/actions/templateActions.ts
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/App.tsx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/NewApplicationPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - scripts/README.txt
  - src/app/actions/referralUnitActions.ts
  - CLAUDE.md
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - scripts/init_db.sql
  - src/app/actions/applicationActions.ts
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/types.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/HomePage.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/components/BoardGroupManager.tsx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardVoteCard.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/components/SettingsPanel.tsx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - scripts/seed_admin.mjs
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/app/actions/notificationActions.ts
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/userActions.ts
  - src/components/ReferralUnitManager.tsx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/boardGroupActions.ts
-->

---
### Requirement: Save board review draft (collaborative edit)

The system SHALL provide `saveBoardReviewDraft(applicationId, patch, operatorUserId)` where `patch` is a partial object with keys `approvedAmount`, `comments`, and `isApproved`. The action SHALL:
(a) Validate `applications.status = '1'` AND workflow `stage = 'board_review'`;
(b) Validate operator is a current member of the assigned group OR has `admin` OR `chairman` role;
(c) Validate the application has a row in `board_review_assignments`;
(d) Compute a diff between current values and patch values; if no field changed, COMMIT and return success without writing audit;
(e) UPDATE `applications.approved_amount` and `application_workflow.comments / is_approved` within a single transaction;
(f) Write an audit row with `action = 'board_review.draft_save'`, `target_type = 'application'`, `target_id = applicationId`, `detail = { changedFields, before, after }` (only changed fields).

#### Scenario: Non-member rejected

- **WHEN** a user who is not a current member of the assigned group AND does not have `admin` or `chairman` role calls `saveBoardReviewDraft`
- **THEN** the action SHALL return a failure result

#### Scenario: Unassigned case rejected

- **WHEN** the case is in `board_review` but has no row in `board_review_assignments`
- **THEN** `saveBoardReviewDraft` SHALL return a failure result

#### Scenario: Stage gate

- **WHEN** the case is in `home_visit` stage (not `board_review`)
- **THEN** the action SHALL return a failure result

#### Scenario: Diff-only audit log

- **WHEN** the operator submits a patch that only changes `comments`
- **THEN** `audit_logs.detail.changedFields` SHALL equal `["comments"]`
- **AND** `detail.before` SHALL contain only `comments` with the prior value
- **AND** `detail.after` SHALL contain only `comments` with the new value

#### Scenario: No-op returns success without audit

- **WHEN** every field in the patch equals its current stored value
- **THEN** the action SHALL return `{ success: true }`
- **AND** no new row SHALL be inserted into `audit_logs`

#### Scenario: chairman may save for any group

- **WHEN** a chairman (who is not a group member) calls `saveBoardReviewDraft` for a case assigned to any group
- **THEN** the action SHALL succeed (subject to other validations)


<!-- @trace
source: add-board-group-assignment
updated: 2026-04-22
code:
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - src/app/actions/templateActions.ts
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/App.tsx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/NewApplicationPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - scripts/README.txt
  - src/app/actions/referralUnitActions.ts
  - CLAUDE.md
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - scripts/init_db.sql
  - src/app/actions/applicationActions.ts
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/types.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/HomePage.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/components/BoardGroupManager.tsx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardVoteCard.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/components/SettingsPanel.tsx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - scripts/seed_admin.mjs
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/app/actions/notificationActions.ts
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/userActions.ts
  - src/components/ReferralUnitManager.tsx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/boardGroupActions.ts
-->

---
### Requirement: Dirty-state guard on stage-advance and reject actions

The application detail UI SHALL track dirty state across the board-review fields (`approvedAmount`, `comments`, `isApproved`). When dirty, the buttons that invoke `advanceWorkflowStage` ("通過 → 進入核銷") and `closeCaseRejected` ("不通過結案") SHALL be disabled with a tooltip prompting the user to save first. Pressing "儲存" calls `saveBoardReviewDraft`; on success the UI SHALL refetch the detail, reset `initialValues` to the new server state, and clear dirty.

#### Scenario: Edit without save blocks advance

- **WHEN** a group member edits `approvedAmount` from `100000` to `150000` but does not press 儲存
- **THEN** the "通過" button SHALL be disabled
- **AND** the "不通過結案" button SHALL be disabled

#### Scenario: After save, advance is re-enabled

- **WHEN** the group member presses 儲存 and the save succeeds
- **THEN** the "通過" and "不通過結案" buttons SHALL become enabled (subject to other preconditions)

#### Scenario: Reset to original value does not count as dirty

- **WHEN** the user types `150000`, then deletes and types back `100000` (matching the current stored value)
- **THEN** dirty SHALL be `false`
- **AND** the advance/reject buttons SHALL remain enabled without saving


<!-- @trace
source: add-board-group-assignment
updated: 2026-04-22
code:
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - src/app/actions/templateActions.ts
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/App.tsx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/NewApplicationPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - scripts/README.txt
  - src/app/actions/referralUnitActions.ts
  - CLAUDE.md
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - scripts/init_db.sql
  - src/app/actions/applicationActions.ts
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/types.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/HomePage.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/components/BoardGroupManager.tsx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardVoteCard.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/components/SettingsPanel.tsx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - scripts/seed_admin.mjs
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/app/actions/notificationActions.ts
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/userActions.ts
  - src/components/ReferralUnitManager.tsx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/boardGroupActions.ts
-->

---
### Requirement: Board review edit permission and UI gating

The board review section fields (核准金額 / 審核意見 / 審核結果) SHALL be editable only by current members of the assigned group, admins, or chairmen. For all other users (including board members of other groups), the fields SHALL render read-only. The "儲存", "通過", "不通過結案" buttons SHALL only be rendered for permitted users.

#### Scenario: Non-member sees read-only fields

- **WHEN** a board_member who is not in the assigned group opens the detail page
- **THEN** the approvedAmount, comments, and isApproved inputs SHALL render as read-only
- **AND** no 儲存 / 通過 / 不通過結案 button SHALL appear

#### Scenario: Assigned member can edit

- **WHEN** a board_member who IS in the assigned group opens the detail page
- **THEN** the inputs SHALL be editable
- **AND** the 儲存 button SHALL be visible

#### Scenario: Chairman can edit any case

- **WHEN** a chairman opens the detail page for a case assigned to any group
- **THEN** the inputs SHALL be editable and all buttons SHALL be visible


<!-- @trace
source: add-board-group-assignment
updated: 2026-04-22
code:
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - src/app/actions/templateActions.ts
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/App.tsx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/NewApplicationPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - scripts/README.txt
  - src/app/actions/referralUnitActions.ts
  - CLAUDE.md
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - scripts/init_db.sql
  - src/app/actions/applicationActions.ts
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/types.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/HomePage.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/components/BoardGroupManager.tsx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardVoteCard.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/components/SettingsPanel.tsx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - scripts/seed_admin.mjs
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/app/actions/notificationActions.ts
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/userActions.ts
  - src/components/ReferralUnitManager.tsx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/boardGroupActions.ts
-->

---
### Requirement: Chairman-only admin tab and settings

The `AdminPanel` SHALL include a tab "董事組別管理" visible only when the logged-in user has the `chairman` or `admin` role. Inside the tab, the user SHALL be able to list / create / edit / toggle-active / delete board groups (subject to delete guard). The `SettingsPanel` SHALL expose the `board_auto_assign` setting using the same label / hint / toast pattern as other settings.

#### Scenario: Tab hidden from non-chairman, non-admin

- **WHEN** a supervisor or case officer opens AdminPanel
- **THEN** the "董事組別管理" tab SHALL NOT render

#### Scenario: Chairman sees the setting row

- **WHEN** a chairman opens SettingsPanel
- **THEN** a row with label "董事審核自動派案" and the current value `'true'` / `'false'` SHALL be editable


<!-- @trace
source: add-board-group-assignment
updated: 2026-04-22
code:
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - src/app/actions/templateActions.ts
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/App.tsx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/NewApplicationPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - scripts/README.txt
  - src/app/actions/referralUnitActions.ts
  - CLAUDE.md
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - scripts/init_db.sql
  - src/app/actions/applicationActions.ts
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/types.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/HomePage.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/components/BoardGroupManager.tsx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardVoteCard.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/components/SettingsPanel.tsx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - scripts/seed_admin.mjs
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/app/actions/notificationActions.ts
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/userActions.ts
  - src/components/ReferralUnitManager.tsx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/boardGroupActions.ts
-->

---
### Requirement: CaseListPage chairman workflow

The `CaseListPage` SHALL, for users with `chairman` or `admin` role, offer a filter "僅顯示未派案的董事審核案件" that restricts results to cases where `workflow.stage = 'board_review'` AND no row exists in `board_review_assignments` for that application. When the filter is active and at least one case is selected, the batch toolbar SHALL expose a "批次自動派案" button that invokes `batchAutoAssignCases` with the selected ids.

#### Scenario: Filter restricts to unassigned board_review cases

- **WHEN** the chairman enables the "僅顯示未派案的董事審核案件" filter
- **THEN** only cases with stage `board_review` AND no matching `board_review_assignments` row SHALL be shown

#### Scenario: Batch auto-assign button visible

- **WHEN** the filter is active and one or more rows are selected
- **THEN** a "批次自動派案" button SHALL appear in the batch toolbar

#### Scenario: Batch operation reports per-case outcome

- **WHEN** the chairman clicks "批次自動派案" with 5 cases selected and 1 has no eligible group
- **THEN** the UI SHALL show a summary "成功 4 / 失敗 1" with per-id detail


<!-- @trace
source: add-board-group-assignment
updated: 2026-04-22
code:
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - src/app/actions/templateActions.ts
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/App.tsx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/NewApplicationPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - scripts/README.txt
  - src/app/actions/referralUnitActions.ts
  - CLAUDE.md
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - scripts/init_db.sql
  - src/app/actions/applicationActions.ts
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/types.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/HomePage.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/components/BoardGroupManager.tsx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardVoteCard.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/components/SettingsPanel.tsx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - scripts/seed_admin.mjs
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/app/actions/notificationActions.ts
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/userActions.ts
  - src/components/ReferralUnitManager.tsx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/boardGroupActions.ts
-->

---
### Requirement: Detail page board assignment card and re-assignment

The application detail view SHALL, for applications in `board_review` stage, display the assigned group name, assignment mode (auto/manual), assignment time, and a list of current group members (no vote status column). This card is purely informational and SHALL NOT present any vote buttons. When the logged-in user has the `chairman` or `admin` role, a "指派 / 重新指派組別" action SHALL be available that opens a dropdown of active groups and calls `assignCaseToBoardGroup(mode='manual')`.

#### Scenario: Card is read-only for all viewers

- **WHEN** any user views a `board_review` case that has been assigned
- **THEN** the card SHALL list members without vote-status badges
- **AND** no 同意 / 否決 / 投票 buttons SHALL appear anywhere on the card

#### Scenario: Chairman sees re-assign dropdown

- **WHEN** a chairman views the card
- **THEN** an action "指派 / 重新指派組別" SHALL be visible
- **AND** selecting a different group SHALL invoke `assignCaseToBoardGroup` with `mode='manual'`


<!-- @trace
source: add-board-group-assignment
updated: 2026-04-22
code:
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - src/app/actions/templateActions.ts
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/App.tsx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/NewApplicationPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - scripts/README.txt
  - src/app/actions/referralUnitActions.ts
  - CLAUDE.md
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - scripts/init_db.sql
  - src/app/actions/applicationActions.ts
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/types.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/HomePage.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/components/BoardGroupManager.tsx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardVoteCard.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/components/SettingsPanel.tsx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - scripts/seed_admin.mjs
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/app/actions/notificationActions.ts
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/userActions.ts
  - src/components/ReferralUnitManager.tsx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/boardGroupActions.ts
-->

---
### Requirement: Audit trail extension

The system SHALL extend `AuditAction` in `src/app/actions/auditActions.ts` with `'board_group.create'`, `'board_group.update'`, `'board_group.toggle_active'`, `'board_group.delete'`, `'board_review.assign'`, `'board_review.reassign'`, `'board_review.draft_save'`. The `AuditTargetType` union SHALL include `'board_group'` and `'board_assignment'`. The union SHALL NOT include `'board_vote'` (legacy from earlier design, removed during ingest).

#### Scenario: TypeScript compilation includes new literals

- **WHEN** the project builds
- **THEN** the `AuditAction` union SHALL include all seven listed action literals
- **AND** the `AuditTargetType` union SHALL include `'board_group'` and `'board_assignment'`
- **AND** the `AuditTargetType` union SHALL NOT include `'board_vote'`

#### Scenario: draft_save writes audit

- **WHEN** `saveBoardReviewDraft` successfully writes a field change
- **THEN** one new row SHALL appear in `audit_logs` with `action = 'board_review.draft_save'`

<!-- @trace
source: add-board-group-assignment
updated: 2026-04-22
code:
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - src/app/actions/templateActions.ts
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - src/App.tsx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReviewList.tsx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/NewApplicationPage.tsx
  - src/components/SendNotificationModal.tsx
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - src/components/CaseListPage.tsx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/actions/settingsActions.ts
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - scripts/seed_users.mjs
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - scripts/README.txt
  - src/app/actions/referralUnitActions.ts
  - CLAUDE.md
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - src/app/actions/workflowActions.ts
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - scripts/init_db.sql
  - src/app/actions/applicationActions.ts
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - src/types.ts
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/components/HomePage.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - src/components/BoardGroupManager.tsx
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardVoteCard.tsx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - src/components/SettingsPanel.tsx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - scripts/seed_admin.mjs
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - src/app/actions/auditActions.ts
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - src/app/actions/notificationActions.ts
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - src/app/actions/userActions.ts
  - src/components/ReferralUnitManager.tsx
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - src/app/actions/boardGroupActions.ts
-->