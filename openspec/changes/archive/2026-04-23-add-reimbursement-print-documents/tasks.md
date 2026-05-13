## 1. DB Schema 與 Migration

- [x] 1.1 於 `scripts/init_db.sql` 新增 `ALTER TABLE applications ADD COLUMN IF NOT EXISTS board_review_comments TEXT` 並加 COMMENT，對 pg_wmcms 與 pg_wmcms_demo 兩庫冪等執行（實作 spec「Persistent board review comments column」三個 scenarios；依 design「新增 `applications.board_review_comments` 欄位」決策）
- [x] 1.2 於 `scripts/init_db.sql` 與 `settingsActions.ensureDefaultSettings` 新增八個 `org_*` 鍵（org_full_name / org_license_no / org_registration_no / org_uniform_no / org_address / org_phone / org_fax / org_line_qr_url）用 INSERT ... ON CONFLICT (key) DO NOTHING 冪等 seed；對兩庫套用（實作 spec「Organization metadata settings seeded」全部三個 scenarios；依 design「組織資料 system_settings 命名與預設值」決策）

## 2. 共用工具模組

- [x] 2.1 新增 `src/lib/caseCategory.ts`：export `CATEGORY_LABEL` 字典（A/B/C/D → 中文全稱）、`parseCategory(caseNumber)` 與 `resolveCategory({ application_type, case_number })`（優先讀 application_type，NULL fallback parseCategory）（實作 spec「Case category derivation from case_number」全部 scenarios；依 design「案件類別從 `case_number` 第一碼解析」決策）
- [x] 2.2 新增 `src/lib/numToChinese.ts`：export `numToChinese(amount: number): string` 支援 0~9999999，中間補零規則，0 回傳「零」（實作 spec「Number-to-Chinese amount conversion utility」全部四個 scenarios；依 design「金額國字大寫工具」決策）
- [x] 2.3 新增 `src/lib/rocDate.ts`：export `formatRocDate(input: Date | string | null, sep?: string): string`，民國年 = 西元年 - 1911，null 回空字串（實作 spec「ROC date formatting utility」兩個 scenarios；依 design「民國年日期工具」決策）

## 3. board_review_comments 生命週期

- [x] 3.1 修改 `src/app/actions/boardGroupActions.ts` 之 `saveBoardReviewDraft`：在既有 `application_workflow.comments` UPDATE 的同一交易內，新增 `UPDATE applications SET board_review_comments = $1` 並同步寫入；未變更 comments 時不觸發此 UPDATE（實作 spec「saveBoardReviewDraft writes both comments fields」全部四個 scenarios；依 design「新增 `applications.board_review_comments` 欄位」決策之「寫入時機」段）
- [x] 3.2 修改 `src/app/actions/workflowActions.ts` 之 `retreatWorkflowStage`：在既有清除 `board_review_assignments` + `clearStaleSignatures` 的區塊內，加上 `UPDATE applications SET board_review_comments = NULL` 當 dbStage ∈ {admin_review, home_visit}（實作 spec「Retreat clears board_review_comments」三個 scenarios；依 design「新增 `applications.board_review_comments` 欄位」決策之「清除時機」段）
- [x] 3.3 驗證 `advanceWorkflowStage` 流程不觸碰 `applications.board_review_comments`（實作 spec「Stage advance does not overwrite board_review_comments」scenario；依 design「新增 `applications.board_review_comments` 欄位」決策）

## 4. SettingsPanel UI 擴充

- [x] 4.1 修改 `src/components/SettingsPanel.tsx`：在 `SETTING_LABEL` / `SETTING_HINT` / `SETTING_INPUT_TYPE` / `SETTING_UNIT` 四個字典新增八個 `org_*` 鍵（全部 input type = 'text'），label 用繁體中文，hint 說明用途（實作 spec「Settings panel exposes organization metadata」兩個 scenarios；依 design「組織資料 system_settings 命名與預設值」決策）

