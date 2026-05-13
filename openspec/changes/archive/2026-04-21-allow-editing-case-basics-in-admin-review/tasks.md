## 1. 型別與稽核

- [x] 1.1 於 `src/app/actions/auditActions.ts` 的 `AuditAction` 聯合型別追加 `'application.basics_update'`（實作 spec「Audit log records before and after diff」之 AuditAction scenario）
- [x] 1.2 於 `src/app/actions/workflowActions.ts` 之 `ApplicationDetail` 介面加入 `officerId?: string | null`，並於 `fetchApplicationDetail` 的 SELECT 與 return 物件補上 `officer_id`；供前端做「僅本案承辦人或 admin 可編輯」的判斷（實作 design「前端按鈕顯示條件」）

## 2. Server Action

- [x] 2.1 於 `src/app/actions/applicationActions.ts` 宣告 server action 骨架 `updateApplicationBasics(applicationId, patch, operatorUserId)`，定義 patch 介面 `{ applicantName?, applicationType?, applicationWay?, referralUnitId? }`，包 BEGIN/COMMIT 事務容器（實作 spec「Server action for editing case basics」，對應 design「事務邊界：單一 BEGIN/COMMIT 包住 users UPDATE + applications UPDATE」）
- [x] 2.2 於事務最前段檢查 `applications.status = '1'` AND `application_workflow.stage = 'admin_review'`，否則 ROLLBACK 並回 `{ success: false, error: ... }`（實作 spec「Editing restricted to admin-review stage」及 design「階段判定：要同時檢 status 與 workflow.stage」）
- [x] 2.3 於階段驗證後檢查 `operatorUserId === applications.officer_id` OR 該 user 於 user_roles 持有 admin 角色；兩者皆否回錯（實作 spec「Permission restricted to case officer or admin」及 design「權限判定：officer_id 比對 + admin 角色」）
- [x] 2.4 於權限驗證後做欄位正規化：若 patch.applicationWay === '1' 強制 referralUnitId = null；若結果 way === '2' 則 referralUnitId 必填且 SELECT `referral_units.is_active` 必須為 TRUE（實作 spec「Referral unit validated when application way is referred」）
- [x] 2.5 若 patch.applicantName 存在：長度限制 1–50，SELECT 該 applicant `users.search_salt / name_enc / name_iv` 並 decryptAES 取現名；若與新名不同則 encryptAES + generateBlindIndex 重新產出三欄並 UPDATE users（實作 spec「Applicant name update re-encrypts and re-indexes」及 design「姓名更新：直接改 users.name_enc，不建立 snapshot」）
- [x] 2.6 組裝 `changedFields` / `before` / `after`（只含實際變動欄位），執行 applications UPDATE（若任一欄位變動）並以 `void writeAuditLog({ action: 'application.basics_update', detail: { changedFields, before, after } })` 寫稽核；若 changedFields 為空陣列則跳過 UPDATE 與 audit（實作 design「Audit log 結構：only 記錄實際變動欄位」與 spec「Audit log records before and after diff」全部 scenarios）

## 3. 前端 UI

- [x] 3.1 新增元件 `src/components/EditCaseBasicsModal.tsx`：props 含 `applicationId`、`initial`、`onClose`、`onSaved`；4 個欄位 state 與 client-side 驗證（姓名 1–50、way=2 必選單位）；way='2' 時 lazy-load `fetchActiveReferralUnits`；modal 內加提示「修改姓名會同步更新此申請人名下所有案件顯示名」；送出呼叫 `updateApplicationBasics` 成功後呼叫 onSaved 關閉 modal（實作 spec「Edit modal fields and validation」全部 scenarios）
- [x] 3.2 修改 `src/App.tsx` 案件詳情區塊：於現有「案件來源 / 轉介單位」顯示列旁加「編輯案件基本資訊」按鈕，顯示條件為 `appDetail.status === '1'` AND `appDetail.stage === 'admin_review'` AND (`loggedInUser.id === appDetail.officerId` OR `loggedInUser.roles` 含 'admin'）；按鈕 onClick 開啟 `<EditCaseBasicsModal />`，modal 的 `onSaved` 呼叫 `loadAppDetail(selectedAppId, true)` 刷新（實作 spec「Detail page surfaces the edit button conditionally」全部 scenarios）

## 4. 驗證

- [x] 4.1 手動測試（權限）：用 `officer_01` 登入看自己名下 admin_review 案件 → 看到「編輯」按鈕；看他人案件 → 按鈕不見；用 `admin01` 看任一案件 → 按鈕都在；用 `supervisor_01`（非本案承辦、非 admin）→ 按鈕應不見
- [x] 4.2 手動測試（階段）：把某案推進到 `home_visit` → 按鈕消失；把某案結案（status=2）→ 按鈕消失；將 admin_review 案件回 status='1' 且 stage='admin_review' → 按鈕回來
- [x] 4.3 手動測試（資料修改 + audit）：開 modal 修改 4 個欄位其中一個 → 儲存成功、詳情刷新顯示新值；在 pgAdmin/Navicat 查 `audit_logs` 最新一筆 `action='application.basics_update'`，`detail.changedFields` 正確、`detail.before` 與 `detail.after` 只含變動欄位；若開 modal 不改任何值送出 → 不產生新 audit 列
- [x] 4.4 手動測試（驗證）：way='2' 但不選單位 → 前端擋；直接呼叫 server action 帶無效 referralUnitId → 回錯、資料未動；姓名空白/51 字 → 回錯。執行 `npm run build` 確認 TypeScript 通過
