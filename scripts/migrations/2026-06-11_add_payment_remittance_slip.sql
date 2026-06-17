-- Add a per-disbursement remittance slip scan URL.
-- Safe to rerun.

ALTER TABLE payment_disbursements
    ADD COLUMN IF NOT EXISTS remittance_slip_file_path TEXT;

COMMENT ON COLUMN payment_disbursements.remittance_slip_file_path IS '撥款完成後上傳的匯款單掃描檔 URL';
