-- WMCMS-4 (#79)：新增主管審閱歷程表，並由 audit_logs 回補既有的送審／通過／退件紀錄。
-- 請先人工執行本檔，再部署會讀寫 application_supervisor_reviews 的應用程式版本。

BEGIN;

CREATE TABLE IF NOT EXISTS application_supervisor_reviews (
    id                   BIGSERIAL PRIMARY KEY,
    application_id       BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    action               TEXT NOT NULL,
    note                 TEXT,
    actor_id             BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_audit_log_id  BIGINT UNIQUE,
    CONSTRAINT application_supervisor_reviews_action_chk
        CHECK (action IN ('request', 'approve', 'reject'))
);
CREATE INDEX IF NOT EXISTS idx_application_supervisor_reviews_app
    ON application_supervisor_reviews (application_id, created_at, id);
COMMENT ON TABLE application_supervisor_reviews IS '送董事前主管審閱歷程（個管送審 / 主管通過 / 主管退件），只新增不覆蓋';
COMMENT ON COLUMN application_supervisor_reviews.action IS 'request=個管送主管審核、approve=主管通過、reject=主管退件';
COMMENT ON COLUMN application_supervisor_reviews.note IS '主管退件原因或通過備註';
COMMENT ON COLUMN application_supervisor_reviews.source_audit_log_id IS '由 audit_logs 回補的來源 id（避免重複回補）';

INSERT INTO application_supervisor_reviews (application_id, action, note, actor_id, created_at, source_audit_log_id)
SELECT al.target_id::bigint,
       CASE al.action
           WHEN 'application.request_supervisor_review_board' THEN 'request'
           WHEN 'application.supervisor_approve_board' THEN 'approve'
           ELSE 'reject'
       END,
       NULLIF(btrim(al.detail->>'note'), ''),
       al.user_id,
       al.created_at,
       al.id
FROM audit_logs al
JOIN applications a ON a.id::text = al.target_id
WHERE al.target_type = 'application'
  AND al.action IN ('application.request_supervisor_review_board',
                    'application.supervisor_approve_board',
                    'application.supervisor_reject_board')
  AND al.target_id ~ '^[0-9]+$'
  -- 已有系統直接寫入的紀錄（source_audit_log_id IS NULL）代表已上線新版，不再回補以免重複
  AND NOT EXISTS (
      SELECT 1 FROM application_supervisor_reviews r
      WHERE r.application_id = a.id AND r.source_audit_log_id IS NULL
  )
ON CONFLICT (source_audit_log_id) DO NOTHING;

COMMIT;
