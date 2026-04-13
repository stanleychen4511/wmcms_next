# 系統操作紀錄（Audit Log）規格書

## 1. 概述

本系統實作了完整的操作稽核機制，記錄從收件到結案的所有增刪改動作，包含文件預覽與上傳。  
所有紀錄寫入 PostgreSQL 的 `audit_logs` 資料表，並可透過後台管理工具的「系統操作紀錄」頁面查詢。

---

## 2. 資料表定義

```sql
CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(50)  NOT NULL,
    target_type VARCHAR(30)  NOT NULL,
    target_id   VARCHAR(50),
    detail      JSONB
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_user_id    ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_target     ON audit_logs (target_type, target_id);
CREATE INDEX idx_audit_logs_action     ON audit_logs (action);
```

### 欄位說明

| 欄位名稱 | 中文名稱 | 資料格式 |
|----------|----------|----------|
| `id` | 紀錄編號 | BIGSERIAL（自動遞增整數） |
| `created_at` | 操作時間 | TIMESTAMPTZ（含時區時間戳記） |
| `user_id` | 操作者 ID | UUID（可為 NULL，對應 `users.id`） |
| `action` | 動作類型 | VARCHAR（動作代碼） |
| `target_type` | 目標類型 | VARCHAR |
| `target_id` | 目標 ID | VARCHAR（可為 NULL） |
| `detail` | 補充資訊 | JSONB（可為 NULL，僅供資訊人員使用） |

> **注意**：操作者姓名與帳號不直接儲存於此表，查詢時 JOIN `users` 表取得，避免每次寫入都需要額外查詢。

---

## 3. Action 動作代碼

### 申請案件

| 代碼 | 中文說明 |
|------|----------|
| `application.create` | 新增申請案件 |
| `application.update` | 修改申請資料 |
| `application.stage_advance` | 推進申請階段 |
| `application.stage_rollback` | 退回申請階段 |
| `application.officer_assign` | 派案 |
| `application.close` | 結案 |

### 家訪紀錄

| 代碼 | 中文說明 |
|------|----------|
| `home_visit.create` | 新增家訪紀錄 |
| `home_visit.update` | 修改家訪紀錄 |

### 文件

| 代碼 | 中文說明 |
|------|----------|
| `document.upload` | 上傳文件 |
| `document.preview` | 預覽文件 |
| `document.delete` | 刪除文件 |
| `document.status_update` | 審核文件狀態 |

### 使用者

| 代碼 | 中文說明 |
|------|----------|
| `user.login` | 使用者登入 |
| `user.create` | 新增使用者 |
| `user.update` | 修改使用者 |
| `user.deactivate` | 停用使用者 |

### 實體位置

| 代碼 | 中文說明 |
|------|----------|
| `file_location.create` | 新增實體位置 |
| `file_location.update` | 修改實體位置 |
| `file_location.disable` | 停用實體位置 |
| `file_location.enable` | 啟用實體位置 |

### 範本檔案

| 代碼 | 中文說明 |
|------|----------|
| `template.upload` | 上傳範本檔案 |
| `template.update` | 修改範本資訊（名稱／分類／說明） |
| `template.disable` | 停用範本檔案 |
| `template.enable` | 啟用範本檔案 |
| `template.download` | 下載範本檔案 |

### 通知

| 代碼 | 中文說明 |
|------|----------|
| `notification.send` | 發送通知（Email） |

---

## 4. Target Type 目標類型

| 代碼 | 中文說明 | 對應 target_id |
|------|----------|----------------|
| `application` | 申請案件 | `applications.id`（BIGINT 字串） |
| `home_visit` | 家訪紀錄 | `applications.id`（關聯用） |
| `document` | 文件 | `application_documents.id`（SMALLINT 字串） |
| `user` | 使用者 | `users.id`（UUID 字串） |
| `file_location` | 實體位置 | `file_storage_location.id`（INTEGER 字串） |
| `template` | 範本檔案 | `template_files.id`（INTEGER 字串） |
| `notification` | 通知紀錄 | `notification_logs.id`（UUID 字串） |

---

## 5. 程式端實作

### 5.1 核心 Server Action

**檔案**：`src/app/actions/auditActions.ts`

提供兩個 exported functions：

#### `writeAuditLog(params)`

Fire-and-forget 寫入，**不會拋出例外**，錯誤僅 console.error。

```typescript
interface WriteAuditLogParams {
    userId: string | null;       // 操作者 UUID，可為 null
    action: AuditAction;         // 動作代碼
    targetType: AuditTargetType; // 目標類型
    targetId?: string | null;    // 目標 ID
    detail?: Record<string, unknown>; // 補充資訊
}

await writeAuditLog({ ... });
// 或 fire-and-forget：
void writeAuditLog({ ... });
```

#### `fetchAuditLogs(params)`

查詢稽核紀錄，支援篩選與分頁。回傳時自動 JOIN `users` 表解密姓名。

