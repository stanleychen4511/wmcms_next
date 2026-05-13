## ADDED Requirements

### Requirement: Users table line_user_id column

The `users` table SHALL include a column `line_user_id TEXT UNIQUE` (nullable). A non-null value indicates the user has linked their LINE account; the value SHALL be the LINE userId (format: `U` + 32 hex characters). The UNIQUE constraint guarantees one LINE account maps to at most one system user.

#### Scenario: Column present after init

- **WHEN** `scripts/init_db.sql` is executed
- **THEN** `users.line_user_id` SHALL exist as nullable TEXT with UNIQUE constraint

#### Scenario: Duplicate LINE userId rejected

- **WHEN** an UPDATE attempts to set the same `line_user_id` on two different `users` rows
- **THEN** PostgreSQL SHALL reject the second UPDATE due to the UNIQUE constraint

### Requirement: User line link codes table

The system SHALL provide a `user_line_link_codes` table with `user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE`, `code CHAR(6) NOT NULL`, `expires_at TIMESTAMPTZ NOT NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, plus an index on `(code)` for webhook lookup. The PK on `user_id` enforces one active code per user (UPSERT overwrites prior code).

#### Scenario: Table present after init

- **WHEN** `scripts/init_db.sql` is executed
- **THEN** `user_line_link_codes` SHALL exist with all specified columns

#### Scenario: One code per user enforced

- **WHEN** generating a new code for a user that already has a row
- **THEN** the existing row SHALL be UPDATED (no duplicate row created)

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

### Requirement: Reply API helper

The system SHALL provide an internal helper `replyLineMessage(replyToken, text)` that calls the LINE Messaging API reply endpoint via the SDK's `replyMessage`. This helper SHALL be used by the webhook handler to respond to events without consuming the push message quota.

#### Scenario: Reply does not consume push quota

- **WHEN** the webhook handler replies to an event
- **THEN** the SDK call SHALL be `replyMessage` (not `pushMessage`)

### Requirement: Unlink line account server action

The system SHALL provide `unlinkLine(operatorUserId)` that sets the user's `line_user_id` to NULL and writes an audit row `line.account_unlinked` whose `detail` includes `previous_line_user_id`.

#### Scenario: Successful unlink

- **WHEN** a linked user invokes `unlinkLine`
- **THEN** their `users.line_user_id` SHALL be NULL
- **AND** an audit row with `action='line.account_unlinked'` SHALL be written

#### Scenario: Unlink unlinked user is no-op

- **WHEN** an already-unlinked user invokes `unlinkLine`
- **THEN** the action SHALL return `{ success: true }` without writing audit

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

### Requirement: Audit action types

The `AuditAction` union SHALL include the literals `'line.link_code_generated'`, `'line.account_linked'`, `'line.account_unlinked'`.

#### Scenario: TypeScript compilation includes literals

- **WHEN** the project builds
- **THEN** all three literals SHALL be present in `AuditAction`

### Requirement: System setting for bot account id

The `system_settings` table SHALL include a key `line_official_account_id` (default empty string). When set to a non-empty value (typically `@xxxxxx`), the personal settings UI SHALL use it to construct the bot's add-friend URL.

#### Scenario: Default seeded

- **WHEN** `ensureDefaultSettings` runs against a fresh database
- **THEN** a row with `key = 'line_official_account_id'` and `value = ''` SHALL exist

