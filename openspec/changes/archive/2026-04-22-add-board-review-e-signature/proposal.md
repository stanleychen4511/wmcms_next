## Why

剛完成的「董事組別共筆審核」允許任一組員代表編輯審核結果並推進案件，但推進行為**只驗權限，不驗「組員是否皆同意該結論」**。實務上董事會決議須有全員書面簽章作為法律依據，才能對外、對主管機關（衛福部、國稅局）出具審核紀錄。

目前系統無法：
1. 蒐集每位組員對某案件的個別簽章（手寫圖像 + 身份確認）。
2. 驗證簽章時的案件內容與簽章後是否一致（防止事後竄改後濫用舊簽章）。
3. 在「通過」「不通過結案」前強制卡關「全員簽完才可推進」。

本 change 導入**內部電子簽章**（依《電子簽章法》第 9 條「當事人同意採用」之效力），達到合理的合規水準，且零外部授權成本（使用 MIT license 套件 + 專案既有 Node.js crypto）。

## What Changes

### 資料模型

- 新增資料表 `board_review_signatures`：`application_id` + `signer_user_id`（複合 PK）、`signature_data_url`（base64 PNG）、`content_hash`（SHA-256 hex）、`signed_at`、`user_agent`、`ip_address`（後兩項佐證用）。
- **不**變更既有欄位；不變更 `applications.approved_amount` / `application_workflow.comments / is_approved` 的寫入路徑（仍由 `saveBoardReviewDraft` 處理）。

### Server actions（新檔 `boardSignatureActions.ts`）

- `computeBoardReviewContentHash(applicationId)`：以固定順序把 `approved_amount / comments / is_approved / board_review_assignments.group_id` 串成字串後 SHA-256；回傳 hex。**純讀**，供 UI 與簽章寫入比對用。
- `submitBoardSignature(applicationId, signatureDataUrl, password, operatorUserId)`：事務內驗證
  - (a) stage='board_review' AND status='1'
  - (b) case 有 assignment
  - (c) operator 為該組當前成員
  - (d) 重新雜湊 operator 的登入密碼 → 與 `users.password` 比對
  - (e) 計算當前內容 hash → 與 `signatureDataUrl` 要附的 hash 一致（防止前端在「取 hash 到送出」中間內容被別人改掉）
  - 通過後 UPSERT `board_review_signatures`（一位一筆，可覆寫重簽）；寫 audit `board_review.signature_added`。
- `fetchBoardReviewSignatures(applicationId)`：回傳當前 hash + 每位組員（當前 group_members）對應的簽章紀錄（可能 NULL=未簽、或 hash 不符=失效）。
- `clearStaleSignatures(applicationId, reason)`：內部函式。於內容異動或重派時由相關 action 呼叫，DELETE 所有 signatures 並寫 audit `board_review.signatures_invalidated` + `reason`。

### 既有 server actions 調整

- `saveBoardReviewDraft`：於「實際有欄位變動」時，於同一事務內呼叫 `clearStaleSignatures(applicationId, 'content_changed')`。
- `assignCaseToBoardGroup`（重派路徑）：於 UPDATE assignment 之後呼叫 `clearStaleSignatures(applicationId, 'reassigned')`。
- `advanceWorkflowStage`（當 fromStage='board_review' 且目標為 reimbursement）與 `closeCaseRejected`（從 board_review 呼叫時）：加事務內守門 —— SELECT 當前組員清單與 signatures 數，必須**每位當前組員皆有 signature_row 且 content_hash 與當前重算結果一致**才允許推進；否則 ROLLBACK 並回 `{ success: false, error: '尚有 X 位組員未簽署（或簽章已因內容變動失效）' }`。

### AuditAction 擴充

- 新增：`board_review.signature_added`、`board_review.signatures_invalidated`

### 前端 UI

- 新增元件 `src/components/BoardSignaturePanel.tsx`：
  - 顯示每位當前組員的簽章狀態（已簽 + 時間 + 縮圖 / 未簽 / 失效）。
  - 若 `currentUser` 是當前組員且自己尚未簽（或簽章失效），顯示「開始簽章」按鈕 → 開啟簽章 modal。
  - 簽章 modal：`react-signature-canvas` 畫布、清除鈕、「確認送出」按鈕、密碼輸入欄；送出時一起傳 signatureDataUrl + password。
- 修改「通過 / 不通過結案」按鈕（App.tsx 案件詳情）：若 stage='board_review'，加上「全員簽章完畢」的前置條件；未滿足時 disabled + tooltip「尚有 X 位組員未簽」。
- `BoardVoteCard` 或詳情頁最上方顯示整體簽章狀態摘要（`2 / 3 人已簽`）。
- `saveBoardReviewDraft` 儲存成功時前端也要刷新簽章狀態（理論上已經 DELETE 了，所有位置重新顯示「未簽」）。

## Non-Goals (optional)

- 不導入 PKI / 第三方 CA（TWCA、綠界電子簽章等）。這是未來若要對外部公文使用時才升級的層級。
- 不支援除了密碼以外的第二驗證（OTP、TOTP、生物辨識）；首版密碼足夠達「電子簽章法第 9 條當事人同意」之效力，之後若要提升可另做 change。
- 不做「看簽章細節」的獨立管理頁；簽章狀態集中於案件詳情頁呈現即可。
- 不記錄「簽章 metadata 的多版本歷史」（例如某董事先簽了失效、後來又簽一次）；每位組員保留最新一筆，先前作廢的可由 `audit_logs` 追溯（action=`board_review.signatures_invalidated` 含 invalidated_rows 陣列）。
- 不做簽章圖像的解析 / 圖形比對（「這簽名真的像那個人嗎」）；身份以登入密碼為準。
- 不支援匿名簽名、代簽、組長統籤。

## Capabilities

### New Capabilities

- `board-review-e-signature`: board_review 階段的內部電子簽章：蒐集每位派組成員手寫簽章、密碼二次驗證、案件內容 hash 綁定；推進案件前強制卡控全員簽完且 hash 有效。

### Modified Capabilities

(none)

## Impact

- **Affected specs**：新增 `specs/board-review-e-signature/spec.md`
- **Affected code**：
  - `scripts/init_db.sql`：新增 `board_review_signatures` 表 + COMMENT
  - `src/app/actions/boardSignatureActions.ts`：新檔（4 個 server actions）
  - `src/app/actions/boardGroupActions.ts`：`saveBoardReviewDraft` 與 `assignCaseToBoardGroup` 內呼叫 `clearStaleSignatures`
  - `src/app/actions/workflowActions.ts`：`advanceWorkflowStage`（從 board_review 推進）與 `closeCaseRejected`（從 board_review 結案）加簽章完整性守門
  - `src/app/actions/auditActions.ts`：`AuditAction` 擴充 2 個字面值
  - `src/components/BoardSignaturePanel.tsx`：新元件（簽章清單 + 畫布 modal）
  - `src/App.tsx`：案件詳情 stage='board_review' 時渲染 `<BoardSignaturePanel />`；「通過 / 不通過結案」按鈕 disable 條件加「全員簽章完畢」
  - `package.json`：新增 `react-signature-canvas` 依賴
- **Dependencies**：新增 `react-signature-canvas`（MIT license，~15KB gzipped，1.8M 週下載）
- **資料移轉**：既有進行中 board_review 案件**不會**自動產生簽章需求；直到下次要推進時才會被守門擋住並提示簽章。
