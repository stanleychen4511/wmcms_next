## 1. 資料庫 Schema 與依賴

- [x] 1.1 於 `scripts/init_db.sql` 新增資料表 `board_review_signatures`：複合 PK `(application_id, signer_user_id)`、欄位 `signature_data_url TEXT NOT NULL / content_hash TEXT NOT NULL / signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW() / user_agent TEXT / ip_address TEXT`、FK 皆 ON DELETE CASCADE；補 COMMENT ON TABLE / COLUMN。依 design「簽章儲存格式：`signature_data_url` = base64 PNG」決策，欄位型別為 TEXT（非 BYTEA）（實作 spec「Board review signatures schema」）
- [x] 1.2 透過 MCP 對 `pg_wmcms` 與 `pg_wmcms_demo` 執行對應 CREATE TABLE IF NOT EXISTS；驗證兩庫 table 存在並用 `\d board_review_signatures` 確認欄位型別
- [x] 1.3 執行 `npm install react-signature-canvas`；確認 `package.json` 新增依賴、無其他連帶套件問題

## 2. 型別與稽核

- [x] 2.1 於 `src/app/actions/auditActions.ts` 的 `AuditAction` 聯合型別新增 `'board_review.signature_added' | 'board_review.signatures_invalidated'`（實作 spec「Audit trail」之 AuditAction scenario）

## 3. Server Actions

- [x] 3.1 新增 `src/app/actions/boardSignatureActions.ts`：`computeBoardReviewContentHash(applicationId)` —— 查 SQL 取 `applications.approved_amount / application_workflow.comments / application_workflow.is_approved / board_review_assignments.group_id`，以 design「Content hash 計算規則：固定順序、lexicographic stable」的格式（`v1|{applicationId}|{approvedAmount ?? 'null'}|{comments ?? 'null'}|{isApproved ?? 'null'}|{assignedGroupId}`）做 SHA-256 hex（實作 spec「Content hash computation」全部 scenarios）
- [x] 3.2 於 `boardSignatureActions.ts` 新增 `submitBoardSignature(applicationId, signatureDataUrl, password, operatorUserId)`：單一事務驗證 (a) stage='board_review' AND status='1'、(b) case 有 assignment、(c) operator 為當前組員、(d) 重算 `hashPassword(password, users.search_salt)` 等於 `users.password`、(e) 當前 `computeBoardReviewContentHash` 後才 UPSERT `board_review_signatures`；寫 audit `board_review.signature_added` with `detail.content_hash / signer_user_id`；依 design「密碼驗證：復用既有 `hashPassword` + 二次驗證」與「權限：chairman / admin 可簽嗎？」—— chairman/admin 非組員時在驗證 (c) 即被拒（實作 spec「Signature submission with password re-auth」全部 scenarios 含 chairman-non-member rejection）
- [x] 3.3 於 `boardSignatureActions.ts` 新增 `fetchBoardReviewSignatures(applicationId)`：回傳 `{ currentHash, members: Array<{ signerUserId, name, account, status: 'signed'|'invalid'|'pending', signedAt, thumbnail }> }`；以 LEFT JOIN `board_review_signatures` on (application_id, signer_user_id in current group members) 查；status 由 hash 比對決定（實作 spec「Fetch signatures with validity state」全部 scenarios）
- [x] 3.4 於 `boardSignatureActions.ts` 新增 internal helper `clearStaleSignatures(client, applicationId, reason)`：在傳入的事務 client 內 DELETE + 寫 audit `board_review.signatures_invalidated` with `detail.reason / invalidated_user_ids`（實作 spec「Signature invalidation on content change」與「...on reassignment」全部 scenarios 的共用後端，對應 design「簽章失效的觸發點」）
- [x] 3.5 修改 `src/app/actions/boardGroupActions.ts` 之 `saveBoardReviewDraft`：於事務內「若 `changedFields.length > 0` 後」、在 audit log 寫入前，呼叫 `clearStaleSignatures(client, applicationId, 'content_changed')`（實作 spec「Signature invalidation on content change」之「Save with change invalidates」scenario）
- [x] 3.6 修改 `src/app/actions/boardGroupActions.ts` 之 `assignCaseToBoardGroup`：於重派路徑（reassigned=true）的 UPDATE 之後、COMMIT 之前，呼叫 `clearStaleSignatures(client, applicationId, 'reassigned')`（實作 spec「Signature invalidation on reassignment」scenario）

## 4. Server-side 守門：推進與結案

