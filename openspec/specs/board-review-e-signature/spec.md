# board-review-e-signature Specification

## Purpose

TBD - created by archiving change 'add-board-review-e-signature'. Update Purpose after archive.

## Requirements

### Requirement: Board review signatures schema

The system SHALL provide a `board_review_signatures` table with composite primary key `(application_id, signer_user_id)`, columns `application_id BIGINT REFERENCES applications(id) ON DELETE CASCADE`, `signer_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE`, `signature_data_url TEXT NOT NULL` (base64 PNG with `data:image/png;base64,` prefix), `content_hash TEXT NOT NULL` (SHA-256 hex), `signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `user_agent TEXT`, `ip_address TEXT`.

#### Scenario: Table present after init

- **WHEN** `scripts/init_db.sql` is executed
- **THEN** the `board_review_signatures` table SHALL exist with all columns

#### Scenario: One signature per signer per case

- **WHEN** a second INSERT attempts the same `(application_id, signer_user_id)` pair
- **THEN** PostgreSQL SHALL reject the INSERT unless upserted via ON CONFLICT


<!-- @trace
source: add-board-review-e-signature
updated: 2026-04-22
code:
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - scripts/seed_users.mjs
  - scripts/README.txt
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - src/App.tsx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/userActions.ts
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardGroupManager.tsx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/banners/banner_1776382867741.png
  - scripts/seed_admin.mjs
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReferralUnitManager.tsx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - src/app/actions/lineActions.ts
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - src/components/BoardSignaturePanel.tsx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - CLAUDE.md
  - src/types.ts
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/app/actions/boardSignatureActions.ts
  - src/app/actions/settingsActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - src/components/HomePage.tsx
  - src/components/CaseListPage.tsx
  - package.json
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - src/app/actions/referralUnitActions.ts
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - src/components/ReviewList.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - scripts/init_db.sql
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/BoardVoteCard.tsx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/templateActions.ts
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/components/NotificationManager.tsx
  - src/app/actions/applicationActions.ts
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
-->

---
### Requirement: Content hash computation

The system SHALL provide `computeBoardReviewContentHash(applicationId)` returning a SHA-256 hex digest of the string `v1|{applicationId}|{approved_amount ?? 'null'}|{comments ?? 'null'}|{is_approved ?? 'null'}|{assigned_group_id}`. Field values SHALL be joined by the literal `|` separator. Null values SHALL be represented by the literal string `'null'` (not empty).

#### Scenario: Identical inputs produce identical hash

- **WHEN** the function is called twice without any DB change
- **THEN** both results SHALL be equal

#### Scenario: Content change alters hash

- **WHEN** `applications.approved_amount` changes from 100000 to 150000
- **THEN** the next computed hash SHALL differ from the previous

#### Scenario: Group reassignment alters hash

- **WHEN** `board_review_assignments.group_id` changes
- **THEN** the next computed hash SHALL differ


<!-- @trace
source: add-board-review-e-signature
updated: 2026-04-22
code:
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - scripts/seed_users.mjs
  - scripts/README.txt
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - src/App.tsx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/userActions.ts
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardGroupManager.tsx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/banners/banner_1776382867741.png
  - scripts/seed_admin.mjs
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReferralUnitManager.tsx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - src/app/actions/lineActions.ts
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - src/components/BoardSignaturePanel.tsx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - CLAUDE.md
  - src/types.ts
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/app/actions/boardSignatureActions.ts
  - src/app/actions/settingsActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - src/components/HomePage.tsx
  - src/components/CaseListPage.tsx
  - package.json
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - src/app/actions/referralUnitActions.ts
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - src/components/ReviewList.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - scripts/init_db.sql
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/BoardVoteCard.tsx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/templateActions.ts
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/components/NotificationManager.tsx
  - src/app/actions/applicationActions.ts
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
-->

---
### Requirement: Signature submission with password re-auth

The system SHALL provide `submitBoardSignature(applicationId, signatureDataUrl, password, operatorUserId)` that validates (a) application status `'1'` AND workflow stage `'board_review'`, (b) the case has a row in `board_review_assignments`, (c) operatorUserId is a current member of the assigned group, (d) the provided `password` re-hashes to equal `users.password` for that user, and (e) the current recomputed content_hash matches. On success it UPSERTs one row into `board_review_signatures` (`signer_user_id = operatorUserId`) with the current hash, and writes an audit row `board_review.signature_added`.

#### Scenario: Non-member rejected

- **WHEN** a user who is not a current member of the assigned group calls `submitBoardSignature`
- **THEN** the action SHALL return a failure result and NOT insert

#### Scenario: Wrong password rejected

- **WHEN** the supplied `password` does not match the user's stored hash
- **THEN** the action SHALL return `{ success: false, error: '密碼錯誤' }`
- **AND** no row SHALL be written

#### Scenario: Signing allowed for chairman only if also group member

- **WHEN** a chairman who is NOT listed in `board_group_members` for the assigned group attempts to sign
- **THEN** the action SHALL return a failure result (chairman permission does NOT grant signing rights)

#### Scenario: Re-sign overwrites existing row

- **WHEN** the same user signs a second time (for example after a previous signature was invalidated)
- **THEN** the existing row SHALL be UPDATED (not duplicated)
- **AND** a new `board_review.signature_added` audit row SHALL be written with the new hash


<!-- @trace
source: add-board-review-e-signature
updated: 2026-04-22
code:
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - scripts/seed_users.mjs
  - scripts/README.txt
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - src/App.tsx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/userActions.ts
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardGroupManager.tsx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/banners/banner_1776382867741.png
  - scripts/seed_admin.mjs
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReferralUnitManager.tsx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - src/app/actions/lineActions.ts
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - src/components/BoardSignaturePanel.tsx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - CLAUDE.md
  - src/types.ts
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/app/actions/boardSignatureActions.ts
  - src/app/actions/settingsActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - src/components/HomePage.tsx
  - src/components/CaseListPage.tsx
  - package.json
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - src/app/actions/referralUnitActions.ts
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - src/components/ReviewList.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - scripts/init_db.sql
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/BoardVoteCard.tsx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/templateActions.ts
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/components/NotificationManager.tsx
  - src/app/actions/applicationActions.ts
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
-->

---
### Requirement: Fetch signatures with validity state

The system SHALL provide `fetchBoardReviewSignatures(applicationId)` that returns the current content_hash plus a list keyed by current group member including fields `signerUserId`, `name` (decrypted), `account`, `status` (`'signed' | 'invalid' | 'pending'`), `signedAt` (nullable), `thumbnail` (nullable base64). A row is `'signed'` iff a signature exists AND its `content_hash` equals the current hash; `'invalid'` iff a signature exists but hash differs; `'pending'` iff no signature row exists.

#### Scenario: Signed and current

- **WHEN** a member has signed with hash matching the current state
- **THEN** their status SHALL be `'signed'`

#### Scenario: Content changed after signing

- **WHEN** a member signed, then the content_hash changed (e.g. save invalidated hash by definition would delete the row; this scenario covers the edge case where deletion fails), the retained row has a stale hash
- **THEN** their status SHALL be `'invalid'`

#### Scenario: Member never signed

- **WHEN** a current member has no row in `board_review_signatures`
- **THEN** their status SHALL be `'pending'`


<!-- @trace
source: add-board-review-e-signature
updated: 2026-04-22
code:
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - scripts/seed_users.mjs
  - scripts/README.txt
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - src/App.tsx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/userActions.ts
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardGroupManager.tsx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/banners/banner_1776382867741.png
  - scripts/seed_admin.mjs
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReferralUnitManager.tsx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - src/app/actions/lineActions.ts
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - src/components/BoardSignaturePanel.tsx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - CLAUDE.md
  - src/types.ts
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/app/actions/boardSignatureActions.ts
  - src/app/actions/settingsActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - src/components/HomePage.tsx
  - src/components/CaseListPage.tsx
  - package.json
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - src/app/actions/referralUnitActions.ts
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - src/components/ReviewList.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - scripts/init_db.sql
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/BoardVoteCard.tsx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/templateActions.ts
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/components/NotificationManager.tsx
  - src/app/actions/applicationActions.ts
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
-->

---
### Requirement: Signature invalidation on content change

When `saveBoardReviewDraft` actually changes at least one tracked field (`approvedAmount`, `comments`, or `isApproved`), the system SHALL delete all rows in `board_review_signatures` for that application within the same transaction and write an audit row `board_review.signatures_invalidated` with `detail.reason = 'content_changed'` and `detail.invalidated_user_ids` listing the signers whose rows were deleted.

#### Scenario: Save with change invalidates

- **WHEN** the case has 2 signatures and `saveBoardReviewDraft` changes `comments`
- **THEN** after the transaction, `board_review_signatures` SHALL have 0 rows for this application
- **AND** one audit row with `action = 'board_review.signatures_invalidated'` SHALL be written

#### Scenario: Save with no change does not invalidate

- **WHEN** the caller submits a patch equal to the current values (no-op)
- **THEN** existing signatures SHALL remain


<!-- @trace
source: add-board-review-e-signature
updated: 2026-04-22
code:
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - scripts/seed_users.mjs
  - scripts/README.txt
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - src/App.tsx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/userActions.ts
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardGroupManager.tsx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/banners/banner_1776382867741.png
  - scripts/seed_admin.mjs
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReferralUnitManager.tsx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - src/app/actions/lineActions.ts
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - src/components/BoardSignaturePanel.tsx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - CLAUDE.md
  - src/types.ts
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/app/actions/boardSignatureActions.ts
  - src/app/actions/settingsActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - src/components/HomePage.tsx
  - src/components/CaseListPage.tsx
  - package.json
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - src/app/actions/referralUnitActions.ts
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - src/components/ReviewList.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - scripts/init_db.sql
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/BoardVoteCard.tsx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/templateActions.ts
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/components/NotificationManager.tsx
  - src/app/actions/applicationActions.ts
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
-->

---
### Requirement: Signature invalidation on reassignment

When `assignCaseToBoardGroup` updates the `group_id` for an existing assignment (reassignment), the system SHALL delete all rows in `board_review_signatures` for that application within the same transaction and write an audit row `board_review.signatures_invalidated` with `detail.reason = 'reassigned'`.

#### Scenario: Reassignment invalidates old signatures

- **WHEN** case has signatures from group A members, chairman reassigns to group B
- **THEN** all old signatures SHALL be deleted
- **AND** audit reason SHALL be `'reassigned'`


<!-- @trace
source: add-board-review-e-signature
updated: 2026-04-22
code:
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - scripts/seed_users.mjs
  - scripts/README.txt
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - src/App.tsx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/userActions.ts
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardGroupManager.tsx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/banners/banner_1776382867741.png
  - scripts/seed_admin.mjs
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReferralUnitManager.tsx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - src/app/actions/lineActions.ts
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - src/components/BoardSignaturePanel.tsx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - CLAUDE.md
  - src/types.ts
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/app/actions/boardSignatureActions.ts
  - src/app/actions/settingsActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - src/components/HomePage.tsx
  - src/components/CaseListPage.tsx
  - package.json
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - src/app/actions/referralUnitActions.ts
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - src/components/ReviewList.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - scripts/init_db.sql
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/BoardVoteCard.tsx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/templateActions.ts
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/components/NotificationManager.tsx
  - src/app/actions/applicationActions.ts
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
-->

---
### Requirement: Stage advance and close-rejected require full signatures

When the target stage transition originates from `board_review` (i.e. `advanceWorkflowStage(applicationId, 'board_review', 'reimbursement', ...)` or `closeCaseRejected` invoked while the case is in `board_review`), the server action SHALL, within its own transaction and before any UPDATE to `applications.status`, verify:
- let `memberCount` = count of rows in `board_group_members` for this case's assigned group;
- let `validCount` = count of rows in `board_review_signatures` where `application_id` matches AND `content_hash` equals the freshly recomputed current hash AND `signer_user_id` is also a current group member;

and require `memberCount > 0` AND `memberCount == validCount`. If the condition fails, the transaction SHALL ROLLBACK and return `{ success: false, error: '尚有 N 位組員未簽署（或簽章已因內容變動失效）' }`.

#### Scenario: All signed advances successfully

- **WHEN** all current group members have signed AND their hashes match current
- **THEN** `advanceWorkflowStage` SHALL succeed and `applications.status` SHALL become `'3'`

#### Scenario: One member unsigned blocks advance

- **WHEN** 2 of 3 members have signed
- **THEN** `advanceWorkflowStage` SHALL return the blocking error
- **AND** `applications.status` SHALL remain `'1'`

#### Scenario: Stale signature blocks close-rejected

- **WHEN** all members signed but then someone edited content invalidating the signatures
- **THEN** `closeCaseRejected` from board_review SHALL fail with the same blocking error

#### Scenario: Recently-added group member missing

- **WHEN** a group previously had 2 members, both signed, then a third member was added to the group
- **THEN** because `memberCount` is now 3 but `validCount` is 2, advance SHALL be blocked until the third signs


<!-- @trace
source: add-board-review-e-signature
updated: 2026-04-22
code:
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - scripts/seed_users.mjs
  - scripts/README.txt
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - src/App.tsx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/userActions.ts
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardGroupManager.tsx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/banners/banner_1776382867741.png
  - scripts/seed_admin.mjs
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReferralUnitManager.tsx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - src/app/actions/lineActions.ts
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - src/components/BoardSignaturePanel.tsx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - CLAUDE.md
  - src/types.ts
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/app/actions/boardSignatureActions.ts
  - src/app/actions/settingsActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - src/components/HomePage.tsx
  - src/components/CaseListPage.tsx
  - package.json
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - src/app/actions/referralUnitActions.ts
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - src/components/ReviewList.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - scripts/init_db.sql
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/BoardVoteCard.tsx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/templateActions.ts
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/components/NotificationManager.tsx
  - src/app/actions/applicationActions.ts
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
-->

---
### Requirement: Audit trail

The system SHALL extend `AuditAction` with `'board_review.signature_added'` and `'board_review.signatures_invalidated'`. The `targetType` for `signature_added` SHALL be `'application'` with `target_id = applicationId`; `detail` SHALL include `content_hash` and `signer_user_id`. For `signatures_invalidated`, `targetType` SHALL be `'application'`, `detail` SHALL include `reason` (`'content_changed' | 'reassigned'`) and `invalidated_user_ids` array.

#### Scenario: AuditAction union includes new literals

- **WHEN** TypeScript compilation runs
- **THEN** `AuditAction` SHALL include both `'board_review.signature_added'` and `'board_review.signatures_invalidated'`


<!-- @trace
source: add-board-review-e-signature
updated: 2026-04-22
code:
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - scripts/seed_users.mjs
  - scripts/README.txt
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - src/App.tsx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/userActions.ts
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardGroupManager.tsx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/banners/banner_1776382867741.png
  - scripts/seed_admin.mjs
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReferralUnitManager.tsx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - src/app/actions/lineActions.ts
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - src/components/BoardSignaturePanel.tsx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - CLAUDE.md
  - src/types.ts
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/app/actions/boardSignatureActions.ts
  - src/app/actions/settingsActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - src/components/HomePage.tsx
  - src/components/CaseListPage.tsx
  - package.json
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - src/app/actions/referralUnitActions.ts
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - src/components/ReviewList.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - scripts/init_db.sql
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/BoardVoteCard.tsx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/templateActions.ts
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/components/NotificationManager.tsx
  - src/app/actions/applicationActions.ts
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
-->

---
### Requirement: Signature panel UI

The application detail page SHALL, when `stage === 'board_review'`, render a `<BoardSignaturePanel>` component that lists each current group member's signature status (`signed` / `invalid` / `pending`). If the logged-in user is the row's member and status is not `signed`, the row SHALL expose a button "簽章" (or "重新簽章" when `invalid`) that opens a signature modal containing a `react-signature-canvas` drawing pad, a clear button, a password input, and a submit button.

#### Scenario: Panel visible on board_review only

- **WHEN** the case is in `admin_review` or `home_visit`
- **THEN** the `BoardSignaturePanel` SHALL NOT render

#### Scenario: Non-member sees panel read-only

- **WHEN** a board member who is NOT in the assigned group views the detail page
- **THEN** the panel SHALL list members with their statuses but SHALL NOT show the "簽章" button on any row

#### Scenario: Signing modal requires both drawing and password

- **WHEN** the modal is open and the user clicks submit with an empty drawing OR empty password
- **THEN** a client-side validation message SHALL appear and submission SHALL not be attempted

#### Scenario: Successful signing refreshes panel

- **WHEN** `submitBoardSignature` returns success
- **THEN** the modal SHALL close
- **AND** the panel SHALL refetch showing the user's row as `'signed'`


<!-- @trace
source: add-board-review-e-signature
updated: 2026-04-22
code:
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - scripts/seed_users.mjs
  - scripts/README.txt
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - src/App.tsx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/userActions.ts
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardGroupManager.tsx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/banners/banner_1776382867741.png
  - scripts/seed_admin.mjs
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReferralUnitManager.tsx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - src/app/actions/lineActions.ts
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - src/components/BoardSignaturePanel.tsx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - CLAUDE.md
  - src/types.ts
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/app/actions/boardSignatureActions.ts
  - src/app/actions/settingsActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - src/components/HomePage.tsx
  - src/components/CaseListPage.tsx
  - package.json
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - src/app/actions/referralUnitActions.ts
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - src/components/ReviewList.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - scripts/init_db.sql
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/BoardVoteCard.tsx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/templateActions.ts
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/components/NotificationManager.tsx
  - src/app/actions/applicationActions.ts
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
-->

---
### Requirement: Advance buttons gated by signature completeness

The "通過" and "不通過結案" buttons in the case detail view SHALL be disabled when `stage === 'board_review'` AND not all current group members are in `'signed'` state. The tooltip SHALL state "尚有 N 位組員未簽章".

#### Scenario: Button disabled when not all signed

- **WHEN** 1 of 3 members has signed
- **THEN** the "通過" button SHALL be disabled
- **AND** the "不通過結案" button SHALL be disabled

#### Scenario: Button enabled when all signed

- **WHEN** all 3 of 3 members signed AND hashes are current
- **AND** no dirty edits exist (from the previous change's dirty-state guard)
- **THEN** both buttons SHALL be enabled


<!-- @trace
source: add-board-review-e-signature
updated: 2026-04-22
code:
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - scripts/seed_users.mjs
  - scripts/README.txt
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - src/App.tsx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/userActions.ts
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardGroupManager.tsx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/banners/banner_1776382867741.png
  - scripts/seed_admin.mjs
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReferralUnitManager.tsx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - src/app/actions/lineActions.ts
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - src/components/BoardSignaturePanel.tsx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - CLAUDE.md
  - src/types.ts
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/app/actions/boardSignatureActions.ts
  - src/app/actions/settingsActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - src/components/HomePage.tsx
  - src/components/CaseListPage.tsx
  - package.json
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - src/app/actions/referralUnitActions.ts
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - src/components/ReviewList.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - scripts/init_db.sql
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/BoardVoteCard.tsx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/templateActions.ts
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/components/NotificationManager.tsx
  - src/app/actions/applicationActions.ts
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
-->

---
### Requirement: Pre-edit confirmation when signatures exist

The board review edit UI SHALL display a visible warning when editing a field while any signature exists; upon save, a confirmation dialog SHALL state "修改會使 N 個已簽名失效" and require explicit confirmation before `saveBoardReviewDraft` is called.

#### Scenario: Dialog appears when signatures exist

- **WHEN** 2 signatures exist and the user edits `comments` and presses 儲存
- **THEN** a confirm dialog SHALL appear stating the invalidation count before the server call is made

#### Scenario: No dialog when no signatures

- **WHEN** no signatures exist and the user presses 儲存
- **THEN** no dialog SHALL appear

<!-- @trace
source: add-board-review-e-signature
updated: 2026-04-22
code:
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - src/components/EditCaseBasicsModal.tsx
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - src/components/SettingsPanel.tsx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - scripts/seed_users.mjs
  - scripts/README.txt
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - src/app/actions/workflowActions.ts
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - src/App.tsx
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - src/app/actions/userActions.ts
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - src/components/BoardGroupManager.tsx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/banners/banner_1776382867741.png
  - scripts/seed_admin.mjs
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - src/app/api/line/webhook/route.ts
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - src/components/ReferralUnitManager.tsx
  - src/app/actions/pendingDocAlertActions.ts
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - src/components/AdminPanel.tsx
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - src/app/actions/lineActions.ts
  - src/app/actions/notificationActions.ts
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - src/components/BoardSignaturePanel.tsx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - CLAUDE.md
  - src/types.ts
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - src/app/actions/boardSignatureActions.ts
  - src/app/actions/settingsActions.ts
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/components/NewApplicationPage.tsx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - src/components/HomePage.tsx
  - src/components/CaseListPage.tsx
  - package.json
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - src/app/actions/referralUnitActions.ts
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - src/components/ReviewList.tsx
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - scripts/init_db.sql
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - src/components/BoardVoteCard.tsx
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - src/app/actions/templateActions.ts
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - src/app/actions/boardGroupActions.ts
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - src/components/NotificationManager.tsx
  - src/app/actions/applicationActions.ts
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - src/components/SendNotificationModal.tsx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
-->