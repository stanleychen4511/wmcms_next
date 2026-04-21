<!-- SPECTRA:START v1.0.1 -->

# Spectra Instructions

This project uses Spectra for Spec-Driven Development(SDD). Specs live in `openspec/specs/`, change proposals in `openspec/changes/`.

## Use `/spectra:*` skills when:

- A discussion needs structure before coding → `/spectra:discuss`
- User wants to plan, propose, or design a change → `/spectra:propose`
- Tasks are ready to implement → `/spectra:apply`
- There's an in-progress change to continue → `/spectra:ingest`
- User asks about specs or how something works → `/spectra:ask`
- Implementation is done → `/spectra:archive`

## Workflow

discuss? → propose → apply ⇄ ingest → archive

- `discuss` is optional — skip if requirements are clear
- Requirements change mid-work? Plan mode → `ingest` → resume `apply`

## Parked Changes

Changes can be parked（暫存）— temporarily moved out of `openspec/changes/`. Parked changes won't appear in `spectra list` but can be found with `spectra list --parked`. To restore: `spectra unpark <name>`. The `/spectra:apply` and `/spectra:ingest` skills handle parked changes automatically.

<!-- SPECTRA:END -->

@AGENTS.md

---

# wmcms_next — 萬美基金會補助管理系統

## 專案概述

自費醫療補助管理系統，處理申請案件從收件、審核、家訪、董事審查、核銷到結案的完整流程。使用者角色包含承辦人、社工、主管、會計、董事、管理員、義工、申請人。

- **需求文件**：`萬美基金會.pdf`、`自費醫療補助管理系統_需求規格書.docx`
- **功能追蹤**：`FEATURES.md`
- **資料庫 Schema 文件**：`database_schema.md`

## 技術棧

- **前端**：Next.js 16 (App Router) + React 19 + TypeScript 5 + Tailwind CSS 4
- **後端**：Next.js Server Actions（`'use server'`）+ PostgreSQL (Neon Cloud)
- **加密**：Node.js `crypto` — AES-256-CBC（欄位加密）+ HMAC-SHA256（密碼與 blind index）
- **主要套件**：`pg` (PostgreSQL client)、`@vercel/blob` (檔案儲存)、`react-pdf`、`docx-preview`、`react-hook-form`、`zod`、`nodemailer`、`framer-motion`、`lucide-react`

## 目錄結構

```
src/
  App.tsx                    # 頂層路由 & 狀態管理（單頁應用，用 view state 切換頁面）
  types.ts                   # Role, CaseSummary, WorkflowStage 等共用型別
  app/
    layout.tsx, page.tsx     # Next.js App Router 入口
    globals.css
    actions/                 # Server Actions（'use server'）— 所有 DB 邏輯放這
      applicationActions.ts  # 案件 CRUD、派案、查詢
      documentActions.ts     # 文件上傳、審核、文件類型設定
      workflowActions.ts     # 工作流程推進/退回
      userActions.ts         # 登入、使用者管理
      auditActions.ts        # 稽核日誌
      bannerActions.ts, announcementActions.ts
      homeVisitActions.ts, notificationActions.ts
      intakeActions.ts       # 快速收件（外部使用者）
      pendingDocAlertActions.ts  # 補件警示
      settingsActions.ts, storageLocationActions.ts, templateActions.ts
    api/
      cron/, preview/, template-download/
    apply/                   # 外部收件頁面 route
  components/                # 所有 React 元件
    AppHeader.tsx, LoginPage.tsx, HomePage.tsx
    NewApplicationPage.tsx   # 新增案件
    CaseListPage.tsx         # 申請人資料查詢
    ReviewList.tsx           # 文件審核清單（含上傳/審核/補件警示）
    HomeVisitForm.tsx        # 家訪表單
    AdminPanel.tsx           # 後台（帳號、文件類型、系統設定 ...）
    ExternalIntake.tsx       # 外部收件入口
    SendNotificationModal.tsx, AnnouncementManager.tsx, BannerManager.tsx ...
  lib/
    crypto.ts                # AES 加解密、salt、blind index
    db.ts                    # pg Pool singleton（HMR safe）
    stageMaps.ts             # status ↔ stage 對應表
    storage.ts               # 檔案儲存（Vercel Blob / 本地）
    validateTwId.ts          # 身分證驗證
    notificationUtils.ts
  schemas/                   # zod 驗證
  utils/                     # 資格判定等工具

scripts/
  init_db.sql                # 冪等資料庫初始化（建表 + seed data）
  seed_admin.mjs             # 建立管理員帳號（Node.js 原生 ESM，無額外依賴）

openspec/                    # Spectra SDD 檔案
tmp/                         # 暫存測試腳本
```

