-- #34 contact record follow-up summaries
-- Append-only tracking summaries for phone/care records.

CREATE TABLE IF NOT EXISTS contact_record_followups (
    id                BIGSERIAL PRIMARY KEY,
    contact_record_id BIGINT NOT NULL REFERENCES contact_records(id) ON DELETE CASCADE,
    author_user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    summary           TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_record_followups_record
    ON contact_record_followups (contact_record_id, created_at DESC);

COMMENT ON TABLE contact_record_followups IS '來電／關懷紀錄的追蹤摘要；每次新增一筆並保留新增者';
COMMENT ON COLUMN contact_record_followups.contact_record_id IS '對應 contact_records.id';
COMMENT ON COLUMN contact_record_followups.author_user_id IS '新增追蹤摘要的人員';
COMMENT ON COLUMN contact_record_followups.summary IS '追蹤摘要內容';
COMMENT ON COLUMN contact_record_followups.created_at IS '追蹤摘要新增時間';
