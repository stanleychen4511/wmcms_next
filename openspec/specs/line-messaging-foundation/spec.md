# line-messaging-foundation Specification

## Purpose

TBD - created by archiving change 'add-line-messaging-foundation'. Update Purpose after archive.

## Requirements

### Requirement: LINE SDK dependency

The project SHALL depend on the `@line/bot-sdk` npm package (MIT license, published by LINE Corporation) at a pinned major version in `package.json`. The SDK SHALL be used for both webhook signature validation and push message dispatch.

#### Scenario: Package present

- **WHEN** `package.json` is inspected after install
- **THEN** it SHALL include `@line/bot-sdk` under `dependencies`


<!-- @trace
source: add-line-messaging-foundation
updated: 2026-04-22
code:
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - scripts/init_db.sql
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/api/line/webhook/route.ts
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - package.json
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
-->

---
### Requirement: LINE webhook endpoint with signature verification

The system SHALL expose an HTTPS POST endpoint at `/api/line/webhook` that receives events from the LINE Platform. The endpoint SHALL read the raw request body exactly once, validate the `X-Line-Signature` header using the channel secret (HMAC-SHA256, base64-compared in a timing-safe way via the SDK), and reject invalid requests with HTTP 401. On valid requests, the endpoint SHALL return HTTP 200 within the LINE Platform's timeout window.

#### Scenario: Missing signature rejected

- **WHEN** a POST arrives without `X-Line-Signature`
- **THEN** the endpoint SHALL return HTTP 401

#### Scenario: Invalid signature rejected

- **WHEN** a POST arrives with an `X-Line-Signature` value that does not match the recomputed signature
- **THEN** the endpoint SHALL return HTTP 401
- **AND** no audit log row SHALL be written

#### Scenario: Valid signature accepted

- **WHEN** a POST arrives with a valid `X-Line-Signature`
- **THEN** the endpoint SHALL return HTTP 200
- **AND** for each event in the payload, one `audit_logs` row SHALL be written with `action = 'line.webhook_received'` and `detail.event_type` set


<!-- @trace
source: add-line-messaging-foundation
updated: 2026-04-22
code:
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - scripts/init_db.sql
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/api/line/webhook/route.ts
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - package.json
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
-->

---
### Requirement: Phase 1 webhook handler is log-only

The webhook handler SHALL write an audit row per received event regardless of binding outcome. The handler MAY perform business logic depending on event type and binding state:

- For `follow` events, the handler SHALL write audit and MAY reply with a guidance message (welcome + instructions to bind).
- For `message` events, the handler SHALL write audit and dispatch by binding state per the `line-account-linking` capability's `Webhook resolves binding state on message events` requirement (Phase 2 behavior).
- For other event types, the handler SHALL write audit and take no further action.

The original "Phase 1 log-only" prohibition on business logic SHALL no longer apply once Phase 2 is in place.

#### Scenario: Follow event still audited

- **WHEN** a user adds the LINE Official Account as friend
- **THEN** the endpoint SHALL write audit `line.webhook_received` with `detail.event_type = 'follow'` and `detail.line_user_id`
- **AND** the bot MAY reply with the welcome / binding guidance text

#### Scenario: Message event audited and dispatched

- **WHEN** a user sends a text message to the bot
- **THEN** the endpoint SHALL write audit with `detail.event_type = 'message'` including `detail.message_text` (truncated to 200 chars)
- **AND** the bot SHALL act according to the binding state dispatch rules defined in the `line-account-linking` capability


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
### Requirement: sendLineMessage server action

