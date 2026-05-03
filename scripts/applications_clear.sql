-- ─────────────────────────────────────────────────────────────────────
-- applications_clear.sql
--
-- 清除「所有申請案件相關」的資料，保留系統基礎設定（角色、使用者、
-- 文件類型、儲存位置、系統參數、通知範本/渠道、董事組別、轉介單位、
-- 公告/Banner、範本檔等）。
--
-- 涵蓋：
--   ▸ applications 主檔
--   ▸ ON DELETE CASCADE 自動連帶清除：
--       application_workflow / application_documents / home_visit /
--       payment_disbursements / board_review_assignments / board_review_signatures
--   ▸ 顯式清除（FK 為 SET NULL，cascade 不會帶走）：
--       contact_records
--   ▸ 全部清除的 log 表（不分 target_type / application_id）：
--       audit_logs（含使用者登入、設定變更、範本上傳等所有歷史日誌）
--       notification_logs（含系統通知、手動發信、LINE 推播測試等所有紀錄）
--   ▸ 重置序號（applications_id_seq 等）
--
-- 不動：
--   roles / users / user_roles / document_type_config / file_storage_location
--   system_settings / notification_channels / notification_templates /
--   notification_schedules / banners / announcements / announcement_categories /
--   referral_units / board_groups / board_group_members / template_files /
--   template_categories
--
-- 用法：
--   psql $DATABASE_URL -f scripts/applications_clear.sql
--   或：node scripts/applications_clear.mjs   （會同時清檔案目錄）
--
-- ⚠️ 不可逆。執行前請確認你真的要清掉所有案件。
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. notification_logs：全清（包含系統通知、手動發信、LINE 推播測試等所有紀錄）
TRUNCATE notification_logs RESTART IDENTITY;

-- 2. contact_records：申請人關懷／來電紀錄
TRUNCATE contact_records RESTART IDENTITY CASCADE;

-- 3. applications：刪除主檔，CASCADE 自動帶走：
--      application_workflow、application_documents、home_visit、
--      payment_disbursements (→ application_documents.disbursement_id 也 CASCADE)、
--      board_review_assignments、board_review_signatures
TRUNCATE applications RESTART IDENTITY CASCADE;

-- 4. audit_logs：全清（包含使用者登入、設定變更、範本上傳等所有歷史日誌）
TRUNCATE audit_logs RESTART IDENTITY;

-- TRUNCATE ... RESTART IDENTITY CASCADE 已自動重置上述各表的序號，
-- 不需再手動 setval。

COMMIT;

-- 顯示清理後的計數（手動跑時可看）
SELECT
    (SELECT COUNT(*) FROM applications)            AS applications,
    (SELECT COUNT(*) FROM application_workflow)    AS workflows,
    (SELECT COUNT(*) FROM application_documents)   AS documents,
    (SELECT COUNT(*) FROM home_visit)              AS home_visits,
    (SELECT COUNT(*) FROM payment_disbursements)   AS disbursements,
    (SELECT COUNT(*) FROM board_review_signatures) AS board_signatures,
    (SELECT COUNT(*) FROM contact_records)         AS contact_records,
    (SELECT COUNT(*) FROM notification_logs)       AS notification_logs,
    (SELECT COUNT(*) FROM audit_logs)              AS audit_logs;