```typescript
interface FetchAuditLogsParams {
    targetType?: AuditTargetType;
    targetId?: string;
    userAccount?: string;   // 模糊搜尋（ILIKE）
    action?: string;
    dateFrom?: string;      // YYYY-MM-DD
    dateTo?: string;        // YYYY-MM-DD（含當天）
    limit?: number;         // 預設 50
    offset?: number;        // 預設 0
}

// 回傳
interface AuditLogEntry {
    id: string;
    createdAt: string;       // ISO 8601
    userId: string | null;
    userAccount: string | null;  // 明文帳號（JOIN users）
    userName: string | null;     // 解密後姓名（JOIN users）
    action: string;
    targetType: string;
    targetId: string | null;
    detail: Record<string, unknown> | null;
}
```

---

### 5.2 各 Server Action 整合點

| 檔案 | 整合的 action |
|------|---------------|
| `workflowActions.ts` | `application.stage_advance`、`application.stage_rollback`、`application.close`（×2：駁回/完成） |
| `applicationActions.ts` | `application.create`（收件建立）、`application.officer_assign`（批次派案） |
| `homeVisitActions.ts` | `home_visit.create`、`home_visit.update` |
| `documentActions.ts` | `document.upload`、`document.status_update` |
| `userActions.ts` | `user.login`、`user.create`、`user.update`（角色變更） |
| `storageLocationActions.ts` | `file_location.create`、`file_location.update`、`file_location.disable`、`file_location.enable` |
| `templateActions.ts` | `template.upload`、`template.update`、`template.disable`、`template.enable` |
| `app/api/template-download/[id]/route.ts` | `template.download`（Route Handler，userId 來自 query param `?userId=`） |
| `notificationActions.ts` | `notification.send`（成功或失敗均記錄，`targetId` 為 `notification_logs.id`） |
| `intakeActions.ts` | `application.create`（線上收件，`userAccount` 記為 `'applicant'`） |

**文件預覽**（`document.preview`）寫入點在前端元件：
- **檔案**：`src/components/ReviewList.tsx`
- **觸發時機**：使用者點擊 Eye（預覽）按鈕時，在 `onClick` 中呼叫 `writeAuditLog`
- **需傳入**：`userId` prop（由 `App.tsx` 傳入 `loggedInUser?.id`）

---

### 5.3 userId 的取得方式

各 server action 透過以下方式取得 `userId`：

| Action | userId 來源 |
|--------|------------|
| `workflowActions` | 函式參數 `reviewerUserId`（呼叫方傳入） |
| `applicationActions.createNewApplication` | 查詢 officer 帳號後得到的 `officerId` |
| `applicationActions.assignOfficerBatch` | 目前傳 `null`，operatorAccount 可擴充 |
| `homeVisitActions` | 函式參數 `visitorUserId` |
| `documentActions` | 目前傳 `null`（可擴充加入 uploaderUserId） |
| `userActions.loginAction` | 登入成功後的 `user.id` |
| `userActions.createUser` / `updateUserRoles` | 目前傳 `null`（操作者為管理員，可擴充） |
| `ReviewList` 預覽 | `userId` prop（來自 `loggedInUser?.id`） |

---

## 6. 後台查詢介面

**元件**：`src/components/AuditLogViewer.tsx`  
**進入路徑**：後台管理工具 → 系統操作紀錄

### 篩選條件

| 條件 | 預設值 | 說明 |
|------|--------|------|
| 日期區間（起） | 當天 | YYYY-MM-DD |
| 日期區間（迄） | 當天 | YYYY-MM-DD（含） |
| 操作帳號 | 空（全部） | 模糊搜尋 |
| 動作類型 | 空（全部） | 下拉選單，顯示中文標籤 |
| 目標類型 | 空（全部） | 下拉選單，顯示中文標籤 |

### 分頁

- 每頁筆數：10 / 50 / 100（使用者可切換，預設 50）
- 切換篩選條件時自動回到第 1 頁
- 頁碼按鈕，超過範圍時顯示省略號（…）

### 顯示欄位

| 欄位 | 說明 |
|------|------|
| 時間 | `created_at`，格式 `YYYY-MM-DD HH:mm:ss` |
| 操作者 | 姓名（解密）+ `@帳號` |
| 動作類型 | 顏色 Badge，顯示中文標籤 |
| 目標類型 | 中文標籤 |
| 目標 ID | 原始 ID 字串 |

> `detail` 欄位不在介面顯示，僅供資訊人員直接查詢 DB 使用。

---

## 7. 設計決策紀錄

| 決策 | 原因 |
|------|------|
| 不儲存 `user_account` | 查詢時 JOIN `users.account`（明文），避免每次寫入都需額外查詢帳號 |
| 不儲存 `user_name` | 姓名為 AES 加密欄位，查詢時統一解密，避免重複儲存加密資料 |
| `writeAuditLog` 不拋例外 | 稽核寫入失敗不應中斷主流程 |
| `detail` 欄位使用 JSONB | 各 action 補充資訊結構不同，彈性儲存 |
| 程式端實作（非 DB Trigger） | DB Trigger 無法取得 session user，且文件預覽等操作完全在程式層 |
