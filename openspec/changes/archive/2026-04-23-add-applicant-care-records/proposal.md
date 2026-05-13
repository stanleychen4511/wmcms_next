## Why

案件結案後，社工 / 志工會持續追蹤申請人狀況（俗稱事後關懷），但目前系統沒有對應的紀錄欄位 → 關懷內容散落在紙本、Line 群、社工個人記事，主管無法統整查看「某位申請人歷次被關懷的軌跡」。本 change 提供結構化的關懷紀錄表，以**申請人**為主體（非案件），支援多次紀錄、不同關懷人、含媒體連結。

## What Changes

- 新增資料表 `applicant_care_records`：以 `applicant_user_id` 為 FK，1 對多紀錄
  - 欄位：`id`, `applicant_user_id`, `care_user_id`（執行關懷的 volunteer/social_worker）, `care_date`, `summary`（明文）, `media_urls TEXT[]`, `created_at`, `updated_at`
- 新增 server actions（`src/app/actions/careRecordActions.ts`）：`fetchCareRecordsByApplicant`, `createCareRecord`, `updateCareRecord`, `deleteCareRecord`，含角色權限守門
- 新增 UI 區塊：在 `ApplicantHistoryPage` 加新 Tab「關懷紀錄」，列出該申請人歷次關懷 + 新增/編輯 modal
- 媒體欄位：**多個** Cloud URL（TEXT[]）— UI 提供「新增一列輸入框」動態加減
- 角色權限：
  - **建立**：`volunteer` OR `social_worker`
  - **檢視**：`volunteer` + `social_worker` + `admin` + `supervisor`
  - **編輯**：建立者本人（隨時）；其他人不可
  - **刪除**：建立者本人（隨時）OR `admin`（任意）
- 新增 audit actions：`care_record.created`, `care_record.updated`, `care_record.deleted`

## Non-Goals

- 不做媒體上傳（不收檔，只存外部 URL；圖片/影片由社工自行傳到 Google Photos / Drive 等服務）
- 不發通知（依使用者決策）
- 不做關懷排程提醒（「該家訪了」之類，留給未來 change）
- 不做關懷紀錄匯出 PDF / Excel（看 UI 即可，匯出留給未來）
- 不對申請人本身揭露這些紀錄（applicant 角色不可看自己的關懷紀錄；本 change 純內部使用）
- 不做摘要欄位的全文搜尋（量小，按申請人查即可）
- 不加密儲存摘要（與 `home_visit.subsidy_need_reason` 等既有自由文字欄位一致）
- 不限制 `media_urls` URL 格式（接受任何字串；若要嚴格只認 https:// 留給未來）

## Capabilities

### New Capabilities

- `applicant-care-records`: 申請人關懷紀錄的 schema、server actions、權限守門、UI 整合到 ApplicantHistoryPage

### Modified Capabilities

(none)

## Impact

- Affected specs:
  - 新增 `specs/applicant-care-records/spec.md`
- Affected code:
  - DB schema: `scripts/init_db.sql` 加 `applicant_care_records` 表 + COMMENT + 索引
  - 新增 `src/app/actions/careRecordActions.ts`
  - 修改 `src/app/actions/auditActions.ts`：`AuditAction` union 加 3 個新 action；`AuditTargetType` 加 `'care_record'`
  - 修改 `src/components/ApplicantHistoryPage.tsx` — 新增「關懷紀錄」Tab + 列表 + 新增/編輯按鈕
  - 新增 `src/components/CareRecordModal.tsx` — 新增/編輯 modal 元件
- DB migration：`scripts/init_db.sql` 對 pg_wmcms / pg_wmcms_demo 兩庫執行（CREATE TABLE IF NOT EXISTS 冪等）
