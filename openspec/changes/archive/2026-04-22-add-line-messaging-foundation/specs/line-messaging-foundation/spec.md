## ADDED Requirements

### Requirement: LINE SDK dependency

The project SHALL depend on the `@line/bot-sdk` npm package (MIT license, published by LINE Corporation) at a pinned major version in `package.json`. The SDK SHALL be used for both webhook signature validation and push message dispatch.

#### Scenario: Package present

- **WHEN** `package.json` is inspected after install
- **THEN** it SHALL include `@line/bot-sdk` under `dependencies`

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

### Requirement: Phase 1 webhook handler is log-only

The Phase 1 webhook handler SHALL NOT execute any business logic (no account linking, no notification triggering). It SHALL only write an audit row per event and return 200.

#### Scenario: Follow event only logs

- **WHEN** a user adds the LINE Official Account as friend
- **THEN** the endpoint SHALL write audit `line.webhook_received` with `detail.event_type = 'follow'` and `detail.line_user_id`
- **AND** no other side effect SHALL occur (no DB write to users, no outbound message)

#### Scenario: Message event only logs

- **WHEN** a user sends a text message to the bot
- **THEN** the endpoint SHALL write audit with `detail.event_type = 'message'` including `detail.message_text` (truncated to 200 chars)
- **AND** the bot SHALL NOT reply in Phase 1

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

### Requirement: Audit action types

The `AuditAction` union in `src/app/actions/auditActions.ts` SHALL include the literals `'line.test_push'` and `'line.webhook_received'`.

#### Scenario: TypeScript compilation includes both literals

- **WHEN** `npm run build` runs
- **THEN** compilation SHALL succeed with both literals present in `AuditAction`

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

### Requirement: notification_channels line row enabled

The database `notification_channels` table SHALL have a row with `channel='line'` and `is_enabled=TRUE`. The `config` column SHALL remain empty (`{}`) because credentials are sourced from the environment, not the database.

#### Scenario: Seed ensures row

- **WHEN** `scripts/init_db.sql` runs against a fresh or existing DB
- **THEN** a row with `channel='line'` SHALL exist with `is_enabled=TRUE`
