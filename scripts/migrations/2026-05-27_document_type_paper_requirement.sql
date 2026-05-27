BEGIN;

ALTER TABLE document_type_config
    ADD COLUMN IF NOT EXISTS paper_requirement VARCHAR(20) NOT NULL DEFAULT 'original';

DO $$
BEGIN
    IF to_regclass('public.document_type_config') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'document_type_config_paper_requirement_chk'
             AND conrelid = 'public.document_type_config'::regclass
       ) THEN
        ALTER TABLE document_type_config
            ADD CONSTRAINT document_type_config_paper_requirement_chk
            CHECK (paper_requirement IN ('original', 'copy_allowed', 'none'));
    END IF;
END $$;

COMMENT ON COLUMN document_type_config.paper_requirement
    IS '紙本要求：original=需正本、copy_allowed=可接受影本、none=不需紙本';

COMMIT;
