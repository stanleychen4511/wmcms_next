-- Add update timestamp for editable contact record follow-up summaries.

ALTER TABLE contact_record_followups
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON COLUMN contact_record_followups.updated_at IS '追蹤摘要最後修改時間';
