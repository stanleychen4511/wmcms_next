## 1. 資料庫 Schema 與設定

- [x] 1.1 於 `scripts/init_db.sql` 在 `notification_logs` 區塊「下方」（不要改 `CREATE TABLE`，沿用既有 `allow_supplement` line 70-71 模式）追加：`ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS is_pending_doc_reminder BOOLEAN NOT NULL DEFAULT FALSE;` 與 `CREATE INDEX IF NOT EXISTS idx_notif_logs_pending_doc ON notification_logs (application_id, is_pending_doc_reminder, status);`（實作「計數來源：在 `notification_logs` 新增旗標欄位 `is_pending_doc_reminder`」與 spec「Notification flag for pending-doc reminders」）
- [x] 1.2 於 `scripts/init_db.sql` 之 `system_settings` seed `INSERT ... ON CONFLICT DO NOTHING` 加入 `('pending_doc_notification_threshold', '3', '...')`，同時於 `src/app/actions/settingsActions.ts` 之 `ensureDefaultSettings` 補入相同預設值（實作「門檻設定鍵：`pending_doc_notification_threshold`」與 spec「Configurable pending-doc notification threshold」）
- [x] 1.3 對所有現行環境執行 `psql $DATABASE_URL -f scripts/init_db.sql` 完成 schema 同步：(a) 主庫 `wmcms`（透過 MCP `pg_wmcms` 或 psql 直連）；(b) demo 庫 `wmcms_demo`（透過 MCP `pg_wmcms_demo`）。執行後用 `\d notification_logs` 驗證新欄位存在、`SELECT value FROM system_settings WHERE key='pending_doc_notification_threshold'` 應回 `'3'`

## 2. 後端 Server Actions

- [x] 2.1 修改 `src/app/actions/notificationActions.ts`：`sendNotificationEmail` 新增參數 `isPendingDocReminder: boolean`，寫入 `notification_logs.is_pending_doc_reminder`，並於 `audit_logs.detail` 加入 `pending_doc_reminder` 欄位（實作「稽核」與 spec「Audit trail for reminder marking and threshold close」、Notification flag for pending-doc reminders）
- [x] 2.2 在 `src/app/actions/pendingDocAlertActions.ts` 新增 `fetchPendingDocThresholdAlerts(officerId)`：以 `system_settings.pending_doc_notification_threshold` 為門檻，回傳該承辦人未結案、且 `is_pending_doc_reminder` 通知計數 ≥ 門檻的案件清單（含 reminderCount、lastReminderAt、missingCount）（實作 spec「Threshold-reached query for case officers」）
- [x] 2.3 於 `src/app/actions/auditActions.ts` 之 `AuditAction` 聯合型別新增 `'pending_doc.threshold_close'`（實作 spec「Audit trail for reminder marking and threshold close」）
- [x] 2.4 於 `src/app/actions/applicationActions.ts`（或對應位置）建立 wrapper / 確認 `closeCase(applicationId, '2', reason)` 可接受結案原因，並在被「不通過結案」按鈕呼叫時寫入 `pending_doc.threshold_close` audit log

## 3. 前端 UI

- [x] 3.1 修改 `src/components/SettingsPanel.tsx`：在「補件警示」區塊下方暴露 `pending_doc_notification_threshold` 編輯欄位，含說明文案區分「天數警示」與「次數提醒」（實作「門檻設定鍵：`pending_doc_notification_threshold`」）
- [x] 3.2 修改 `src/components/SendNotificationModal.tsx`：新增「此為未補件提醒」勾選框，預設值依 `fetchPendingDocAlerts` 是否命中該案件決定，提交時將值傳給 `sendNotificationEmail`（實作「是否計入由發送者勾選」與 spec「Notification flag for pending-doc reminders」之 default checkbox scenarios）
- [x] 3.3 修改 `src/components/HomePage.tsx`：呼叫 `fetchPendingDocThresholdAlerts`，新增「達補件提醒門檻案件」紅色 badge 區塊與案件列表連結（實作 spec「Visual surfacing of threshold-reached cases」之 home page scenario）
- [x] 3.4 修改 `src/components/CaseListPage.tsx`：新增 filter「已達補件提醒門檻」，符合者於 row 顯示橘色 badge `已提醒 N 次`（實作 spec「Visual surfacing of threshold-reached cases」之 case list scenario）
- [x] 3.5 修改案件詳情元件：頂部顯示「未補件提醒已發送 N / M 次」，達門檻時顯示紅色橫幅「建議以不通過結案」+「立即結案」按鈕，並彈出結案原因 modal（≥5 字驗證），確認後呼叫 closeCase 並寫 audit log（實作「UI 與快捷結案操作」與 spec「Reject-and-close suggestion banner」）

## 4. 驗證

- [x] 4.1 手動測試：建立測試案件，依序送出 1/2/3 封 reminder Email，確認 HomePage、CaseListPage badge、CaseDetailPage 計數與橫幅出現時機正確
- [x] 4.2 手動測試：透過 SettingsPanel 將門檻調為 5，確認原本達 3 次的案件不再出現於門檻清單；調回 3 後立即重新出現（驗證 spec「Threshold change reflected immediately」scenario）
- [x] 4.3 手動測試：點擊「立即結案」未填理由 / 少於 5 字應被拒絕；填妥後成功結案、`audit_logs` 出現 `pending_doc.threshold_close`、案件不再出現於門檻清單與橫幅
- [x] 4.4 執行 `npm run build` 與 `npm run lint`，確認 TypeScript 嚴格模式通過、無 lint 錯誤
