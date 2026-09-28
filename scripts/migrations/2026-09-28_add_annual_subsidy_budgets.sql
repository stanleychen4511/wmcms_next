-- WMCMS-8 (#83)：年度預算與警戒金額（經濟弱勢／小康家庭分列）。
-- 已撥款（review_stage='9'）依核發日期 sent_at 所屬年度扣除；剩餘 ≤ 警戒金額時提醒內部人員。
-- 請先人工執行本檔，再部署會讀寫 annual_subsidy_budgets 的應用程式版本。

BEGIN;

CREATE TABLE IF NOT EXISTS annual_subsidy_budgets (
    fiscal_year     INT NOT NULL CHECK (fiscal_year BETWEEN 2000 AND 2200),
    subsidy_subtype CHAR(1) NOT NULL CHECK (subsidy_subtype IN ('1', '2')),
    budget_amount   NUMERIC(14, 0) NOT NULL CHECK (budget_amount >= 0),
    warning_amount  NUMERIC(14, 0) NOT NULL CHECK (warning_amount >= 0),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (fiscal_year, subsidy_subtype)
);
COMMENT ON TABLE  annual_subsidy_budgets IS '年度補助預算（依子類型）；剩餘預算 = 預算 − 當年度已完成撥款（依核發日期）';
COMMENT ON COLUMN annual_subsidy_budgets.fiscal_year IS '西元年（畫面顯示民國年）';
COMMENT ON COLUMN annual_subsidy_budgets.subsidy_subtype IS '子類型：1=經濟弱勢、2=小康家庭';
COMMENT ON COLUMN annual_subsidy_budgets.warning_amount IS '警戒金額：剩餘預算 ≤ 此值時提醒內部人員';

COMMIT;
