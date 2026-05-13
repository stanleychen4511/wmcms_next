# 萬美基金會補助管理系統 — 角色權限說明與調整建議

> 產出日期：2026-04
> 用途：逐項檢視當前權限設計，標註需調整處

---

## 1. 9 個角色一覽

| 角色 code | 中文 | 主要職責 |
|---|---|---|
| `applicant` | 申請人 | 外部收件建立的帳號；**目前不參與系統登入流程** |
| `case_officer` | 承辦人員 | 收件、文件審核、推進初審 |
| `social_worker` | 社工人員 | 家訪填表、關懷追蹤 |
| `supervisor` | 主管 | 派案、案件統計、後台部分管理 |
| `accountant` | 會計 | 核銷階段文件審核、列印領款收據 |
| `board_member` | 董事 | 董事審核 + 簽章 |
| `chairman` | 董事長 | 派組、所有董事權限 |
| `admin` | 系統管理員 | 全部權限 |
| `volunteer` | 志工 | 關懷追蹤 |

---

## 2. 詳細權限矩陣

### 2.1 首頁與導覽

| 功能 | applicant | case_officer | social_worker | supervisor | accountant | board_member | chairman | admin | volunteer |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 登入 / 看首頁 | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 首頁「未補件」警示 |  | ✓ |  |  |  |  |  |  |  |
| 首頁「未派案」警示 |  |  |  | ✓ |  | ✓ |  | ✓ |  |
| 首頁「新增申請案件」卡片 |  | ✓ |  |  |  |  |  | ✓ |  |
| 首頁「申請案件管理」卡片 |  | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 首頁「表單下載」/「外部收件」/「個人設定」 |  | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 首頁「通知管理」 |  | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 首頁「後台管理」卡片 |  |  |  |  |  |  | ✓ | ✓ |  |
| 首頁「案件統計」卡片 |  |  |  | ✓ |  | ✓ | ✓ | ✓ |  |

### 2.2 案件主流程

| 動作 | 可執行角色 | 註 |
|---|---|---|
| 建立新案件 (`createNewApplication`) | case_officer / admin | UI gate；server action 無檢查 |
| 案件查詢 / 列表 | 全員 | UI 顯示欄位依角色而異 |
| 派承辦人（assign officer） | supervisor / board_member / admin | `lockAssign` 反向判斷：被擋的是 officer/accountant/volunteer |
| 文件審核（apply phase） | case_officer / admin |  |
| 文件審核（home_visit phase） | case_officer / admin |  |
| 文件審核（reimbursement phase） | accountant / case_officer / admin |  |
| 家訪表填寫 / 編輯 | social_worker / case_officer / admin |  |
| 派組（董事分組） | chairman / admin |  |
| 重新指派組別 | chairman / admin |  |
| 董事審核編輯草稿 | 該案派組成員 / chairman | server action 守門 |
| 董事電子簽章 | 該案派組成員 |  |
| 推進 stage | UI 沒明顯 gate（依當前 stage 角色） | **疑慮，見 §3.1** |
| 退回 stage | UI 沒明顯 gate | **疑慮，見 §3.1** |
| 結案 (`closeCase`) | 觸發路徑與推進共用 |  |

### 2.3 核銷階段專屬

| 動作 | 角色 |
|---|---|
| 「文件列印」區塊可見 | admin / accountant |
| 列印頁直接 URL 訪問 | admin / accountant（server-side gate） |
| 自動寄領款收據 PDF 給申請人 | 系統觸發（fire-and-forget），非使用者操作 |

### 2.4 後台管理（AdminPanel）

| 分頁 | 可看角色 |
|---|---|
| 帳號權限管理 | admin |
| 檔案實體位置 | admin / supervisor / board_member |
| 文件類型管理 | admin / supervisor / board_member |
| 範本檔案 | admin / supervisor |
| Banner 管理 | admin / supervisor |
| 公告管理 | admin / supervisor |
| 董事組別管理 | chairman / admin |
| 轉介單位管理 | admin |
| 系統操作紀錄（audit log） | **無 gate** — 任何進得了 AdminPanel 的人都看得到 |
| 參數設定 | admin |

### 2.5 統計與關懷

| 動作 | 角色 |
|---|---|
| 案件統計 — 看 | admin / supervisor / chairman / board_member |
| 案件統計 — drill-down | 同上 |
| 案件統計 — CSV 匯出 | 同上 |
| 關懷紀錄 — 建立 | volunteer / social_worker |
| 關懷紀錄 — 看列表 | volunteer / social_worker / admin / supervisor |
| 關懷紀錄 — 編輯 | 僅原建立者 |
| 關懷紀錄 — 刪除 | 原建立者 OR admin |

### 2.6 通知