## 關鍵架構模式

### 1. Server Actions 為 DB 入口

所有資料庫操作都透過 `src/app/actions/*.ts` 的 Server Actions，檔案頂端以 `'use server'` 宣告。絕對不要在 client component 直接查 DB。

### 2. 欄位加密（AES-256-CBC）

敏感欄位（姓名、身分證號）以加密欄 + IV 欄儲存為 `BYTEA`：

```ts
const { enc, iv } = encryptAES('王小明');
// 存 DB：name_enc = enc (Buffer), name_iv = iv (Buffer)
// 讀回：decryptAES(row.name_enc, row.name_iv)
```

### 3. Blind Index（可搜尋加密）

加密欄位無法 `WHERE` 比對，改用 HMAC 哈希當索引：

```ts
const salt = generateSalt();                   // hex string
const saltBuffer = Buffer.from(salt, 'hex');   // 32 bytes
// 儲存時：search_salt 欄位必須存 saltBuffer（不是 hex 字串！）
// blind index：id_number_bidx = generateBlindIndex(idNumber, salt)
```

**查詢時的 salt 還原**（重要陷阱）：

```ts
// row.search_salt 從 BYTEA 讀出來是 Buffer
const salt = row.search_salt.toString('hex');  // 正確：還原為 hex 字串
if (generateBlindIndex(idNumber, salt) === row.id_number_bidx) { ... }
```

> ⚠️ **hex 字串 vs Buffer 陷阱**：
> - 若把 `searchSalt`（hex 字串）直接存進 BYTEA，PostgreSQL 會以 ASCII bytes 儲存，讀回時 `.toString('hex')` 會是「hex of ASCII」—— 完全不同的值。
> - 必須 `Buffer.from(salt, 'hex')` 轉成 32 bytes 再存。
> - 同理，`hashPassword(pass, searchSalt)` 與 `hashPassword(pass, saltBuffer)` 產生的結果不同（HMAC key 不同）。登入時用 `row.search_salt` (Buffer)，所以建立帳號時也要用 `hashPassword(pass, saltBuffer)` 保持一致。

### 4. 單頁狀態機（App.tsx）

沒有 React Router，整個 App 用 `view` state（`'home' | 'list' | 'detail' | 'new' | 'admin' | ...`）切換畫面，每個 view 對應不同子元件。

### 5. 工作流程（Workflow）

`applications.status` 與 `application_workflow.stage` 兩套：

| status | 意義 | 階段 (stage) |
|--------|------|---|
| `'1'` | 審核中 | admin_review → home_visit → board_review |
| `'2'` | 審核未通過（結案） | — |
| `'3'` | 待核銷 | reimbursement |
| `'4'` | 核銷完成（結案） | — |

### 6. 文件與補件邏輯

`document_type_config` 兩個關鍵欄位：
- `is_required`：是否必備文件
- `allow_supplement`：是否可延後補件（`false` = 收件當下必備）

**「補件」= 時間基準的警示**，不是「重新上傳已核准文件」的動作。觸發條件：
- `is_required = true`
- `today - apply_at >= system_settings.pending_doc_alert_days`
- 文件 `status ≠ '1'`（未通過審核）
- 案件 `status NOT IN ('2', '4')`（非結案）

警示出現位置：
- `HomePage`（case_officer 看到自己的案件計數）
- `CaseListPage`（篩選器 + row highlight）
- `ReviewList`（每筆文件顯示「逾期補件」橘色 badge）

`application_documents` 是**懶建立**（on first upload），不會在建案時預先塞空列。

### 7. 文件狀態

`application_documents.status`（CHAR(1)）：
- `'0'`：待上傳 / 未符合（上傳後預設值）
- `'1'`：符合（審核人員按「符合」後）
- `'2'`：逾期

## 資料庫

