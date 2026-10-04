-- 案件專屬董事組合（ad-hoc board group）。Safe to rerun.
--
-- 背景：匯入的歷史案件沒有派組紀錄、原審董事不詳，且一般組別「一位董事僅屬一組」，
-- 無法組出跨組的審核組合。改為允許為單一案件建立專屬組別：
--   * board_groups.is_adhoc = TRUE、adhoc_application_id 指向案件（每案至多一個專屬組別）
--   * 專屬組別不出現在組別管理、也不參與自動派組
--   * 「一位董事僅屬一組」只約束一般組別（partial unique index），專屬組別不受限

ALTER TABLE board_groups
    ADD COLUMN IF NOT EXISTS is_adhoc BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE board_groups
    ADD COLUMN IF NOT EXISTS adhoc_application_id BIGINT REFERENCES applications(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_board_groups_adhoc_application
    ON board_groups (adhoc_application_id)
    WHERE adhoc_application_id IS NOT NULL;

-- 成員表冗餘一份 is_adhoc，讓 partial unique index 可以只約束一般組別
ALTER TABLE board_group_members
    ADD COLUMN IF NOT EXISTS is_adhoc BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'board_group_members_user_id_key'
          AND conrelid = 'board_group_members'::regclass
    ) THEN
        ALTER TABLE board_group_members DROP CONSTRAINT board_group_members_user_id_key;
    END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_board_group_members_regular_user
    ON board_group_members (user_id)
    WHERE NOT is_adhoc;

COMMENT ON COLUMN board_groups.is_adhoc IS '是否為案件專屬組別（由派案人員為單一案件自訂董事組合）；不列入組別管理與自動派組';
COMMENT ON COLUMN board_groups.adhoc_application_id IS '專屬組別所屬案件；一般組別為 NULL';
COMMENT ON COLUMN board_group_members.is_adhoc IS '冗餘自 board_groups.is_adhoc；一般組別成員受「一位董事僅屬一組」限制，專屬組別成員不受限';
