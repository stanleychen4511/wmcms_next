-- Allow multiple uploaded files per configured document type and add upload hints.

ALTER TABLE document_type_config
    ADD COLUMN IF NOT EXISTS tooltip_text TEXT;

COMMENT ON COLUMN document_type_config.tooltip_text
    IS '文件上傳時顯示的提示文字（滑鼠 hover 顯示）';

DROP INDEX IF EXISTS uq_app_docs_case_level;
DROP INDEX IF EXISTS uq_app_docs_disb_level;

CREATE INDEX IF NOT EXISTS idx_app_docs_case_level_lookup
    ON application_documents (application_id, id)
    WHERE disbursement_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_app_docs_disb_level_lookup
    ON application_documents (application_id, id, disbursement_id)
    WHERE disbursement_id IS NOT NULL;
