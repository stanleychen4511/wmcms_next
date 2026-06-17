-- Quick archive records for paper applications rejected before case creation.

CREATE TABLE IF NOT EXISTS rejected_application_archives (
    id                 BIGSERIAL PRIMARY KEY,
    applicant_name_enc BYTEA NOT NULL,
    applicant_name_iv  BYTEA NOT NULL,
    apply_at           TIMESTAMPTZ NOT NULL,
    application_form   CHAR(1),
    reason_rows        JSONB NOT NULL DEFAULT '[]'::jsonb,
    officer_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT rejected_application_archives_application_form_chk
        CHECK (application_form IS NULL OR application_form IN ('P', 'E'))
);

CREATE INDEX IF NOT EXISTS idx_rejected_archives_apply_at
    ON rejected_application_archives (apply_at);

CREATE INDEX IF NOT EXISTS idx_rejected_archives_officer
    ON rejected_application_archives (officer_id);

CREATE INDEX IF NOT EXISTS idx_rejected_archives_reasons
    ON rejected_application_archives USING GIN (reason_rows);

COMMENT ON TABLE rejected_application_archives IS '紙本申請初判未通過且不建立正式案件時的報表歸檔資料';
COMMENT ON COLUMN rejected_application_archives.applicant_name_enc IS '申請人姓名 AES 加密內容';
COMMENT ON COLUMN rejected_application_archives.applicant_name_iv IS '申請人姓名 AES IV';
COMMENT ON COLUMN rejected_application_archives.apply_at IS '歸檔所屬申請日期';
COMMENT ON COLUMN rejected_application_archives.application_form IS '申請形式：P=紙本、E=電子郵件';
COMMENT ON COLUMN rejected_application_archives.reason_rows IS '不通過原因陣列：[{code, detail}]';
COMMENT ON COLUMN rejected_application_archives.officer_id IS '建立此筆歸檔的人員';
COMMENT ON COLUMN rejected_application_archives.notes IS '備註';
