## Context

現行系統（已歸檔之 `add-multi-stage-disbursement-review`）已建立 4 階段 `review_stage` 流程、`payment_disbursements` 表、串行守門 unique partial index、SecureFilePreviewModal 紙本掃描檢視。在此基礎上，業務端再行確認以下不足：

- 文件審核機制尚未區分「全案共用文件」與「每筆撥款專屬文件」；目前 `application_documents` 全為 case-level，導致醫療收據／領款收據在多筆撥款情境下無法明確歸屬。
- 各審核階段的【送出】條件僅靠 server-side `rolesForStage()` 判定權限，沒有具體業務檢核項；操作者無法在 UI 上看到「我這關到底要確認哪幾件事」。
- 申請人寄送領款收據的觸發點原為 `advanceWorkflowStage` 進入 `reimbursement` 時自動發送（`payment-receipt-auto-mailer`），單筆模型可行；但分批撥款下，每筆都要重新寄一份，自動觸發機制無法支援。
- 會計階段三個獨立列印按鈕（`reimbursement-document-printing`）不便於一次列印整套，會計需要彈性勾選並合併。
- 各角色看不到累計撥款金額，每次都要回頭查；結案時也沒有跨角色可見的明確標示。

## Goals / Non-Goals

**Goals:**

- 釐清每份核銷文件的 scope 與上傳責任歸屬，使資料模型可正確支援多次撥款。
- 為每個撥款審核階段建立 checklist，並讓【送出】／【完成】按鈕在 checklist 完成前 disabled。
- 撥款面板任意角色階段都能看到核定金額／已撥款累計／剩餘可撥三個指標。
- 個管師取得對「產生／檢視／寄信／掃描回填」的完整自助權，移除舊有的自動寄信耦合。
- 會計列印改為勾選清單 + 合併單一 PDF，並寫 audit log。
- 撥款完成時主動通知所有相關人員。

**Non-Goals:**

- 不變更 4 階段 `review_stage` 順序或語意（`'1'`/`'2'`/`'3'`/`'4'`/`'9'`/`'X'`）。
- 不調整 `notification_channels` 與 `notification_logs` 之 schema。
- 不改寫已歸檔 `add-multi-stage-disbursement-review` 既有 server actions 之函式簽章；偏好以新增欄位／新增 action 方式擴充。
- 不重構 `template_files` 模型；領款收據 PDF 沿用現行範本套印機制。
- 不為應用程式既存 `application_documents` 列做大規模回填——僅新增可空欄位 + scope 預設值。

## Decisions

### Decision 1：以 `disbursement_id` nullable 欄位處理 case vs disbursement scope

採用「同一張表 + 可空 FK」方案，而非新建 `disbursement_documents` 表。

**理由**：

- `application_documents` 既有的審核狀態欄位（`status`、`reviewed_by`、`reviewed_at`、檔案儲存元資料）對 case-level 與 disbursement-level 文件需求一致；複製成兩張表會造成程式碼重複。
- `document_type_config.scope` 同時提供 schema-level 守門（type-config 已限定 scope，業務層再依此挑出「該撥款應有的文件類型」），無需在表結構上分離。
- 既有 case-level 文件 row 可保持 `disbursement_id IS NULL`，免於資料遷移。

**替代方案**：另建 `disbursement_documents` 表 — 拒絕，因為文件審核流程要重複實作一遍。

### Decision 2：checklist 採用 `payment_disbursements` 多 boolean 欄位

每個 checklist 項目對應一個 boolean 欄位，而非 JSONB 陣列或關聯表。

**理由**：

- 檢核項目少（個管 1 項、主管 1 項、會計 4 項、執行長 1 項，共 7 項），固定不會動態增刪。
- Boolean 欄位在 SQL 守門 / WHERE 過濾上最直觀，避免 JSON path 操作。
- 與既有 `payment-disbursement-multi-stage-review` 既存的「stage 切換時驗證」風格一致。

**替代方案**：JSONB checklist —— 拒絕，因檢核項固定且需嚴格守門，型別損失大於彈性。

### Decision 3：合併列印走 server-side route，client 不做 PDF 拼接

新增 `POST /api/disbursement-print`：body 含 `disbursementId` 與 `documents: ('opinion'|'medical'|'payment')[]`，server 端讀取對應檔案、合併成單一 PDF（用 `pdf-lib` 或既有工具），回傳 `application/pdf` stream。

**理由**：

- 來源檔案可能是 PDF／JPG／PNG 混合，client 端要做 image→PDF 轉換 + 合併不易。
- 私有檔案儲存（Vercel Blob 或本地）不應在 client 直接讀取，server 端可做權限檢查（accountant/admin only）。
- audit log 要在 server 寫，順道在這個 route 內完成。

**替代方案**：client 端用 `pdf-lib` 拼接 —— 拒絕，存取私有檔案 URL 過於暴露，且 image 處理在 client 體驗差。

### Decision 4：移除 `payment-receipt-auto-mailer` 自動觸發但保留事件名稱與派送基礎建設

`advanceWorkflowStage` 進入 `reimbursement` 不再自動觸發；改由個管師手動觸發 `case_payment_receipt_to_applicant`（同一事件名）。

**理由**：

- 事件派送邏輯（notification_channels / templates / logs）已成熟，重用避免重造輪子。
- 同一事件可在後端疊加新 metadata（如「第 N 次撥款金額」），讓模板渲染分批資訊。
- 保留事件名也讓既有訂閱方（如 LINE 推播）無痛延續。

