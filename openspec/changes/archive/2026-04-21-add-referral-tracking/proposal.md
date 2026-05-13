## Why

目前新增案件時，承辦人無法紀錄「此案是自提還是轉介而來」，也無法追蹤轉介來源。實務上這是基金會評估合作單位、回報補助成效、以及做年度統計的重要資訊。臨時作法（在姓名後面手打「XX醫院轉介」）造成資料髒、無法查詢、拼寫不一致、統計時需人工彙整。

導入「案件來源」欄位與「轉介單位字典表」可讓系統在新增案件時以結構化資料記錄，並提供後台維護清單避免重複打字。未來可直接以 SQL 查詢「某月來自 XX 醫院的案件數」。

## What Changes

- `applications` 新增欄位 `application_way CHAR(1) NOT NULL DEFAULT '1'` — 1=自提 / 2=轉介，加 CHECK 約束只允許這兩個值。
- `applications` 新增欄位 `referral_unit_id BIGINT` REFERENCES `referral_units(id)` ON DELETE SET NULL — 僅當 `application_way = '2'` 時有意義。
- 新增資料表 `referral_units`（id / name UNIQUE / contact_info / sort_order / is_active / created_at / updated_at）。
- 新增 server actions `src/app/actions/referralUnitActions.ts`：`fetchActiveReferralUnits`（表單下拉用）、`fetchAllReferralUnits`（後台列表用）、`createReferralUnit` / `updateReferralUnit` / `toggleReferralUnitActive`。
- 後台 `AdminPanel` 新增「轉介單位管理」分頁：CRUD、啟用/停用、排序。
- `NewApplicationPage` 與 `ApplicationForm` 新增兩個欄位：
  - Radio「案件來源」：自提（預設）/ 轉介
  - 下拉「轉介單位」：僅選「轉介」時顯示，資料來自 `fetchActiveReferralUnits`；無選項時顯示「請先至後台建立轉介單位」訊息。
- `createNewApplication` server action 新增兩個參數：`applicationWay` 與 `referralUnitId`，以及驗證（way=2 時 referralUnitId 必填且必須為啟用中的單位）。
- 案件詳情頁顯示「案件來源」與「轉介單位」（唯讀，沿既有資料呈現模式）。
- `fetchApplicationDetail` 與 `fetchCaseSummaries` 回傳值加入對應欄位（後者可選，視 UI 是否要在清單顯示）。
- 稽核：轉介單位 CRUD 與 toggle active 操作寫入 `audit_logs`（新增 `referral_unit.create / update / toggle_active` audit actions）。

## Non-Goals (optional)

- 不處理既有案件的資料補填（既有列 `application_way` 會以 DEFAULT '1' 回填，referral_unit_id 保留 NULL）。
- 不提供轉介單位的多語言名稱、logo 或進階屬性（地址、統編 …），首版僅名稱 + 聯絡資訊備註。
- 不在案件清單新增「轉介單位」篩選器（首版僅詳情頁顯示）。
- 不做統計報表（僅提供資料欄位，未來再另起 change 做統計頁）。

## Capabilities

### New Capabilities

- `application-referral-tracking`: 在案件記錄案件來源（自提/轉介）與轉介單位，並提供轉介單位字典維護。

### Modified Capabilities

(none)

## Impact

- **Affected specs**：新增 `specs/application-referral-tracking/spec.md`
- **Affected code**：
  - `scripts/init_db.sql`：建立 `referral_units` 表、`applications` 加兩個欄位（以 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 冪等寫法）
  - `src/app/actions/applicationActions.ts`：`createNewApplication` 新增參數、`fetchApplicationDetail` 回傳新欄位
  - `src/app/actions/referralUnitActions.ts`：新增檔案（CRUD 與啟停用）
  - `src/app/actions/auditActions.ts`：`AuditAction` 聯合型別新增 3 個 action；`AuditTargetType` 新增 `referral_unit`
  - `src/components/NewApplicationPage.tsx`：新增 Radio + 下拉欄位與提交邏輯
  - `src/components/ApplicationForm.tsx`：編輯模式時顯示與驗證（若適用）
  - `src/components/AdminPanel.tsx`：新增「轉介單位管理」分頁
  - 新增元件 `src/components/ReferralUnitManager.tsx`（在 AdminPanel 中使用）
  - `src/App.tsx`：詳情頁顯示「案件來源」與「轉介單位」
  - `src/types.ts`：`ApplicationRecord` / `CaseSummary` 加欄位（視需要）
- **Dependencies**：無新增 npm 套件
- **資料移轉**：既有案件的 `application_way` 以 DEFAULT '1' 自動回填、`referral_unit_id` 保留 NULL
