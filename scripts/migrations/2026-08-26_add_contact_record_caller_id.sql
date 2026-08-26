-- 來電紀錄：註記電話號碼是否由本會電話的來電顯示取得。
-- 請先人工執行本檔，再部署會讀寫 caller_phone_from_caller_id 的應用程式版本。

BEGIN;

ALTER TABLE contact_records
    ADD COLUMN IF NOT EXISTS caller_phone_from_caller_id BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN contact_records.caller_phone_from_caller_id
    IS '聯絡方式中的電話號碼是否由本會電話來電顯示取得';

COMMIT;
