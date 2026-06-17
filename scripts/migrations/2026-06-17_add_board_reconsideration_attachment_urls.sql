-- Support multiple attachments for board reconsideration requests.
-- Safe to rerun.

ALTER TABLE board_reconsideration_requests
    ADD COLUMN IF NOT EXISTS attachment_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE board_reconsideration_requests
SET attachment_urls = jsonb_build_array(attachment_url)
WHERE attachment_url IS NOT NULL
  AND btrim(attachment_url) <> ''
  AND attachment_urls = '[]'::jsonb;

COMMENT ON COLUMN board_reconsideration_requests.attachment_urls
    IS '退回訊息多附件 URL 陣列（PDF/JPG/PNG），保留 attachment_url 作為舊資料相容欄位';
