ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS referral_contact_email TEXT;

COMMENT ON COLUMN applications.referral_contact_email IS '轉介人 Email；轉介申請時必填，用於後續聯繫。';
