## ADDED Requirements

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

### Requirement: Settings panel exposes organization metadata

The `SettingsPanel` admin UI SHALL register all eight `org_*` keys in `SETTING_LABEL`, `SETTING_HINT`, `SETTING_INPUT_TYPE`, and (where applicable) `SETTING_UNIT`. All eight MUST use `INPUT_TYPE = 'text'`. Labels MUST be in Traditional Chinese and MUST clearly indicate their purpose. Admins MUST be able to edit and save each key through the existing save-button flow.

#### Scenario: Admin sees organization setting rows

- **WHEN** an admin opens the "系統參數設定" tab
- **THEN** all eight org_* keys MUST appear as editable rows alongside existing settings

#### Scenario: Admin can update organization phone

- **WHEN** an admin changes the value of `org_phone` and clicks Save
- **THEN** the new value MUST be persisted to the DB; subsequent loads MUST display the new value; an audit log MUST be written

### Requirement: Print pages read organization metadata at render time

The `/print/review-opinion/[applicationId]` and `/print/payment-receipt/[applicationId]` server components SHALL read organization metadata from `system_settings` at request time (not from compiled constants), so that changes made via the admin UI take effect without redeployment.

#### Scenario: Updated header appears on next print

- **WHEN** an admin updates `org_address` via the settings panel at time T
- **THEN** any print page rendered at time > T MUST display the new address

### Requirement: LINE QR asset location and fallback

The LINE volunteer QR image SHALL be served from `public/org-line-qr.png` (the default referenced by `org_line_qr_url`). If an administrator changes `org_line_qr_url` to a different path or URL, the payment receipt print page SHALL use the new value. If the referenced file does not exist, the QR area SHALL render as a bordered empty box — the page MUST NOT display a broken-image icon.

#### Scenario: Default URL points to bundled asset

- **WHEN** the payment receipt page renders with default `org_line_qr_url = '/org-line-qr.png'`
- **THEN** the QR image MUST load from the static `public/` asset

#### Scenario: Missing QR file shows empty box

- **WHEN** `org_line_qr_url` is set to a path whose file does not exist
- **THEN** the QR area MUST render as an empty bordered container of the same dimensions; no broken-image icon MUST appear in the printed output
