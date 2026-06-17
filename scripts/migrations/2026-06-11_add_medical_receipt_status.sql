-- Track whether the hospital medical receipt uploaded by the officer is an
-- official receipt or an unpaid receipt notice.
-- Safe to rerun.

ALTER TABLE payment_disbursements
    ADD COLUMN IF NOT EXISTS medical_receipt_status TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'payment_disbursements_medical_receipt_status_chk'
          AND conrelid = 'public.payment_disbursements'::regclass
    ) THEN
        ALTER TABLE payment_disbursements
            ADD CONSTRAINT payment_disbursements_medical_receipt_status_chk
            CHECK (medical_receipt_status IS NULL OR medical_receipt_status IN ('official', 'unpaid'));
    END IF;
END $$;

COMMENT ON COLUMN payment_disbursements.medical_receipt_status IS '醫療收據狀態：official=正式收據；unpaid=未繳款領據';
