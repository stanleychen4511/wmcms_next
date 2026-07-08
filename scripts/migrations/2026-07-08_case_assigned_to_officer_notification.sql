-- Add automatic notification event for officer assignment.
-- Safe to rerun.

INSERT INTO notification_templates (name, channel, subject, body, description, status, sort_order)
SELECT *
FROM (
    VALUES
        (
            'line_case_assigned_to_officer',
            'line',
            '',
            E'【萬美基金會】您有新案件被指派\n案號：{{案號}}\n申請人：{{申請人}}\n申請金額：NT$ {{申請金額}}\n\n請至系統查看案件並進行處理。\n{{案件連結}}',
            '系統範本：承辦人被派發案件時通知本人（LINE）',
            1,
            107
        ),
        (
            'email_case_assigned_to_officer',
            'email',
            '【萬美基金會】您有新案件被指派',
            E'{{承辦人}} 您好：\n\n以下案件已指派給您處理：\n\n案號：{{案號}}\n申請人：{{申請人}}\n申請金額：NT$ {{申請金額}}\n\n請至系統查看案件並進行處理：{{案件連結}}\n\n──────────────\n財團法人萬美社會福利慈善事業基金會',
            '系統範本：承辦人被派發案件時通知本人（Email）',
            1,
            108
        )
) AS v(name, channel, subject, body, description, status, sort_order)
WHERE NOT EXISTS (
    SELECT 1 FROM notification_templates t WHERE t.name = v.name
);

INSERT INTO notification_events (code, module, name, description)
VALUES
    ('case_assigned_to_officer', 'application', '承辦人被派發案件', '案件指派或改派給承辦人時自動通知該承辦人。')
ON CONFLICT (code) DO UPDATE SET
    module = EXCLUDED.module,
    name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO notification_rules (event_code, name, is_enabled, recipient_policy, channels, sort_order)
VALUES
    (
        'case_assigned_to_officer',
        '通知被指派承辦人',
        TRUE,
        '{"recipient_types":["assigned_officer"],"respect_user_preferences":true}'::jsonb,
        ARRAY['email', 'line']::text[],
        15
    )
ON CONFLICT (event_code, name) DO UPDATE SET
    recipient_policy = EXCLUDED.recipient_policy,
    channels = EXCLUDED.channels,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

WITH desired(rule_event, rule_name, channel, template_name) AS (
    VALUES
        ('case_assigned_to_officer', '通知被指派承辦人', 'email', 'email_case_assigned_to_officer'),
        ('case_assigned_to_officer', '通知被指派承辦人', 'line', 'line_case_assigned_to_officer')
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
