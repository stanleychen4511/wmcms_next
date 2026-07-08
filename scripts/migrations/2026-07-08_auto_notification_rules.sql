-- Modular automatic notification rules.
-- Scope: automatic event notifications only. Manual send flows keep using notification_templates directly.
-- Safe to rerun.

CREATE TABLE IF NOT EXISTS notification_events (
    code           TEXT PRIMARY KEY,
    module         TEXT NOT NULL DEFAULT 'application',
    name           TEXT NOT NULL,
    description    TEXT,
    payload_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_rules (
    id               BIGSERIAL PRIMARY KEY,
    event_code       TEXT NOT NULL REFERENCES notification_events(code) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    is_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
    conditions       JSONB NOT NULL DEFAULT '{}'::jsonb,
    recipient_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
    channels         TEXT[] NOT NULL DEFAULT ARRAY['email'],
    dedupe_key       TEXT,
    sort_order       INT NOT NULL DEFAULT 100,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT notification_rules_event_name_uniq UNIQUE (event_code, name),
    CONSTRAINT notification_rules_channels_chk CHECK (
        array_length(channels, 1) IS NOT NULL
        AND channels <@ ARRAY['email', 'line']::text[]
    )
);

CREATE TABLE IF NOT EXISTS notification_rule_templates (
    rule_id     BIGINT NOT NULL REFERENCES notification_rules(id) ON DELETE CASCADE,
    channel     TEXT NOT NULL,
    template_id INT NOT NULL REFERENCES notification_templates(id) ON DELETE RESTRICT,
    PRIMARY KEY (rule_id, channel),
    CONSTRAINT notification_rule_templates_channel_chk CHECK (channel IN ('email', 'line'))
);

ALTER TABLE notification_logs
    ADD COLUMN IF NOT EXISTS event_code TEXT REFERENCES notification_events(code) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS rule_id BIGINT REFERENCES notification_rules(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS recipient_type TEXT,
    ADD COLUMN IF NOT EXISTS delivery_key TEXT;

CREATE INDEX IF NOT EXISTS idx_notification_rules_event
    ON notification_rules (event_code, is_enabled, sort_order);

CREATE INDEX IF NOT EXISTS idx_notification_logs_event
    ON notification_logs (event_code, rule_id, sent_at);

INSERT INTO notification_events (code, module, name, description)
VALUES
    ('case_entered_board_review', 'application', '案件進入董事審核', '案件進入董事審核、尚未派組時自動通知。'),
    ('case_assigned_to_board_group', 'application', '董事審核派組', '案件派給董事審核小組時自動通知組員。'),
    ('disbursement_completed', 'payment', '撥款完成', '撥款流程完成時自動通知相關人員。')
ON CONFLICT (code) DO UPDATE SET
    module = EXCLUDED.module,
    name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO notification_rules (event_code, name, is_enabled, recipient_policy, channels, sort_order)
VALUES
    (
        'case_entered_board_review',
        '通知董事長待派組',
        TRUE,
        '{"recipient_types":["chairman"],"respect_user_preferences":true}'::jsonb,
        ARRAY['email', 'line']::text[],
        10
    ),
    (
        'case_assigned_to_board_group',
        '通知董事審核組員',
        TRUE,
        '{"recipient_types":["board_group_members"],"respect_user_preferences":true}'::jsonb,
        ARRAY['email', 'line']::text[],
        20
    ),
    (
        'disbursement_completed',
        '通知撥款完成相關人員',
        TRUE,
        '{"recipient_types":["disbursement_related_users"],"respect_user_preferences":true}'::jsonb,
        ARRAY['email', 'line']::text[],
        30
    )
ON CONFLICT (event_code, name) DO UPDATE SET
    recipient_policy = EXCLUDED.recipient_policy,
    channels = EXCLUDED.channels,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

WITH desired(rule_event, rule_name, channel, template_name) AS (
    VALUES
        ('case_entered_board_review', '通知董事長待派組', 'email', 'email_case_entered_board_review'),
        ('case_entered_board_review', '通知董事長待派組', 'line', 'line_case_entered_board_review'),
        ('case_assigned_to_board_group', '通知董事審核組員', 'email', 'email_case_assigned_to_board_group'),
        ('case_assigned_to_board_group', '通知董事審核組員', 'line', 'line_case_assigned_to_board_group'),
        ('disbursement_completed', '通知撥款完成相關人員', 'email', 'email_disbursement_completed'),
        ('disbursement_completed', '通知撥款完成相關人員', 'line', 'line_disbursement_completed')
)
INSERT INTO notification_rule_templates (rule_id, channel, template_id)
SELECT r.id, d.channel, t.id
FROM desired d
JOIN notification_rules r ON r.event_code = d.rule_event AND r.name = d.rule_name
JOIN LATERAL (
    SELECT id
    FROM notification_templates
    WHERE name = d.template_name
    ORDER BY id
    LIMIT 1
) t ON TRUE
ON CONFLICT (rule_id, channel) DO UPDATE SET
    template_id = EXCLUDED.template_id;
