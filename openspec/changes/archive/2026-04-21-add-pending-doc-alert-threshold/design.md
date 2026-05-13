## Context

系統目前透過 `fetchPendingDocAlerts(officerId)`（`src/app/actions/pendingDocAlertActions.ts`）動態計算「自申請日起超過 `pending_doc_alert_days` 天且仍有缺件」的案件，並在 `HomePage` 與 `CaseListPage` 顯示警示。承辦人可透過 `SendNotificationModal` 透過 SMTP 發送 Email 給申請人，每筆送出寫入 `notification_logs`（`scripts/init_db.sql` line 189-202），但目前沒有任何欄位區分「該封信是否為未補件提醒」，也沒有「累計幾次未補件提醒」的概念。

本次變更要在不改動既有 `pendingDocAlert` 邏輯的前提下，新增一條獨立的「達門檻提醒」資訊流，並讓承辦人可在 UI 直接以「不通過結案」收尾。

## Goals / Non-Goals

**Goals:**

- 系統可記錄並查詢「每案件的未補件提醒通知次數」。
- 後台可調整門檻值（預設 3）。
- 達門檻案件在承辦人 `HomePage`、`CaseListPage`、`CaseDetailPage` 三處可被識別。
- 在達門檻案件詳情頁提供「以不通過結案」的快捷操作，並要求填寫結案原因。
- 計數來源來自既有 `notification_logs`，不引入第二份事實。

**Non-Goals:**

- 不自動結案；門檻達到只是「建議」，最終仍由承辦人手動觸發 `closeCase`。
- 不對主管／董事推播通知（首版只在承辦人介面提示）。
- 不變更現有 `fetchPendingDocAlerts`（缺件警示）行為。
- 不支援 SMS/站內訊息渠道；本次仍以 Email 為唯一計入管道。
- 不做歷史 `notification_logs` 的 backfill 標記；新欄位以 `DEFAULT FALSE` 起算。

## Decisions

### 計數來源：在 `notification_logs` 新增旗標欄位 `is_pending_doc_reminder`

**選擇**：於 `notification_logs` 新增 `is_pending_doc_reminder BOOLEAN NOT NULL DEFAULT FALSE`，由 `sendNotificationEmail` 寫入時帶旗標。`fetchPendingDocThresholdAlerts` 以 `COUNT(*) FROM notification_logs WHERE application_id = $1 AND is_pending_doc_reminder = TRUE AND status = 'sent'` 計算。

**Alternatives considered**：

1. *在 `applications` 表新增 `pending_doc_reminder_count INT`*：每次發送時 +1。優點：讀取快；缺點：需事務一致性、修正錯誤發送難（需手動減）、撤回 Email 時資料會偏差。
2. *新建 `pending_doc_reminders` 獨立表*：靈活、可記錄更多 metadata；缺點：對於本需求屬過度設計，且 `notification_logs` 已是事實來源，會造成重複。
3. *以 `notification_templates.category = 'pending_doc'` 推斷*：缺點：依賴範本設定一致性、若使用者用其他範本發提醒就漏算。

採用旗標方案：保留單一事實來源、可在後台或 SQL 修正錯誤標記、零冗餘。

### 是否計入由發送者勾選

`SendNotificationModal` 的勾選框預設值規則：

- 若案件目前處於「未補件警示」狀態（`fetchPendingDocAlerts` 命中該案）→ 預設勾選 `true`
- 否則 → 預設勾選 `false`

承辦人可手動覆寫。寫入 `notification_logs.is_pending_doc_reminder` 一律以最終勾選值為準。理由：避免系統自動把所有 Email 都當成提醒，也避免承辦人忘記勾選。

### 門檻設定鍵：`pending_doc_notification_threshold`

新增至 `system_settings`，預設 `'3'`，型別 string（與既有 `pending_doc_alert_days` 一致）。`ensureDefaultSettings` 補入。

### UI 與快捷結案操作

- **HomePage**：新增區塊「達補件提醒門檻案件」，列出案件清單（連結到詳情頁），紅色 badge 顯示總數。位置在現有「未補件警示」之下、獨立區塊。
- **CaseListPage**：新增 filter checkbox「已達補件提醒門檻」（與既有篩選器並列），符合者於 row 顯示橘色 badge `已提醒 N 次`。
- **CaseDetailPage**：頂部資訊列顯示「未補件提醒已發送 N / M 次」（M = 門檻）。達門檻時於頂部顯示紅色橫幅，含「以不通過結案」按鈕。按鈕點擊後彈出 modal 要求填寫結案原因（必填，至少 5 字），確認後呼叫 `closeCase(applicationId, '2', reason)`。

### 稽核

- `notification_logs` 寫入時若 `is_pending_doc_reminder = TRUE`，`audit_logs.detail` 內紀錄 `pending_doc_reminder: true`（沿用既有 `notification.send` action）。
- 「以不通過結案」操作寫入新 audit action `pending_doc.threshold_close`，target = applicationId，detail 含 reminder count、結案原因、發送提醒最後時間。需更新 `src/app/actions/auditActions.ts` 的 `AuditAction` 聯合型別。

## Risks / Trade-offs

- **承辦人忘記勾選旗標** → 計數偏低，導致永遠不達門檻 → Mitigation：當案件命中未補件警示時預設勾選 + UI 文案提示「此 Email 將計入未補件提醒次數」；後台可在 `notification_logs` 直接 SQL 修正。
- **歷史通知不計入** → 新功能上線時所有案件計數從 0 開始 → Mitigation：可接受（首版屬過渡期）；如有需要未來可寫一次性 backfill 腳本，依 `template_id` 或 `subject like '%補件%'` 標記。
- **動態 COUNT 在大量資料時效能** → `notification_logs` 已對 `application_id` 隱含查詢，新增複合索引 `(application_id, is_pending_doc_reminder, status)` 緩解。
- **「不通過結案」不可逆** → 操作前 modal 需顯著警示 + 必填理由（≥5 字），由現有 `closeCase` 寫入 `application_workflow.note` 與 audit log 雙重保存。
- **與既有 `pending_doc_alert_days` 概念混淆** → 文案上區分：「天數警示」=「該案多久沒補件」、「次數提醒」=「已催件幾次」。SettingsPanel 中放在同一區塊但分開 label。
