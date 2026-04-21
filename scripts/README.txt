scripts/ — 資料庫管理腳本說明
===============================================================================

本資料夾內共有兩個腳本，分別負責「建立／升級資料庫結構」與「建立系統管理員
帳號」。兩個腳本皆為冪等（idempotent）設計，可重複執行而不會破壞既有資料。


-------------------------------------------------------------------------------
1) init_db.sql — 資料庫初始化／升級
-------------------------------------------------------------------------------

【目的】

  建立或升級 PostgreSQL 資料庫的所有資料表、索引、預設資料（roles、system_settings、
  notification_channels 等）。

  本檔案是「單一事實來源」，專案沒有獨立的 migration 工具：

    - 全新資料庫：直接執行此檔即可建立完整 schema。
    - 既有資料庫：再次執行此檔會以 IF NOT EXISTS / ON CONFLICT DO NOTHING 的方式
      補上新欄位、新表、新預設值；既有資料不會被覆寫。

  新增 schema 變更時，請勿直接修改 CREATE TABLE 區塊（那只對全新 DB 有效），
  而是於對應表下方追加 ALTER TABLE ... ADD COLUMN IF NOT EXISTS / CREATE INDEX
  IF NOT EXISTS。範例可參考 `notification_logs` 區塊（14a）的 is_pending_doc_reminder
  欄位、document_type_config 的 allow_supplement 欄位（line 70-71）。

【執行方式】

  # 主資料庫
  psql "postgresql://postgres:1qazXSW%40@localhost:5433/wmcms" -f scripts/init_db.sql

  # Demo 資料庫
  psql "postgresql://postgres:1qazXSW%40@localhost:5433/wmcms_demo" -f scripts/init_db.sql

  也可以使用 .env.local 中的 DATABASE_URL：
    psql $DATABASE_URL -f scripts/init_db.sql

  Windows PowerShell 範例：
    psql -h localhost -p 5433 -U postgres -d wmcms      -f scripts\init_db.sql
    psql -h localhost -p 5433 -U postgres -d wmcms_demo -f scripts\init_db.sql

【常見情境】

  - 開新環境           → 直接跑一次。
  - schema 異動後同步  → 對每個現有環境（wmcms、wmcms_demo …）各跑一次。
  - 砍掉重練           → 先 `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`
                          再跑 init_db.sql，最後跑 seed_admin。

【注意】

  - 執行前建議先停掉 dev server（npm run dev），避免活躍連線干擾 ALTER。
  - 此腳本不會建立資料庫本身（CREATE DATABASE），請確認目標 DB 已存在。
  - 不會建立任何使用者帳號；管理員帳號請另用 seed_admin.mjs 建立。


-------------------------------------------------------------------------------
2) seed_admin.mjs — 建立／更新系統管理員帳號
-------------------------------------------------------------------------------

【目的】

  在 users 表中建立一筆「admin」角色的帳號，並完成密碼雜湊與加密欄位寫入：

    - 姓名以 AES-256-CBC 加密（name_enc + name_iv）
    - 身分證留空（管理員不需）
    - 密碼以 HMAC-SHA256 雜湊（key 為該 user 的 search_salt Buffer）
    - 自動指派 admin 角色（user_roles）

  使用 Node.js 原生 ESM，無需額外 npm 套件即可執行（依賴 pg 與 dotenv 透過
  讀取 .env.local 取得 DATABASE_URL 與 ENCRYPTION_KEY 等環境變數）。

  腳本為冪等：若帳號已存在則改用 UPDATE 重設密碼／姓名，避免 SELECT-then-INSERT
  的 race condition。

【執行方式（互動模式）】

  node scripts/seed_admin.mjs

  系統會依序詢問：
    帳號 (account)       : 例如 admin
    密碼 (password)      : 至少 6 字
    姓名 (name)          : 例如 系統管理員

【執行方式（非互動 / CI 模式）】

  透過環境變數一次帶入，跳過所有提示：

    ADMIN_ACCOUNT=admin01 \
    ADMIN_PASSWORD=YourStrongPass! \
    ADMIN_NAME=系統管理員 \
    node scripts/seed_admin.mjs

  Windows PowerShell：
    $env:ADMIN_ACCOUNT="admin01"
    $env:ADMIN_PASSWORD="YourStrongPass!"
    $env:ADMIN_NAME="系統管理員"
    node scripts\seed_admin.mjs