## 5. 印表 Server Actions

- [x] 5.1 新增 `src/app/actions/printDocumentActions.ts`（'use server'），內部 helper `assertAdminOrAccountant(operatorUserId)` 查 user_roles，非 admin/accountant 直接拋錯或返回失敗（依 design「印表 server actions 集中於新檔 printDocumentActions.ts」決策；實作 spec「Print data assembly server actions」unauthorized scenario）
- [x] 5.2 於 `printDocumentActions.ts` 實作 `fetchReviewOpinionPrintData(applicationId, operatorUserId)`：JOIN applications + users（解密姓名）+ home_visit（subsidy_need_reason）+ board_review_signatures（image + 解密姓名）+ application_workflow（reimbursement 的 reviewed_at），回傳含 case_number / applicantName / category / caseDescription / boardComments / approvedAmount / isApproved / reviewDate / signatures[] 的 DTO（實作 spec「Print data assembly server actions」authorized scenario；依 design「審核日期 = 推進到 reimbursement 的時間」「簽章呈現 = 同一張表並列所有董事簽章圖」兩個決策）
- [x] 5.3 於 `printDocumentActions.ts` 實作 `fetchPaymentReceiptPrintData(applicationId, operatorUserId)`：組裝 applicants info（含解密身分證）+ approvedAmount + category + org_* 設定（fetchSetting 拉八個鍵）；全數以 DTO 形式回傳（實作 spec「Payment receipt print page」資料面 scenarios 的前置；依 design「印表 server actions 集中於新檔」決策）
- [x] 5.4 於 `printDocumentActions.ts` 實作 `fetchMedicalReceipts(applicationId, operatorUserId)`：SELECT `application_documents.file_path` JOIN `document_type_config` WHERE name='醫療收據' 返回檔案陣列（實作 spec「Medical receipt direct-open behavior」的資料前置；依 design「醫療收據走「直接開既有檔案」」決策）

## 6. 審核意見表列印頁

- [x] 6.1 新增 server component `src/app/print/review-opinion/[applicationId]/page.tsx`：呼叫 `fetchReviewOpinionPrintData`；若結果 `success=false` 因權限拒絕 → 回 403 頁面或 `redirect('/')`（實作 spec「Direct URL access blocked for unauthorized role」scenario；依 design「列印區塊權限與位置」server-side 檢查）
- [x] 6.2 於該頁面渲染 A4 版面：基金會 header → 類別 checkbox 列（用 `parseCategory` + `CATEGORY_LABEL`）→ 案件編號 → 申請人 → 案件說明 → 審核委員簽章區（flex 並列圖片 + 姓名）→ 審核意見（`board_review_comments`，NULL 時顯示「（未保存審核意見）」）→ 審核結果（准予補助/不准予補助 + `numToChinese(approvedAmount)`）→ 審核日期（`formatRocDate(reviewDate)`）（實作 spec「Review opinion form print page」全部四個 scenarios）
- [x] 6.3 新增 client component 顯示「列印」按鈕 + `window.print()`；使用 `@media print { .no-print { display: none } }` 隱藏非列印元素（實作 spec「Print button triggers browser print dialog」scenario）
- [x] 6.4 列印樣式：Tailwind `print:` modifier + `@page { size: A4; margin: 1cm }`；盡量對齊使用者提供的紙本範本版面

## 7. 領款收據列印頁