| 動作 | 角色 |
|---|---|
| 接收 `case_entered_board_review` | 全部 chairman（手動派組模式才寄） |
| 接收 `case_assigned_to_board_group` | 該組所有 board_member（含 chairman 若在組內） |
| 接收 `case_payment_receipt_to_applicant`（含 PDF 附件） | applicant 本人 |
| 個人通知方式設定（Email / LINE） | 自己改自己 |
| 系統範本守門（不可刪 / 改名 / 停用） | 影響所有試圖操作系統範本的人 |

---

## 3. 建議調整事項（依優先序）

### 3.1 🔴 [安全] `推進 / 退回 stage` 沒有伺服端權限檢查

**現況**：`advanceWorkflowStage` 與 `retreatWorkflowStage` 兩個 server action **沒有 role gate**。理論上任何登入者只要拿到 `applicationId` 就能呼叫推進/退回。雖然 UI 按鈕只給對應角色看到，但這是經典 BOLA（Broken Object Level Authorization）。

**風險**：惡意使用者用 DevTools 打 server action endpoint，可任意推進別人的案件、跳過審核流程。

**建議**：依當前 stage 加伺服端守門：
- `admin_review` → `home_visit`：case_officer / admin
- `home_visit` → `board_review`：social_worker / case_officer / admin
- `board_review` → `reimbursement`：board_review-assigned member / chairman / admin
- `reimbursement` → 結案：accountant / admin
- 退回（任何 stage 退回）：對應上一階段角色 / admin

**相關檔案**：
- `src/app/actions/workflowActions.ts:advanceWorkflowStage`
- `src/app/actions/workflowActions.ts:retreatWorkflowStage`
- `src/app/actions/applicationActions.ts:closeCase`

**檢視結論**：[ ] 同意調整 / [ ] 維持現狀 / [ ] 其他

---

### 3.2 🔴 [安全] 「系統操作紀錄」分頁沒 role gate

**現況**：`AdminPanel` 內 `logs` tab 是唯一**沒套 `isAdmin` 檢查**的分頁。其他七個 tab 都有檢查（`isAdmin` / `canManageLocations` / `canManageTemplates` / `(isChairman || isAdmin)`），唯獨它沒有。

**風險**：audit log 含敏感操作詳情（誰改了誰、何時、改了什麼欄位）。任何進得了 AdminPanel 的人（chairman、supervisor、board_member）都看得到，**邏輯不一致**。

**建議**：加 `{isAdmin && (...)}` 守門，或改成 `admin / supervisor` 可看（兩者都負責監督）。

**相關檔案**：`src/components/AdminPanel.tsx:371`（logs tab 按鈕）

**檢視結論**：[ ] 同意調整 / [ ] 維持現狀 / [ ] 其他

---

### 3.3 🟡 [一致性] `accountant` 能審核所有 phase 的文件

**現況**：`ReviewList` 的 `canReview` 邏輯：
- `apply` phase → case_officer / admin
- `home_visit` phase → case_officer / admin
- `reimbursement` phase → **accountant / case_officer / admin**

**問題**：accountant 沒被分別擋在 reimbursement 以外的 phase。雖實際上會計只看核銷畫面所以不會接觸到，但定義上不嚴謹。

**建議**：改為 accountant 只能審 reimbursement phase 文件；apply / home_visit 不允許。

**相關檔案**：`src/App.tsx:1126-1127`

**檢視結論**：[ ] 同意調整 / [ ] 維持現狀 / [ ] 其他

---

### 3.4 🟡 [語意] 「未派案」首頁警示給 `board_member`，不太合理

**現況**：`ASSIGN_ROLES = ['supervisor', 'board_member', 'admin']`。「未派案」實際是「沒指派**承辦人**」的案件數。

**問題**：派承辦人不是 board_member 的工作（董事審查案件、不分配承辦人）。`board_member` 看到「未派案：X 筆」毫無意義。

**建議二選一**：
- **A**：改 `ASSIGN_ROLES = ['supervisor', 'admin']`
- **B**：保留 board_member，但新增獨立的「待我審的案」警示

**相關檔案**：`src/App.tsx:321`

**檢視結論**：[ ] 採方案 A / [ ] 採方案 B / [ ] 維持現狀 / [ ] 其他

---

### 3.5 🟡 [UX] `chairman` 進後台只看得到「董事組別管理」

**現況**：HomePage 讓 `chairman` 看到「後台管理」卡片，但 AdminPanel 內 7 個 tab 對 chairman 只開「董事組別管理」一個。

**問題**：chairman 點進後台會發現只剩一個分頁可看，UX 體驗差。

**建議二選一**：
- **A**：把首頁卡片改名「董事組別管理」+ 直接導 board_groups tab，chairman 不看到 AdminPanel 框架
- **B**：開放 chairman 看 audit logs（與 §3.2 取捨）+ 讓 chairman 有完整後台框架體驗

**相關檔案**：
- `src/components/HomePage.tsx:322`
- `src/components/AdminPanel.tsx:343`

