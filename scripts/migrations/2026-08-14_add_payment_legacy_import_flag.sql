-- Mark synthetic payment records created from historical cumulative amounts.
-- Safe to rerun.

ALTER TABLE payment_disbursements
    ADD COLUMN IF NOT EXISTS is_legacy_import BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN payment_disbursements.is_legacy_import
    IS '初始匯入的歷史撥款；不要求追溯收件日期、匯款單及歷史簽核';
