-- WMCMS-1 (#75)：來電紀錄新增「聯絡方式類別」（後台可管理的下拉選項），供來電紀錄統計使用。
-- 舊資料 contact_channel_id 為 NULL，統計時顯示「未填」。
-- 請先人工執行本檔，再部署會讀寫 contact_channel_id 的應用程式版本。

BEGIN;

CREATE TABLE IF NOT EXISTS contact_channel_options (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    sort_order  INT NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE contact_channel_options IS '來電紀錄「聯絡方式類別」選項（電話/LINE/Email…），由後台維護；停用後不再出現在下拉選單但保留歷史統計';

-- 只在表為空時放預設選項，避免管理員改名後重跑又被補回
INSERT INTO contact_channel_options (name, sort_order)
SELECT v.name, v.sort_order
FROM (VALUES ('電話', 1), ('LINE', 2), ('Email', 3), ('親洽', 4), ('其他', 99)) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM contact_channel_options);

ALTER TABLE contact_records
    ADD COLUMN IF NOT EXISTS contact_channel_id BIGINT REFERENCES contact_channel_options(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contact_records_channel ON contact_records (contact_channel_id);
COMMENT ON COLUMN contact_records.contact_channel_id IS '聯絡方式類別（來電紀錄用；NULL=未填，舊資料皆為 NULL）';

COMMIT;