**檢視結論**：[ ] 採方案 A / [ ] 採方案 B / [ ] 維持現狀 / [ ] 其他

---

### 3.6 🟡 [安全] `createNewApplication` server action 沒做角色檢查

**現況**：UI 限定 case_officer / admin 才能看到「新增申請案件」卡片，但 `createNewApplication` server action **沒守門**。任何登入者用 DevTools 打 server action 即可建案。

**建議**：在 `createNewApplication` 開頭加 role gate（case_officer OR admin OR 透過外部收件路徑）。

**相關檔案**：`src/app/actions/applicationActions.ts:createNewApplication`

**檢視結論**：[ ] 同意調整 / [ ] 維持現狀 / [ ] 其他

---

### 3.7 🟢 [權責] `case_officer` 等所有人能進「通知管理」

**現況**：所有登入者皆可進「通知管理」入口，操作 SMTP 設定、編輯系統範本、發送批次通知。

**問題**：這是後台級別的功能，給承辦人能改 SMTP 或範本其實有風險（誤改、誤發給錯對象）。

**建議**：「通知管理」改成 admin / supervisor 可進；其他角色看不到入口。

**相關檔案**：
- `src/components/HomePage.tsx`（QUICK_LINKS 中 `notifications` 沒角色 gate）
- `src/components/NotificationManager.tsx`（內部也應加）

**檢視結論**：[ ] 同意調整 / [ ] 維持現狀 / [ ] 其他

---

### 3.8 🟢 [語意] `board_member` 能看案件統計

**現況**：案件統計可看角色含 `board_member`。

**問題**：統計含申請人姓名、金額等敏感彙總，**包含其他董事組審過的案件**（cross-group 訊息揭露）。董事看自己組審過的有道理；看別組的可能違反組與組之間的獨立性。

**建議**：保留現狀，或縮為 `admin / supervisor / chairman`。

**檢視結論**：[ ] 縮減（移除 board_member） / [ ] 維持現狀 / [ ] 其他

---

### 3.9 🟢 [文件] `applicant` 角色定義含糊

**現況**：`applicant` 在 roles 表存在，外部收件建立的 user 都拿這 role。但**沒有為 applicant 設計任何登入頁 / 權限**，他們的密碼是隨機產生且沒人知道。

**建議二選一**：
- **A**：在開發文件 / CLAUDE.md 明確記錄「applicant 角色純為資料分類用，非設計給 UI 登入」
- **B**：刪除這個 role，改用 `users.is_external = true` 旗標標記

**檢視結論**：[ ] 採方案 A（補文件） / [ ] 採方案 B（重構 schema） / [ ] 維持現狀

---

### 3.10 🟢 [隱私] `volunteer` 可看所有案件列表

**現況**：volunteer 雖被列為 `lockAssign`（無法派案），但仍可進「申請案件管理」看到所有案件清單（含 case_number / 申請人姓名等個資）。

**問題**：volunteer 的工作純粹是事後關懷，**不需要看到他沒參與過的案件**。

**建議**：volunteer 進列表頁時自動 filter「結案 + 我關懷過的申請人相關案件」，避免揭露不必要的個資。

**相關檔案**：
- `src/components/CaseListPage.tsx`（filter 邏輯）
- `src/app/actions/applicationActions.ts:fetchCaseSummaries`（後端可加 role-based filter）

**檢視結論**：[ ] 同意調整 / [ ] 維持現狀 / [ ] 其他

---

## 4. 優先處理建議

| 編號 | 等級 | 標題 | 預估工時 |
|---|---|---|---|
| 3.1 | 🔴 高 | stage 推進/退回 server-side gate | 中（多個 action 要改） |
| 3.2 | 🔴 高 | audit log 加 gate | 低（一行條件） |
| 3.6 | 🔴 高 | createNewApplication gate | 低 |
| 3.3 | 🟡 中 | accountant phase 收斂 | 低 |
| 3.4 | 🟡 中 | 未派案警示移除 board_member | 低 |
| 3.5 | 🟡 中 | chairman 後台 UX | 中 |
| 3.7 | 🟢 低 | 通知管理改 admin only | 低 |
| 3.8 | 🟢 低 | board_member 看統計收斂 | 低 |
| 3.9 | 🟢 低 | applicant 角色文件 | 低 |
| 3.10 | 🟢 低 | volunteer 可看案件範圍 | 中 |

---

## 5. 後續行動

逐項檢視打勾後，可：

1. 把同意採納的調整集中起來開一個 `/spectra:propose harden-permissions` change
2. 或拆成多個 change（例如先做 §3.1 + §3.2 + §3.6 的 security 一波；UX 與語意調整另開一波）

請逐項在 §3 各小節的「檢視結論」勾選後告訴我，我會把同意調整的部分整合成 change proposal。