- [x] 4.1 修改 `src/app/actions/workflowActions.ts` 之 `advanceWorkflowStage`：當 `fromStage === 'board_review'` 且 `toStage === 'reimbursement'`，依 design「守門點：server-side 在 `advanceWorkflowStage` / `closeCaseRejected`，前端只做 UX」，於事務內、在 UPDATE applications.status 之前加雙重 SELECT 驗證之 SQL 範例），計算 `memberCount` vs `validCount`（hash 相符且 signer 為當前組員）；若不等或 memberCount=0 → ROLLBACK 並回 `{ success: false, error: '尚有 X 位組員未簽署（或簽章已因內容變動失效）' }`（實作 spec「Stage advance and close-rejected require full signatures」之 advance scenarios）
- [x] 4.2 修改 `src/app/actions/workflowActions.ts` 之 `closeCaseRejected`：若呼叫時案件 `application_workflow.stage === 'board_review'`，加同樣的簽章完整性守門（在 UPDATE applications.status='2' 之前）；拒絕條件同 4.1（實作 spec「Stage advance and close-rejected require full signatures」之 close-rejected scenario）

## 5. 前端 UI：簽章元件

- [x] 5.1 新增元件 `src/components/BoardSignaturePanel.tsx`：props `{ applicationId, currentUserId, onChange? }`；呼叫 `fetchBoardReviewSignatures` 顯示每位當前組員的狀態 badge（signed/invalid/pending）；若 currentUser 是該列成員且狀態非 'signed'，顯示「簽章」或「重新簽章」按鈕；按下開啟簽章 modal（實作 spec「Signature panel UI」之列表與按鈕 scenarios）
- [x] 5.2 於 `BoardSignaturePanel.tsx` 內實作簽章 modal：`react-signature-canvas` 畫布 400x200、清除鈕、密碼 input（type=password）、送出鈕；client-side 驗證（簽名不可空白 + 密碼不可空白）；送出呼叫 `submitBoardSignature`；失敗顯示錯誤；成功關閉 modal 並 refetch panel（實作 spec「Signing modal requires both drawing and password」與「Successful signing refreshes panel」scenarios）

## 6. 前端 UI：整合到詳情頁

- [x] 6.1 修改 `src/App.tsx` 案件詳情：依 design「UI 佈局」，當 `appDetail.stage === 'board_review'` 時於 `<BoardVoteCard>` 下方、董事審核區塊上方渲染 `<BoardSignaturePanel applicationId={selectedAppId} currentUserId={loggedInUser.id} onChange={() => loadAppDetail(selectedAppId, true)} />`（實作 spec「Signature panel UI」之 visibility scenario）
- [x] 6.2 修改 `src/App.tsx` 的「通過 / 不通過結案」按鈕：新增 `boardSignatureComplete` state（從 `fetchBoardReviewSignatures` 回傳計算）；disable 條件加上 `isBoardReview && !boardSignatureComplete`，tooltip 顯示「尚有 X 位組員未簽章」（實作 spec「Advance buttons gated by signature completeness」全部 scenarios）
- [x] 6.3 修改董事審核區塊的「儲存」按鈕：按下前，若當前有任一簽章存在（`signatures.length > 0`），先顯示 `confirm('修改會使 N 個已簽名失效，確認繼續？')`；拒絕則不呼叫 `saveBoardReviewDraft`（實作 spec「Pre-edit confirmation when signatures exist」全部 scenarios）

## 7. 驗證

- [x] 7.1 手動測試（單人簽章）：board_02 登入派到 G2 的案件詳情 → 看到 panel 自己狀態 pending → 按「簽章」→ 畫簽名、輸入錯誤密碼 → 被擋；輸入正確密碼 → 成功；panel 狀態變 signed、audit_logs 有 `signature_added` 一筆含 content_hash
- [x] 7.2 手動測試（推進卡控）：G2 有 2 位組員；只有 board_02 簽 → 按「通過」disabled、tooltip 顯示「尚有 1 位組員未簽章」；前端繞過直接呼叫 `advanceWorkflowStage` → 回錯「尚有 1 位組員未簽署」、案件 status 未變
- [x] 7.3 手動測試（全員簽 + 推進）：board_03 也簽 → 按「通過」enable → 點下 → case 進入 reimbursement、status='3'
- [x] 7.4 手動測試（內容異動作廢）：全員簽完但按「通過」前，chairman 編輯 comments 欄位 + 儲存（confirm dialog 提示會作廢 2 個簽章 → 確認）→ panel 兩個 row 變回 pending、audit_logs 有 `signatures_invalidated` + `reason='content_changed'` + `invalidated_user_ids` 陣列
- [x] 7.5 手動測試（重派作廢）：某案派 G2，board_02 + board_03 都簽；chairman 重新指派給 G1 → 原兩筆簽章被 DELETE、audit `reason='reassigned'`；panel 顯示 G1 新成員 pending
- [x] 7.6 手動測試（新增組員後卡住）：某案派 G2（僅 board_02），board_02 已簽並推進前暫停；chairman 在 AdminPanel 的「董事組別管理」把 board_03 加入 G2 → 回詳情頁 `fetchBoardReviewSignatures` 顯示 board_03 pending；「通過」按鈕 disabled、server 呼叫也被擋
- [x] 7.7 執行 `npm run build` 確認 TypeScript 通過、執行 `npm run lint` 無新 error（`react-signature-canvas` 需 `'use client'`，確認 modal 元件有標註）