【注意】

  - 連線資訊取自 .env.local 的 DATABASE_URL；若要對 demo 庫建管理員，
    請暫時改寫 DATABASE_URL 或在執行前 export 一次性的環境變數：
      DATABASE_URL=postgresql://postgres:1qazXSW%40@localhost:5433/wmcms_demo \
      node scripts/seed_admin.mjs
  - 加密／雜湊使用的金鑰來自 ENCRYPTION_KEY（lib/crypto.ts 會讀取），
    此金鑰必須與線上環境一致，否則之後 server 啟動後解密／登入會失敗。
  - 必須先執行過 init_db.sql（roles 表中要有 admin 那一筆）。


-------------------------------------------------------------------------------
3) seed_users.mjs — 批次建立預設測試帳號
-------------------------------------------------------------------------------

【目的】

  一次建立多個測試帳號（主管 / 承辦 / 社工 / 董事 / 會計 ...），方便開發與
  人工測試使用。腳本以 account 為 key，**已存在的帳號會直接跳過**，只建立
  尚未存在者，因此可重複執行而不會覆寫既有資料。

  與 seed_admin.mjs 的差別：
    - seed_admin.mjs    → 互動式單一帳號（含覆寫已存在帳號的 UPDATE 邏輯）
    - seed_users.mjs    → 批次多筆，已存在跳過，所有帳號共用同一密碼

【設定方式】

  打開 scripts/seed_users.mjs，編輯檔案頂端兩個區塊：

    const DEFAULT_PASSWORD = 'Password123!';      ← 所有帳號共用此密碼
    const USERS = [
        { account: 'supervisor_01', name: '主管一', roles: ['supervisor']    },
        { account: 'officer_01',    name: '承辦一', roles: ['case_officer']  },
        ...
    ];

  - 改密碼：直接改 DEFAULT_PASSWORD 那行。
  - 新增帳號：在 USERS 陣列追加一筆。
  - 暫時不建某帳號：把該行用 // 註解掉。
  - roles 必須對應 init_db.sql 中 roles 表的 code（case_officer / supervisor /
    social_worker / accountant / board_member / volunteer / admin / applicant）。

【執行方式】

  # 對 .env.local 設定的 DATABASE_URL 執行
  node scripts/seed_users.mjs

  # 對 demo 庫執行
  DATABASE_URL=postgresql://postgres:1qazXSW%40@localhost:5433/wmcms_demo \
  node scripts/seed_users.mjs

  Windows PowerShell：
    $env:DATABASE_URL="postgresql://postgres:1qazXSW%40@localhost:5433/wmcms_demo"
    node scripts\seed_users.mjs

【輸出範例】

  ✅  supervisor_01   主管一（supervisor）
  ⊘  officer_01      已存在，跳過
  ...
  完成 — 建立 5 筆 / 跳過 7 筆 / 失敗 0 筆

【注意】

  - 必須先跑過 init_db.sql（roles 表中要有對應的 role code）。
  - 連線資訊取自 .env.local 的 DATABASE_URL。
  - 加密金鑰來自 ENCRYPTION_KEY；換金鑰後舊帳號將無法登入，必須砍掉重建。
  - 若要「強制覆寫」已存在的帳號（重設密碼 / 改姓名），目前需先手動 DELETE
    該筆 users 後再跑腳本，或改用 seed_admin.mjs（單筆 UPDATE）。


-------------------------------------------------------------------------------
完整重置流程（開發環境砍掉重練）
-------------------------------------------------------------------------------

  1) 停掉 dev server（Ctrl+C）。
  2) 對目標 DB 清空 schema：
       psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
  3) 重新建立資料表與預設資料：
       psql $DATABASE_URL -f scripts/init_db.sql
  4) 建立管理員帳號：
       node scripts/seed_admin.mjs
  5) （選用）建立 12 個預設測試帳號：
       node scripts/seed_users.mjs

  若要同時重置 wmcms 與 wmcms_demo，將上述 1～3 對兩個 DATABASE_URL 各跑一次即可。
