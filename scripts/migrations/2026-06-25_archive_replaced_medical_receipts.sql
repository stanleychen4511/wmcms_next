ALTER TABLE application_documents
    ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS archive_note TEXT;

COMMENT ON COLUMN application_documents.is_current IS '是否為目前採用版本；重新上傳時舊檔保留但標示為歷史版本';
COMMENT ON COLUMN application_documents.archive_note IS '歷史版本註記（例如：已由正式收據取代）';
