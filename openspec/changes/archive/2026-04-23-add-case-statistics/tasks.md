## 1. 型別與稽核

- [x] 1.1 修改 `src/app/actions/auditActions.ts`：`AuditAction` union 新增 `'case_statistics.viewed'`（實作 spec「Audit action types extended」scenario）

## 2. Server Actions — 統計彙總

- [x] 2.1 新增 `src/app/actions/caseStatisticsActions.ts`（'use server'）：定義 `CaseStatistics` / `StatsDrillDownRow` TypeScript interfaces；內部 helper `assertHasAnyRole(operatorUserId, codes)`（複用既有 pattern，查 user_roles JOIN roles）；helper `resolveOperatorRole(operatorUserId)` 回傳 `'admin' | 'supervisor' | 'chairman' | 'board_member' | null`（依優先序，作為 audit detail.operatorRole 欄位）
- [x] 2.2 於 `caseStatisticsActions.ts` 實作 `fetchCaseStatistics(operatorUserId, fromDate, toDate)`：role gate → 單次 SELECT 查範圍內案件（依 `apply_at` 過濾，排除 NULL）→ 聚合 4 個 dimension：byCategory（A/B/C/D + unknown；用 COALESCE(application_type, LEFT(case_number,1))）、byOfficer（LEFT JOIN users 取解密姓名，officer_id IS NULL 歸未派案）、bySource（selfApply + referrals 細分 LEFT JOIN referral_units）、byMonth（TO_CHAR(apply_at, 'YYYY-MM')；gap-fill 月份）；計算 total / approvalRate；approvalRate=0 when denominator=0；寫 audit `case_statistics.viewed`（實作 spec「Status outcome definition」/「Date range filter on apply_at」/「Top-level summary aggregation」/「By case category dimension」/「By officer dimension」/「By application source dimension」/「By month dimension」/「Audit logging on view」所有 scenarios）
- [x] 2.3 於 `caseStatisticsActions.ts` 實作 `fetchCaseStatisticsDrillDown(operatorUserId, fromDate, toDate, dimension, dimensionValue, outcome)`：role gate → switch dimension（'category' / 'officer' / 'source' / 'month'）組出對應 WHERE clause → outcome 對應 status filter（'approved' → IN ('3','4')；'rejected' → '2'）→ LEFT JOIN users 解密申請人姓名 → 子查詢取 latestComment（application_workflow 最新一筆）→ ORDER BY apply_at DESC → 回傳陣列；不寫 audit（spec 規範 drill-down 不重複 audit）（實作 spec「Drill-down by dimension value」全部五個 scenarios）

## 3. UI

- [x] 3.1 新增 `src/components/CaseStatisticsDrillDownModal.tsx`（'use client'）：props 接 `fromDate / toDate / dimension / dimensionValue / outcome / operatorUserId / title / onClose`；open 時呼叫 `fetchCaseStatisticsDrillDown`；表格顯示 案號 / 申請人 / 收件日期 / 核准金額 / 最近一筆審核意見（截斷 60 字）；無資料顯示「（無資料）」（實作 spec「Drill-down modal shows case list」兩個 scenarios）
- [x] 3.2 新增 `src/components/CaseStatisticsPage.tsx`（'use client'）：AppHeader + 返回首頁按鈕；日期區間 input（type=date）兩個，default fromDate=本月 1 日、toDate=今天；「查詢」按鈕觸發 `fetchCaseStatistics`；狀態：loading / error / data；顯示 summary（approved / rejected / approvalRate / in-progress 註記）；4 個 table 區塊（依類別 / 依承辦人 / 依案件來源 / 依月份）；每個非 0 cell 是 button → setState 開 DrillDownModal；0 cell 純文字；「下載 CSV」按鈕（實作 spec「UI date range and dimension table rendering」全部四個 scenarios）
- [x] 3.3 於 `CaseStatisticsPage.tsx` 實作 client-side CSV 匯出：`exportToCsv(stats, fromDate, toDate)` → 組合 5 個 section（總覽 / 依類別 / 依承辦人 / 依案件來源 / 依月份）以空白 row 分隔；每 section 有標題 row + 欄標題 + 資料 rows；CSV 字串前加 UTF-8 BOM (`\uFEFF`)；用 `Blob` + `URL.createObjectURL` + `<a download>` 觸發下載；filename = `case_statistics_{fromDate}_to_{toDate}.csv`（實作 spec「CSV export」全部三個 scenarios）

## 4. 導覽整合

- [x] 4.1 修改 `src/App.tsx`：`View` 型別加 `'stats'`；新增 `onGoStats` handler；在 render switch 加 `view === 'stats'` 分支 render `<CaseStatisticsPage>`（實作 spec「Statistics view access control」之 navigate scenario）
- [x] 4.2 修改 `src/components/HomePage.tsx`：新增「案件統計」quick action 卡片；條件 render：`userRoles.some(r => ['admin','supervisor','chairman','board_member'].includes(r))`；點擊觸發 `onGoStats` prop（實作 spec「Statistics view access control」之 HomePage 可見/不可見兩個 scenarios）

## 5. 驗證

- [x] 5.1 手動測試（權限）：case_officer 登入 → 首頁無「案件統計」卡片；admin 登入 → 有卡片、點擊進入；嘗試以 case_officer 直接呼叫 server action（改 id 模擬）→ 回權限不足
- [x] 5.2 手動測試（統計正確性）：選本月區間 → 手工從 DB 查 `SELECT status, count(*) FROM applications WHERE apply_at BETWEEN ... GROUP BY status` 對照 summary 數字是否正確；再查各 dimension 交叉比對
- [x] 5.3 手動測試（drill-down）：byCategory B 的「不通過」cell 點擊 → modal 開啟、標題含「類別 B」「不通過」、列表案件的確是 category B + status=2；點承辦人某人的「通過」cell → 列表都是該 officer_id 的 3/4 案
- [x] 5.4 手動測試（CSV）：下載按鈕 → 檔名符合、Excel 開啟無亂碼（BOM OK）、5 個 section 都在
- [x] 5.5 手動測試（audit）：查 `SELECT * FROM audit_logs WHERE action='case_statistics.viewed' ORDER BY created_at DESC LIMIT 5;` → 有 record，detail 含 from/to/operatorRole
- [x] 5.6 執行 `npm run build` 通過、`npm run lint` 無新 error
