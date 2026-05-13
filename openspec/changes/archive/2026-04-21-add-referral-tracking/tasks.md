## 1. 資料庫 Schema

- [x] 1.1 於 `scripts/init_db.sql` 新增 `referral_units` 資料表：欄位 `id BIGSERIAL PK`、`name TEXT NOT NULL UNIQUE`、`contact_info TEXT`、`sort_order INT NOT NULL DEFAULT 0`、`is_active BOOLEAN NOT NULL DEFAULT TRUE`、`created_at / updated_at TIMESTAMPTZ` —— 用 `CREATE TABLE IF NOT EXISTS`（實作 spec「Referral units dictionary table」）
- [x] 1.2 於 `scripts/init_db.sql` 對 `applications` 表以 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 加入 `application_way CHAR(1) NOT NULL DEFAULT '1'` 與 `referral_unit_id BIGINT REFERENCES referral_units(id) ON DELETE SET NULL`，並加 CHECK 約束 `application_way IN ('1','2')`（冪等：用 `DO $$ ... IF NOT EXISTS ... $$` 處理 CHECK，避免重跑時衝突）（實作 spec「Application source code column」「Application referral unit foreign key」及「`application_way` 用 CHAR(1) 而非 ENUM」、「轉介單位 FK 採 `ON DELETE SET NULL`（不硬刪）」）
- [x] 1.3 對 `pg_wmcms` 與 `pg_wmcms_demo` 兩個現行 DB 執行 `psql $DATABASE_URL -f scripts/init_db.sql`（或透過 MCP），驗證新表建立、兩欄位補上、CHECK 啟用；並跑 `SELECT COUNT(*) FROM applications WHERE application_way = '1'` 確認既有案件回填成 '1'
- [x] 1.4 為 `referral_units` 與 `applications` 新欄位補上 `COMMENT ON COLUMN`（中文說明 enum 與 FK 意義），並同步寫進 `init_db.sql` 既有的 COMMENT 區塊

## 2. 後端 Server Actions

- [x] 2.1 新增 `src/app/actions/referralUnitActions.ts`：定義介面 `ReferralUnit`（id/name/contactInfo/sortOrder/isActive/createdAt/updatedAt）與五個 server action `fetchActiveReferralUnits` / `fetchAllReferralUnits` / `createReferralUnit` / `updateReferralUnit` / `toggleReferralUnitActive`。排序皆為 `ORDER BY sort_order ASC, name ASC`。CRUD 寫入 `audit_logs`。依照 design「單位名稱 UNIQUE 但允許停用後重建」之決策，createReferralUnit 於 UNIQUE 衝突時直接回傳錯誤，不自動改用既有停用單位的 id（實作 spec「Referral unit server actions」「Audit trail for referral unit management」）
- [x] 2.2 於 `src/app/actions/auditActions.ts` 之 `AuditAction` 聯合型別追加 `'referral_unit.create' | 'referral_unit.update' | 'referral_unit.toggle_active'`；`AuditTargetType` 追加 `'referral_unit'`（實作 spec「Audit trail for referral unit management」）
- [x] 2.3 修改 `src/app/actions/applicationActions.ts` 之 `createNewApplication`：新增參數 `applicationWay: '1' | '2'` 與 `referralUnitId: number | null`，在事務內驗證 way='2' 時 `referralUnitId` 存在且 `referral_units.is_active=true`，way='1' 時強制寫入 NULL；INSERT 時帶入兩欄（實作 spec「createNewApplication validates referral fields」與 design「表單驗證由前後端雙重把關」）
- [x] 2.4 修改 `src/app/actions/applicationActions.ts`（或 `workflowActions.ts` 視 `fetchApplicationDetail` 所在）：`fetchApplicationDetail` 回傳值加入 `applicationWay` 與 `referralUnitName`（JOIN `referral_units` 取 name；若 unit 被刪則 name 為 null）（實作 spec「Application detail shows referral info」）

## 3. 前端 UI

- [x] 3.1 新增元件 `src/components/ReferralUnitManager.tsx`：呼叫 `fetchAllReferralUnits` 顯示列表，提供「新增」表單（name/contactInfo/sortOrder）、inline 編輯、啟停用 toggle；比照 `DocumentTypeManager.tsx` 的 UI 模式；重新整理不顯示整頁 loading（沿用 AdminPanel silent refresh 模式）（實作 spec「Admin can manage referral units」）
- [x] 3.2 修改 `src/components/AdminPanel.tsx`：依照 design「後台 UI：複用 `AdminPanel` 分頁容器」，於既有 tabs 結構新增「轉介單位管理」tab，僅 `admin` 角色可見，內容渲染 `<ReferralUnitManager />`（實作 spec「Tab visible to admins / Tab hidden from non-admins」scenarios）
- [x] 3.3 修改 `src/components/NewApplicationPage.tsx`：新增 state `applicationWay`（預設 `'1'`）與 `referralUnitId`（預設 `null`）。顯示 Radio「案件來源」（自提/轉介），選「轉介」時載入並顯示下拉；空清單時顯示「請先至後台建立轉介單位」訊息並禁止以轉介提交；切回自提時清空 `referralUnitId`；提交時將兩值帶入 `createNewApplication`（實作 spec「New application form captures source」全部 scenarios）
- [x] 3.4 修改 `src/App.tsx`（或案件詳情對應區塊）：顯示「案件來源: 自提/轉介」；若 way='2' 且 referralUnitName 有值顯示單位名；若 way='2' 且 referralUnitName 為 null 顯示「轉介（單位已刪除）」（實作 spec「Application detail shows referral info」全部 scenarios）

## 4. 驗證

- [x] 4.1 手動測試：以 admin 登入 → AdminPanel 見「轉介單位管理」tab；新增 2 個單位、停用其一；切回 non-admin（例如 supervisor）重新整理 AdminPanel，該 tab 不可見
- [x] 4.2 手動測試：新增案件 → Radio 預設自提、提交成功 → 案件詳情顯示「案件來源: 自提」；另一案選「轉介」+ 選單位 → 提交成功 → 詳情顯示「案件來源: 轉介」+ 單位名
- [x] 4.3 手動測試：在新增案件頁選「轉介」但不選單位 → 送出被擋（前端驗證）；若前端繞過直接呼叫 server action 帶錯 referralUnitId → 回傳錯誤、DB 沒新增任何 row（檢查 `SELECT COUNT(*)` 確認）
- [x] 4.4 執行 `npm run build` 確認 TypeScript 嚴格模式通過；執行 `npm run lint` 確認我新增的檔案無新 error
