-- Record why an active case was closed early.
-- Safe to rerun.

ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS early_close_reason TEXT;

COMMENT ON COLUMN applications.early_close_reason
    IS '案件中途結案時的必填原因；NULL 表示非中途結案';
