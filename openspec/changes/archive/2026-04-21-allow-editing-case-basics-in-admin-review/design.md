## Context

新增案件流程（`createNewApplication`）在建立時寫入：
- `applications.application_type / apply_amount / application_way / referral_unit_id / applicant_id / officer_id`
- `application_workflow` 一筆 `stage = 'admin_review'`
- 可能建立新 `users` row（applicant），name/idNumber 皆為加密欄位

目前無任何路徑可在建立後修改這些欄位；若發現錯誤只能整案刪除重建。本 change 目標為在「行政初審」階段允許承辦人與 admin 修正常見打字錯誤，而不破壞案件主體（case_number / applicant_id / workflow）。

既有 server action `updateUserRoles`（`userActions.ts`）示範了更新 users 表 + audit log 的雙寫模式，本次修改姓名將沿用。

## Goals / Non-Goals

**Goals:**

- 在 `stage='admin_review'` AND `status='1'` 時允許修改 4 項基本欄位（姓名、類別、來源、轉介單位）。
- 修改姓名同步更新 users.name_enc/name_iv/name_bidx（AES 加解密 + HMAC blind index 一致性）。
- 權限：承辦人（officer_id 等於當前使用者）或 admin 角色。
- 完整 audit log：before + after + changedFields。
- 其他階段或結案後鎖死（UI 不顯示按鈕 + server 拒絕）。

**Non-Goals:**

- 不支援修改 idNumber（Non-Goal）。
- 不支援修改 applyAmount（其他表單負責）。
- 不做 UI 上的 diff 預覽（單純送出後刷新）。
- 不支援批次修改或 undo。
- 不為 users.name 變更建立 history 表（修改影響該 applicant 的所有案件顯示名，屬預期行為）。

## Decisions

### 權限判定：officer_id 比對 + admin 角色

**選擇**：server action 內查詢 `applications.officer_id`，若等於 `operatorUserId` 則允許；否則檢查 `user_roles` 是否含 `admin`。任一成立即通過。

**Alternatives considered**：
1. *只允許承辦人*：admin 作為後臺角色，實務上會需要代為修正 → 過於受限，否決。
2. *只允許 admin*：承辦人自己發現打字錯誤卻要找管理員 → UX 差，否決。
3. *放給所有 officer 角色（不限本案承辦人）*：安全性不足，任何承辦人都能改他人案件。

雙軌（本案承辦人 or admin）兼顧 UX 與安全。

### 階段判定：要同時檢 status 與 workflow.stage

**選擇**：僅在 `applications.status = '1'` AND `application_workflow.stage = 'admin_review'` 時允許。

**理由**：
- 只看 `status='1'` 不夠：'1' 涵蓋 admin_review / home_visit / board_review 全部進行中階段，不符合需求「只限行政初審」。
- 只看 `workflow.stage` 不夠：結案案件的 workflow.stage 會停在最後階段（例如 'board_review' 拒件後 status='2'），若只看 stage 會誤放結案案件。
- 雙條件並查最嚴謹。

### 姓名更新：直接改 users.name_enc，不建立 snapshot

**選擇**：修改姓名時以新姓名重新產生 name_enc/name_iv/name_bidx 並 UPDATE 該筆 users 的三欄。

**Alternatives considered**：
1. *在 applications 表加一個 display_name override 欄位*：避免影響其他案件；但違反「同一人應有單一姓名」的直覺，且之後要做統計/通知時會困擾。
2. *拆出 applicant_snapshots 表記錄每個案件當時的姓名*：未來若有需求可以再做；此次需求僅是「修正打字」，引入 snapshot 過度設計。

直接改 users 符合「修正資料」的語意；會同步影響該 applicant 名下其他案件顯示名，這是預期行為（寫入 proposal 的 Non-Goal）。

### Audit log 結構：only 記錄實際變動欄位

**選擇**：`detail.before` 與 `detail.after` 只放實際有變動的欄位，`detail.changedFields` 明確列出欄位名陣列。若呼叫 patch 無任何欄位與現值不同，直接回傳成功但不寫 audit log（no-op）。

**範例 detail**：
```json
{
  "changedFields": ["applicationType", "referralUnitId"],
  "before": { "applicationType": "A", "referralUnitId": null },
  "after":  { "applicationType": "B", "referralUnitId": "3" }
}
```

**理由**：降低 audit log 雜訊，方便未來查詢「改過哪些欄位」的統計。

### 事務邊界：單一 BEGIN/COMMIT 包住 users UPDATE + applications UPDATE

**選擇**：server action 內開事務，若姓名與 applications 兩邊都要改，一起 commit；任一失敗整體 rollback。

**理由**：避免 applications.application_type 更新成功但 users.name_enc 更新失敗的中間態。稽核 log 使用 `void writeAuditLog(...)` 異步寫入，不影響事務。

### 前端按鈕顯示條件

後端是權威，但前端按鈕 UX 上應該「符合條件才顯示」而非「按了再跳錯誤訊息」：

- `appDetail.status === '1'`
- `appDetail.stage === 'admin_review'`（`fetchApplicationDetail` 已回傳 stage）
- `loggedInUser.id === appDetail.officerId`（需要在 `ApplicationDetail` 介面加 `officerId` 欄位）OR `loggedInUser.roles` 含 `'admin'`

所有三項為 true 才顯示「編輯」按鈕。

## Risks / Trade-offs

- **姓名變更影響其他案件** → 同一 applicant 名下所有案件顯示名會一起改。Mitigation：UI modal 加警示「修改姓名會同步更新此申請人名下所有案件的顯示名」，提醒使用者。
- **修改轉介單位可能選到已停用單位**（若使用者開 modal 後，另一個 admin 剛好把該單位停用）→ server action 事務內再驗證 is_active，以最後一刻為準，並回傳明確錯誤。
- **operator 權限 race**（例如 admin 剛被降級）→ 本次不特別處理，若權限檢查通過後隨即被降級，操作已成為已發生事件；audit_logs 留下當時的 userId 供事後追查。
- **Audit log 巨量**：若使用者頻繁按「編輯」但未實際改動（無變動直接 return success），不寫 audit log 可避免雜訊。
- **前端按鈕條件與後端不同步**：後端是權威。若前端有 bug 顯示了按鈕但後端拒絕，會在 modal 提交時顯示錯誤訊息，不會造成資料損壞。
