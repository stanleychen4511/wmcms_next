-- Add email verification codes for applicant/referral email ownership checks.
-- Safe to rerun.

CREATE TABLE IF NOT EXISTS email_verification_codes (
    id                 BIGSERIAL PRIMARY KEY,
    email              TEXT NOT NULL,
    purpose            TEXT NOT NULL,
    code_hash          TEXT NOT NULL,
    salt               TEXT NOT NULL,
    verification_token TEXT,
    attempts           INTEGER NOT NULL DEFAULT 0,
    expires_at         TIMESTAMPTZ NOT NULL,
    verified_at        TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT email_verification_codes_purpose_chk
        CHECK (purpose IN ('applicant_application', 'referral_application'))
);

CREATE INDEX IF NOT EXISTS idx_email_verification_codes_lookup
    ON email_verification_codes (email, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_verification_codes_token
    ON email_verification_codes (email, purpose, verification_token)
    WHERE verification_token IS NOT NULL;

COMMENT ON TABLE email_verification_codes IS '申請流程 Email 驗證碼；用於確認申請人與轉介人信箱可收信';
COMMENT ON COLUMN email_verification_codes.purpose IS '驗證用途：applicant_application / referral_application';
COMMENT ON COLUMN email_verification_codes.verification_token IS '驗證成功後交給表單送出的短期 token';
