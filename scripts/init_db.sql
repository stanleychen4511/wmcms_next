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
    is_active           BOOLEAN  NOT NULL DEFAULT TRUE,
    subsidy_subtype     CHAR(1),
    paper_requirement   VARCHAR(20) NOT NULL DEFAULT 'original',
    tooltip_text        TEXT,
    CONSTRAINT document_type_config_subsidy_subtype_chk
        CHECK (subsidy_subtype IS NULL OR subsidy_subtype IN ('1', '2')),
    CONSTRAINT document_type_config_paper_requirement_chk
        CHECK (paper_requirement IN ('original', 'copy', 'original_or_copy', 'none'))
);
-- 補欄位（舊表可能缺少 allow_supplement）
ALTER TABLE document_type_config
    ADD COLUMN IF NOT EXISTS allow_supplement BOOLEAN NOT NULL DEFAULT FALSE;

-- 補欄位：scope（refine-disbursement-flow，2026-04）
--   'C' = case-level（一案一份；application_documents.disbursement_id IS NULL）
--   'D' = disbursement-level（每筆撥款一份；application_documents.disbursement_id 指向 payment_disbursements）
ALTER TABLE document_type_config
    ADD COLUMN IF NOT EXISTS scope CHAR(1) NOT NULL DEFAULT 'C'
        CHECK (scope IN ('C','D'));

ALTER TABLE document_type_config
    ADD COLUMN IF NOT EXISTS subsidy_subtype CHAR(1);

ALTER TABLE document_type_config
    ADD COLUMN IF NOT EXISTS paper_requirement VARCHAR(20) NOT NULL DEFAULT 'original';

ALTER TABLE document_type_config
    ADD COLUMN IF NOT EXISTS tooltip_text TEXT;

DO $$
BEGIN
    IF to_regclass('public.document_type_config') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'document_type_config_subsidy_subtype_chk'
             AND conrelid = 'public.document_type_config'::regclass
       ) THEN
        ALTER TABLE document_type_config
            ADD CONSTRAINT document_type_config_subsidy_subtype_chk
            CHECK (subsidy_subtype IS NULL OR subsidy_subtype IN ('1', '2'));
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.document_type_config') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'document_type_config_paper_requirement_chk'
             AND conrelid = 'public.document_type_config'::regclass
       ) THEN
        ALTER TABLE document_type_config
            ADD CONSTRAINT document_type_config_paper_requirement_chk
            CHECK (paper_requirement IN ('original', 'copy', 'original_or_copy', 'none'));
    END IF;
END $$;

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
    marital_status           CHAR(1),    -- 115 辦法：'1'=已婚 '2'=單親 '3'=單身（CHECK 約束於 6b6 加上）
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
    is_current      BOOLEAN NOT NULL DEFAULT TRUE,
    archive_note    TEXT,
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
-- 自 2026-04 起每位董事擁有獨立的審核結果（member_approved / member_amount / member_comments）
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
ALTER TABLE board_review_signatures
    ADD COLUMN IF NOT EXISTS member_approved BOOLEAN,
    ADD COLUMN IF NOT EXISTS member_amount   NUMERIC(12,0),
    ADD COLUMN IF NOT EXISTS member_comments TEXT;

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

-- 6b3. applications: 轉介單位自由填寫 + 承辦人聯絡（#6, added 2026-04）
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS referral_unit_name TEXT,
    ADD COLUMN IF NOT EXISTS referral_contact_name TEXT,
    ADD COLUMN IF NOT EXISTS referral_contact_title TEXT,
    ADD COLUMN IF NOT EXISTS referral_contact_phone TEXT,
    ADD COLUMN IF NOT EXISTS referral_contact_email TEXT;

-- 6b4. applications: 補助子類型（#2, added 2026-04，依 115 年辦法）
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS subsidy_subtype CHAR(1)
    CHECK (subsidy_subtype IS NULL OR subsidy_subtype IN ('1', '2'));
COMMENT ON COLUMN applications.subsidy_subtype IS
    '補助子類型（115 年辦法）：1=經濟弱勢、2=小康家庭；NULL 為舊資料未分類';

-- 6b6. applications.marital_status：對齊 115 辦法編碼（added 2026-04）
--   '1'=已婚、'2'=單親、'3'=單身（與 mid_class_eligibility_matrix 一致）
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_marital_status_chk;
ALTER TABLE applications
    ADD CONSTRAINT applications_marital_status_chk
    CHECK (marital_status IS NULL OR marital_status IN ('1', '2', '3'));

-- 6b7. applications: 經濟弱勢專屬欄位（added 2026-04）
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS econ_deposit         NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS econ_monthly_income  NUMERIC(12, 2);
COMMENT ON COLUMN applications.econ_deposit
    IS '【經濟弱勢專屬】存款（配偶取平均，萬元）— 115 年辦法第四條第三項第 1 款';
COMMENT ON COLUMN applications.econ_monthly_income
    IS '【經濟弱勢專屬】每月收入（配偶取平均，萬元）— 115 年辦法第四條第三項第 1 款';

-- 6b5. 補助金額上限表 + 小康家庭資格矩陣（#2 + #3, added 2026-04）
CREATE TABLE IF NOT EXISTS subsidy_amount_limits (
    subsidy_subtype CHAR(1) PRIMARY KEY
        CHECK (subsidy_subtype IN ('1', '2')),
    amount_max     NUMERIC(12, 0) NOT NULL CHECK (amount_max >= 0),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by     BIGINT REFERENCES users(id) ON DELETE SET NULL
);
COMMENT ON TABLE  subsidy_amount_limits IS '補助金額上限（依子類型，單位：元）— 115 年辦法第三條';
COMMENT ON COLUMN subsidy_amount_limits.subsidy_subtype IS '子類型：1=經濟弱勢、2=小康家庭';
COMMENT ON COLUMN subsidy_amount_limits.amount_max IS '每一申請人不限年度累計補助上限（元）';

INSERT INTO subsidy_amount_limits (subsidy_subtype, amount_max)
VALUES ('1', 30000), ('2', 350000)
ON CONFLICT (subsidy_subtype) DO NOTHING;

CREATE TABLE IF NOT EXISTS mid_class_eligibility_matrix (
    marital_status   CHAR(1) NOT NULL CHECK (marital_status  IN ('1', '2', '3')),  -- 1=已婚 2=單親 3=單身
    children_status  CHAR(1) NOT NULL CHECK (children_status IN ('1', '2', '3')),  -- 1=未成年子女 2=已成年子女 3=無子女
    income_min       NUMERIC(12, 0) NOT NULL CHECK (income_min >= 0),
    income_max       NUMERIC(12, 0) NOT NULL CHECK (income_max >= 0),
    assets_max       NUMERIC(12, 0) NOT NULL CHECK (assets_max >= 0),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by       BIGINT REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (marital_status, children_status)
);
COMMENT ON TABLE  mid_class_eligibility_matrix IS '小康家庭資格矩陣（115 年辦法第四條第三項第 2 款）— 單位：萬元';
COMMENT ON COLUMN mid_class_eligibility_matrix.marital_status IS '婚姻狀態：1=已婚（收入配偶合計）、2=單親（個人收入）、3=單身（個人收入）';
COMMENT ON COLUMN mid_class_eligibility_matrix.children_status IS '子女狀態：1=未成年子女、2=已成年子女、3=無子女';
COMMENT ON COLUMN mid_class_eligibility_matrix.income_min IS '年收入下限（萬）';
COMMENT ON COLUMN mid_class_eligibility_matrix.income_max IS '年收入上限（萬）';
COMMENT ON COLUMN mid_class_eligibility_matrix.assets_max IS '存款＋有價證券上限（萬）';

