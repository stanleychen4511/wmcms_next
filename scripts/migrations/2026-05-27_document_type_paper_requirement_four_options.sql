BEGIN;

ALTER TABLE document_type_config
    ADD COLUMN IF NOT EXISTS paper_requirement VARCHAR(20) NOT NULL DEFAULT 'original';

DO $$
BEGIN
    IF to_regclass('public.document_type_config') IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'document_type_config_paper_requirement_chk'
             AND conrelid = 'public.document_type_config'::regclass
       ) THEN
        ALTER TABLE document_type_config
            DROP CONSTRAINT document_type_config_paper_requirement_chk;
    END IF;
END $$;

UPDATE document_type_config
SET paper_requirement = 'original_or_copy'
WHERE paper_requirement = 'copy_allowed';

ALTER TABLE document_type_config
    ADD CONSTRAINT document_type_config_paper_requirement_chk
    CHECK (paper_requirement IN ('original', 'copy', 'original_or_copy', 'none'));

COMMENT ON COLUMN document_type_config.paper_requirement
    IS '紙本要求：original=正本、copy=影本、original_or_copy=正本或影本、none=不須紙本';

COMMIT;
