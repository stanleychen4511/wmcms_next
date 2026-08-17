-- Limit LINE account-linking attempts per LINE userId.
-- Safe to rerun.

CREATE TABLE IF NOT EXISTS line_link_attempts (
    line_user_id      TEXT        PRIMARY KEY,
    attempt_count     INTEGER     NOT NULL CHECK (attempt_count BETWEEN 1 AND 6),
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE line_link_attempts
    IS '以 LINE userId 紀錄綁定嘗試視窗：每 10 分鐘最多處理 5 次';

COMMENT ON COLUMN line_link_attempts.line_user_id
    IS 'LINE Messaging API userId（限流主體）';

COMMENT ON COLUMN line_link_attempts.attempt_count
    IS '目前 10 分鐘視窗的嘗試次數，6 代表已遭阻擋';

COMMENT ON COLUMN line_link_attempts.window_started_at
    IS '嘗試視窗開始時間';