- **連線**：`DATABASE_URL` 環境變數（`.env.local`，可有多行被註解的設定）
- **初始化**：`psql $DATABASE_URL -f scripts/init_db.sql`（冪等，可重複執行）
- **管理員帳號**：`node scripts/seed_admin.mjs`（互動式或走環境變數 `ADMIN_ACCOUNT` / `ADMIN_PASSWORD` / `ADMIN_NAME`）

### 主要資料表

| 表 | 用途 |
|---|---|
| `roles`, `users`, `user_roles` | 帳號與角色（多對多） |
| `applications` | 案件主檔（`case_number` 唯一） |
| `application_workflow` | 每階段審核紀錄 |
| `application_documents` | 文件與審核狀態（PK = `application_id` + `id`） |
| `document_type_config` | 文件類型設定（phase、is_required、allow_supplement） |
| `file_storage_location` | 檔案儲存位置（樹狀結構） |
| `home_visit` | 家訪紀錄（每案最多一筆） |
| `system_settings` | 系統參數（`max_apply_amount`, `pending_doc_alert_days`…） |
| `audit_logs` | 稽核日誌 |
| `notification_channels`, `notification_templates`, `notification_logs` | 通知功能 |
| `banners`, `announcements`, `announcement_categories` | 首頁輪播與公告 |
| `template_files`, `template_categories` | 範本下載 |

## 常用指令

```bash
npm run dev          # 開發伺服器
npm run build        # Next.js build（產品建置）
npm run lint         # ESLint

# 資料庫初始化（冪等）
psql $DATABASE_URL -f scripts/init_db.sql

# 建立/更新管理員帳號
node scripts/seed_admin.mjs
```

## 開發陷阱備忘

1. **BYTEA 欄位**：`pg` 讀回來是 `Buffer`，比對時用 `Buffer.isBuffer()` 判斷並 `.toString('hex')` 還原（如 blind index）。直接 `===` 比對會永遠失敗。
2. **salt 存法**：hex 字串必須 `Buffer.from(hex, 'hex')` 再存 BYTEA，不然讀回對不上。
3. **Hashing 一致性**：`hashPassword` 與 `generateBlindIndex` 的 salt 格式在「寫入」與「讀取比對」兩端必須一致（都用 Buffer 或都用 hex 字串）。
4. **`SELECT` + `INSERT` race**：建立使用者若先 `SELECT` 判斷再 `INSERT`，可能踩到重複鍵錯誤。偏好 `INSERT ... ON CONFLICT (account) DO UPDATE`。
5. **JOIN 去重**：`users JOIN user_roles` 時若條件含 `OR`，同一人可能出現多次，加 `SELECT DISTINCT ON (u.id)`。
6. **補件與時間**：所有「補件」相關判斷都以 `apply_at + pending_doc_alert_days` 為基準，**不是**看 workflow stage。結案前（status 非 '2'/'4'）都要檢測缺件。
7. **`allow_supplement=true` 不是免死金牌**：收件當下可空白，但過了門檻仍未補件一樣警示。
8. **Next.js 16 新 API**：參考 `AGENTS.md`，有可能與訓練資料不符，必要時讀 `node_modules/next/dist/docs/`。
9. **TypeScript 嚴格模式**：`null` 不能給 `string | undefined` 的 prop，用 `?? ''` 或 `?? undefined` 轉換。
10. **AuditAction / AuditTargetType 是聯合型別**：新增 action 時必須同步更新 `src/app/actions/auditActions.ts` 的型別定義，否則編譯失敗。

## 常用 server action 入口

- 案件：`fetchCaseSummaries`, `createNewApplication`, `fetchApplicationDetail`, `assignOfficerBatch`, `advanceWorkflowStage`, `retreatWorkflowStage`, `closeCase`, `checkApplicationStatus`
- 文件：`uploadApplicationDocument`, `updateDocumentStatus`, `fetchApplicationDocuments`, `fetchDocumentTypeConfigs`, `copyDocumentToApplication`
- 使用者：`loginAction`, `getUsers`, `createUser`, `fetchCaseOfficers`, `fetchCaseOfficersWithId`
- 警示：`fetchPendingDocAlerts`, `fetchUnassignedCount`
- 系統設定：`fetchSetting`, `updateSetting`, `ensureDefaultSettings`
- 加密工具：從 `src/lib/crypto.ts` import — `encryptAES`, `decryptAES`, `generateSalt`, `hashPassword`, `generateBlindIndex`
