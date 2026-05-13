## ADDED Requirements

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

### Requirement: Referral units dictionary table

The system SHALL provide a `referral_units` table containing `id BIGSERIAL PK`, `name TEXT NOT NULL UNIQUE`, `contact_info TEXT`, `sort_order INT NOT NULL DEFAULT 0`, `is_active BOOLEAN NOT NULL DEFAULT TRUE`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, and `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.

#### Scenario: Table created on init

- **WHEN** `scripts/init_db.sql` is executed
- **THEN** the `referral_units` table SHALL exist with all specified columns and constraints

#### Scenario: Duplicate name rejected

- **WHEN** an INSERT attempts to create a referral unit with a name that already exists
- **THEN** PostgreSQL SHALL reject the statement due to the UNIQUE constraint on `name`

### Requirement: Application referral unit foreign key

The `applications` table SHALL include a nullable `referral_unit_id BIGINT` column referencing `referral_units(id)` with `ON DELETE SET NULL`. The column SHALL be meaningful only when `application_way = '2'`; callers SHALL write `NULL` when `application_way = '1'`.

#### Scenario: FK column present

- **WHEN** the schema is inspected
- **THEN** `applications.referral_unit_id` SHALL exist as nullable `BIGINT` with FK to `referral_units(id) ON DELETE SET NULL`

#### Scenario: Deleting a referenced unit nullifies the FK

- **WHEN** a referral unit row is hard-deleted while at least one application references it
- **THEN** the application rows SHALL have `referral_unit_id` set to `NULL`
- **AND** no application rows SHALL be deleted

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

### Requirement: Audit trail for referral unit management

The system SHALL extend the `AuditAction` union in `src/app/actions/auditActions.ts` with the literals `'referral_unit.create'`, `'referral_unit.update'`, `'referral_unit.toggle_active'`, and the `AuditTargetType` union with `'referral_unit'`. Each referral-unit CRUD server action SHALL write a corresponding audit entry.

#### Scenario: AuditAction type includes referral unit actions

- **WHEN** TypeScript compilation runs
- **THEN** `AuditAction` SHALL include `'referral_unit.create'`, `'referral_unit.update'`, `'referral_unit.toggle_active'`
- **AND** `AuditTargetType` SHALL include `'referral_unit'`

#### Scenario: Create writes audit log

- **WHEN** `createReferralUnit` successfully inserts a row
- **THEN** `audit_logs` SHALL contain a row with `action = 'referral_unit.create'`, `target_type = 'referral_unit'`, `target_id = <new id>`, and `detail.name = <provided name>`
