## 1. 資料庫遷移

- [x] 1.1 在 `scripts/init_db.sql` 為 `document_type_config` 新增 `scope CHAR(1) NOT NULL DEFAULT 'C'` 欄位，並依 Decision 1：以 `disbursement_id` nullable 欄位處理 case vs disbursement scope，將「醫療收據」「領款收據」既有列更新為 `scope = 'D'`，完成 Document type scope classification。
- [x] 1.2 在 `scripts/init_db.sql` 為 `application_documents` 新增 `disbursement_id BIGINT NULL REFERENCES payment_disbursements(id)` 欄位（同 Decision 1），完成 Application document disbursement linkage。
- [x] 1.3 依 Decision 2：checklist 採用 `payment_disbursements` 多 boolean 欄位，將七個 boolean 檢核欄位（`officer_doc_check`、`supervisor_doc_check`、`accountant_medical_uploaded_check`、`accountant_amount_match_check`、`accountant_board_opinion_check`、`accountant_bank_setup_check`、`executive_final_check`）以 `IF NOT EXISTS` 加到 `payment_disbursements`，完成 Stage checklist columns on payment_disbursements。
- [x] 1.4 依 Decision 7：存摺封面影本走既有 `document_type_config` 機制，於 `init_db.sql` 以 `INSERT ON CONFLICT DO NOTHING` 新增一筆 name='存摺封面影本'、scope='C'、phase='reimbursement'、is_required=true、allow_supplement=true，完成 Bankbook cover is a case-level reimbursement-phase document。
- [x] 1.5 在 `init_db.sql` 新增兩筆 seed：`system_settings` 的 `disbursement_reject_reason_min_chars=10`（用於 Reject reason minimum length），以及 `notification_templates.disbursement_completed`（用於 Completion notification template），皆 `ON CONFLICT DO NOTHING`。

## 2. 文件上傳：scope 與責任歸屬

- [x] 2.1 在 `src/app/actions/documentActions.ts` 加入 scope-aware 的 `uploadApplicationDocument` 分支：依 `document_type_config.scope` 守門，case-level 必須 `disbursementId` 為 null、disbursement-level 必須非 null；依此實作 Payment receipt is uploaded by case officer at officer stage 與 Medical receipt is uploaded by accountant at accountant stage 兩條規則（角色 + `review_stage` 雙重檢查）。

## 3. 撥款各階段送件守門

- [x] 3.1 在 `src/app/actions/paymentDisbursementActions.ts` 為 `submitOfficerStage` 與 `submitSupervisorStage` 加上 checklist 守門與相關欄位寫入，分別實作 Officer stage submission gate（含領款收據存在 + 寄送成功檢查）與 Supervisor stage submission gate。
- [x] 3.2 在同檔為 `submitAccountantStage` 與 `submitExecutiveStage` 加上 checklist 守門，分別實作 Accountant stage submission gate（四項檢核全 TRUE）與 Executive stage completion gate；完成時觸發 Decision 5：完成時通知派送限定當筆撥款相關角色 對應 dispatch。
- [x] 3.3 修改 `rejectDisbursement`：強制 `reason` 字串 trim 後長度 ≥ `disbursement_reject_reason_min_chars`，且退件時僅重置「目標 stage 之後」的 checklist 欄位，完成 Reject reason minimum length。

## 4. 個管師寄送領款收據

- [x] 4.1 新增 server action `generateDisbursementPaymentReceipt`，使用既有 `template_files` 範本套印產生 PDF，僅允許 `case_officer` 於 `review_stage='1'` 呼叫，完成 Officer-triggered receipt generation。
- [x] 4.2 新增 server action `sendDisbursementPaymentReceiptEmail`，重用 `case_payment_receipt_to_applicant` 事件並夾帶 PDF，每次呼叫產生獨立 `notification_logs` 列且 metadata 含 `disbursement_id`，完成 Officer-triggered receipt email 與 Audit logging for payment receipt sends（修訂版）。
- [x] 4.3 在 `src/app/actions/workflowActions.ts` 移除 `advanceWorkflowStage` 中對 `case_payment_receipt_to_applicant` 的自動觸發呼叫（Decision 4：移除 `payment-receipt-auto-mailer` 自動觸發但保留事件名稱與派送基礎建設），對應 Auto-send event triggered on advance to reimbursement 的 REMOVED 規則。

## 5. 完成通知派送

- [x] 5.1 在 `submitExecutiveStage` 完成 commit 後，以 fire-and-forget 派送 `disbursement_completed`，依 Decision 5 將收件人限定為該筆撥款的 `officer/supervisor/accountant_user_id`（站內）與申請人（依 `notification_channels`），同時實作 Completion notification dispatched on executive completion 與 Completion notification recipient set。

## 6. 會計合併列印

- [x] 6.1 依 Decision 3：合併列印走 server-side route，client 不做 PDF 拼接，新增 `src/app/api/disbursement-print/route.ts`：接收 `disbursementId` + `documents[]`，僅允許 `accountant` 於 `review_stage='3'`，合併所選來源為單一 PDF 回傳並寫 `audit_logs`；同步完成 Reimbursement print panel visibility and access control（修訂版）與 Print audit and badge 對應的伺服端規則。

## 7. DisbursementPanel UI

- [x] 7.1 在 `src/components/DisbursementPanel.tsx` 頂部加入 summary 卡片（核定／累計／剩餘）、每筆撥款 row 標示「第 N 次撥款」（Decision 6：第 N 次撥款序號以 `created_at` 為準，UI 計算）、累計達核定金額時顯示完成 banner，分別實作 Disbursement summary card visible to all roles、Per-disbursement sequence label、Completion banner。
- [x] 7.2 在同檔為各階段 row 加上 checklist UI（個管 1 項／主管 1 項／會計 4 項／執行長 1 項），未完成時 disable 對應【送出】／【完成】按鈕並提供 tooltip，完成 UI submit button disabled until checklist complete。
- [x] 7.3 在個管階段 row 加入【產生領款收據】【檢視】【寄送 email】三步驟動作與三個狀態 badge（已產生／已寄送／紙本掃描完成），分別對應 Officer-triggered receipt preview 與 Disbursement row badges。
- [x] 7.4 在會計階段 row 替換原三按鈕為勾選清單 + 單一【列印】按鈕（呼叫 6.1 route），列印成功後顯示「📄 已列印」badge（hover 顯示時間/操作者），完成 Print audit and badge 之 UI 部分。
- [x] 7.5 將歷史撥款收據檢視按鈕限縮為 `accountant` 角色於 `status='3'` 才顯示；其他角色僅看摘要列，完成 Historical receipt viewing limited to accountant stage。

## 8. ReviewList 與存摺封面

- [x] 8.1 在 `src/components/ReviewList.tsx` 加上 `scope='C'` 過濾，避免列出 disbursement-level 文件；同時加入「存摺封面影本」上傳 UI，僅在 `application.status='3'` 後啟用，串接 1.4 新增的 document_type_config 列。