The system SHALL provide a server action `sendLineMessage(lineUserId, text, operatorUserId)` that dispatches a push text message to the given LINE userId via the LINE Push API (through the SDK's `Client.pushMessage`). It SHALL validate that `lineUserId` matches the pattern `^U[0-9a-f]{32}$` and that `text` is non-empty. On dispatch it SHALL write a `notification_logs` row (channel='line', status='sent' or 'failed') and an `audit_logs` row with `action = 'line.test_push'`.

#### Scenario: Missing credentials returns error

- **WHEN** `LINE_CHANNEL_ACCESS_TOKEN` is not set in the environment
- **THEN** the action SHALL return `{ success: false, error: 'LINE 憑證未設定' }`
- **AND** no external API call SHALL be made
- **AND** a `notification_logs` row with `status='failed'` SHALL still be written for auditability

#### Scenario: Invalid userId format rejected

- **WHEN** `lineUserId` does not match the `U` + 32 hex characters pattern
- **THEN** the action SHALL return a failure result without calling the LINE API

#### Scenario: Successful push logs sent

- **WHEN** the LINE API returns success
- **THEN** `notification_logs` SHALL contain a row with `channel='line'`, `status='sent'`, `body` equal to the provided text
- **AND** `audit_logs` SHALL contain a row with `action='line.test_push'` and `detail.line_user_id`

#### Scenario: LINE API error logs failed

- **WHEN** the LINE API returns a non-2xx response
- **THEN** `notification_logs` SHALL contain a row with `status='failed'` and `error_message` set to the API error string
- **AND** the action SHALL return `{ success: false, error: ... }`


<!-- @trace
source: add-line-messaging-foundation
updated: 2026-04-22
code:
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - scripts/init_db.sql
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/api/line/webhook/route.ts
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - package.json
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
-->

---
### Requirement: Audit action types

The `AuditAction` union in `src/app/actions/auditActions.ts` SHALL include the literals `'line.test_push'` and `'line.webhook_received'`.

#### Scenario: TypeScript compilation includes both literals

- **WHEN** `npm run build` runs
- **THEN** compilation SHALL succeed with both literals present in `AuditAction`


<!-- @trace
source: add-line-messaging-foundation
updated: 2026-04-22
code:
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - scripts/init_db.sql
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/api/line/webhook/route.ts
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - package.json
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
-->

---
### Requirement: Admin UI test push panel

The `NotificationManager` admin component SHALL render a section titled "LINE 測試推送" that displays whether LINE credentials are present (without exposing the token value) and provides a form accepting a LINE userId and text message that, on submit, invokes `sendLineMessage` and displays the outcome.

#### Scenario: Credentials present indicator

- **WHEN** both `LINE_CHANNEL_SECRET` and `LINE_CHANNEL_ACCESS_TOKEN` are set in the environment
- **THEN** the panel SHALL display an indicator "LINE 憑證: 已設定" (or equivalent green badge)
- **AND** the access token SHALL be masked (for example showing only the first 6 characters followed by an ellipsis)

#### Scenario: Missing credentials indicator

- **WHEN** either credential environment variable is empty
- **THEN** the panel SHALL display "LINE 憑證: 未設定"
- **AND** the submit button SHALL be disabled

#### Scenario: Successful test push

- **WHEN** an admin submits a valid LINE userId and text
- **AND** the action returns success
- **THEN** a success toast or inline message SHALL appear indicating the push was delivered


<!-- @trace
source: add-line-messaging-foundation
updated: 2026-04-22
code:
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - scripts/init_db.sql
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/api/line/webhook/route.ts
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - package.json
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
-->

---
### Requirement: notification_channels line row enabled

The database `notification_channels` table SHALL have a row with `channel='line'` and `is_enabled=TRUE`. The `config` column SHALL remain empty (`{}`) because credentials are sourced from the environment, not the database.

#### Scenario: Seed ensures row

- **WHEN** `scripts/init_db.sql` runs against a fresh or existing DB
- **THEN** a row with `channel='line'` SHALL exist with `is_enabled=TRUE`

<!-- @trace
source: add-line-messaging-foundation
updated: 2026-04-22
code:
  - public/uploads/12/A115004_綜所稅清單(配偶亦繳)_20260416172834.pdf
  - public/uploads/3/D115001_個資同意書_20260420135414.pdf
  - public/uploads/7/A115001_現職醫事人員在職證明_20260409165924.docx
  - public/uploads/10/D115001_綜所稅清單(配偶亦繳)_20260413120838.pdf
  - public/uploads/10/D115001_診斷證明_20260413120857.pdf
  - public/uploads/7/A115001_醫療單據正本或與正本相符之影本_20260409165917.docx
  - public/uploads/12/A115004_醫療收據_20260416173007.docx
  - public/uploads/7/A115001_購屋貸款利息單據_20260409165921.docx
  - public/uploads/12/A115004_生命故事同意刊登截圖證明_20260416173012.docx
  - scripts/init_db.sql
  - public/uploads/16/A115006_自費醫療補助申請表_20260416223230.pdf
  - public/uploads/banners/banner_1776382899855.png
  - public/uploads/3/D115001_自費醫療補助申請表_20260420135414.pdf
  - public/uploads/templates/aa0c2858-c372-4150-b0b5-eaf26f3d7e9f.docx
  - src/app/api/line/webhook/route.ts
  - public/uploads/10/D115001_保險給付通知單_20260413121718.pdf
  - public/uploads/1/B115001_身分證正反面影本_20260420132617.pdf
  - public/uploads/11/B115001_自費醫療補助申請表_20260413130228.pdf
  - public/uploads/12/A115004_診斷證明_20260416172840.pdf
  - public/uploads/10/D115001_醫療單據正本或與正本相符之影本_20260413120854.pdf
  - public/uploads/12/A115004_現職醫事人員在職證明_20260416172849.pdf
  - public/uploads/1/A115001_身分證正反面影本_20260409201732.pdf
  - public/uploads/10/D115001_醫療收據_20260413121713.pdf
  - public/uploads/12/A115004_集保結算所資料_20260416172845.pdf
  - public/uploads/12/A115004_領款收據_20260416173008.docx
  - public/uploads/7/A115001_自費醫療補助申請表_20260409190100.pdf
  - public/uploads/12/A115004_個資同意書_20260416172832.pdf
  - public/uploads/8/A115002_個資同意書_20260420113010.pdf
  - public/uploads/1/A115001_醫療收據_20260417071832.pdf
  - src/app/actions/auditActions.ts
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417073556.pdf
  - public/uploads/16/A115006_個資同意書_20260416223230.pdf
  - public/uploads/10/D115001_全戶戶籍謄本_20260413120841.pdf
  - src/components/NotificationManager.tsx
  - public/uploads/12/A115004_重大傷病證明_20260416172838.pdf
  - public/uploads/1/A115001_醫療收據_20260417073547.pdf
  - public/uploads/3/A115002_個資同意書_20260417075332.pdf
  - public/uploads/templates/20c4eca2-6c44-4785-9634-07670b65f414.pdf
  - public/uploads/8/A115002_個資同意書_20260410104439.docx
  - public/uploads/8/A115002_身分證正反面影本_20260416231953.pdf
  - public/uploads/12/A115004_購屋貸款利息單據_20260416172847.pdf
  - public/uploads/10/D115001_購屋貸款利息單據_20260413120848.pdf
  - public/uploads/7/A115001_身分證正反面影本_20260409165903.docx
  - public/uploads/10/D115001_現職醫事人員在職證明_20260413120844.pdf
  - public/uploads/10/D115001_重大傷病證明_20260413121133.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260416231948.pdf
  - public/uploads/16/A115006_身分證正反面影本_20260416223230.pdf
  - public/uploads/9/A115003_身分證正反面影本_20260410153442.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413112840.pdf
  - public/uploads/templates/d771037d-137e-4752-acf0-a32354793f89.docx
  - public/uploads/10/D115001_個資同意書_20260413112840.pdf
  - package.json
  - public/uploads/1/A115001_領款收據_20260417071835.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409185050.pdf
  - public/uploads/17/A115007_自費醫療補助申請表_20260416225000.pdf
  - public/uploads/templates/380e49ec-045d-4ccd-a51f-ed73f10f6d3b.docx
  - public/uploads/1/B115001_自費醫療補助申請表_20260420132614.pdf
  - public/uploads/15/C115002_自費醫療補助申請表_20260416221822.pdf
  - public/uploads/10/D115001_領款收據_20260413121716.pdf
  - public/uploads/17/A115007_個資同意書_20260416225000.pdf
  - public/uploads/3/A115002_身分證正反面影本_20260417075332.pdf
  - public/uploads/12/A115004_身分證正反面影本_20260416172830.docx
  - public/uploads/1/A115001_保險給付通知單_20260417073553.pdf
  - public/uploads/15/C115002_個資同意書_20260416221822.pdf
  - public/uploads/7/A115001_綜所稅清單(配偶亦繳)_20260409165909.docx
  - public/uploads/7/A115001_重大傷病證明_20260409165914.docx
  - public/uploads/templates/8b10774e-e620-4a5a-ae66-803629047a8b.docx
  - public/uploads/1/A115001_自費醫療補助申請表_20260406230710.docx
  - public/uploads/12/A115004_保險給付通知單_20260416173010.docx
  - public/uploads/9/A115003_個資同意書_20260410153442.docx
  - public/uploads/1/A115001_保險給付通知單_20260417071838.pdf
  - public/uploads/7/A115001_診斷證明_20260409165916.docx
  - public/uploads/10/D115001_集保結算所資料_20260413121107.docx
  - public/uploads/1/B115001_個資同意書_20260420132620.pdf
  - public/uploads/11/B115001_身分證正反面影本_20260413130228.docx
  - public/uploads/7/A115001_集保結算所資料_20260409165919.docx
  - public/uploads/8/A115002_身分證正反面影本_20260410104439.pdf
  - public/uploads/banners/banner_1776382867741.png
  - public/uploads/12/A115004_醫療單據正本或與正本相符之影本_20260416172843.pdf
  - public/uploads/10/D115001_身分證正反面影本_20260413121110.docx
  - public/uploads/8/A115002_自費醫療補助申請表_20260410104439.pdf
  - public/uploads/12/A115004_自費醫療補助申請表_20260416172827.pdf
  - src/app/actions/lineActions.ts
  - public/uploads/7/A115001_個資同意書_20260409165906.docx
  - public/uploads/7/A115001_全戶戶籍謄本_20260409165911.docx
  - public/uploads/15/C115002_身分證正反面影本_20260416221822.pdf
  - public/uploads/3/A115002_自費醫療補助申請表_20260417075332.pdf
  - public/uploads/10/D115001_生命故事同意刊登截圖證明_20260413121720.pdf
  - public/uploads/17/A115007_身分證正反面影本_20260416225000.pdf
  - public/uploads/12/A115004_全戶戶籍謄本_20260416172836.pdf
  - public/uploads/10/D115001_自費醫療補助申請表_20260413112840.pdf
  - public/uploads/9/A115003_自費醫療補助申請表_20260410153442.pdf
  - public/uploads/10/D115001_集保結算所資料_20260413120852.pdf
  - public/uploads/3/D115001_身分證正反面影本_20260420135414.pdf
  - public/uploads/1/A115001_領款收據_20260417073551.pdf
  - public/uploads/11/B115001_個資同意書_20260413130228.pdf
  - public/uploads/7/A115001_自費醫療補助申請表_20260409165901.docx
  - public/uploads/1/A115001_生命故事同意刊登截圖證明_20260417071840.pdf
-->