-- WMCMS-6 (#81)：各角色「輪到他處理」時發送 LINE / Email 提醒。
--   個管師：董事審核通過、案件退回（主管送董事前退件／退回董事再審未通過／撥款退回個管）
--   會計：撥款送達會計、執行長退回會計
--   執行長：撥款送達執行長
--   （董事派組、個管派案、撥款完成沿用既有事件）
-- 事件於狀態轉換時觸發，轉換本身即代表「輪到該角色」，不需額外去重。
-- 請先人工執行本檔，再部署會觸發這些事件的應用程式版本。
-- 本檔與 scripts/init_db.sql 的「WMCMS-6 角色輪到提醒」段落內容相同，可重複執行。

BEGIN;

-- ▼▼ WMCMS-6 角色輪到提醒 ▼▼
INSERT INTO notification_templates (name, channel, subject, body, description, status, sort_order)
SELECT * FROM (VALUES
    ('line_case_board_approved', 'line', '',
     E'【萬美基金會】董事審核通過\n案號：{{案號}}\n申請人：{{申請人}}\n核定金額：NT$ {{核定金額}}\n\n案件已進入核銷撥款階段，請至系統辦理後續撥款作業。\n{{案件連結}}',
     '系統範本：董事審核通過、案件進入核銷撥款時通知承辦人（LINE）', 1, 110),
    ('email_case_board_approved', 'email', '【萬美基金會】董事審核通過，請辦理撥款',
     E'{{承辦人}} 您好：\n\n以下案件已通過董事審核，進入核銷撥款階段：\n\n案號：{{案號}}\n申請人：{{申請人}}\n核定金額：NT$ {{核定金額}}\n\n請至系統辦理後續撥款作業：{{案件連結}}\n\n──────────────\n財團法人萬美社會福利慈善事業基金會',
     '系統範本：董事審核通過、案件進入核銷撥款時通知承辦人（Email）', 1, 111),
    ('line_case_returned_to_officer', 'line', '',
     E'【萬美基金會】案件退回待處理\n案號：{{案號}}\n申請人：{{申請人}}\n退回項目：{{退件項目}}\n退回原因：{{退件原因}}\n\n請至系統修正後重新送出。\n{{案件連結}}',
     '系統範本：案件或撥款退回承辦人時通知（LINE）', 1, 112),
    ('email_case_returned_to_officer', 'email', '【萬美基金會】案件退回待處理',
     E'{{承辦人}} 您好：\n\n以下案件已退回給您處理：\n\n案號：{{案號}}\n申請人：{{申請人}}\n退回項目：{{退件項目}}\n退回原因：{{退件原因}}\n\n請至系統修正後重新送出：{{案件連結}}\n\n──────────────\n財團法人萬美社會福利慈善事業基金會',
     '系統範本：案件或撥款退回承辦人時通知（Email）', 1, 113),
    ('line_disbursement_to_accountant', 'line', '',
     E'【萬美基金會】撥款待會計審核\n案號：{{案號}}\n撥款編號：{{撥款編號}}\n本次撥款金額：NT$ {{本次撥款金額}}\n\n請至系統辦理會計審核。\n{{案件連結}}',
     '系統範本：撥款送達會計審核時通知會計（LINE）', 1, 114),
    ('email_disbursement_to_accountant', 'email', '【萬美基金會】撥款待會計審核',
     E'您好：\n\n以下撥款已送達會計審核：\n\n案號：{{案號}}\n申請人：{{申請人}}\n撥款編號：{{撥款編號}}\n本次撥款金額：NT$ {{本次撥款金額}}\n\n請至系統辦理會計審核：{{案件連結}}\n\n──────────────\n財團法人萬美社會福利慈善事業基金會',
     '系統範本：撥款送達會計審核時通知會計（Email）', 1, 115),
    ('line_disbursement_returned_to_accountant', 'line', '',
     E'【萬美基金會】撥款退回會計\n案號：{{案號}}\n撥款編號：{{撥款編號}}\n退回原因：{{退件原因}}\n\n請至系統確認後重新送出。\n{{案件連結}}',
     '系統範本：執行長將撥款退回會計時通知會計（LINE）', 1, 116),
    ('email_disbursement_returned_to_accountant', 'email', '【萬美基金會】撥款退回會計',
     E'您好：\n\n以下撥款已由執行長退回會計：\n\n案號：{{案號}}\n申請人：{{申請人}}\n撥款編號：{{撥款編號}}\n本次撥款金額：NT$ {{本次撥款金額}}\n退回原因：{{退件原因}}\n\n請至系統確認後重新送出：{{案件連結}}\n\n──────────────\n財團法人萬美社會福利慈善事業基金會',
     '系統範本：執行長將撥款退回會計時通知會計（Email）', 1, 117),
    ('line_disbursement_to_executive', 'line', '',
     E'【萬美基金會】撥款待執行長核准\n案號：{{案號}}\n撥款編號：{{撥款編號}}\n本次撥款金額：NT$ {{本次撥款金額}}\n\n請至系統辦理核准。\n{{案件連結}}',
     '系統範本：撥款送達執行長核准時通知執行長（LINE）', 1, 118),
    ('email_disbursement_to_executive', 'email', '【萬美基金會】撥款待執行長核准',
     E'執行長 您好：\n\n以下撥款已送達執行長核准：\n\n案號：{{案號}}\n申請人：{{申請人}}\n撥款編號：{{撥款編號}}\n本次撥款金額：NT$ {{本次撥款金額}}\n\n請至系統辦理核准：{{案件連結}}\n\n──────────────\n財團法人萬美社會福利慈善事業基金會',
     '系統範本：撥款送達執行長核准時通知執行長（Email）', 1, 119)
) AS v(name, channel, subject, body, description, status, sort_order)
WHERE NOT EXISTS (
    SELECT 1 FROM notification_templates t WHERE t.name = v.name
);

INSERT INTO notification_events (code, module, name, description)
VALUES
    ('case_board_approved', 'application', '董事審核通過', '董事審核通過、案件進入核銷撥款時通知承辦人。'),
    ('case_returned_to_officer', 'application', '案件退回承辦人', '主管送董事前退件、退回董事再審未通過、撥款退回個管時通知承辦人。'),
    ('disbursement_to_accountant', 'payment', '撥款送達會計', '撥款由主管送出、進入會計審核時通知會計。'),
    ('disbursement_returned_to_accountant', 'payment', '撥款退回會計', '執行長將撥款退回會計時通知會計。'),
    ('disbursement_to_executive', 'payment', '撥款送達執行長', '撥款由會計送出、進入執行長核准時通知執行長。')
ON CONFLICT (code) DO UPDATE SET
    module = EXCLUDED.module,
    name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO notification_rules (event_code, name, is_enabled, recipient_policy, channels, sort_order)
VALUES
    ('case_board_approved', '通知承辦人董事審核通過', TRUE,
     '{"recipient_types":["assigned_officer"],"respect_user_preferences":true}'::jsonb,
     ARRAY['email', 'line']::text[], 40),
    ('case_returned_to_officer', '通知承辦人案件退回', TRUE,
     '{"recipient_types":["assigned_officer"],"respect_user_preferences":true}'::jsonb,
     ARRAY['email', 'line']::text[], 45),
    ('disbursement_to_accountant', '通知會計撥款待審', TRUE,
     '{"recipient_types":["role:accountant"],"respect_user_preferences":true}'::jsonb,
     ARRAY['email', 'line']::text[], 50),
    ('disbursement_returned_to_accountant', '通知會計撥款退回', TRUE,
     '{"recipient_types":["role:accountant"],"respect_user_preferences":true}'::jsonb,
     ARRAY['email', 'line']::text[], 55),
    ('disbursement_to_executive', '通知執行長撥款待核准', TRUE,
     '{"recipient_types":["role:executive"],"respect_user_preferences":true}'::jsonb,
     ARRAY['email', 'line']::text[], 60)
ON CONFLICT (event_code, name) DO UPDATE SET
    recipient_policy = EXCLUDED.recipient_policy,
    channels = EXCLUDED.channels,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

WITH desired(rule_event, rule_name, channel, template_name) AS (
    VALUES
        ('case_board_approved', '通知承辦人董事審核通過', 'email', 'email_case_board_approved'),
        ('case_board_approved', '通知承辦人董事審核通過', 'line', 'line_case_board_approved'),
        ('case_returned_to_officer', '通知承辦人案件退回', 'email', 'email_case_returned_to_officer'),
        ('case_returned_to_officer', '通知承辦人案件退回', 'line', 'line_case_returned_to_officer'),
        ('disbursement_to_accountant', '通知會計撥款待審', 'email', 'email_disbursement_to_accountant'),
        ('disbursement_to_accountant', '通知會計撥款待審', 'line', 'line_disbursement_to_accountant'),
        ('disbursement_returned_to_accountant', '通知會計撥款退回', 'email', 'email_disbursement_returned_to_accountant'),
        ('disbursement_returned_to_accountant', '通知會計撥款退回', 'line', 'line_disbursement_returned_to_accountant'),
        ('disbursement_to_executive', '通知執行長撥款待核准', 'email', 'email_disbursement_to_executive'),
        ('disbursement_to_executive', '通知執行長撥款待核准', 'line', 'line_disbursement_to_executive')
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
-- ▲▲ WMCMS-6 角色輪到提醒 ▲▲

COMMIT;