- [x] 7.1 將使用者提供的 LINE 志工 QR 圖片儲存到 `public/org-line-qr.png`（預設 `org_line_qr_url` 指向此路徑）（實作 spec「LINE QR asset location and fallback」default URL scenario；依 design「組織資料 system_settings 命名與預設值」決策）
- [x] 7.2 新增 server component `src/app/print/payment-receipt/[applicationId]/page.tsx`：呼叫 `fetchPaymentReceiptPrintData`；權限檢查同 6.1（實作 spec「Direct URL access blocked for unauthorized role」）
- [x] 7.3 於該頁面渲染 A4 版面：基金會 header（8 個 org_* 設定值 + QR 圖片區塊，若 `org_line_qr_url` 為相對路徑且檔案不存在則渲染空白邊框方塊）→「此欄由基金會填寫」空白列 → 申請人資料表格（姓名/案號/身分證/電話留白/電郵留白/地址留白）→ 補助類別 checkbox → 領款金額（`numToChinese(approvedAmount)` 包在「新臺幣…元整」中，NULL 則全空）→ 領款方式 / 具領人 / 簽名列全部留白 → 承辦人/主管/會計/執行長 signature 空欄（實作 spec「Payment receipt print page」全部四個 scenarios；「Print pages read organization metadata at render time」scenario；「LINE QR asset location and fallback」missing file scenario）
- [x] 7.4 加「列印」按鈕（同 6.3 模式）

## 8. 核銷畫面整合

- [x] 8.1 定位核銷撥款畫面對應元件（grep `view === 'reimbursement'` 或 `stage === 'reimbursement'` 在 `src/App.tsx` / `src/components/` 下的相關檔案），記錄檔名於此任務的實作筆記（解 design.md「Open Questions」第 1 條）
- [x] 8.2 於定位到的元件新增「文件列印」區塊，條件 render：`loggedInUser.roles.includes('admin') || loggedInUser.roles.includes('accountant')`；顯示三顆按鈕（實作 spec「Reimbursement print panel visibility and access control」四個 scenarios；依 design「列印區塊權限與位置」決策）
- [x] 8.3 「審核意見表」按鈕：`window.open(`/print/review-opinion/${applicationId}`, '_blank')`（依 design「列印頁面用 Server Component + 瀏覽器原生列印」決策）
- [x] 8.4 「領款收據」按鈕：`window.open(`/print/payment-receipt/${applicationId}`, '_blank')`（同上決策）
- [x] 8.5 「醫療收據」按鈕行為：呼叫 `fetchMedicalReceipts` → 0 份 alert、1 份直接 `window.open`、≥2 份彈 modal 列出檔案（每個檔案一顆「開啟」按鈕）（實作 spec「Medical receipt direct-open behavior」全部三個 scenarios；依 design「醫療收據走「直接開既有檔案」」決策）

## 9. 驗證與清理

- [x] 9.1 對兩庫跑 `psql $DATABASE_URL -f scripts/init_db.sql` 冪等驗證：`\d applications` 看到 `board_review_comments` 欄位；`SELECT key FROM system_settings WHERE key LIKE 'org_%'` 回 8 列
- [x] 9.2 手動測試審核意見表：建一案推進到 board_review → 組員簽章 + 存 draft 寫入共同意見 → 推進到 reimbursement → admin 進核銷畫面點「審核意見表」→ 版面正確、意見存在、簽章並列、類別 checkbox 對應 case_number 第一碼
- [x] 9.3 手動測試領款收據：同一案點「領款收據」→ 基金會 header 顯示 8 個 setting 值、QR 圖顯示、金額國字大寫正確、地址/電話/電郵等留白
- [x] 9.4 手動測試醫療收據三種情境：未上傳 → alert；上傳 1 份 → 新分頁開啟原檔；上傳 2 份 → modal
- [x] 9.5 手動測試權限：以 case_officer / supervisor 身分嘗試直接訪問 `/print/review-opinion/<id>` → 被拒；admin / accountant 可訪問；核銷畫面上「文件列印」區塊對 case_officer 不可見
- [x] 9.6 手動測試 comments 生命週期：board_review 存意見 → 推進到 reimbursement 後 `applications.board_review_comments` 仍保留；退回到 home_visit 後該欄位清空
- [x] 9.7 執行 `npm run build` 確認 TypeScript 編譯通過、`npm run lint` 無新 error
