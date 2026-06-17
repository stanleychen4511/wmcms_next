-- Store completed board-review rounds so reimbursement returns can create a second review
-- while keeping the first review as reference history. Safe to rerun.

CREATE TABLE IF NOT EXISTS board_review_rounds (
    id                         BIGSERIAL PRIMARY KEY,
    application_id             BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    round_no                   INT NOT NULL,
    source_reconsideration_id  BIGINT REFERENCES board_reconsideration_requests(id) ON DELETE SET NULL,
    approved_amount            NUMERIC(12,2),
    comments                   TEXT,
    signatures                 JSONB NOT NULL DEFAULT '[]'::jsonb,
    completed_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_latest                  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (application_id, round_no)
);

CREATE INDEX IF NOT EXISTS idx_board_review_rounds_app
    ON board_review_rounds (application_id, round_no DESC);

CREATE INDEX IF NOT EXISTS idx_board_review_rounds_latest
    ON board_review_rounds (application_id)
    WHERE is_latest = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_board_review_rounds_reconsideration
    ON board_review_rounds (source_reconsideration_id)
    WHERE source_reconsideration_id IS NOT NULL;

COMMENT ON TABLE board_review_rounds IS '董事審核多輪歷史；核銷退回再審時保留前一輪，最新輪為實際審核依據';
COMMENT ON COLUMN board_review_rounds.round_no IS '同一案件第幾次董事審核，正常流程為 1，核銷退回再審後為 2+';
COMMENT ON COLUMN board_review_rounds.source_reconsideration_id IS '若本輪源自核銷階段退回董事再審，連結 board_reconsideration_requests.id';
COMMENT ON COLUMN board_review_rounds.signatures IS '本輪完成時的董事簽章與個別審核意見快照';
COMMENT ON COLUMN board_review_rounds.is_latest IS '是否為目前實際採用的最新董事審核結果';
