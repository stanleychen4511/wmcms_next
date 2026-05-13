## 1. DB Schema

- [x] 1.1 於 `scripts/init_db.sql` 新增 `CREATE TABLE IF NOT EXISTS applicant_care_records (...)` 含全部欄位（id, applicant_user_id, care_user_id, care_date, summary, media_urls TEXT[], created_at, updated_at）+ FK + ON DELETE CASCADE on applicant + ON DELETE SET NULL on care_user；對 pg_wmcms 與 pg_wmcms_demo 兩庫執行（實作 spec「Care records schema」之 table-present / idempotent / cascade scenarios）
- [x] 1.2 於 `scripts/init_db.sql` 新增 `CREATE INDEX IF NOT EXISTS idx_care_records_applicant_user_id ON applicant_care_records(applicant_user_id)` 加速 per-applicant 查詢
- [x] 1.3 於 `scripts/init_db.sql` 為新表每個欄位加 `COMMENT ON COLUMN`；對兩庫套用（實作 spec「Care records schema」comment 規範與 default-empty-array scenario）

## 2. 型別與稽核

- [x] 2.1 修改 `src/app/actions/auditActions.ts`：`AuditAction` union 加 `'care_record.created' | 'care_record.updated' | 'care_record.deleted'`；`AuditTargetType` union 加 `'care_record'`（實作 spec「Audit action types extended」scenario）

## 3. Server Actions

- [x] 3.1 新增 `src/app/actions/careRecordActions.ts`（'use server'）：定義 `CareRecord` interface 與 `ActionResult`（沿用既有 pattern）；新增 internal helper `assertHasAnyRole(operatorUserId, codes: string[])` 查 user_roles join roles
- [x] 3.2 於 `careRecordActions.ts` 實作 `createCareRecord(operatorUserId, applicantUserId, careDate, summary, mediaUrls)`：role gate (`volunteer` OR `social_worker`) → 驗證 applicant 存在且 active → 驗證 summary 非空 → normalize mediaUrls（trim + 移空 + 移 null）→ INSERT → 寫 audit `care_record.created`（實作 spec「Create care record server action」全部六個 scenarios）
- [x] 3.3 於 `careRecordActions.ts` 實作 `fetchCareRecordsByApplicant(operatorUserId, applicantUserId)`：role gate (`volunteer`/`social_worker`/`admin`/`supervisor` 任一) → SELECT JOIN users 取 care worker 解密姓名 → ORDER BY care_date DESC, created_at DESC → 回傳 CareRecord[]（實作 spec「Fetch care records by applicant」全部三個 scenarios）
- [x] 3.4 於 `careRecordActions.ts` 實作 `updateCareRecord(operatorUserId, recordId, careDate, summary, mediaUrls)`：載 record → 不存在拒絕 → 驗證 operator === record.care_user_id → 驗證/normalize 同 create → UPDATE → 計算 changedFields → 寫 audit `care_record.updated`（實作 spec「Update care record server action」全部三個 scenarios）
- [x] 3.5 於 `careRecordActions.ts` 實作 `deleteCareRecord(operatorUserId, recordId)`：載 record → 不存在拒絕 → 驗證 operator === record.care_user_id OR operator 有 admin role → DELETE → 寫 audit `care_record.deleted` 含 `deleted_by_role`（實作 spec「Delete care record server action」全部四個 scenarios）

## 4. UI

- [x] 4.1 新增 `src/components/CareRecordModal.tsx`（'use client'）：props 接 `mode: 'create' | 'edit'` / `applicantUserId` / `applicantName` / `existingRecord?` / `operatorUserId` / `onSaved` / `onClose`；包含日期 input（type=date，default today）、summary textarea、動態 mediaUrls 列表（新增/刪除列）、Save/Cancel 按鈕；Save disabled 當 summary 空 或 in-flight；錯誤訊息顯示在底部紅色（實作 spec「Create / edit care record UI modal」全部六個 scenarios）
- [x] 4.2 修改 `src/components/ApplicantHistoryPage.tsx`：在現有 tab/區塊結構加入「關懷紀錄」tab；tab 顯示條件 = logged-in user 至少有 volunteer/social_worker/admin/supervisor 之一；「新增關懷紀錄」按鈕僅當有 volunteer 或 social_worker role 時顯示（實作 spec「Care records tab in ApplicantHistoryPage」之 tab 顯示與按鈕顯示 scenarios）
- [x] 4.3 於 `ApplicantHistoryPage.tsx` 之關懷紀錄 tab 內：開啟 tab 時呼叫 `fetchCareRecordsByApplicant`；列出每筆 row（care_date / careUserName / summary 前 80 字 / media count）；每 row 顯示「編輯」（僅當 operator === careUserId）+「刪除」（當 operator === careUserId OR operator 是 admin）按鈕；Modal Save 後 re-fetch（實作 spec「Care records tab」之 list-rendered-newest-first scenario + 與 modal 整合）

## 5. 驗證

- [x] 5.1 兩庫跑 `psql $DATABASE_URL -f scripts/init_db.sql` 冪等驗證；查 `\d applicant_care_records` 確認欄位與索引；二次執行不報錯
- [x] 5.2 手動測試（建立流程）：以 volunteer 登入 → 開某申請人 ApplicantHistoryPage → 切到關懷紀錄 tab → 新增關懷（含 2 個媒體 URL）→ 列表顯示新紀錄
- [x] 5.3 手動測試（編輯/刪除權限）：以 social_worker (不同人) 登入看同一申請人 → 該紀錄無編輯/刪除按鈕；以 admin 登入 → 看到刪除按鈕但無編輯按鈕；以原建立者登入 → 兩按鈕都顯示
- [x] 5.4 手動測試（檢視權限）：以 case_officer 登入 → 關懷紀錄 tab 不顯示；以 supervisor 登入 → tab 顯示但「新增關懷紀錄」按鈕不顯示
- [x] 5.5 手動測試（驗證 + audit）：summary 空白送出被擋；建立/編輯/刪除三種操作各看 audit_logs 應有對應 action row 與 detail
- [x] 5.6 執行 `npm run build` 通過、`npm run lint` 無新 error
