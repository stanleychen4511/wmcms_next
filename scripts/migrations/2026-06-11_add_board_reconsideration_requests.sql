-- Add reimbursement-stage requests to return a case to board review for a second review.
-- Safe to rerun.

CREATE TABLE IF NOT EXISTS board_reconsideration_requests (
    id                         BIGSERIAL PRIMARY KEY,
    application_id             BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    status                     TEXT NOT NULL DEFAULT 'pending_supervisor',
    reason                     TEXT NOT NULL,
    attachment_url             TEXT,
    attachment_urls            JSONB NOT NULL DEFAULT '[]'::jsonb,
    requested_by               BIGINT REFERENCES users(id) ON DELETE SET NULL,
    requested_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    supervisor_id              BIGINT REFERENCES users(id) ON DELETE SET NULL,
    supervisor_note            TEXT,
    supervisor_reviewed_at     TIMESTAMPTZ,
    final_board_review_comments TEXT,
    final_approved_amount      NUMERIC(12,2),
    CONSTRAINT board_reconsideration_requests_status_chk
        CHECK (status IN ('pending_supervisor', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_board_reconsideration_requests_app
    ON board_reconsideration_requests (application_id, requested_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_board_reconsideration_requests_pending
    ON board_reconsideration_requests (application_id)
    WHERE status = 'pending_supervisor';

COMMENT ON TABLE board_reconsideration_requests IS '核銷階段因治療變更等原因退回董事再次審核的申請與主管審核紀錄';
COMMENT ON COLUMN board_reconsideration_requests.reason IS '承辦人填寫的退回董事再審原因';
COMMENT ON COLUMN board_reconsideration_requests.attachment_url IS '退回訊息附件 URL（PDF/JPG/PNG）';
COMMENT ON COLUMN board_reconsideration_requests.final_board_review_comments IS '本次再次董事審核完成後彙整的意見，不覆蓋第一次審核內容';
