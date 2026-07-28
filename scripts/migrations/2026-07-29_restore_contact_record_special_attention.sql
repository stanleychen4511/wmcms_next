-- Restore special attention as one checkbox + one description on each contact record.
ALTER TABLE contact_record_followups
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'followup';

ALTER TABLE contact_records
    ADD COLUMN IF NOT EXISTS is_special_attention BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS special_attention_note TEXT;

ALTER TABLE contact_records
    DROP CONSTRAINT IF EXISTS contact_records_special_attention_note_chk;

ALTER TABLE contact_records
    ADD CONSTRAINT contact_records_special_attention_note_chk
    CHECK (
        (NOT is_special_attention AND special_attention_note IS NULL)
        OR (is_special_attention AND btrim(COALESCE(special_attention_note, '')) <> '')
    );

WITH latest_special_attention AS (
    SELECT DISTINCT ON (f.contact_record_id)
        f.contact_record_id,
        f.summary
    FROM contact_record_followups f
    WHERE f.kind = 'special_attention'
    ORDER BY f.contact_record_id, f.created_at DESC, f.id DESC
)
UPDATE contact_records cr
SET is_special_attention = TRUE,
    special_attention_note = latest.summary
FROM latest_special_attention latest
WHERE latest.contact_record_id = cr.id
  AND (NOT cr.is_special_attention OR btrim(COALESCE(cr.special_attention_note, '')) = '');

CREATE INDEX IF NOT EXISTS idx_contact_records_special_attention_applicant
    ON contact_records (applicant_user_id, contact_date DESC, created_at DESC)
    WHERE is_special_attention;
