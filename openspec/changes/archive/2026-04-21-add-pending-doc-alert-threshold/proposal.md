## Why

目前系統僅會在「未補件警示」中列出有缺件的案件（`fetchPendingDocAlerts`），但不會記錄「承辦人已對申請人發了幾次補件提醒」。實務上，承辦人需要憑記憶或翻閱通知歷史才能判斷某案件是否已多次催件未果、是否該以不通過結案，造成決策延遲與案件積壓。

導入「未補件通知次數門檻」機制，讓系統自動標記達到提醒上限（後台可調，預設 3 次）的案件，並在承辦人首頁與案件清單中顯著提醒，附上「以不通過結案」的快捷操作建議，有助於明確結案決策、避免案件無限期擱置。

## What Changes

- 新增系統設定 `pending_doc_notification_threshold`（預設 `3`），於後台「系統設定」可調整。
- 在 `notification_logs` 增加欄位 `is_pending_doc_reminder BOOLEAN DEFAULT FALSE`，標記該筆通知是否屬於「未補件提醒」。
- `SendNotificationModal` 新增「此為未補件提醒」勾選框（預設依案件目前是否處於未補件狀態自動勾選），由發信端決定是否計入次數。
- 新增 server action `fetchPendingDocThresholdAlerts(officerId)`：回傳該承辦人轄下「達門檻且案件仍未結案」的案件清單（含已發次數、最近一次發送時間、缺件數）。
- `HomePage` 新增「達補件提醒門檻案件」區塊（紅色 badge），顯示計數。
- `CaseListPage` 新增 filter「已達補件提醒門檻」，符合者於 row 顯示橘色 badge `已提醒 N 次`。
- 案件詳情頁（`CaseDetailPage`）顯示「未補件提醒已發送 N 次」資訊，並在達門檻時於頂部顯示建議橫幅「建議以不通過結案」+「立即結案」按鈕（呼叫現有 `closeCase` 並設 `status='2'`，需要承辦人填寫結案原因）。
- 稽核：標記為未補件提醒的通知、達門檻提示的開啟與「以不通過結案」操作皆寫入 `audit_logs`。

## Non-Goals (optional)

無（design.md 將進一步補完設計考量與替代方案）。

## Capabilities

### New Capabilities

- `pending-doc-alert-threshold`: 累計每案件的未補件提醒通知次數，達後台可設定門檻時於 UI 醒目提醒承辦人並提供結案快捷建議。

### Modified Capabilities

(none)

## Impact

- **Affected specs**：新增 `specs/pending-doc-alert-threshold/spec.md`
- **Affected code**：
  - `scripts/init_db.sql`：`notification_logs` 新增欄位、`system_settings` 新增 key
  - `src/app/actions/notificationActions.ts`：`sendNotificationEmail` 接收 `isPendingDocReminder` 參數並寫入欄位
  - `src/app/actions/pendingDocAlertActions.ts`：新增 `fetchPendingDocThresholdAlerts`
  - `src/app/actions/settingsActions.ts`：`ensureDefaultSettings` 加入新預設值
  - `src/components/HomePage.tsx`：新增「達門檻案件」區塊
  - `src/components/CaseListPage.tsx`：新增 filter 與 row badge
  - `src/components/SendNotificationModal.tsx`：新增勾選框
  - `src/components/SettingsPanel.tsx`：暴露新設定的編輯欄位
  - `src/App.tsx` 的 Detail / Workflow view 區塊（本專案案件詳情 inline 於此，無獨立 `CaseDetailPage.tsx`）：顯示計數與結案建議橫幅
  - `src/app/actions/auditActions.ts`：擴充 `AuditAction` 聯合型別（新增 `pending_doc.threshold_close_suggested`）
- **Dependencies**：無新增 npm 套件
- **資料移轉**：既有 `notification_logs` 欄位以 `DEFAULT FALSE` 補齊，無需手動 backfill