INSERT INTO mid_class_eligibility_matrix (marital_status, children_status, income_min, income_max, assets_max)
VALUES
    ('1', '1',  70, 164, 120),
    ('1', '2',  70, 164,  60),
    ('1', '3',  70, 164,  60),
    ('2', '1',  32, 105,  65),
    ('2', '2',  32, 105,  32),
    ('3', '1',  32, 105,  65),
    ('3', '2',  32, 105,  32),
    ('3', '3',  32, 105,  32)
ON CONFLICT (marital_status, children_status) DO NOTHING;

-- 移除舊版資格設定（pre-115 辦法）— 冪等
DELETE FROM system_settings
WHERE key IN (
    'eligibility_age_min', 'eligibility_age_max', 'eligibility_real_estate_max',
    'eligibility_s31_income_min', 'eligibility_s31_income_max', 'eligibility_s31_assets_max',
    'eligibility_s32_income_min', 'eligibility_s32_income_max', 'eligibility_s32_assets_max',
    'eligibility_s33_income_min', 'eligibility_s33_income_max', 'eligibility_s33_assets_max',
    'eligibility_s34_income_min', 'eligibility_s34_income_max'
);
INSERT INTO system_settings (key, value, description) VALUES
    ('elig_age_min',                  '25',   '【115 辦法】申請人年齡下限（歲）'),
    ('elig_age_max',                  '65',   '【115 辦法】申請人年齡上限（歲）'),
    ('elig_real_estate_max',          '2500', '【115 辦法】不動產上限：戶籍內直系合計（萬元）'),
    ('elig_econ_deposit_max',         '16',   '【115 辦法-經濟弱勢】存款上限（配偶取平均，萬元）'),
    ('elig_econ_monthly_income_max',  '3',    '【115 辦法-經濟弱勢】每月收入上限（配偶取平均，萬元）')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

-- 6b2. applications: 家訪指派（added 2026-04，#11）
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS home_visit_assignee_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_applications_home_visit_assignee
    ON applications (home_visit_assignee_id);
COMMENT ON COLUMN applications.home_visit_assignee_id IS '家訪指派人 user_id（volunteer / case_officer）；NULL 為尚未指派';

-- 6b8. applications: 個管師案件說明（#17, added 2026-04）
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS officer_case_summary TEXT;
COMMENT ON COLUMN applications.officer_case_summary IS
    '【#17】個管師填寫的案件說明（董事審核參考用，建議 5 點條列）；填寫於家訪/行政初審階段，董事審核頁唯讀顯示，列印於審核意見表';

-- 6c. applications: 董事審核意見永久保存欄位（added 2026-04）
--   application_workflow.comments 是 stage-scoped、推進 stage 會被覆寫；
--   board_review_comments 是 case-scoped 永久保存，由 saveBoardReviewDraft 同步寫入，
--   推進 stage 不會覆寫；retreat 退回 board_review 之前的 stage 才會清空。
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS board_review_comments TEXT;

-- 6b9. applications: 申請人聯絡電話（2026-05）
--   每件申請都需填寫；存於 application 而非 user，因聯絡電話可能因案而異。
--   舊資料無此欄位故先 nullable；application 端 UI 強制必填。
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS applicant_phone TEXT;
COMMENT ON COLUMN applications.applicant_phone IS '申請人聯絡電話（內外部收件皆必填）';

-- 6b10. applications: 出生年月日 + 癌別 + 期數（2026-05）
--   三欄皆為申請必填欄位；可在行政初審階段重新編輯。
--   舊資料 nullable；新案 UI 強制必填、edit 不可清空。
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS applicant_dob   DATE,
    ADD COLUMN IF NOT EXISTS cancer_type     TEXT,
    ADD COLUMN IF NOT EXISTS cancer_stage    TEXT;
COMMENT ON COLUMN applications.applicant_dob IS '申請人出生年月日（西元）';
COMMENT ON COLUMN applications.cancer_type   IS '癌別自由文字（例：肺腺癌）';
COMMENT ON COLUMN applications.cancer_stage  IS '癌症期數自由文字（例：第三期、IIIA）';

-- 6b11. applications: 申請形式 + 治療前後（2026-05，給報表用）
--   application_form：'P' 紙本 / 'E' 電子郵件；外部收件後端強制 'E'
--   treatment_phase：'B' 治療前 / 'A' 治療後 / 'X' 治療前後
--   兩欄皆必填；可在行政初審階段重新編輯。
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS application_form CHAR(1),
    ADD COLUMN IF NOT EXISTS treatment_phase  CHAR(1);
