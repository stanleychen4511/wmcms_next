-- Add subsidy subtype scoping to document type management.
-- NULL = shared by both subsidy types, '1' = 經濟弱勢, '2' = 小康家庭.

ALTER TABLE document_type_config
    ADD COLUMN IF NOT EXISTS subsidy_subtype CHAR(1);

DO $$
BEGIN
    IF to_regclass('public.document_type_config') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'document_type_config_subsidy_subtype_chk'
             AND conrelid = 'public.document_type_config'::regclass
       ) THEN
        ALTER TABLE document_type_config
            ADD CONSTRAINT document_type_config_subsidy_subtype_chk
            CHECK (subsidy_subtype IS NULL OR subsidy_subtype IN ('1', '2'));
    END IF;
END $$;

COMMENT ON COLUMN document_type_config.subsidy_subtype
    IS '適用補助子類型：NULL=共用、1=經濟弱勢、2=小康家庭';

-- Existing extra documents that were already described as 小康家庭 requirements.
UPDATE document_type_config
SET subsidy_subtype = '2'
WHERE id IN (5, 9, 10);
