-- Preserve the names of files included with each email notification.
-- Safe to rerun; existing records simply have an empty attachment list.

ALTER TABLE notification_logs
    ADD COLUMN IF NOT EXISTS attachment_filenames TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN notification_logs.attachment_filenames IS
    'Actual attachment filenames sent with this notification; the temporary file itself is not retained.';
