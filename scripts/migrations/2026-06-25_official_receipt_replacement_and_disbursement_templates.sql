-- Track official receipt replacement after a disbursement was completed with an unpaid receipt notice.
-- Also seed the selectable disbursement approval email template.
-- Safe to rerun.

ALTER TABLE payment_disbursements
    ADD COLUMN IF NOT EXISTS official_receipt_replaced_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS official_receipt_replaced_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS official_receipt_accountant_confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS official_receipt_accountant_confirmed_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN payment_disbursements.official_receipt_replaced_at IS '未繳款領據於撥款完成後補換正式收據的時間';
COMMENT ON COLUMN payment_disbursements.official_receipt_replaced_by IS '補換正式收據的使用者 ID';
COMMENT ON COLUMN payment_disbursements.official_receipt_accountant_confirmed_at IS '會計確認正式收據補換的時間';
COMMENT ON COLUMN payment_disbursements.official_receipt_accountant_confirmed_by IS '確認正式收據補換的會計使用者 ID';

INSERT INTO notification_templates (name, channel, subject, body, description, status, sort_order)
SELECT
    'email_case_disbursement_approval_to_applicant',
    'email',
    '萬美基金會申請通過通知',
    E'{{申請人}} 您好：\n\n您所申請的補助案件已通過董事審核，特此通知。\n\n本次撥款金額：{{本次撥款金額}}\n\n後續撥款流程將由基金會人員協助辦理。\n\n──────────────\n財團法人萬美社會福利慈善事業基金會',
    '系統範本：個管師於撥款階段寄送申請通過通知給申請人',
    1,
    104
WHERE NOT EXISTS (
    SELECT 1
    FROM notification_templates
    WHERE name = 'email_case_disbursement_approval_to_applicant'
);
