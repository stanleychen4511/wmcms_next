## Why

主管階層（admin / supervisor / chairman / board_member）需要定期檢視一段日期內的案件結果分布（通過率 / 不通過率 / 拆分維度），才能判斷收案標準是否需要調整、哪類案件被退最多、哪位承辦人案量結構等。目前系統只有單筆案件查詢與單筆狀態檢視，**沒有統計報表**，主管只能用 SQL 自己撈或透過 admin 後台逐案累計，效率低。

## What Changes

- 新增頂層「案件統計」分頁（`view='stats'`），首頁新增 quick action 卡片進入；只有 `admin` / `supervisor` / `chairman` / `board_member` 角色可見此入口，server actions 同步做 server-side 角色守門
- 新增 server actions（`src/app/actions/caseStatisticsActions.ts`）：
  - `fetchCaseStatistics(operatorUserId, fromDate, toDate)` — 回傳該日期區間（以 `apply_at` 為基準）內**通過/不通過**案件的彙總，含 4 個維度拆分
  - `fetchCaseStatisticsDrillDown(operatorUserId, fromDate, toDate, dimension, dimensionValue, outcome)` — drill-down：給定某維度值（如「類別 A」「officer 2」「轉介單位 5」「2026-04」），回傳該分類下符合 outcome（'approved' | 'rejected'）的案件清單
- **狀態定義**（依使用者決策）：
  - 通過 = `applications.status IN ('3', '4')`
  - 不通過 = `applications.status = '2'`
  - 進行中（`status = '1'`）**不列入統計**
- **日期維度**：以 `applications.apply_at` 為基準（即「這段期間收件的案，最終結果分布」）
- **拆分維度**（4 個，皆通過/不通過分別計數）：
  1. 案件類別（A/B/C/D；用既有 `applications.application_type` + fallback `case_number` 第一碼）
  2. 承辦人（officer_id → users.name 解密）
  3. 案件來源 + 轉介單位（`application_way='1'` 自提 vs `'2'` 轉介；轉介細分 `referral_unit.name`）
  4. 月份（依 `apply_at` 取 `YYYY-MM`）
- **「原因」呈現**（依使用者 Q3=A 決策）：不新增分類欄位；drill-down 時把該案的 `application_workflow.comments` 一併列出供主管自行閱讀
- **CSV 匯出**：頁面提供「下載 CSV」按鈕；不引入圖表庫
- **drill-down**：表格內每個數字可點擊 → 開 modal 顯示該分類的案件清單（case_number、申請人、apply_at、approved_amount、最近一筆 workflow.comments 摘要）
- 新增 audit action `case_statistics.viewed`（detail 含 from / to / operator role）— 用於追蹤誰查過敏感統計

## Non-Goals

- 不新增「不通過原因分類」欄位（依 Q3 決策 A）；不改 init_db.sql schema
- 不畫圖表（無 recharts/nivo 依賴）；只給表格 + CSV
- 不做月份自動 prefilled / 排程匯出
- 不涵蓋「卡在哪個 stage 被擋」維度（依 Q4 未勾選）
- 不做即時刷新 / WebSocket；查詢結果為快照，使用者改日期區間或按重新整理才更新
- 不做申請人個資匿名化（drill-down 顯示真實姓名 — 角色已是 admin/supervisor/chairman/board_member 屬合理需求）
- 不限制日期區間長度；超大區間若效能不佳留給未來優化
- 不新增其他 server actions 之外的快取層；單純 SELECT 即時計算

## Capabilities

### New Capabilities

- `case-statistics`: 案件統計報表的 server actions、UI 分頁、CSV 匯出、drill-down

### Modified Capabilities

(none)

## Impact

- Affected specs:
  - 新增 `specs/case-statistics/spec.md`
- Affected code:
  - 新增 `src/app/actions/caseStatisticsActions.ts`
  - 修改 `src/app/actions/auditActions.ts`：`AuditAction` union 加 `'case_statistics.viewed'`
  - 新增 `src/components/CaseStatisticsPage.tsx` — 主頁面（日期區間選擇 / 4 維度表格 / CSV 匯出按鈕 / drill-down 觸發）
  - 新增 `src/components/CaseStatisticsDrillDownModal.tsx` — drill-down 案件清單 modal
  - 修改 `src/App.tsx`：新增 `view='stats'` 路由 + 處理 navigation
  - 修改 `src/components/HomePage.tsx`：新增「案件統計」quick action 卡片（受角色守門）
- 不動 DB schema、不動既有資料