COMMENT ON COLUMN applications.application_form IS '申請形式：P=紙本 E=電子郵件（外部收件強制 E）';
COMMENT ON COLUMN applications.treatment_phase  IS '治療階段：B=治療前 A=治療後 X=治療前後';
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applications_application_form_chk') THEN
        ALTER TABLE applications
            ADD CONSTRAINT applications_application_form_chk
            CHECK (application_form IS NULL OR application_form IN ('P', 'E'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applications_treatment_phase_chk') THEN
        ALTER TABLE applications
            ADD CONSTRAINT applications_treatment_phase_chk
            CHECK (treatment_phase IS NULL OR treatment_phase IN ('B', 'A', 'X'));
    END IF;
END$$;

-- 6b12. applications: 戶籍地址 + 主管雙閘門（2026-05 user feedback round）
--   applicant_address：領款收據需印戶籍地址
--   supervisor_approved_for_*：主管雙審核 checkpoint
--     - NULL  = 個管尚未送主管
--     - true  = 主管已通過、允許進下一階段
--     - false = 主管退件、個管要修正後重送
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS applicant_address                 TEXT,
    ADD COLUMN IF NOT EXISTS supervisor_approved_for_board     BOOLEAN,
    ADD COLUMN IF NOT EXISTS supervisor_approved_for_accounting BOOLEAN,
    ADD COLUMN IF NOT EXISTS supervisor_review_note            TEXT;
COMMENT ON COLUMN applications.applicant_address                  IS '申請人戶籍地址（領款收據用）';
COMMENT ON COLUMN applications.supervisor_approved_for_board      IS '主管送董事閘門: NULL=未審, true=送董事, false=退個管';
COMMENT ON COLUMN applications.supervisor_approved_for_accounting IS '主管送會計閘門: NULL=未審, true=送會計, false=退個管';
COMMENT ON COLUMN applications.supervisor_review_note             IS '主管退件原因或通過備註';

-- 8a. payment_disbursements: 捐贈者公開姓名意願（2026-05 user feedback round）
ALTER TABLE payment_disbursements
    ADD COLUMN IF NOT EXISTS donor_disclosure_consent BOOLEAN;
COMMENT ON COLUMN payment_disbursements.donor_disclosure_consent IS '是否同意公開捐贈者姓名（每筆撥款獨立記錄；NULL=未填；false 時需配套上傳聲明書）';

-- 14. application_close_reasons: 結構化結案原因（2026-05）
--   一個案件可勾多個原因；每個 reason_code 可帶 detail_value（金額/年齡/補助項目/取消原因）。
CREATE TABLE IF NOT EXISTS application_close_reasons (
    application_id BIGINT      NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    reason_code    CHAR(2)     NOT NULL,
        -- '01' 低收/中低收入戶
        -- '02' 年收入過低（detail = 金額）
        -- '03' 年收入過高（detail = 金額）
        -- '04' 存款過高（detail = 金額）
        -- '05' 房產價值過高（detail = 金額）
        -- '06' 年齡過低（detail = 年齡）
        -- '07' 年齡過高（detail = 年齡）
        -- '08' 補助項目不符（detail = 欲申請項目自由文字）
        -- '09' 非癌症
        -- '10' 非本國籍
        -- '99' 申請人取消申請（detail = 取消原因自由文字）
    detail_value   TEXT,
    closed_at_stage TEXT,        -- 結案當下的 workflow.stage（admin_review/visit/board_review/reimbursement）
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (application_id, reason_code)
);
CREATE INDEX IF NOT EXISTS idx_close_reasons_app  ON application_close_reasons (application_id);
CREATE INDEX IF NOT EXISTS idx_close_reasons_code ON application_close_reasons (reason_code);
COMMENT ON TABLE  application_close_reasons IS '【#R】結構化結案原因（多選 + detail）';
COMMENT ON COLUMN application_close_reasons.reason_code IS '01-10 不通過原因 / 99 申請人取消';
COMMENT ON COLUMN application_close_reasons.detail_value IS '金額／年齡／自由說明';
COMMENT ON COLUMN application_close_reasons.closed_at_stage IS '結案發生的 workflow stage';

-- 14b. rejected_application_archives: 紙本初判未通過、不建立正式案件的歸檔資料
CREATE TABLE IF NOT EXISTS rejected_application_archives (
    id                 BIGSERIAL PRIMARY KEY,
    applicant_name_enc BYTEA NOT NULL,
    applicant_name_iv  BYTEA NOT NULL,
    apply_at           TIMESTAMPTZ NOT NULL,
    application_form   CHAR(1),
    reason_rows        JSONB NOT NULL DEFAULT '[]'::jsonb,
    officer_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT rejected_application_archives_application_form_chk
        CHECK (application_form IS NULL OR application_form IN ('P', 'E'))
);
CREATE INDEX IF NOT EXISTS idx_rejected_archives_apply_at
    ON rejected_application_archives (apply_at);
CREATE INDEX IF NOT EXISTS idx_rejected_archives_officer
    ON rejected_application_archives (officer_id);
CREATE INDEX IF NOT EXISTS idx_rejected_archives_reasons
    ON rejected_application_archives USING GIN (reason_rows);
COMMENT ON TABLE rejected_application_archives IS '紙本申請初判未通過且不建立正式案件時的報表歸檔資料';
COMMENT ON COLUMN rejected_application_archives.applicant_name_enc IS '申請人姓名 AES 加密內容';
COMMENT ON COLUMN rejected_application_archives.applicant_name_iv IS '申請人姓名 AES IV';
COMMENT ON COLUMN rejected_application_archives.apply_at IS '歸檔所屬申請日期';
COMMENT ON COLUMN rejected_application_archives.application_form IS '申請形式：P=紙本、E=電子郵件';
COMMENT ON COLUMN rejected_application_archives.reason_rows IS '不通過原因陣列：[{code, detail}]';
COMMENT ON COLUMN rejected_application_archives.officer_id IS '建立此筆歸檔的人員';
COMMENT ON COLUMN rejected_application_archives.notes IS '備註';

-- 14c. board_reconsideration_requests（#50：核銷階段退回董事再次審核）
CREATE TABLE IF NOT EXISTS board_reconsideration_requests (
    id                         BIGSERIAL PRIMARY KEY,
    application_id             BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    status                     TEXT NOT NULL DEFAULT 'pending_supervisor',
    reason                     TEXT NOT NULL,
    attachment_url             TEXT,
    attachment_urls            JSONB NOT NULL DEFAULT '[]'::jsonb,
    requested_by               BIGINT REFERENCES users(id) ON DELETE SET NULL,
    requested_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    supervisor_id              BIGINT REFERENCES users(id) ON DELETE SET NULL,
    supervisor_note            TEXT,
    supervisor_reviewed_at     TIMESTAMPTZ,
    final_board_review_comments TEXT,
    final_approved_amount      NUMERIC(12,2),
    CONSTRAINT board_reconsideration_requests_status_chk
        CHECK (status IN ('pending_supervisor', 'approved', 'rejected'))
);
CREATE INDEX IF NOT EXISTS idx_board_reconsideration_requests_app
    ON board_reconsideration_requests (application_id, requested_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_board_reconsideration_requests_pending
    ON board_reconsideration_requests (application_id)
    WHERE status = 'pending_supervisor';
COMMENT ON TABLE board_reconsideration_requests IS '核銷階段因治療變更等原因退回董事再次審核的申請與主管審核紀錄';
COMMENT ON COLUMN board_reconsideration_requests.reason IS '承辦人填寫的退回董事再審原因';
COMMENT ON COLUMN board_reconsideration_requests.attachment_url IS '退回訊息附件 URL（PDF/JPG/PNG）';
COMMENT ON COLUMN board_reconsideration_requests.attachment_urls IS '退回訊息多附件 URL 陣列（PDF/JPG/PNG），保留 attachment_url 作為舊資料相容欄位';
COMMENT ON COLUMN board_reconsideration_requests.final_board_review_comments IS '本次再次董事審核完成後彙整的意見，不覆蓋第一次審核內容';

ALTER TABLE board_reconsideration_requests
    ADD COLUMN IF NOT EXISTS attachment_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE board_reconsideration_requests
SET attachment_urls = jsonb_build_array(attachment_url)
WHERE attachment_url IS NOT NULL
  AND btrim(attachment_url) <> ''
  AND attachment_urls = '[]'::jsonb;

-- 14d. board_review_rounds：董事審核多輪歷史（最新輪才是實際審核依據）
CREATE TABLE IF NOT EXISTS board_review_rounds (
    id                         BIGSERIAL PRIMARY KEY,
    application_id             BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    round_no                   INT NOT NULL,
    source_reconsideration_id  BIGINT REFERENCES board_reconsideration_requests(id) ON DELETE SET NULL,
    approved_amount            NUMERIC(12,2),
    comments                   TEXT,
    signatures                 JSONB NOT NULL DEFAULT '[]'::jsonb,
    completed_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_latest                  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (application_id, round_no)
);
CREATE INDEX IF NOT EXISTS idx_board_review_rounds_app
    ON board_review_rounds (application_id, round_no DESC);
CREATE INDEX IF NOT EXISTS idx_board_review_rounds_latest
    ON board_review_rounds (application_id)
    WHERE is_latest = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_board_review_rounds_reconsideration
    ON board_review_rounds (source_reconsideration_id)
    WHERE source_reconsideration_id IS NOT NULL;
COMMENT ON TABLE board_review_rounds IS '董事審核多輪歷史；核銷退回再審時保留前一輪，最新輪為實際審核依據';
COMMENT ON COLUMN board_review_rounds.round_no IS '同一案件第幾次董事審核，正常流程為 1，核銷退回再審後為 2+';
COMMENT ON COLUMN board_review_rounds.source_reconsideration_id IS '若本輪源自核銷階段退回董事再審，連結 board_reconsideration_requests.id';
COMMENT ON COLUMN board_review_rounds.signatures IS '本輪完成時的董事簽章與個別審核意見快照';
COMMENT ON COLUMN board_review_rounds.is_latest IS '是否為目前實際採用的最新董事審核結果';

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

-- 9aa. home_visit: 不家訪選項 + 訪視員職稱/姓名（user feedback #8 #18, 2026-05）
ALTER TABLE home_visit
    ADD COLUMN IF NOT EXISTS visit_skipped BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS skip_reason   TEXT;
COMMENT ON COLUMN home_visit.visit_skipped IS '是否跳過家訪（經濟弱勢可選不家訪）';
COMMENT ON COLUMN home_visit.skip_reason   IS '不家訪原因（visit_skipped=true 時必填）';

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

-- 7f. payment_disbursements（多次撥款紀錄；added 2026-04）
CREATE TABLE IF NOT EXISTS payment_disbursements (
    id                 BIGSERIAL    PRIMARY KEY,
    application_id     BIGINT       NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    receipt_number     TEXT         NOT NULL UNIQUE,
    amount             NUMERIC(12,0) NOT NULL CHECK (amount > 0),
    payee_name         TEXT,
    payee_id_number    TEXT,
    payee_relation     TEXT,
    payment_method     TEXT,
    bank_name          TEXT,
    bank_branch        TEXT,
    bank_account       TEXT,
    sent_at            DATE,
    received_at        DATE,
    receipt_file_path  TEXT,
    remittance_slip_file_path TEXT,
    medical_receipt_status TEXT,
    notes              TEXT,
    created_by         BIGINT       REFERENCES users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_disbursements_application_id
    ON payment_disbursements (application_id);

-- 7f-1b. payment_disbursements 外部隱碼（refine-disbursement-flow，2026-04）
--   receipt_number = 內部可讀流水號（YYYY-MM-NNNN）
--   external_code  = 對外的不可預測短碼（6 字元 base32，UNIQUE）
--   申請人收到的收據／email 只露 external_code；內部界面同時顯示兩者方便對照。
ALTER TABLE payment_disbursements
    ADD COLUMN IF NOT EXISTS external_code TEXT;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_disbursements_external_code_key') THEN
        ALTER TABLE payment_disbursements
            ADD CONSTRAINT payment_disbursements_external_code_key UNIQUE (external_code);
    END IF;
END$$;
COMMENT ON COLUMN payment_disbursements.receipt_number IS '內部收據編號（YYYY-MM-NNNN，每月歸零的流水號），UNIQUE';
COMMENT ON COLUMN payment_disbursements.external_code  IS '外部隱碼（6 字元 base32 隨機），對外露出此碼；UNIQUE';

-- 7f-1c. payment_disbursements 匯款單掃描檔（完成撥款後補上傳）
ALTER TABLE payment_disbursements
    ADD COLUMN IF NOT EXISTS remittance_slip_file_path TEXT;
COMMENT ON COLUMN payment_disbursements.remittance_slip_file_path IS '撥款完成後上傳的匯款單掃描檔 URL';

-- 7f-1d. payment_disbursements 醫療收據狀態（#51）
ALTER TABLE payment_disbursements
    ADD COLUMN IF NOT EXISTS medical_receipt_status TEXT;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'payment_disbursements_medical_receipt_status_chk'
          AND conrelid = 'public.payment_disbursements'::regclass
    ) THEN
        ALTER TABLE payment_disbursements
            ADD CONSTRAINT payment_disbursements_medical_receipt_status_chk
            CHECK (medical_receipt_status IS NULL OR medical_receipt_status IN ('official', 'unpaid'));
    END IF;
END $$;
COMMENT ON COLUMN payment_disbursements.medical_receipt_status IS '醫療收據狀態：official=正式收據；unpaid=未繳款領據';

-- 7f-1e. payment_disbursements 正式收據補換與會計確認（2026-06）
ALTER TABLE payment_disbursements
    ADD COLUMN IF NOT EXISTS official_receipt_replaced_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS official_receipt_replaced_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS official_receipt_accountant_confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS official_receipt_accountant_confirmed_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
COMMENT ON COLUMN payment_disbursements.official_receipt_replaced_at IS '未繳款領據於撥款完成後補換正式收據的時間';
COMMENT ON COLUMN payment_disbursements.official_receipt_replaced_by IS '補換正式收據的使用者 ID';
COMMENT ON COLUMN payment_disbursements.official_receipt_accountant_confirmed_at IS '會計確認正式收據補換的時間';
COMMENT ON COLUMN payment_disbursements.official_receipt_accountant_confirmed_by IS '確認正式收據補換的會計使用者 ID';

-- 7f-2. payment_disbursements 多層審核欄位（#12，added 2026-04）
ALTER TABLE payment_disbursements
    ADD COLUMN IF NOT EXISTS review_stage CHAR(1) NOT NULL DEFAULT '9'
        CHECK (review_stage IN ('1','2','3','4','9','X')),
    ADD COLUMN IF NOT EXISTS officer_signed_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS supervisor_user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS supervisor_signed_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS accountant_user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS accountant_signed_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS executive_user_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS executive_signed_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejected_reason        TEXT,
    ADD COLUMN IF NOT EXISTS rejected_at            TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejected_by            BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS rejected_from_stage    CHAR(1);

-- 串行守門：每案最多一筆 in-flight（review_stage IN '1'..'4'）
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_disb_one_in_flight
    ON payment_disbursements (application_id)
    WHERE review_stage IN ('1','2','3','4');

COMMENT ON COLUMN payment_disbursements.review_stage IS
    '審核流程狀態：1=個管師持有中、2=主管審核中、3=會計審核中、4=執行長審核中、9=已完成、X=已退件廢棄';
COMMENT ON COLUMN payment_disbursements.officer_signed_at      IS '個管師【送出】時間';
COMMENT ON COLUMN payment_disbursements.supervisor_user_id     IS '主管審核人 user_id';
COMMENT ON COLUMN payment_disbursements.supervisor_signed_at   IS '主管【送出】時間';
COMMENT ON COLUMN payment_disbursements.accountant_user_id     IS '會計審核人 user_id';
COMMENT ON COLUMN payment_disbursements.accountant_signed_at   IS '會計【送出】時間';
COMMENT ON COLUMN payment_disbursements.executive_user_id      IS '執行長審核人 user_id';
COMMENT ON COLUMN payment_disbursements.executive_signed_at    IS '執行長【完成】時間（同時觸發通知）';
COMMENT ON COLUMN payment_disbursements.rejected_reason        IS '退件原因（必填）';
COMMENT ON COLUMN payment_disbursements.rejected_at            IS '退件時間';
COMMENT ON COLUMN payment_disbursements.rejected_by            IS '退件人 user_id';
COMMENT ON COLUMN payment_disbursements.rejected_from_stage    IS '從哪一層退件（2/3/4），便於追蹤與通知對象';

-- 7f-3. payment_disbursements 各階段 checklist 守門欄位（refine-disbursement-flow，2026-04）
ALTER TABLE payment_disbursements
    ADD COLUMN IF NOT EXISTS officer_doc_check                  BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS supervisor_doc_check               BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS accountant_medical_uploaded_check  BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS accountant_amount_match_check      BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS accountant_board_opinion_check     BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS accountant_bank_setup_check        BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS executive_final_check              BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN payment_disbursements.officer_doc_check                  IS '個管：線上/紙本文件齊全（送出至主管前必勾）';
COMMENT ON COLUMN payment_disbursements.supervisor_doc_check               IS '主管：領款收據確認無誤（送出至會計前必勾）';
COMMENT ON COLUMN payment_disbursements.accountant_medical_uploaded_check  IS '會計：醫療收據已上傳';
COMMENT ON COLUMN payment_disbursements.accountant_amount_match_check      IS '會計：醫療單據與領款收據金額核對無誤';
COMMENT ON COLUMN payment_disbursements.accountant_board_opinion_check     IS '會計：董事審核意見表 2 份';
COMMENT ON COLUMN payment_disbursements.accountant_bank_setup_check        IS '會計：已設定銀行補助款';
COMMENT ON COLUMN payment_disbursements.executive_final_check              IS '執行長：申請表、家訪、審核意見表確認';

-- 7f-4. payment_disbursements 具領人關係其他欄位（refine-disbursement-flow，2026-04）
--   當 payee_relation = '其他' 時，UI 開放選填具體關係描述（例：鄰居、社工等）
ALTER TABLE payment_disbursements
    ADD COLUMN IF NOT EXISTS payee_relation_other TEXT;
COMMENT ON COLUMN payment_disbursements.payee_relation_other IS '具領人關係：當 payee_relation = "其他" 時的補充描述';

-- 14b. notification_logs 加 disbursement_id（refine-disbursement-flow，2026-04）
--   讓「個管寄送領款收據」「撥款完成通知」等事件可追蹤是哪一筆撥款觸發
ALTER TABLE notification_logs
    ADD COLUMN IF NOT EXISTS disbursement_id BIGINT REFERENCES payment_disbursements(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_notification_logs_disbursement
    ON notification_logs (disbursement_id) WHERE disbursement_id IS NOT NULL;
COMMENT ON COLUMN notification_logs.disbursement_id IS '若通知與特定撥款關聯（例：個管寄領款收據／撥款完成通知）則記錄該 payment_disbursements.id';

-- 8b. application_documents 加 disbursement_id 並重構 PK（refine-disbursement-flow，2026-04）
--   配合 document_type_config.scope：
--     scope='C'（case-level）：每案每 type 至多一筆 → 由 partial unique index 守門
--     scope='D'（disbursement-level）：每筆撥款各一份 → (app_id, id, disbursement_id) 唯一
--   原 PK = (application_id, id) 改為 row_id 代理鍵，避免 disbursement-level 衝突
ALTER TABLE application_documents
    ADD COLUMN IF NOT EXISTS disbursement_id BIGINT REFERENCES payment_disbursements(id) ON DELETE CASCADE;

-- 加 row_id 代理鍵（已存在則略過）並用它替換複合 PK（冪等）
ALTER TABLE application_documents
    ADD COLUMN IF NOT EXISTS row_id BIGSERIAL;

ALTER TABLE application_documents
    ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS archive_note TEXT;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'application_documents_pkey'
          AND pg_get_constraintdef(oid) LIKE 'PRIMARY KEY (application_id, id)'
    ) THEN
        ALTER TABLE application_documents DROP CONSTRAINT application_documents_pkey;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'application_documents_pkey'
    ) THEN
        ALTER TABLE application_documents ADD CONSTRAINT application_documents_pkey PRIMARY KEY (row_id);
    END IF;
END$$;

-- 多檔上傳：同案件同文件類型可有多筆檔案，移除舊唯一限制並保留查詢索引
DROP INDEX IF EXISTS uq_app_docs_case_level;
DROP INDEX IF EXISTS uq_app_docs_disb_level;

CREATE INDEX IF NOT EXISTS idx_app_docs_case_level_lookup
    ON application_documents (application_id, id)
    WHERE disbursement_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_app_docs_disb_level_lookup
    ON application_documents (application_id, id, disbursement_id)
    WHERE disbursement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_docs_disbursement_id
    ON application_documents (disbursement_id) WHERE disbursement_id IS NOT NULL;

COMMENT ON COLUMN application_documents.disbursement_id IS '若文件 scope=D（如醫療收據、領款收據），指向對應 payment_disbursements；scope=C 則為 NULL';
COMMENT ON COLUMN application_documents.row_id          IS 'Surrogate primary key（取代原複合 PK），讓 disbursement-level 文件可同 (app_id, id) 多筆';
COMMENT ON COLUMN application_documents.is_current      IS '是否為目前採用版本；重新上傳時舊檔保留但標示為歷史版本';
COMMENT ON COLUMN application_documents.archive_note    IS '歷史版本註記（例如：已由正式收據取代）';

-- 9b. home_visit: 訪視者資訊 + 照片（added 2026-04）
ALTER TABLE home_visit ADD COLUMN IF NOT EXISTS visitor_title TEXT;
ALTER TABLE home_visit ADD COLUMN IF NOT EXISTS visitor_name TEXT;
ALTER TABLE home_visit ADD COLUMN IF NOT EXISTS visit_photo_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 2c. users: 通知接收偏好（Phase 3，added 2026-04）
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS notification_channels TEXT[] NOT NULL DEFAULT ARRAY['email'];
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_notification_channels_chk') THEN
        ALTER TABLE users ADD CONSTRAINT users_notification_channels_chk
            CHECK (array_length(notification_channels, 1) IS NOT NULL
                   AND array_length(notification_channels, 1) >= 1);
    END IF;
END$$;

-- 2a. users: LINE 帳號綁定欄位（Phase 2，added 2026-04）
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS line_user_id TEXT;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_line_user_id_key') THEN
        ALTER TABLE users ADD CONSTRAINT users_line_user_id_key UNIQUE (line_user_id);
    END IF;
END$$;

-- 2b. user_line_link_codes（綁定碼暫存，PK = user_id 一人一碼）
CREATE TABLE IF NOT EXISTS user_line_link_codes (
    user_id     BIGINT      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    code        CHAR(6)     NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_line_link_codes_code ON user_line_link_codes (code);

-- 2c. contact_records（#14：來電紀錄與關懷紀錄合併表）
CREATE TABLE IF NOT EXISTS contact_records (
    id                BIGSERIAL PRIMARY KEY,
    record_type       CHAR(1) NOT NULL CHECK (record_type IN ('1', '2')),  -- 1=來電 2=關懷
    contact_date      DATE NOT NULL,
    handler_user_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,

    applicant_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    caller_name       TEXT,
    caller_gender     CHAR(1) CHECK (caller_gender IS NULL OR caller_gender IN ('M', 'F', 'U')),
    caller_phone      TEXT,

    application_id    BIGINT REFERENCES applications(id) ON DELETE SET NULL,

    from_source       CHAR(2),
    consultant_type   CHAR(1) CHECK (consultant_type IS NULL OR consultant_type IN ('1', '2', '3')),
    consult_program   CHAR(1) CHECK (consult_program IS NULL OR consult_program IN ('1', '2')),
    reject_reasons    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

    summary           TEXT,
    media_urls        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contact_records_phone     ON contact_records (caller_phone);
CREATE INDEX IF NOT EXISTS idx_contact_records_applicant ON contact_records (applicant_user_id);
CREATE INDEX IF NOT EXISTS idx_contact_records_app       ON contact_records (application_id);
CREATE INDEX IF NOT EXISTS idx_contact_records_date      ON contact_records (contact_date DESC);

-- 2c-2. contact_records 關懷專屬欄位（refine-contact-care，2026-05）
--   record_type='2' 時記錄聯絡對象（與申請人之關係）
ALTER TABLE contact_records
    ADD COLUMN IF NOT EXISTS contacted_party       CHAR(1),
    ADD COLUMN IF NOT EXISTS contacted_party_other TEXT;
COMMENT ON COLUMN contact_records.contacted_party       IS '關懷紀錄專用：聯絡對象與申請人之關係（1=本人 2=配偶 9=其他）';
COMMENT ON COLUMN contact_records.contacted_party_other IS '當 contacted_party=9 時的補充描述';

-- 2c-3. caller_phone 正規化欄位 + index（2026-05）
--   原本查詢用 regexp_replace(caller_phone, '[^0-9]', '') = $1，
--   函數套在欄位上會繞過 index 變 full table scan。
--   改用 generated column 預先正規化 + B-tree index，
--   完全比對 / 前綴 / 末碼比對都能用得到 index。
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'contact_records' AND column_name = 'caller_phone_digits'
    ) THEN
        ALTER TABLE contact_records
            ADD COLUMN caller_phone_digits TEXT
            GENERATED ALWAYS AS (regexp_replace(COALESCE(caller_phone, ''), '[^0-9]', '', 'g')) STORED;
    END IF;
END $$;
COMMENT ON COLUMN contact_records.caller_phone_digits IS '正規化過的電話（只留數字）；給 index 用，禁止手動寫入';
CREATE INDEX IF NOT EXISTS idx_contact_records_phone_digits
    ON contact_records (caller_phone_digits);
-- 舊的 idx_contact_records_phone 已被取代（caller_phone 直接比對沒人用）
DROP INDEX IF EXISTS idx_contact_records_phone;

-- 2c-4. contact_record_followups（#34：追蹤摘要，append-only）
CREATE TABLE IF NOT EXISTS contact_record_followups (
    id                BIGSERIAL PRIMARY KEY,
    contact_record_id BIGINT NOT NULL REFERENCES contact_records(id) ON DELETE CASCADE,
    author_user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    summary           TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE contact_record_followups
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_contact_record_followups_record
    ON contact_record_followups (contact_record_id, created_at DESC);
COMMENT ON TABLE contact_record_followups IS '來電／關懷紀錄的追蹤摘要；每次新增一筆並保留新增者';
COMMENT ON COLUMN contact_record_followups.contact_record_id IS '對應 contact_records.id';
COMMENT ON COLUMN contact_record_followups.author_user_id IS '新增追蹤摘要的人員';
COMMENT ON COLUMN contact_record_followups.summary IS '追蹤摘要內容';
COMMENT ON COLUMN contact_record_followups.created_at IS '追蹤摘要新增時間';
COMMENT ON COLUMN contact_record_followups.updated_at IS '追蹤摘要最後修改時間';

-- 2c-5. email_verification_codes（#36：申請人／轉介人 Email 驗證）
CREATE TABLE IF NOT EXISTS email_verification_codes (
    id                 BIGSERIAL PRIMARY KEY,
    email              TEXT NOT NULL,
    purpose            TEXT NOT NULL,
    code_hash          TEXT NOT NULL,
    salt               TEXT NOT NULL,
    verification_token TEXT,
    attempts           INTEGER NOT NULL DEFAULT 0,
    expires_at         TIMESTAMPTZ NOT NULL,
    verified_at        TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT email_verification_codes_purpose_chk
        CHECK (purpose IN ('applicant_application', 'referral_application'))
);
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_lookup
    ON email_verification_codes (email, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_token
    ON email_verification_codes (email, purpose, verification_token)
    WHERE verification_token IS NOT NULL;
COMMENT ON TABLE email_verification_codes IS '申請流程 Email 驗證碼；用於確認申請人與轉介人信箱可收信';
COMMENT ON COLUMN email_verification_codes.purpose IS '驗證用途：applicant_application / referral_application';
COMMENT ON COLUMN email_verification_codes.verification_token IS '驗證成功後交給表單送出的短期 token';

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
    ('executive',     '執行長'),
    ('volunteer',     '志工'),
    ('applicant',     '申請人')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- ── 系統設定 ──────────────────────────────────────────────────
INSERT INTO system_settings (key, value, description) VALUES
    -- max_apply_amount 已移除（#2/#3）：改由 subsidy_amount_limits 表依子類型動態查詢
    ('pending_doc_alert_days', '14',     '超過幾天未補件則觸發缺件警示'),
    ('pending_doc_notification_threshold', '3', '同案件累計發送幾次未補件提醒後，於 UI 提示承辦人考慮以不通過結案'),
    ('board_auto_assign',                  'false', '董事審核階段自動派案開關（true/false）：true 時案件進 board_review 自動派給當前案件最少、priority 最小的組別'),
    ('line_official_account_id',           '',      'LINE 官方帳號 ID（@xxxxxx 格式）；使用者個人設定頁的「加好友」連結會用此值組成 https://line.me/R/ti/p/{@id}'),
    ('notification_dispatcher_enabled',    'false', '事件通知派送總開關（true/false）：開啟後事件觸發時才會發送 Email/LINE 通知；關閉時事件仍發生但不通知（不影響業務）'),
    ('announcement_new_days',  '7',      '公告發佈後幾天內顯示 NEW 標籤'),
    -- 組織基本資料（顯示於核銷階段列印的領款收據 header）
    ('org_full_name',          '財團法人萬美基金會',                          '基金會全名（列印 header）'),
    ('org_license_no',         '衛部醫字第 1121668099 號',                     '主管機關核准立案字號'),
    ('org_registration_no',    '113 證他字第 000974 號',                        '法人登記證字號'),
    ('org_uniform_no',         '93155400',                                     '統一編號'),
    ('org_address',            '106005 台北市大安區金山南路二段 165 號 4 樓',  '登記住址'),
    ('org_phone',              '(02) 2321-2777',                               '聯絡電話'),
    ('org_fax',                '(02) 2321-3828',                               '傳真'),
    ('org_line_qr_url',        '/org-line-qr.png',                             'LINE 加入志工 QR code 圖片路徑（相對於 public/，或外部 URL）'),
    -- refine-disbursement-flow：撥款退件原因最少字數
    ('disbursement_reject_reason_min_chars', '10', '撥款流程退件時，退件原因 trim 後最少字數（rejectDisbursement 守門用）')
ON CONFLICT (key) DO NOTHING;

-- ── 通知渠道 ──────────────────────────────────────────────────
INSERT INTO notification_channels (channel, is_enabled, config) VALUES
    ('email', FALSE, '{}'),
    ('line',  TRUE,  '{}'),
    ('sms',   FALSE, '{}')
ON CONFLICT (channel) DO NOTHING;
-- LINE 整合 Phase 1（added 2026-04）：將既有 line 渠道強制啟用，憑證從 .env 讀
UPDATE notification_channels SET is_enabled = TRUE WHERE channel = 'line';

-- ── 系統通知範本（Phase 3，事件驅動 dispatcher 用，added 2026-04） ──
-- name 開頭為 line_/email_ + 事件代碼；屬保護範本，不可刪除（由 server action 守門）
INSERT INTO notification_templates (name, channel, subject, body, description, status, sort_order)
SELECT * FROM (VALUES
    ('line_case_entered_board_review', 'line', '',
     E'【萬美基金會】新案件待派組\n案號：{{案號}}\n申請人：{{申請人}}\n申請金額：NT$ {{申請金額}}\n\n本案已進入董事審核階段，請至系統儘速指派董事組。\n{{系統連結}}',
     '系統範本：案件進入董事審核階段時通知董事長（LINE）', 1, 100),
    ('email_case_entered_board_review', 'email', '【萬美基金會】新案件待派組',
     E'董事長 您好：\n\n以下案件已進入「董事審核」階段，請儘速於系統指派董事組進行審查：\n\n案號：{{案號}}\n申請人：{{申請人}}\n申請金額：NT$ {{申請金額}}\n\n系統連結：{{系統連結}}\n\n──────────────\n財團法人萬美社會福利慈善事業基金會',
     '系統範本：案件進入董事審核階段時通知董事長（Email）', 1, 101),
    ('line_case_assigned_to_board_group', 'line', '',
     E'【萬美基金會】您所屬組別有新案件待審\n組別：{{組別名稱}}\n案號：{{案號}}\n申請人：{{申請人}}\n\n請至系統完成審查與簽章。\n{{系統連結}}',
     '系統範本：案件派組時通知該組成員（LINE）', 1, 102),
    ('email_case_assigned_to_board_group', 'email', '【萬美基金會】您所屬組別有新案件待審',
     E'董事 您好：\n\n您所屬的組別「{{組別名稱}}」已被指派一件新的審核案件：\n\n案號：{{案號}}\n申請人：{{申請人}}\n\n請至系統儘速完成審查與簽章：{{系統連結}}\n\n──────────────\n財團法人萬美社會福利慈善事業基金會',
     '系統範本：案件派組時通知該組成員（Email）', 1, 103),
    ('email_case_payment_receipt_to_applicant', 'email', '萬美基金會申請通過通知',
     E'{{申請人}} 您好：\n\n您所申請的補助案件已通過董事審核，特此通知。\n\n案號：{{案號}}\n申請金額：NT$ {{申請金額}}\n核定金額：NT$ {{核定金額}}\n\n請列印附件之「領款收據」，填寫具領人資料、簽名後郵寄回基金會以辦理撥款。\n\n──────────────\n財團法人萬美社會福利慈善事業基金會',
     '系統範本：個管師於每筆撥款手動產生並寄送領款收據 PDF 給申請人', 1, 104),
    -- refine-disbursement-flow：撥款完成通知（站內 + Email + LINE）
    ('email_disbursement_completed', 'email', '萬美基金會撥款完成通知',
     E'{{申請人}} 您好：\n\n您所申請的補助案件當次撥款已完成發放。\n\n案號：{{案號}}\n本次撥款金額：NT$ {{本次撥款金額}}\n累計已撥金額：NT$ {{累計撥款金額}}\n\n──────────────\n財團法人萬美社會福利慈善事業基金會',
     '系統範本：執行長按【完成】時通知所有相關人員（個管/主管/會計/申請人）', 1, 105),
    ('line_disbursement_completed', 'line', '',
     E'【萬美基金會】撥款完成\n案號：{{案號}}\n本次金額：NT$ {{本次撥款金額}}\n累計：NT$ {{累計撥款金額}}',
     '系統範本：撥款完成通知（LINE）', 1, 106)
) AS v(name, channel, subject, body, description, status, sort_order)
WHERE NOT EXISTS (
    SELECT 1 FROM notification_templates t WHERE t.name = v.name
);

-- 既有環境若已建立系統範本，僅同步人看的說明文字；name 保留為系統查找 key。
UPDATE notification_templates
SET description = '系統範本：案件進入董事審核階段時通知董事長（LINE）'
WHERE name = 'line_case_entered_board_review'
  AND description IS DISTINCT FROM '系統範本：案件進入董事審核階段時通知董事長（LINE）';

UPDATE notification_templates
SET description = '系統範本：案件進入董事審核階段時通知董事長（Email）'
WHERE name = 'email_case_entered_board_review'
  AND description IS DISTINCT FROM '系統範本：案件進入董事審核階段時通知董事長（Email）';

UPDATE notification_templates
SET description = '系統範本：個管師於每筆撥款手動產生並寄送領款收據 PDF 給申請人'
WHERE name = 'email_case_payment_receipt_to_applicant'
  AND description IS DISTINCT FROM '系統範本：個管師於每筆撥款手動產生並寄送領款收據 PDF 給申請人';

INSERT INTO notification_templates (name, channel, subject, body, description, status, sort_order)
SELECT
    'email_case_disbursement_approval_to_applicant',
    'email',
    '萬美基金會申請通過通知',
    E'{{申請人}} 您好：\n\n您所申請的補助案件已通過董事審核，特此通知。\n\n本次撥款金額：{{本次撥款金額}}\n\n後續撥款流程將由基金會人員協助辦理。\n\n──────────────\n財團法人萬美社會福利慈善事業基金會',
    '系統範本：個管師於撥款階段寄送申請通過通知給申請人',
    1,
    104
WHERE NOT EXISTS (
    SELECT 1
    FROM notification_templates
    WHERE name = 'email_case_disbursement_approval_to_applicant'
);

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
    (id, label, phase, is_required, storage_location_id, sort_order, is_active, allow_supplement, scope, subsidy_subtype, paper_requirement)
VALUES
    ( 1, '自費醫療補助申請表',             'apply', TRUE,  8,    1,  TRUE, FALSE, 'C', NULL, 'original'),
    ( 2, '重大傷病證明',                   'apply', TRUE,  NULL, 6,  TRUE, TRUE,  'C', NULL, 'original'),
    ( 3, '身分證正反面影本',               'apply', TRUE,  7,    2,  TRUE, FALSE, 'C', NULL, 'original'),
    ( 4, '個資同意書',                     'apply', TRUE,  9,    3,  TRUE, FALSE, 'C', NULL, 'original'),
    ( 5, '現職醫事人員在職證明',           'apply', FALSE, NULL, 11, TRUE, FALSE, 'C', '2', 'original'),
    ( 6, '綜所稅清單(配偶亦繳)',           'apply', TRUE,  NULL, 4,  TRUE, TRUE,  'C', NULL, 'original'),
    ( 8, '全戶戶籍謄本',                   'apply', TRUE,  NULL, 5,  TRUE, TRUE,  'C', NULL, 'original'),
    ( 9, '投資人有價證券餘額表',           'apply', FALSE, NULL, 9,  TRUE, FALSE, 'C', '2', 'original'),  -- 2026-05 改名（原集保結算所資料）
    (10, '購屋貸款利息單據',               'apply', FALSE, NULL, 10, TRUE, FALSE, 'C', '2', 'original'),
    (11, '診斷證明',                       'apply', TRUE,  NULL, 7,  TRUE, TRUE,  'C', NULL, 'original'),
    (13, '醫療單據正本',                   'apply', FALSE, NULL, 8,  TRUE, TRUE,  'C', NULL, 'original'),  -- 2026-05 改名 + 非必填（治療前可預先申請）
    (14, '全國財產稅總歸戶財產查詢清單',   'apply', TRUE,  NULL, 12, TRUE, TRUE,  'C', NULL, 'original'),  -- 2026-05 新增
-- 核銷階段
    (17, '醫療收據',             'reimbursement', TRUE,  NULL, 1, TRUE, FALSE, 'D', NULL, 'original'),  -- 每筆撥款一份
    (18, '領款收據',             'reimbursement', TRUE,  NULL, 2, TRUE, FALSE, 'D', NULL, 'original'),  -- 每筆撥款一份
    (19, '保險給付通知單',       'reimbursement', FALSE, NULL, 3, TRUE, FALSE, 'C', NULL, 'original'),
    (20, '生命故事同意刊登截圖證明', 'reimbursement', FALSE, NULL, 4, TRUE, FALSE, 'C', NULL, 'original'),
    (21, '存摺封面影本',         'reimbursement', TRUE,  NULL, 5, TRUE, TRUE,  'D', NULL, 'original'),  -- 2026-05 改為每次撥款必備
    (22, '捐贈/受補助者聲明書（不同意公開姓名時必附）', 'reimbursement', FALSE, NULL, 6, TRUE, FALSE, 'D', NULL, 'original')  -- 2026-05 新增；UI conditionally required
ON CONFLICT (id) DO UPDATE SET
    label               = EXCLUDED.label,
    phase               = EXCLUDED.phase,
    is_required         = EXCLUDED.is_required,
    storage_location_id = EXCLUDED.storage_location_id,
    sort_order          = EXCLUDED.sort_order,
    is_active           = EXCLUDED.is_active,
    allow_supplement    = EXCLUDED.allow_supplement,
    scope               = EXCLUDED.scope,
    subsidy_subtype     = EXCLUDED.subsidy_subtype,
    paper_requirement   = EXCLUDED.paper_requirement;

-- 重設 sequence 以免之後新增文件類型時 id 衝突
SELECT setval(
    pg_get_serial_sequence('document_type_config', 'id')::regclass,
    COALESCE((SELECT MAX(id) FROM document_type_config), 0) + 1,
    false
);

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
COMMENT ON TABLE application_documents    IS '案件文件與審核狀態；row_id 為主鍵，同案件同文件類型可有多筆上傳檔案。status：0=待上傳/未符合, 1=符合, 2=逾期。懶建立：首次上傳才會建列';
COMMENT ON TABLE document_type_config     IS '文件類型設定：phase（apply/board/reimbursement）、subsidy_subtype（NULL=共用、1=經濟弱勢、2=小康家庭）、is_required（必備）、allow_supplement（可延後補件）、paper_requirement（紙本要求）';
COMMENT ON TABLE file_storage_location    IS '檔案實體儲存位置樹狀結構（parent_id 自參考），用於記錄紙本或影印本的實體櫃位';
COMMENT ON TABLE home_visit               IS '家訪紀錄：每個案件最多一筆，記錄家庭狀況、訪視心得、訪視人員';
COMMENT ON TABLE contact_records   IS '【#14】來電與關懷紀錄合併表（record_type=1 來電 / 2 關懷）';
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
COMMENT ON TABLE user_line_link_codes     IS '使用者 LINE 綁定碼暫存表：PK = user_id 強制一人一碼，產新覆寫舊；過期 30 分鐘自動失效（webhook 查詢時加 expires_at > NOW() 過濾）';

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
COMMENT ON COLUMN users.line_user_id   IS 'LINE 帳號綁定後寫入；UNIQUE 確保一個 LINE 帳號僅對應一個系統使用者；NULL = 未綁定';
COMMENT ON COLUMN users.notification_channels IS '使用者通知接收偏好陣列（值域 email/line）；至少 1 個（CHECK 強制）；DEFAULT 為 {email}';
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
COMMENT ON COLUMN document_type_config.subsidy_subtype     IS '適用補助子類型：NULL=共用、1=經濟弱勢、2=小康家庭';
COMMENT ON COLUMN document_type_config.paper_requirement   IS '紙本要求：original=正本、copy=影本、original_or_copy=正本或影本、none=不須紙本';
COMMENT ON COLUMN document_type_config.tooltip_text        IS '文件上傳時顯示的提示文字（滑鼠 hover 顯示）';

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
COMMENT ON COLUMN applications.marital_status          IS '婚姻狀態（115 年辦法）：1=已婚（配偶合計收入）、2=單親（個人收入）、3=單身（個人收入）；NULL 為舊資料未填';
COMMENT ON COLUMN applications.has_children            IS '是否有子女';
COMMENT ON COLUMN applications.underage_children_count IS '未成年子女人數';
COMMENT ON COLUMN applications.adult_children_count    IS '成年子女人數';
COMMENT ON COLUMN applications.application_way         IS '案件來源：1=自提 2=轉介（CHECK 約束）';
COMMENT ON COLUMN applications.referral_unit_id        IS '轉介單位 ID，FK 至 referral_units.id（ON DELETE SET NULL）；僅當 application_way=2 時有意義';
COMMENT ON COLUMN applications.board_review_comments   IS '董事審核意見（case-scoped 永久保存）；由 saveBoardReviewDraft 同步寫入，獨立於 stage-scoped 的 application_workflow.comments，不受 stage 推進覆寫影響';

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

-- user_line_link_codes
COMMENT ON COLUMN user_line_link_codes.user_id    IS '系統使用者 ID（PK）';
COMMENT ON COLUMN user_line_link_codes.code       IS '6 位數字綁定碼（使用者於 LINE app 傳給 bot）';
COMMENT ON COLUMN user_line_link_codes.expires_at IS '失效時間（產生時設 NOW() + 30 minutes）';
COMMENT ON COLUMN user_line_link_codes.created_at IS '產生時間';

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
COMMENT ON COLUMN home_visit.visitor_title                 IS '訪視者職稱（志工 / 個管師）';
COMMENT ON COLUMN home_visit.visitor_name                  IS '訪視者姓名（自填）';
COMMENT ON COLUMN home_visit.visit_photo_urls              IS '家訪照片雲端連結陣列（必填至少一張，使用者貼外部 URL）';

-- contact_records（#14）
COMMENT ON COLUMN contact_records.record_type     IS '1=來電紀錄 2=關懷紀錄';
COMMENT ON COLUMN contact_records.contact_date    IS '紀錄日期';
COMMENT ON COLUMN contact_records.handler_user_id IS '接聽人/紀錄者（FK→users）';
COMMENT ON COLUMN contact_records.applicant_user_id IS '若已是申請人則關聯 user.id；來電未識別時為 NULL';
COMMENT ON COLUMN contact_records.caller_name     IS '來電者姓名（自由填，未必=applicant_user.name）';
COMMENT ON COLUMN contact_records.caller_gender   IS 'M=男 F=女 U=未知';
COMMENT ON COLUMN contact_records.caller_phone    IS '聯絡方式（電話/LINE/Email）；含歷史檢索 index';
COMMENT ON COLUMN contact_records.application_id  IS '可關聯特定補助案；未關聯為 NULL';
COMMENT ON COLUMN contact_records.from_source     IS '從何得知本補助：01醫院社工 02醫師 03網路 04病友 05親友 06鄉鎮市公所 07他會 08合作的個管師 09公文 10FB 11Hope基金會 12癌資中心 13醫院個管';
COMMENT ON COLUMN contact_records.consultant_type IS '諮詢人：1=本人 2=親友 3=轉介個案';
COMMENT ON COLUMN contact_records.consult_program IS '諮詢方案（對齊 #2 子類型）：1=小康家庭 2=經濟弱勢';
COMMENT ON COLUMN contact_records.reject_reasons  IS '無法申請原因（多選代碼）：1收入不符 2存款證券不符 3補助項目不符 4年齡不符 5非癌症 6非本國籍 7中低收入';
COMMENT ON COLUMN contact_records.summary         IS '備註／追蹤摘要';
COMMENT ON COLUMN contact_records.media_urls      IS '雲端連結（關懷紀錄常用）；空陣列為預設';
COMMENT ON COLUMN contact_records.created_at      IS '紀錄建立時間';
COMMENT ON COLUMN contact_records.updated_at      IS '紀錄最後更新時間';

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
