-- WMCMS-14 (#89)：撥款新增「支出帳戶」（一般／勸募）。
-- 以陣列儲存：目前 UI 為單選，日後若需複選只改 UI，不需搬資料。
-- 請先人工執行本檔，再部署會讀寫 expense_accounts 的應用程式版本。

BEGIN;

ALTER TABLE payment_disbursements
    ADD COLUMN IF NOT EXISTS expense_accounts TEXT[] NOT NULL DEFAULT '{}';

DO $$ BEGIN
    ALTER TABLE payment_disbursements
        ADD CONSTRAINT payment_disbursements_expense_accounts_chk
        CHECK (expense_accounts <@ ARRAY['general', 'fundraising']::TEXT[]);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN payment_disbursements.expense_accounts
    IS '支出帳戶：general=一般、fundraising=勸募；個管送出前必填（空陣列=未填）';

COMMIT;
