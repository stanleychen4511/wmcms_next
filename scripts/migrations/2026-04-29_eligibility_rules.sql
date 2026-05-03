-- ============================================================================
-- Migration: 2026-04-29  申請規則參數化（115 年辦法）
-- 對應修改計畫 #2 + #3
--
-- 變更內容：
--   1. applications 加 subsidy_subtype CHAR(1)（'1'=經濟弱勢, '2'=小康家庭）
--   2. 新建 subsidy_amount_limits 表（補助金額上限，依子類型）
--   3. 新建 mid_class_eligibility_matrix 表（小康家庭資格矩陣 8 列）
--   4. system_settings 移除舊 eligibility_s31~s34 + age + real_estate；
--      改插入新的 elig_age_min/max、elig_real_estate_max、
--      elig_econ_deposit_max、elig_econ_monthly_income_max
--   5. 全部以 115 年辦法為預設值（民國 114 年 10 月 21 日董事會核定）
--
-- 冪等：可重複執行
-- ============================================================================

-- 1. applications 子類型欄位 -------------------------------------------------
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS subsidy_subtype CHAR(1)
    CHECK (subsidy_subtype IS NULL OR subsidy_subtype IN ('1', '2'));

COMMENT ON COLUMN applications.subsidy_subtype IS
    '補助子類型（115 年辦法）：1=經濟弱勢、2=小康家庭；NULL 為舊資料未分類';

-- 2. 補助金額上限表 ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS subsidy_amount_limits (
    subsidy_subtype CHAR(1) PRIMARY KEY
        CHECK (subsidy_subtype IN ('1', '2')),
    amount_max     NUMERIC(12, 0) NOT NULL CHECK (amount_max >= 0),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by     BIGINT REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE  subsidy_amount_limits IS
    '補助金額上限（依子類型，單位：元）— 115 年辦法第三條';
COMMENT ON COLUMN subsidy_amount_limits.subsidy_subtype IS
    '子類型：1=經濟弱勢、2=小康家庭';
COMMENT ON COLUMN subsidy_amount_limits.amount_max IS
    '每一申請人不限年度累計補助上限（元）';

-- 預設值（115 年辦法第三條）：
--   經濟弱勢 30,000 元 / 小康家庭 350,000 元
INSERT INTO subsidy_amount_limits (subsidy_subtype, amount_max)
VALUES ('1', 30000), ('2', 350000)
ON CONFLICT (subsidy_subtype) DO NOTHING;

-- 3. 小康家庭資格矩陣 -------------------------------------------------------
CREATE TABLE IF NOT EXISTS mid_class_eligibility_matrix (
    marital_status   CHAR(1) NOT NULL
        CHECK (marital_status  IN ('1', '2', '3')),  -- 1=已婚 2=單親 3=單身
    children_status  CHAR(1) NOT NULL
        CHECK (children_status IN ('1', '2', '3')),  -- 1=未成年子女 2=已成年子女 3=無子女
    income_min       NUMERIC(12, 0) NOT NULL CHECK (income_min >= 0),
    income_max       NUMERIC(12, 0) NOT NULL CHECK (income_max >= 0),
    assets_max       NUMERIC(12, 0) NOT NULL CHECK (assets_max >= 0),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by       BIGINT REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (marital_status, children_status)
);

COMMENT ON TABLE  mid_class_eligibility_matrix IS
    '小康家庭資格矩陣（115 年辦法第四條第三項第 2 款）— 單位：萬元';
COMMENT ON COLUMN mid_class_eligibility_matrix.marital_status IS
    '婚姻狀態：1=已婚（收入夫妻合計）、2=單親（個人收入）、3=單身（個人收入）';
COMMENT ON COLUMN mid_class_eligibility_matrix.children_status IS
    '子女狀態：1=未成年子女、2=已成年子女、3=無子女';
COMMENT ON COLUMN mid_class_eligibility_matrix.income_min IS '年收入下限（萬）';
COMMENT ON COLUMN mid_class_eligibility_matrix.income_max IS '年收入上限（萬）';
COMMENT ON COLUMN mid_class_eligibility_matrix.assets_max IS '存款＋有價證券上限（萬）';

-- 預設值（115 年辦法第四條第三項第 2 款）：
INSERT INTO mid_class_eligibility_matrix
    (marital_status, children_status, income_min, income_max, assets_max)
VALUES
    -- 已婚：收入 70~164 萬
    ('1', '1',  70, 164, 120),  -- 已婚 + 未成年子女
    ('1', '2',  70, 164,  60),  -- 已婚 + 已成年子女
    ('1', '3',  70, 164,  60),  -- 已婚 + 無子女
    -- 單親：收入 32~105 萬
    ('2', '1',  32, 105,  65),  -- 單親 + 未成年子女
    ('2', '2',  32, 105,  32),  -- 單親 + 已成年子女
    -- 單身：收入 32~105 萬
    ('3', '1',  32, 105,  65),  -- 單身 + 未成年子女
    ('3', '2',  32, 105,  32),  -- 單身 + 已成年子女
    ('3', '3',  32, 105,  32)   -- 單身 + 無子女
ON CONFLICT (marital_status, children_status) DO NOTHING;

-- 4. system_settings：移除舊 eligibility_*，補入新 elig_* -------------------
DELETE FROM system_settings
WHERE key IN (
    'eligibility_age_min', 'eligibility_age_max', 'eligibility_real_estate_max',
    'eligibility_s31_income_min', 'eligibility_s31_income_max', 'eligibility_s31_assets_max',
    'eligibility_s32_income_min', 'eligibility_s32_income_max', 'eligibility_s32_assets_max',
    'eligibility_s33_income_min', 'eligibility_s33_income_max', 'eligibility_s33_assets_max',
    'eligibility_s34_income_min', 'eligibility_s34_income_max'
);

-- 共同條件 + 經濟弱勢專屬條件
INSERT INTO system_settings (key, value, description) VALUES
    ('elig_age_min',                  '25',   '【115 辦法】申請人年齡下限（歲）'),
    ('elig_age_max',                  '65',   '【115 辦法】申請人年齡上限（歲）'),
    ('elig_real_estate_max',          '2500', '【115 辦法】不動產上限：戶籍內直系合計（萬元）'),
    ('elig_econ_deposit_max',         '16',   '【115 辦法-經濟弱勢】存款上限（夫妻取平均，萬元）'),
    ('elig_econ_monthly_income_max',  '3',    '【115 辦法-經濟弱勢】每月收入上限（夫妻取平均，萬元）')
ON CONFLICT (key) DO UPDATE
    SET description = EXCLUDED.description;
-- 注意：value 不覆寫（避免管理員調過後被 reseed 蓋掉）；description 永遠對齊新版註解。
