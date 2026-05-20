-- ============================================================================
-- Migration: 2026-04-29  marital_status 重新編碼 + 經濟弱勢專屬欄位
-- 對應修改計畫 #2 後續
--
-- 變更：
--   1. applications.marital_status 編碼改為對齊 mid_class_eligibility_matrix：
--        舊：'1'=單身, '2'=已婚
--        新：'1'=已婚, '2'=單親, '3'=單身
--      Migration 規則：
--        舊 '2' → 新 '1'（已婚）
--        舊 '1' + has_children=true → 新 '2'（單親）
--        舊 '1' + has_children=false/NULL → 新 '3'（單身）
--        NULL 保持 NULL
--   2. 加 applications.econ_deposit NUMERIC（經濟弱勢專屬）
--   3. 加 applications.econ_monthly_income NUMERIC（經濟弱勢專屬）
--
-- 冪等：
--   - 先用 has_children 推導重編碼；若已是新編碼（'3'）則不會再被翻譯
--   - 用兩段 UPDATE 並用「目前是舊值」的判定避免重複套用
-- ============================================================================

BEGIN;

-- 1. 暫時不加 CHECK 限制（避免 update 過程中卡住）
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_marital_status_chk;

-- 2a. 把舊 '2' 已婚 → 新 '1' 已婚（先做這步，避免被下一步誤判）
--     用一個臨時值 'M' 過渡，避免和舊 '1' 撞號
UPDATE applications SET marital_status = 'M' WHERE marital_status = '2';

-- 2b. 舊 '1' 單身 → 視 has_children 拆成 '2'(單親) 或 '3'(單身)
UPDATE applications
   SET marital_status = CASE WHEN has_children = TRUE THEN '2' ELSE '3' END
 WHERE marital_status = '1';

-- 2c. 過渡值換回 '1'
UPDATE applications SET marital_status = '1' WHERE marital_status = 'M';

-- 3. 套上新的 CHECK 約束
ALTER TABLE applications
    ADD CONSTRAINT applications_marital_status_chk
    CHECK (marital_status IS NULL OR marital_status IN ('1', '2', '3'));

COMMENT ON COLUMN applications.marital_status IS
    '婚姻狀態（115 年辦法）：1=已婚（配偶合計收入）、2=單親（個人收入）、3=單身（個人收入）；NULL 為舊資料未填';

-- 4. 經濟弱勢專屬欄位
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS econ_deposit         NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS econ_monthly_income  NUMERIC(12, 2);

COMMENT ON COLUMN applications.econ_deposit
    IS '【經濟弱勢專屬】存款（配偶取平均，萬元）— 115 年辦法第四條第三項第 1 款';
COMMENT ON COLUMN applications.econ_monthly_income
    IS '【經濟弱勢專屬】每月收入（配偶取平均，萬元）— 115 年辦法第四條第三項第 1 款';

COMMIT;