**替代方案**：用全新事件名 —— 拒絕，無實質好處還要遷移既有 channel 訂閱。

### Decision 5：完成時通知派送限定當筆撥款相關角色

只通知「該撥款」記錄上的 case_officer / supervisor / accountant 與申請人，不通知整案歷次參與者。

**理由**：

- 多次撥款下，歷次參與者可能不同；通知範圍過廣會干擾。
- `payment_disbursements` 已記錄該筆各 stage 簽署者 user_id（`officer/supervisor/accountant/executive_user_id`），直接取用即可。

### Decision 6：第 N 次撥款序號以 `created_at` 為準，UI 計算

不在 DB 新增 `seq_no` 欄位；UI 排序 + 索引顯示。

**理由**：

- 串行守門已保證同一案件一次只能進行一筆，`created_at` 排序不會亂跳。
- 取消／作廢撥款（若未來支援）以 status 標示，序號仍以 created_at 計即可。

### Decision 7：存摺封面影本走既有 `document_type_config` 機制

`scope='C'`、`phase='reimbursement'`、`is_required=true`、`allow_supplement=true`，案件 `status='3'` 後 UI 解鎖；補件警示沿用 `pending_doc_alert_days`。

**理由**：與其他 case-level 必備文件流程一致，不需另寫上傳路徑。

## Risks / Trade-offs

- **既有資料遷移**：`document_type_config.scope` 加欄位需給既有列預設 `'C'`；`application_documents.disbursement_id` 為 nullable 不需回填。風險低。→ Mitigation：migration 一律 `IF NOT EXISTS` + `DEFAULT 'C'`。
- **多次列印 PDF 合併效能**：若文件量大（多頁掃描），server merge 可能慢。→ Mitigation：列印按需執行（accountant 點擊才觸發），無快取需求；若效能成為瓶頸再加。
- **個管寄信失敗時的撥款狀態**：寄信失敗不能阻擋撥款流程，但個管【送出】時要看到失敗 badge 並知道要重試。→ Mitigation：寄信非同步（fire-and-forget），UI 以 `notification_logs.last_status` 反映；【送出】守門僅檢查「最近一次寄信成功」。
- **舊 `payment-receipt-auto-mailer` 訂閱者**：移除 advance 自動觸發後，若有外部系統依賴此事件會中斷。→ Mitigation：事件名保留，個管手動觸發產生同一事件，下游無感。
- **checklist UI 與 server 一致性**：client 與 server 兩端都要驗證 7 個 boolean。→ Mitigation：抽出共用驗證函式 `validateStageChecklist(stage, row)` 於 server action 與 client 守門共用（透過 `lib/` 模組）。
- **歷史收據檢視權限縮限**：將「歷史收據」按鈕僅給 accountant 後，其他角色排查問題時可能不便。→ Mitigation：管理員（admin）若有 accountant 兼任時自然可看；單純排查可由系統設定面板 / audit log 反查。

## Migration Plan

1. **DB migration**（冪等 SQL，全部走 `scripts/init_db.sql`）
   1. `ALTER TABLE document_type_config ADD COLUMN IF NOT EXISTS scope CHAR(1) NOT NULL DEFAULT 'C';`
   2. `ALTER TABLE application_documents ADD COLUMN IF NOT EXISTS disbursement_id BIGINT REFERENCES payment_disbursements(id);`
   3. `ALTER TABLE payment_disbursements` 增加 7 個 boolean 檢核欄位（皆 `DEFAULT FALSE`）。
   4. `INSERT ... ON CONFLICT DO NOTHING` 新增「存摺封面影本」`document_type_config` 列（scope='C', phase='reimbursement'）。
   5. `INSERT ... ON CONFLICT DO UPDATE` 將「醫療收據」「領款收據」既有 `document_type_config` 列的 scope 改為 `'D'`。
   6. `INSERT ... ON CONFLICT DO NOTHING` 新增 system_settings：`disbursement_reject_reason_min_chars` = 10。
   7. `INSERT ... ON CONFLICT DO NOTHING` 新增 notification_template `disbursement_completed`。
2. **Server actions**：依序加上 checklist 欄位讀寫、會計列印 route、個管 mailer action；移除 `advanceWorkflowStage` 內 `case_payment_receipt_to_applicant` 自動觸發呼叫。
3. **UI**：`DisbursementPanel` 重構分區（summary 卡片 / 各階段 checklist / 個管三步驟 / 會計列印勾選）；`ReviewList` 加 scope filter。
4. **Spec 修訂**：歸檔時自動更新 `payment-receipt-auto-mailer`、`reimbursement-document-printing` 既有 spec 的 Requirements。

**Rollback 策略**：欄位新增為 nullable / DEFAULT，若功能撤回可僅將 UI 隱藏，DB 欄位保留無害；移除事件自動觸發是 BREAKING，rollback 需復原該段呼叫並重新 deploy。

## Open Questions

- 個管寄信時，附件 PDF 是「一次性下載連結」還是「直接夾帶 base64 附件」？暫定夾帶 base64（與既有 LINE / Email 模板渲染一致），實作時再確認 SMTP 大小限制。
- 會計列印的 audit log 中是否要記錄「列印了哪幾項」？暫定記錄 `selected: ('opinion','medical','payment')[]` 至 audit detail，方便日後對帳。
- 撥款【作廢／取消】是否在本變更範圍內？暫不處理，`Non-Goals` 已排除；未來如需新增另起 change。
