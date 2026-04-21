-- ============================================================
-- WMCMS 資料庫初始化腳本 (Idempotent)
-- 可重複執行：CREATE TABLE IF NOT EXISTS + ALTER ADD COLUMN IF NOT EXISTS
-- 所有 Seed Data 使用 ON CONFLICT DO NOTHING / DO UPDATE
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- SECTION 1: 建立資料表
-- 依照 FK 相依順序建立，無 FK 的表優先
-- ─────────────────────────────────────────────────────────────

-- 1. roles
CREATE TABLE IF NOT EXISTS roles (
    id    SERIAL PRIMARY KEY,
    code  TEXT   NOT NULL UNIQUE,
    name  TEXT   NOT NULL
);

-- 2. users
-- search_salt / *_enc / *_iv / *_bidx 以 BYTEA 儲存（Node.js crypto 產生 Buffer）
CREATE TABLE IF NOT EXISTS users (
    id               BIGSERIAL PRIMARY KEY,
    account          TEXT      NOT NULL UNIQUE,
    password         TEXT      NOT NULL,
    search_salt      BYTEA,
    name_enc         BYTEA,
    name_iv          BYTEA,
    name_bidx        TEXT,
    id_number_enc    BYTEA,
    id_number_iv     BYTEA,
    id_number_bidx   TEXT,
    email            TEXT,
    is_active        BOOLEAN   NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. user_roles
CREATE TABLE IF NOT EXISTS user_roles (
    user_id  BIGINT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    role_id  INT    NOT NULL REFERENCES roles(id)  ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- 4. file_storage_location（自參考樹狀結構）
CREATE TABLE IF NOT EXISTS file_storage_location (
    id             SERIAL PRIMARY KEY,
    parent_id      INT REFERENCES file_storage_location(id) ON DELETE SET NULL,
    location_name  TEXT    NOT NULL,
    status         SMALLINT NOT NULL DEFAULT 1,     -- 0=停用 1=啟用
    description    TEXT,
    sort_order     INT     NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. document_type_config
CREATE TABLE IF NOT EXISTS document_type_config (
    id                  SMALLSERIAL PRIMARY KEY,
    label               TEXT     NOT NULL,
    phase               TEXT     NOT NULL DEFAULT 'apply',   -- 'apply' | 'reimbursement'
    is_required         BOOLEAN  NOT NULL DEFAULT TRUE,
    allow_supplement    BOOLEAN  NOT NULL DEFAULT FALSE,
    storage_location_id INT REFERENCES file_storage_location(id) ON DELETE SET NULL,
    sort_order          INT      NOT NULL DEFAULT 0,
    is_active           BOOLEAN  NOT NULL DEFAULT TRUE
);
-- 補欄位（舊表可能缺少 allow_supplement）
ALTER TABLE document_type_config
    ADD COLUMN IF NOT EXISTS allow_supplement BOOLEAN NOT NULL DEFAULT FALSE;

-- 6. applications
CREATE TABLE IF NOT EXISTS applications (
    id                       BIGSERIAL   PRIMARY KEY,
    case_number              TEXT        NOT NULL UNIQUE,
    applicant_id             BIGINT      NOT NULL REFERENCES users(id),
    officer_id               BIGINT      REFERENCES users(id) ON DELETE SET NULL,
    status                   CHAR(1)     NOT NULL DEFAULT '1',
        -- '1'=審核中 '2'=審核未通過(結案) '3'=待核銷 '4'=核銷完成(結案)
    apply_at                 TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ,
    application_type         CHAR(1),    -- A/B/C/D
    apply_amount             NUMERIC(12,0),
    approved_amount          NUMERIC(12,0),
    age                      INT,
    moveable_property        NUMERIC(12,0),
    immoveable_property      NUMERIC(12,0),
    annual_income            NUMERIC(12,0),
    marital_status           CHAR(1),    -- '1'=未婚/單身 '2'=已婚
    has_children             BOOLEAN,
    underage_children_count  INT,
    adult_children_count     INT
);

-- 7. application_workflow
CREATE TABLE IF NOT EXISTS application_workflow (
    id              BIGSERIAL   PRIMARY KEY,
    application_id  BIGINT      NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    stage           TEXT        NOT NULL,
        -- 'admin_review' | 'home_visit' | 'board_review' | 'reimbursement'
    reviewer_id     BIGINT      REFERENCES users(id) ON DELETE SET NULL,
    is_approved     BOOLEAN,    -- NULL=尚未審核 TRUE=通過 FALSE=退件
    comments        TEXT,
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. application_documents
CREATE TABLE IF NOT EXISTS application_documents (
    application_id  BIGINT   NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    id              SMALLINT NOT NULL,  -- FK 至 document_type_config.id（邏輯關聯）
    file_path       TEXT,
    status          CHAR(1)  NOT NULL DEFAULT '0',
        -- '0'=待上傳/未符合 '1'=符合 '2'=逾期
    reject_reason   TEXT,
    uploaded_at     TIMESTAMPTZ,
    pages           INT,
    PRIMARY KEY (application_id, id)
);

-- 9. home_visit（允許一案多筆家訪；同案同日不可重複，由 UNIQUE (application_id, visit_date) 約束）
CREATE TABLE IF NOT EXISTS home_visit (
    id                              BIGSERIAL   PRIMARY KEY,
    application_id                  BIGINT      NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    visitor_id                      BIGINT      REFERENCES users(id) ON DELETE SET NULL,
    visit_date                      DATE,
    self_reported_condition         TEXT,
    disease_reaction_status         TEXT,
    disease_reaction_other          TEXT,
    treatment_attitude_status       TEXT,
    treatment_attitude_other        TEXT,
    other_status_notes              TEXT,
    primary_caregiver               TEXT,
    primary_caregiver_other         TEXT,
    family_interaction_status       TEXT,
    family_interaction_other        TEXT,
    impacted_party_thoughts         TEXT,
    treatment_support_status        TEXT,
    treatment_support_other         TEXT,
    subsidy_need_reason             TEXT,
    visitor_recommendations         TEXT,
    visitor_recommendations_other   TEXT,
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id           BIGSERIAL   PRIMARY KEY,
    user_id      BIGINT      REFERENCES users(id) ON DELETE SET NULL,
    action       TEXT        NOT NULL,
    target_type  TEXT,
    target_id    TEXT,
    detail       JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. system_settings
CREATE TABLE IF NOT EXISTS system_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT        NOT NULL,
    description TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. notification_channels
CREATE TABLE IF NOT EXISTS notification_channels (
    id          SERIAL PRIMARY KEY,
    channel     TEXT    NOT NULL UNIQUE,  -- 'email' | 'line' | 'sms'
    is_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    config      JSONB   NOT NULL DEFAULT '{}'
);

-- 13. notification_templates
CREATE TABLE IF NOT EXISTS notification_templates (
    id          SERIAL PRIMARY KEY,
    name        TEXT        NOT NULL,
    channel     TEXT        NOT NULL,
    subject     TEXT,
    body        TEXT        NOT NULL DEFAULT '',
    description TEXT,
    status      SMALLINT    NOT NULL DEFAULT 1,  -- 0=停用 1=啟用
    sort_order  INT         NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  BIGINT      REFERENCES users(id) ON DELETE SET NULL
);

-- 14. notification_logs
CREATE TABLE IF NOT EXISTS notification_logs (
    id              BIGSERIAL   PRIMARY KEY,
    application_id  BIGINT      REFERENCES applications(id) ON DELETE SET NULL,
    channel         TEXT        NOT NULL,
    sender_id       BIGINT      REFERENCES users(id) ON DELETE SET NULL,
    recipients      JSONB       NOT NULL DEFAULT '[]',
    subject         TEXT,
    body            TEXT        NOT NULL DEFAULT '',
    template_id     INT         REFERENCES notification_templates(id) ON DELETE SET NULL,
    status          TEXT        NOT NULL DEFAULT 'sent',  -- 'sent' | 'failed'
    error_message   TEXT,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7a. board_groups（董事組別主檔，added 2026-04）
CREATE TABLE IF NOT EXISTS board_groups (
    id          BIGSERIAL   PRIMARY KEY,
    name        TEXT        NOT NULL UNIQUE,
    priority    INT         NOT NULL DEFAULT 0,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7b. board_group_members（組別成員，一人一組 UNIQUE(user_id)）
CREATE TABLE IF NOT EXISTS board_group_members (
    group_id  BIGINT NOT NULL REFERENCES board_groups(id) ON DELETE CASCADE,
    user_id   BIGINT NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
    PRIMARY KEY (group_id, user_id),
    UNIQUE (user_id)
);

-- 7c. board_review_assignments（案件派組紀錄，每案至多一組）
CREATE TABLE IF NOT EXISTS board_review_assignments (
    application_id BIGINT      PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
    group_id       BIGINT      NOT NULL REFERENCES board_groups(id),
    assigned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by    BIGINT      REFERENCES users(id) ON DELETE SET NULL,
    assign_mode    TEXT        NOT NULL
);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'board_review_assignments_mode_chk') THEN
        ALTER TABLE board_review_assignments
            ADD CONSTRAINT board_review_assignments_mode_chk
            CHECK (assign_mode IN ('auto', 'manual'));
    END IF;
END$$;

-- 7d. board_review_votes — REMOVED 2026-04
--   原設計為每位董事一列的投票表；改為「組員共筆代表」模式後不再使用。
--   對既有環境執行 DROP TABLE IF EXISTS（冪等）。
DROP TABLE IF EXISTS board_review_votes;

-- 7e. board_review_signatures（董事審核電子簽章，added 2026-04）
CREATE TABLE IF NOT EXISTS board_review_signatures (
    application_id     BIGINT      NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    signer_user_id     BIGINT      NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
    signature_data_url TEXT        NOT NULL,
    content_hash       TEXT        NOT NULL,
    signed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_agent         TEXT,
    ip_address         TEXT,
    PRIMARY KEY (application_id, signer_user_id)
);

-- 6a. referral_units（轉介單位字典表，added 2026-04；供 applications.referral_unit_id FK 使用）
CREATE TABLE IF NOT EXISTS referral_units (
    id            BIGSERIAL   PRIMARY KEY,
    name          TEXT        NOT NULL UNIQUE,
    contact_info  TEXT,
    sort_order    INT         NOT NULL DEFAULT 0,
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6b. applications: 案件來源與轉介單位（added 2026-04）
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS application_way   CHAR(1) NOT NULL DEFAULT '1';
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS referral_unit_id  BIGINT;

-- CHECK 約束（冪等）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'applications_application_way_chk'
    ) THEN
        ALTER TABLE applications
            ADD CONSTRAINT applications_application_way_chk
            CHECK (application_way IN ('1','2'));
    END IF;
END$$;

-- FK 約束（冪等；refs referral_units 表需先建立）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'applications_referral_unit_id_fkey'
    ) THEN
        ALTER TABLE applications
            ADD CONSTRAINT applications_referral_unit_id_fkey
            FOREIGN KEY (referral_unit_id) REFERENCES referral_units(id) ON DELETE SET NULL;
    END IF;
END$$;

-- 9a. home_visit: 允許一案多筆家訪（added 2026-04）
--   舊表可能仍是 UNIQUE (application_id)；改為 UNIQUE (application_id, visit_date) 以允許同案多次訪視
ALTER TABLE home_visit DROP CONSTRAINT IF EXISTS home_visit_application_id_key;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'home_visit_app_date_uniq'
    ) THEN
        ALTER TABLE home_visit
            ADD CONSTRAINT home_visit_app_date_uniq UNIQUE (application_id, visit_date);
    END IF;
END$$;

-- 14a. notification_logs: pending-doc reminder flag (added 2026-04)
ALTER TABLE notification_logs
    ADD COLUMN IF NOT EXISTS is_pending_doc_reminder BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_notif_logs_pending_doc
    ON notification_logs (application_id, is_pending_doc_reminder, status);

-- 15. notification_schedules
CREATE TABLE IF NOT EXISTS notification_schedules (
    id              SERIAL PRIMARY KEY,
    name            TEXT        NOT NULL,
    channel         TEXT        NOT NULL,
    template_id     INT         REFERENCES notification_templates(id) ON DELETE SET NULL,
    recipient_type  TEXT        NOT NULL,
    conditions      JSONB       NOT NULL DEFAULT '{}',
    frequency       TEXT        NOT NULL DEFAULT 'weekly',
    day_of_week     INT,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    last_sent_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. template_categories
CREATE TABLE IF NOT EXISTS template_categories (
    id          SERIAL PRIMARY KEY,
    name        TEXT     NOT NULL UNIQUE,
    sort_order  INT      NOT NULL DEFAULT 0,
    status      SMALLINT NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. template_files
CREATE TABLE IF NOT EXISTS template_files (
    id             SERIAL PRIMARY KEY,
    display_name   TEXT        NOT NULL,
    description    TEXT,
    category_id    INT         REFERENCES template_categories(id) ON DELETE SET NULL,
    file_name      TEXT        NOT NULL,
    original_name  TEXT        NOT NULL,
    file_path      TEXT        NOT NULL,
    file_size      INT         NOT NULL DEFAULT 0,
    mime_type      TEXT        NOT NULL DEFAULT '',
    sort_order     INT         NOT NULL DEFAULT 0,
    status         SMALLINT    NOT NULL DEFAULT 1,
    uploaded_by    BIGINT      REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. banners
CREATE TABLE IF NOT EXISTS banners (
    id          SERIAL PRIMARY KEY,
    title       TEXT,
    subtitle    TEXT,
    image_url   TEXT        NOT NULL,
    link_url    TEXT,
    sort_order  INT         NOT NULL DEFAULT 0,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. announcement_categories
CREATE TABLE IF NOT EXISTS announcement_categories (
    id          SERIAL PRIMARY KEY,
    name        TEXT     NOT NULL,
    color       TEXT     NOT NULL DEFAULT '#6366f1',
    sort_order  INT      NOT NULL DEFAULT 0,
    is_active   BOOLEAN  NOT NULL DEFAULT TRUE
);

-- 20. announcements
CREATE TABLE IF NOT EXISTS announcements (
    id            SERIAL PRIMARY KEY,
    category_id   INT         REFERENCES announcement_categories(id) ON DELETE SET NULL,
    title         TEXT        NOT NULL,
    content       TEXT        NOT NULL DEFAULT '',
    publish_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
    start_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
    end_date      DATE,
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    BIGINT      REFERENCES users(id) ON DELETE SET NULL
);


-- ─────────────────────────────────────────────────────────────
-- SECTION 2: 建立索引
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_applications_applicant_id  ON applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_officer_id    ON applications(officer_id);
CREATE INDEX IF NOT EXISTS idx_applications_status        ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_apply_at      ON applications(apply_at);
CREATE INDEX IF NOT EXISTS idx_workflow_application_id    ON application_workflow(application_id);
CREATE INDEX IF NOT EXISTS idx_workflow_reviewed_at       ON application_workflow(reviewed_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_documents_application_id  ON application_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id        ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at     ON audit_logs(created_at DESC);


-- ─────────────────────────────────────────────────────────────
-- SECTION 3: Seed Data（基本資料）
-- ON CONFLICT 確保重複執行安全
-- ─────────────────────────────────────────────────────────────

-- ── 角色 ──────────────────────────────────────────────────────
INSERT INTO roles (code, name) VALUES
    ('admin',         '系統管理員'),
    ('supervisor',    '主管'),
    ('case_officer',  '承辦人員'),
    ('social_worker', '社工人員'),
    ('chairman',      '董事長'),
    ('board_member',  '董事'),
    ('accountant',    '會計'),
    ('volunteer',     '志工'),
    ('applicant',     '申請人')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- ── 系統設定 ──────────────────────────────────────────────────
INSERT INTO system_settings (key, value, description) VALUES
    ('max_apply_amount',       '350000', '每人累積補助金額上限（元）'),
    ('pending_doc_alert_days', '14',     '超過幾天未補件則觸發缺件警示'),
    ('pending_doc_notification_threshold', '3', '同案件累計發送幾次未補件提醒後，於 UI 提示承辦人考慮以不通過結案'),
    ('board_auto_assign',                  'false', '董事審核階段自動派案開關（true/false）：true 時案件進 board_review 自動派給當前案件最少、priority 最小的組別'),
    ('announcement_new_days',  '7',      '公告發佈後幾天內顯示 NEW 標籤')
ON CONFLICT (key) DO NOTHING;

-- ── 通知渠道 ──────────────────────────────────────────────────
INSERT INTO notification_channels (channel, is_enabled, config) VALUES
    ('email', FALSE, '{}'),
    ('line',  FALSE, '{}'),
    ('sms',   FALSE, '{}')
ON CONFLICT (channel) DO NOTHING;

-- ── 檔案儲存位置 ──────────────────────────────────────────────
-- 先插入無 parent 的根節點，再插入子節點
INSERT INTO file_storage_location (id, parent_id, location_name, status, description, sort_order) VALUES
    (1, NULL, 'A區',      1, NULL, 1),
    (2, NULL, 'B區',      1, NULL, 1),
    (3, NULL, 'C區',      1, NULL, 1),
    (4, 1,    '1號櫃',    1, NULL, 1),
    (5, 2,    '2號櫃',    1, NULL, 1),
    (6, 3,    '3號櫃',    1, NULL, 1),
    (7, 4,    '身分證影本', 1, NULL, 2),
    (8, 4,    '申請書',   1, NULL, 1),
    (9, 5,    '個資同意書', 1, NULL, 1)
ON CONFLICT (id) DO UPDATE SET
    parent_id     = EXCLUDED.parent_id,
    location_name = EXCLUDED.location_name,
    status        = EXCLUDED.status,
    sort_order    = EXCLUDED.sort_order;
-- 重設 sequence 以免之後新增時 id 衝突
SELECT setval('file_storage_location_id_seq', (SELECT MAX(id) FROM file_storage_location));

-- ── 文件類型設定 ──────────────────────────────────────────────
-- 申請階段
INSERT INTO document_type_config
    (id, label, phase, is_required, storage_location_id, sort_order, is_active, allow_supplement)
VALUES
    ( 1, '自費醫療補助申請表',             'apply', TRUE,  8,    1,  TRUE, FALSE),
    ( 2, '重大傷病證明',                   'apply', TRUE,  NULL, 6,  TRUE, TRUE),
    ( 3, '身分證正反面影本',               'apply', TRUE,  7,    2,  TRUE, FALSE),
    ( 4, '個資同意書',                     'apply', TRUE,  9,    3,  TRUE, FALSE),
    ( 5, '現職醫事人員在職證明',           'apply', FALSE, NULL, 11, TRUE, FALSE),
    ( 6, '綜所稅清單(配偶亦繳)',           'apply', TRUE,  NULL, 4,  TRUE, TRUE),
    ( 8, '全戶戶籍謄本',                   'apply', TRUE,  NULL, 5,  TRUE, TRUE),
    ( 9, '集保結算所資料',                 'apply', FALSE, NULL, 9,  TRUE, FALSE),
    (10, '購屋貸款利息單據',               'apply', FALSE, NULL, 10, TRUE, FALSE),
    (11, '診斷證明',                       'apply', TRUE,  NULL, 7,  TRUE, TRUE),
    (13, '醫療單據正本或與正本相符之影本', 'apply', TRUE,  NULL, 8,  TRUE, TRUE),
-- 核銷階段
    (17, '醫療收據',             'reimbursement', TRUE,  NULL, 1, TRUE, FALSE),
    (18, '領款收據',             'reimbursement', TRUE,  NULL, 2, TRUE, FALSE),
    (19, '保險給付通知單',       'reimbursement', FALSE, NULL, 3, TRUE, FALSE),
    (20, '生命故事同意刊登截圖證明', 'reimbursement', FALSE, NULL, 4, TRUE, FALSE)
ON CONFLICT (id) DO UPDATE SET
    label               = EXCLUDED.label,
    phase               = EXCLUDED.phase,
    is_required         = EXCLUDED.is_required,
    storage_location_id = EXCLUDED.storage_location_id,
    sort_order          = EXCLUDED.sort_order,
    is_active           = EXCLUDED.is_active,
    allow_supplement    = EXCLUDED.allow_supplement;

-- ── 公告分類（預設） ──────────────────────────────────────────
INSERT INTO announcement_categories (name, color, sort_order, is_active) VALUES
    ('最新消息', '#3b82f6', 1, TRUE),
    ('活動公告', '#10b981', 2, TRUE),
    ('重要通知', '#ef4444', 3, TRUE)
ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- 資料表註解（COMMENT ON TABLE）
--   方便 DBA / 開發者以 `\d+ <table>` 或 pg_class 查看用途說明。
--   COMMENT 為冪等操作（會覆寫既有註解），可重複執行。
-- ─────────────────────────────────────────────────────────────
COMMENT ON TABLE roles                    IS '角色字典表：系統內所有可指派的角色定義（admin/supervisor/case_officer/social_worker/accountant/board_member/volunteer/applicant）';
COMMENT ON TABLE users                    IS '使用者帳號主檔：含加密欄位（name_enc/name_iv/id_number_enc/id_number_iv）與 HMAC blind index（name_bidx/id_number_bidx）。密碼為 HMAC-SHA256 雜湊，search_salt 為 32-byte BYTEA';
COMMENT ON TABLE user_roles               IS '使用者與角色多對多關聯表：一個使用者可同時擁有多個角色';
COMMENT ON TABLE applications             IS '補助申請案件主檔。status：1=審核中 / 2=審核未通過結案 / 3=待核銷 / 4=核銷完成結案。case_number 為唯一案號';
COMMENT ON TABLE application_workflow     IS '案件各階段審核紀錄：stage（admin_review/home_visit/board_review/reimbursement）、reviewer、審核結果、審核意見';
COMMENT ON TABLE application_documents    IS '案件文件與審核狀態（複合主鍵 application_id + id）。status：0=待上傳/未符合, 1=符合, 2=逾期。懶建立：首次上傳才會建列';
COMMENT ON TABLE document_type_config     IS '文件類型設定：phase（apply/board/reimbursement）、is_required（必備）、allow_supplement（可延後補件）';
COMMENT ON TABLE file_storage_location    IS '檔案實體儲存位置樹狀結構（parent_id 自參考），用於記錄紙本或影印本的實體櫃位';
COMMENT ON TABLE home_visit               IS '家訪紀錄：每個案件最多一筆，記錄家庭狀況、訪視心得、訪視人員';
COMMENT ON TABLE system_settings          IS '系統參數（key-value）：max_apply_amount、pending_doc_alert_days、pending_doc_notification_threshold、announcement_new_days 等';
COMMENT ON TABLE audit_logs               IS '稽核日誌：所有敏感操作（登入、建案、審核、權限異動、通知發送、結案、設定變更等）的紀錄。detail 為 JSONB';
COMMENT ON TABLE notification_channels    IS '通知渠道設定（email/line/sms）：config 為 JSONB，email 含 SMTP host/port/user/password_enc/password_iv 等';
COMMENT ON TABLE notification_templates   IS '通知範本：支援 {{案號}} / {{申請人}} / {{階段}} / {{申請日期}} / {{申請金額}} / {{承辦人}} 等 placeholder';
COMMENT ON TABLE notification_logs        IS '通知發送紀錄：每一次寄送都寫一筆。is_pending_doc_reminder=TRUE 代表該筆屬於「未補件提醒」，用於達門檻提醒計數';
COMMENT ON TABLE notification_schedules   IS '排程通知設定：定時自動寄發通知（conditions JSONB 描述觸發條件，frequency 描述頻率）';
COMMENT ON TABLE template_categories      IS '範本下載分類字典（例如：申請表、同意書、證明文件 …）';
COMMENT ON TABLE template_files           IS '範本下載檔案：供外部申請人或承辦人下載的空白表單檔';
COMMENT ON TABLE announcement_categories  IS '公告分類字典（例如：一般公告、重要通知、活動訊息）含顏色與排序';
COMMENT ON TABLE announcements            IS '首頁公告內容：發佈日期 + NEW 標籤天數（由 system_settings.announcement_new_days 控制）';
COMMENT ON TABLE banners                  IS '首頁輪播橫幅：圖片、連結、顯示區間、排序';
COMMENT ON TABLE referral_units           IS '轉介單位字典表：由後台管理員維護，供新增案件時於下拉選單選擇來源機構';
COMMENT ON TABLE board_groups             IS '董事組別主檔：由董事長(chairman)維護；每組含 name / priority（小者優先）/ is_active';
COMMENT ON TABLE board_group_members      IS '董事組別成員：多對多但 UNIQUE(user_id) 限制一位董事僅屬於一組';
COMMENT ON TABLE board_review_assignments IS '案件派組紀錄：每案一列，記錄當前派到哪個董事組別、派案者、手動/自動';
COMMENT ON TABLE board_review_signatures  IS '董事審核電子簽章：每位派組成員一列，含簽章 base64 + 當時案件內容 SHA-256 hash + 時間/IP/UA；推進前守門驗證全員簽完且 hash 有效';

-- ─────────────────────────────────────────────────────────────
-- 欄位註解（COMMENT ON COLUMN）
--   不確定語意的欄位（例如 home_visit 內的多個自由文字狀態欄位）暫留空，
--   待熟悉需求的開發者後續補上。新增欄位時請同步補註解。
-- ─────────────────────────────────────────────────────────────
-- roles
COMMENT ON COLUMN roles.id           IS '主鍵，自動遞增';
COMMENT ON COLUMN roles.code         IS '角色代碼（英文，程式判斷用）：admin/supervisor/case_officer/social_worker/accountant/board_member/volunteer/applicant';
COMMENT ON COLUMN roles.name         IS '角色中文顯示名稱';

-- users
COMMENT ON COLUMN users.id             IS '主鍵，自動遞增（BIGINT）';
COMMENT ON COLUMN users.account        IS '登入帳號（唯一）';
COMMENT ON COLUMN users.password       IS '密碼：HMAC-SHA256 雜湊字串（key 為該 user 的 search_salt）';
COMMENT ON COLUMN users.search_salt    IS '32-byte 隨機鹽值（BYTEA），作為密碼雜湊與 blind index 的 HMAC key';
COMMENT ON COLUMN users.name_enc       IS '姓名 AES-256-CBC 加密後密文（BYTEA），配合 name_iv 使用';
COMMENT ON COLUMN users.name_iv        IS '姓名 AES 加密的 IV（16 bytes BYTEA）';
COMMENT ON COLUMN users.name_bidx      IS '姓名 HMAC 盲索引（blind index），供精確搜尋使用';
COMMENT ON COLUMN users.id_number_enc  IS '身分證號 AES-256-CBC 加密後密文（BYTEA）';
COMMENT ON COLUMN users.id_number_iv   IS '身分證號 AES 加密的 IV（16 bytes BYTEA）';
COMMENT ON COLUMN users.id_number_bidx IS '身分證號 HMAC 盲索引（blind index）';
COMMENT ON COLUMN users.email          IS 'Email 地址（明文儲存，用於系統通知）';
COMMENT ON COLUMN users.is_active      IS '帳號啟用狀態：TRUE=啟用 FALSE=停用';
COMMENT ON COLUMN users.created_at     IS '帳號建立時間';

-- user_roles
COMMENT ON COLUMN user_roles.user_id   IS '使用者 ID，FK 至 users.id';
COMMENT ON COLUMN user_roles.role_id   IS '角色 ID，FK 至 roles.id';

-- file_storage_location
COMMENT ON COLUMN file_storage_location.id            IS '主鍵，自動遞增';
COMMENT ON COLUMN file_storage_location.parent_id     IS '上層節點 ID（自參考）；NULL 表示根節點';
COMMENT ON COLUMN file_storage_location.location_name IS '位置名稱（例如 "A區"、"1號櫃"）';
COMMENT ON COLUMN file_storage_location.status        IS '狀態：0=停用 1=啟用';
COMMENT ON COLUMN file_storage_location.description   IS '備註說明';
COMMENT ON COLUMN file_storage_location.sort_order    IS '同層級下的排序值（小者優先）';
COMMENT ON COLUMN file_storage_location.created_at    IS '建立時間';
COMMENT ON COLUMN file_storage_location.updated_at    IS '最後更新時間';

-- document_type_config
COMMENT ON COLUMN document_type_config.id                  IS '主鍵；同時作為 application_documents.id 的邏輯 FK';
COMMENT ON COLUMN document_type_config.label               IS '文件顯示名稱（例如 "身分證影本"）';
COMMENT ON COLUMN document_type_config.phase               IS '所屬階段：apply（收件）/ reimbursement（核銷）等';
COMMENT ON COLUMN document_type_config.is_required         IS '是否為必備文件';
COMMENT ON COLUMN document_type_config.allow_supplement    IS '是否允許延後補件（FALSE = 收件當下必備）';
COMMENT ON COLUMN document_type_config.storage_location_id IS '預設實體儲存位置，FK 至 file_storage_location.id';
COMMENT ON COLUMN document_type_config.sort_order          IS '顯示排序';
COMMENT ON COLUMN document_type_config.is_active           IS '是否啟用：FALSE 時此文件類型不會出現在新案件中';

-- applications
COMMENT ON COLUMN applications.id                      IS '主鍵，自動遞增（BIGINT）';
COMMENT ON COLUMN applications.case_number             IS '案號（唯一，人類可讀格式）';
COMMENT ON COLUMN applications.applicant_id            IS '申請人使用者 ID，FK 至 users.id';
COMMENT ON COLUMN applications.officer_id              IS '承辦人 ID，FK 至 users.id；NULL 代表尚未派案';
COMMENT ON COLUMN applications.status                  IS '案件狀態：1=審核中 / 2=審核未通過（結案）/ 3=待核銷 / 4=核銷完成（結案）';
COMMENT ON COLUMN applications.apply_at                IS '正式收件時間（作為補件警示的起算點）';
COMMENT ON COLUMN applications.created_at              IS '資料建立時間';
COMMENT ON COLUMN applications.updated_at              IS '最後更新時間';
COMMENT ON COLUMN applications.application_type        IS '申請類別：A/B/C/D（依補助類型區分）';
COMMENT ON COLUMN applications.apply_amount            IS '申請金額（元）';
COMMENT ON COLUMN applications.approved_amount         IS '董事審核核准金額（元）；0 表示未通過';
COMMENT ON COLUMN applications.age                     IS '申請人年齡（資格預審用）';
COMMENT ON COLUMN applications.moveable_property       IS '動產金額（元）';
COMMENT ON COLUMN applications.immoveable_property     IS '不動產金額（元）';
COMMENT ON COLUMN applications.annual_income           IS '年收入（元）';
COMMENT ON COLUMN applications.marital_status          IS '婚姻狀況：1=未婚/單身 2=已婚';
COMMENT ON COLUMN applications.has_children            IS '是否有子女';
COMMENT ON COLUMN applications.underage_children_count IS '未成年子女人數';
COMMENT ON COLUMN applications.adult_children_count    IS '成年子女人數';
COMMENT ON COLUMN applications.application_way         IS '案件來源：1=自提 2=轉介（CHECK 約束）';
COMMENT ON COLUMN applications.referral_unit_id        IS '轉介單位 ID，FK 至 referral_units.id（ON DELETE SET NULL）；僅當 application_way=2 時有意義';

-- board_groups
COMMENT ON COLUMN board_groups.id         IS '主鍵，自動遞增（BIGINT）';
COMMENT ON COLUMN board_groups.name       IS '組別名稱（唯一）';
COMMENT ON COLUMN board_groups.priority   IS '優先序：自動派案平手時小者優先';
COMMENT ON COLUMN board_groups.is_active  IS '是否啟用：FALSE 時不再接受新派案，但既有派案不受影響';
COMMENT ON COLUMN board_groups.created_at IS '建立時間';
COMMENT ON COLUMN board_groups.updated_at IS '最後更新時間';

-- board_group_members
COMMENT ON COLUMN board_group_members.group_id IS '組別 ID，FK 至 board_groups.id';
COMMENT ON COLUMN board_group_members.user_id  IS '董事 user ID，FK 至 users.id（UNIQUE：一人僅屬於一組）';

-- board_review_assignments
COMMENT ON COLUMN board_review_assignments.application_id IS '案件 ID（主鍵）：每案至多一個當前派案';
COMMENT ON COLUMN board_review_assignments.group_id       IS '被派到的組別，FK 至 board_groups.id';
COMMENT ON COLUMN board_review_assignments.assigned_at    IS '派案時間';
COMMENT ON COLUMN board_review_assignments.assigned_by    IS '派案者 user ID（自動派案時為 NULL）';
COMMENT ON COLUMN board_review_assignments.assign_mode    IS '派案模式：auto（自動）/ manual（手動）';

-- board_review_signatures
COMMENT ON COLUMN board_review_signatures.application_id     IS '案件 ID（複合 PK）';
COMMENT ON COLUMN board_review_signatures.signer_user_id     IS '簽章董事 user ID（複合 PK）；必須為該案派組的當前成員';
COMMENT ON COLUMN board_review_signatures.signature_data_url IS '手寫簽名的 PNG data URL（base64），前端以 react-signature-canvas 的 toDataURL 取得';
COMMENT ON COLUMN board_review_signatures.content_hash       IS 'SHA-256 hex；v1|{appId}|{approvedAmount}|{comments}|{isApproved}|{groupId} 的雜湊值，綁定簽章與當時案件內容';
COMMENT ON COLUMN board_review_signatures.signed_at          IS '簽章時間';
COMMENT ON COLUMN board_review_signatures.user_agent         IS '簽章當下的 User-Agent（稽核佐證用）';
COMMENT ON COLUMN board_review_signatures.ip_address         IS '簽章當下的 IP（稽核佐證用）';

-- referral_units
COMMENT ON COLUMN referral_units.id           IS '主鍵，自動遞增（BIGINT）';
COMMENT ON COLUMN referral_units.name         IS '單位名稱（唯一）';
COMMENT ON COLUMN referral_units.contact_info IS '聯絡資訊（聯絡人 / 電話 / Email，自由文字）';
COMMENT ON COLUMN referral_units.sort_order   IS '下拉排序（小者優先），相同時依 name 排';
COMMENT ON COLUMN referral_units.is_active    IS '是否啟用：FALSE 時不再出現於新案件下拉，但已引用此單位的歷史案件保留關聯';
COMMENT ON COLUMN referral_units.created_at   IS '建立時間';
COMMENT ON COLUMN referral_units.updated_at   IS '最後更新時間';

-- application_workflow
COMMENT ON COLUMN application_workflow.id             IS '主鍵，自動遞增';
COMMENT ON COLUMN application_workflow.application_id IS '案件 ID，FK 至 applications.id';
COMMENT ON COLUMN application_workflow.stage          IS '工作流程階段：admin_review / home_visit / board_review / reimbursement';
COMMENT ON COLUMN application_workflow.reviewer_id    IS '審核者 ID，FK 至 users.id';
COMMENT ON COLUMN application_workflow.is_approved    IS '審核結果：NULL=尚未審核 TRUE=通過 FALSE=退件';
COMMENT ON COLUMN application_workflow.comments       IS '審核意見／備註';
COMMENT ON COLUMN application_workflow.reviewed_at    IS '審核完成時間';
COMMENT ON COLUMN application_workflow.created_at     IS '資料建立時間';

-- application_documents
COMMENT ON COLUMN application_documents.application_id IS '案件 ID，FK 至 applications.id';
COMMENT ON COLUMN application_documents.id             IS '文件類型 ID，邏輯 FK 至 document_type_config.id';
COMMENT ON COLUMN application_documents.file_path      IS '檔案儲存路徑（Vercel Blob URL 或本地路徑）';
COMMENT ON COLUMN application_documents.status         IS '文件審核狀態：0=待上傳/未符合 1=符合 2=逾期';
COMMENT ON COLUMN application_documents.reject_reason  IS '退件／未符合原因';
COMMENT ON COLUMN application_documents.uploaded_at    IS '上傳時間';
COMMENT ON COLUMN application_documents.pages          IS 'PDF 總頁數（上傳時解析）';

-- home_visit
COMMENT ON COLUMN home_visit.id                            IS '主鍵，自動遞增';
COMMENT ON COLUMN home_visit.application_id                IS '案件 ID，FK 至 applications.id（每案最多一筆）';
COMMENT ON COLUMN home_visit.visitor_id                    IS '訪視人員使用者 ID，FK 至 users.id';
COMMENT ON COLUMN home_visit.visit_date                    IS '家訪日期';
COMMENT ON COLUMN home_visit.self_reported_condition       IS '自述病情（自由文字，最多 255 字）';
COMMENT ON COLUMN home_visit.disease_reaction_status       IS '目前狀態-對疾病的反應：1=否認 2=憤怒 3=討價還價 4=沮喪 5=接受 6=其他';
COMMENT ON COLUMN home_visit.disease_reaction_other        IS '目前狀態-對疾病的反應-其他說明（當 disease_reaction_status=6 時使用）';
COMMENT ON COLUMN home_visit.treatment_attitude_status     IS '目前狀態-對疾病治療的態度：1=過度期待 2=適當配合 3=被動接受 4=其他';
COMMENT ON COLUMN home_visit.treatment_attitude_other      IS '目前狀態-對疾病治療的態度-其他說明（當 treatment_attitude_status=4 時使用）';
COMMENT ON COLUMN home_visit.other_status_notes            IS '目前狀態-其他身、心、想法等（自由文字）';
COMMENT ON COLUMN home_visit.primary_caregiver             IS '個案家庭資料-主要照顧者：1=配偶 2=伴侶 3=子女 4=親戚 5=朋友 6=其他';
COMMENT ON COLUMN home_visit.primary_caregiver_other       IS '個案家庭資料-主要照顧者-其他說明（當 primary_caregiver=6 時使用）';
COMMENT ON COLUMN home_visit.family_interaction_status     IS '個案家庭資料-家庭互動：1=和諧 2=普通 3=衝突 4=冷漠疏離 5=其他';
COMMENT ON COLUMN home_visit.family_interaction_other      IS '個案家庭資料-家庭互動-其他說明（當 family_interaction_status=5 時使用）';
COMMENT ON COLUMN home_visit.impacted_party_thoughts       IS '受個案及其病情等影響-對個案與其病情的想法（自由文字）';
COMMENT ON COLUMN home_visit.treatment_support_status      IS '受個案及其病情等影響-對個案疾病治療的支持：1=非常支持 2=普通支持 3=被動配合 4=其他';
COMMENT ON COLUMN home_visit.treatment_support_other       IS '受個案及其病情等影響-對個案疾病治療的支持-其他說明（當 treatment_support_status=4 時使用）';
COMMENT ON COLUMN home_visit.subsidy_need_reason           IS '萬美基金會補助評估-個案需求評估（有/沒有補助需求的原因；自由文字）';
COMMENT ON COLUMN home_visit.visitor_recommendations       IS '訪視者建議事項：1=有補助需求 2=轉介資源 3=其他';
COMMENT ON COLUMN home_visit.visitor_recommendations_other IS '訪視者建議事項-其他說明（當 visitor_recommendations=3 時使用）';
COMMENT ON COLUMN home_visit.updated_at                    IS '最後更新時間';

-- audit_logs
COMMENT ON COLUMN audit_logs.id          IS '主鍵，自動遞增';
COMMENT ON COLUMN audit_logs.user_id     IS '操作者使用者 ID，FK 至 users.id（系統觸發時為 NULL）';
COMMENT ON COLUMN audit_logs.action      IS '動作代碼（例：application.create / notification.send / pending_doc.threshold_close）';
COMMENT ON COLUMN audit_logs.target_type IS '操作目標類型（application / notification / user / setting 等）';
COMMENT ON COLUMN audit_logs.target_id   IS '操作目標 ID（字串形式，支援各種主鍵類型）';
COMMENT ON COLUMN audit_logs.detail      IS '額外操作細節（JSONB）';
COMMENT ON COLUMN audit_logs.created_at  IS '操作時間';

-- system_settings
COMMENT ON COLUMN system_settings.key         IS '參數鍵（主鍵，例 pending_doc_alert_days）';
COMMENT ON COLUMN system_settings.value       IS '參數值（以 TEXT 儲存，讀取時由程式解析為對應型別）';
COMMENT ON COLUMN system_settings.description IS '參數說明，顯示於後台設定面板';
COMMENT ON COLUMN system_settings.updated_at  IS '最後更新時間';

-- notification_channels
COMMENT ON COLUMN notification_channels.id         IS '主鍵，自動遞增';
COMMENT ON COLUMN notification_channels.channel    IS '渠道代碼：email / line / sms（唯一）';
COMMENT ON COLUMN notification_channels.is_enabled IS '是否啟用此渠道';
COMMENT ON COLUMN notification_channels.config     IS '渠道設定（JSONB）；email 含 host/port/user/password_enc/password_iv 等';

-- notification_templates
COMMENT ON COLUMN notification_templates.id          IS '主鍵，自動遞增';
COMMENT ON COLUMN notification_templates.name        IS '範本名稱';
COMMENT ON COLUMN notification_templates.channel     IS '適用渠道（email / line / sms）';
COMMENT ON COLUMN notification_templates.subject     IS '信件主旨（可含 {{placeholder}}）';
COMMENT ON COLUMN notification_templates.body        IS '信件內文（可含 {{placeholder}}，支援 {{案號}}/{{申請人}}/{{階段}}/{{申請日期}}/{{申請金額}}/{{承辦人}}）';
COMMENT ON COLUMN notification_templates.description IS '範本說明備註';
COMMENT ON COLUMN notification_templates.status      IS '狀態：0=停用 1=啟用';
COMMENT ON COLUMN notification_templates.sort_order  IS '排序值';
COMMENT ON COLUMN notification_templates.created_at  IS '建立時間';
COMMENT ON COLUMN notification_templates.created_by  IS '建立者使用者 ID，FK 至 users.id';

-- notification_logs
COMMENT ON COLUMN notification_logs.id                      IS '主鍵，自動遞增';
COMMENT ON COLUMN notification_logs.application_id          IS '相關案件 ID，FK 至 applications.id（可為 NULL）';
COMMENT ON COLUMN notification_logs.channel                 IS '渠道（email / line / sms）';
COMMENT ON COLUMN notification_logs.sender_id               IS '寄送者使用者 ID，FK 至 users.id（系統排程寄送時為 NULL）';
COMMENT ON COLUMN notification_logs.recipients              IS '收件人清單（JSONB 陣列，每筆含 name/email/user_id）';
COMMENT ON COLUMN notification_logs.subject                 IS '信件主旨（已代入 placeholder）';
COMMENT ON COLUMN notification_logs.body                    IS '信件內文（已代入 placeholder）';
COMMENT ON COLUMN notification_logs.template_id             IS '使用的範本 ID，FK 至 notification_templates.id（手動寫的為 NULL）';
COMMENT ON COLUMN notification_logs.status                  IS '寄送結果：sent / failed';
COMMENT ON COLUMN notification_logs.error_message           IS '失敗原因（僅 status=failed 時有值）';
COMMENT ON COLUMN notification_logs.sent_at                 IS '寄送時間';
COMMENT ON COLUMN notification_logs.is_pending_doc_reminder IS '是否為未補件提醒：TRUE 會計入該案件的達門檻提醒次數';

-- notification_schedules
COMMENT ON COLUMN notification_schedules.id             IS '主鍵，自動遞增';
COMMENT ON COLUMN notification_schedules.name           IS '排程名稱（方便管理員識別）';
COMMENT ON COLUMN notification_schedules.channel        IS '使用渠道（email / line / sms）';
COMMENT ON COLUMN notification_schedules.template_id    IS '使用的範本 ID，FK 至 notification_templates.id';
COMMENT ON COLUMN notification_schedules.recipient_type IS '收件人類型（例：applicant / officer / supervisor）';
COMMENT ON COLUMN notification_schedules.conditions     IS '觸發條件（JSONB），例如哪些 status 的案件才寄';
COMMENT ON COLUMN notification_schedules.frequency      IS '頻率：weekly / daily / monthly 等';
COMMENT ON COLUMN notification_schedules.day_of_week    IS '週幾寄送（frequency=weekly 時使用）：0=週日 ... 6=週六';
COMMENT ON COLUMN notification_schedules.is_active      IS '是否啟用此排程';
COMMENT ON COLUMN notification_schedules.last_sent_at   IS '最近一次執行時間（避免重複寄送）';
COMMENT ON COLUMN notification_schedules.created_at     IS '建立時間';
COMMENT ON COLUMN notification_schedules.updated_at     IS '最後更新時間';

-- template_categories
COMMENT ON COLUMN template_categories.id         IS '主鍵，自動遞增';
COMMENT ON COLUMN template_categories.name       IS '分類名稱（唯一）';
COMMENT ON COLUMN template_categories.sort_order IS '顯示排序';
COMMENT ON COLUMN template_categories.status     IS '狀態：0=停用 1=啟用';
COMMENT ON COLUMN template_categories.created_at IS '建立時間';

-- template_files
COMMENT ON COLUMN template_files.id            IS '主鍵，自動遞增';
COMMENT ON COLUMN template_files.display_name  IS '顯示名稱（前端下載頁呈現的標題）';
COMMENT ON COLUMN template_files.description   IS '檔案說明';
COMMENT ON COLUMN template_files.category_id   IS '所屬分類，FK 至 template_categories.id';
COMMENT ON COLUMN template_files.file_name     IS '實際儲存的檔名（含隨機前綴避免衝突）';
COMMENT ON COLUMN template_files.original_name IS '使用者上傳時的原始檔名';
COMMENT ON COLUMN template_files.file_path     IS '檔案儲存路徑（Blob URL 或本地路徑）';
COMMENT ON COLUMN template_files.file_size     IS '檔案大小（bytes）';
COMMENT ON COLUMN template_files.mime_type     IS 'MIME 類型（例：application/pdf）';
COMMENT ON COLUMN template_files.sort_order    IS '同分類下的顯示排序';
COMMENT ON COLUMN template_files.status        IS '狀態：0=停用 1=啟用';
COMMENT ON COLUMN template_files.uploaded_by   IS '上傳者使用者 ID，FK 至 users.id';
COMMENT ON COLUMN template_files.created_at    IS '建立時間';
COMMENT ON COLUMN template_files.updated_at    IS '最後更新時間';

-- banners
COMMENT ON COLUMN banners.id         IS '主鍵，自動遞增';
COMMENT ON COLUMN banners.title      IS '橫幅標題（覆蓋於圖片上）';
COMMENT ON COLUMN banners.subtitle   IS '橫幅副標題';
COMMENT ON COLUMN banners.image_url  IS '橫幅圖片 URL';
COMMENT ON COLUMN banners.link_url   IS '點擊後導向的 URL（可為空，表示不做導向）';
COMMENT ON COLUMN banners.sort_order IS '輪播排序';
COMMENT ON COLUMN banners.is_active  IS '是否啟用此橫幅';
COMMENT ON COLUMN banners.updated_at IS '最後更新時間';

-- announcement_categories
COMMENT ON COLUMN announcement_categories.id         IS '主鍵，自動遞增';
COMMENT ON COLUMN announcement_categories.name       IS '分類名稱';
COMMENT ON COLUMN announcement_categories.color      IS '分類顯示顏色（HEX 代碼，例 #6366f1）';
COMMENT ON COLUMN announcement_categories.sort_order IS '顯示排序';
COMMENT ON COLUMN announcement_categories.is_active  IS '是否啟用此分類';

-- announcements
COMMENT ON COLUMN announcements.id           IS '主鍵，自動遞增';
COMMENT ON COLUMN announcements.category_id  IS '所屬分類，FK 至 announcement_categories.id';
COMMENT ON COLUMN announcements.title        IS '公告標題';
COMMENT ON COLUMN announcements.content      IS '公告內容（支援 Markdown）';
COMMENT ON COLUMN announcements.publish_date IS '發佈日期（決定 NEW 標籤是否顯示的基準日）';
COMMENT ON COLUMN announcements.start_date   IS '開始顯示日期（首頁只顯示在此日期之後的公告）';
COMMENT ON COLUMN announcements.end_date     IS '結束顯示日期（NULL 代表永久顯示）';
COMMENT ON COLUMN announcements.is_active    IS '是否啟用此公告';
COMMENT ON COLUMN announcements.created_at   IS '建立時間';
COMMENT ON COLUMN announcements.updated_at   IS '最後更新時間';
COMMENT ON COLUMN announcements.created_by   IS '建立者使用者 ID，FK 至 users.id';

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- ⚠️  使用者帳號（含管理員 / 預設測試帳號）請執行對應的 Node 腳本建立
--     原因：密碼與姓名使用 Node.js crypto 加密（AES-256-CBC + HMAC），
--           無法在純 SQL 中產生對得上 ENCRYPTION_KEY 的密文。
--
--     管理員帳號：node scripts/seed_admin.mjs
--     12 個預設測試帳號（主管/承辦/社工/董事/會計）：node scripts/seed_users.mjs
--
--     詳見 scripts/README.txt
-- ─────────────────────────────────────────────────────────────
