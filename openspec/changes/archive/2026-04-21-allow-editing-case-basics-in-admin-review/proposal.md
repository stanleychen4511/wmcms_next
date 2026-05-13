## Why

目前案件一旦建立，「申請人姓名、申請類別、案件來源、轉介單位」都無法修改。實務上承辦人在行政初審階段會發現：
- 申請人姓名打錯字（同音字、簡繁混用）
- 類別選錯（A/B/C/D 誤選）
- 案件來源誤填自提，實際為轉介（或相反）
- 轉介單位選錯

目前唯一解法是整案刪除重建，但 case_number 已經產生、workflow 紀錄已寫入、applicant user 可能已建，重建代價很高且破壞稽核連續性。

導入「行政初審階段基本資訊編輯」可在不動 case_number、applicant_id、workflow 的前提下修正錯誤，並由 audit_logs 完整留下 before/after，保有追蹤。進入家訪或更後階段時鎖死以確保資訊穩定。

## What Changes

- 新增 server action `updateApplicationBasics(applicationId, patch, operatorUserId)`，接受：
  - `applicantName`（可選，修正申請人姓名 → 更新 users.name_enc/name_iv/name_bidx）
  - `applicationWay`（可選，'1' 自提 / '2' 轉介）
  - `referralUnitId`（可選；當 way='2' 時必要且必須是 is_active=true 的單位）
  - 注意：**不接受 `applicationType`**（申請類別與 case_number 首字母綁定，不可修改）
- server action 於事務內做四重驗證：
  1. 案件必須存在
  2. `applications.status = '1'` 且 `application_workflow.stage = 'admin_review'`（其他階段或結案狀態拒絕）
  3. 操作者必須是 `applications.officer_id` 或擁有 `admin` 角色
  4. `application_way = '2'` 時 `referralUnitId` 必須為有效啟用單位
- 寫 audit_logs 一筆 `action = 'application.basics_update'`，`detail.before` 與 `detail.after` 只記錄實際變動的欄位；`detail.changedFields` 列出欄位名稱。
- 前端新增「編輯案件基本資訊」按鈕於案件詳情頁（Dashboard 下方，現有「案件來源/轉介單位」顯示列旁邊），僅當滿足「stage=admin_review + status='1' + 操作者為該案承辦或 admin」三條件時顯示。
- 點擊按鈕彈出 modal，含：
  - 姓名 input（必填，≤50 字，可編輯）
  - 類別唯讀顯示 + 說明「類別不可修改，有誤請以不通過結案重建」
  - 來源 radio（自提 / 轉介，可編輯）
  - 轉介單位 select（僅 way='2' 時顯示，fetchActiveReferralUnits）
- 送出後刷新詳情頁；失敗顯示錯誤訊息。
- 擴充 `AuditAction` 聯合型別新增 `'application.basics_update'`。

## Non-Goals (optional)

- 不開放修改身分證號（idNumber 有誤一律作廢重建新案件）。
- 不開放修改申請類別（application_type 已綁定於 case_number 首字母，修改會造成案號與類別不一致；類別有誤須以「不通過結案」並重新建立新案件）。
- 不開放修改申請金額（applyAmount）本次不一併處理；仍由既有「資格預審表單」的儲存流程負責。
- 不改動案件 case_number 或 applicant_id 的對應關係（修改姓名只更新同一位 applicant user 的加密欄位）。
- 不支援多階段或批次修改（每次送出為單一案件的完整 patch）。
- 不處理跨案件影響：修改姓名會影響該 applicant 名下所有案件的顯示（因為 users.name_enc 是共用的）；這是預期行為，不另做 snapshot。

## Capabilities

### New Capabilities

- `case-basics-editing`: 行政初審階段允許承辦人/admin 修改申請人姓名、申請類別、案件來源與轉介單位，進階階段與結案後鎖死，變更完整記錄於稽核日誌。

### Modified Capabilities

(none)

## Impact

- **Affected specs**：新增 `specs/case-basics-editing/spec.md`
- **Affected code**：
  - `src/app/actions/applicationActions.ts`：新增 `updateApplicationBasics` server action（含事務內驗證與 users 表姓名更新邏輯）
  - `src/app/actions/auditActions.ts`：`AuditAction` 聯合型別追加 `'application.basics_update'`
  - `src/App.tsx`：案件詳情頁頂部顯示「編輯」按鈕（條件顯示）與 modal；整合 `fetchActiveReferralUnits`；成功後呼叫 `loadAppDetail` 刷新
  - 新增元件 `src/components/EditCaseBasicsModal.tsx`（含表單驗證與送出邏輯）
  - `src/app/actions/workflowActions.ts`：`fetchApplicationDetail` 已有 `applicationWay` / `referralUnitId` / `referralUnitName` 回傳值可重用；如需額外回傳 `officerId` 給前端做權限判斷，一併補上
- **Dependencies**：無新增 npm 套件
- **既有資料相容**：不動 schema，新欄位 `application_way` / `referral_unit_id` 已於前次 change 加入；此次只做 UPDATE 路徑。
