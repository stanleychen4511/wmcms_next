## Context

會計在核銷階段需要列印三份紙本歸檔文件。使用者提供了兩份既有紙本範本（審核意見表、領款收據）的影本作為版面依據；醫療收據是申請人收件時上傳的檔案。

目前系統已有的相關基礎設施：
- `applications` / `users`（含 AES 加密的姓名、身分證）/ `home_visit`（含 `subsidy_need_reason`）/ `application_workflow`（含 `comments`）/ `board_review_assignments`（派組）/ `board_review_signatures`（含 base64 PNG `signature_data_url`）
- `document_type_config` 已有 name="醫療收據" 紀錄；`application_documents` 是懶建立
- `system_settings` 已有 `pending_doc_alert_days` 等鍵；`fetchSetting / updateSetting / ensureDefaultSettings` 可重用
- React 19 / Next.js 16 App Router；可建 `src/app/print/<doc>/[applicationId]/page.tsx` 為 server component，無需 PDF/DOCX 套件
- Tailwind CSS 4 已可用 `@media print` / `print:` modifier

目前的關鍵限制與痛點：
- **`application_workflow.comments` 是 stage-scoped**：每次推進 stage 都會被新 stage 的 comments 覆寫。董事審核意見在進入 reimbursement 之後會遺失，導致審核意見表印不出原始意見
- 沒有「組織基本資料」的設定機制（公司名稱、統編、地址等都未集中管理）
- 沒有金額轉國字大寫工具，沒有民國日期工具
- 案件類別 A/B/C/D 沒有專屬欄位，但 `case_number` 第一碼即為類別字母（規則已確認：`[A-D]` + 民國年 3 碼 + 流水號 3 碼）

## Goals / Non-Goals

**Goals:**

- 會計在核銷撥款畫面點按鈕，於新分頁開啟列印頁面，瀏覽器原生 `Ctrl+P` 即可印出/存 PDF
- 列印頁面的版面盡量貼近使用者提供的兩份紙本範本（表格、欄位順序、字級）
- 將「董事審核意見」從 stage-scoped 欄位提升為 case-scoped 欄位，未來不再被任何 workflow 推進覆寫
- 組織基本資料集中於 `system_settings`，admin 可在後台「系統參數設定」修改，無須改 code
- 權限正確：僅 `admin` 與 `accountant` 角色看得到「文件列印」區塊與相關 server action

**Non-Goals:**

- 不產生 PDF/DOCX 檔下載；不引入 puppeteer、docxtemplater、jspdf 等套件
- 不做合併列印（一次印三份）
- 不支援董事個別獨立意見（紙本表雖然每位委員一張，但因「會計留底用 + 簽章並列即可」決策，整組共用一份意見）
- 不支援超過 999,9999（七位數）以上金額的國字大寫（依使用者決策「不用管超過」）
- 不在 case_number 之外另存案件類別欄位

## Decisions

### 列印頁面用 Server Component + 瀏覽器原生列印

**選擇**：每份要產生的文件對應一個 Next.js App Router server component route：
- `src/app/print/review-opinion/[applicationId]/page.tsx`
- `src/app/print/payment-receipt/[applicationId]/page.tsx`

頁面 server-side 從 DB 撈資料 → 渲染 HTML（A4 比例 + Tailwind `@media print` 樣式）→ 內含一顆「列印」按鈕（client component）按下呼叫 `window.print()`。會計也可直接 `Ctrl+P`。

**為什麼不用 PDF 產生庫**：
- 內部使用、樣式不需 byte-perfect、不需要伺服器端渲染 PDF 二進位
- puppeteer 啟 chromium 太重；jspdf 中文字型支援差；docxtemplater 需要事先製作 docx 樣板且改版面困難
- 既有 `react-pdf` 是「閱讀 PDF」的庫，不是「產生 PDF」的庫

**為什麼不用 client component 直接 fetch**：
- server component 可直接呼叫 server actions / `pool.query`，少一層 API
- 解密 (`decryptAES`) 必須在 server 跑，client 拿不到金鑰

### 醫療收據走「直接開既有檔案」

**選擇**：醫療收據按鈕點下去 → server action `fetchMedicalReceipts(applicationId)` 回傳該案 type='醫療收據' 的所有上傳檔案 URL → 前端：
- 0 份：彈警示「該案尚未上傳醫療收據」
- 1 份：直接 `window.open(url, '_blank')`（PDF/JPG 在新分頁瀏覽器原生開啟，使用者 `Ctrl+P` 印出）
- ≥2 份：彈一個 modal 列出所有檔案 + 各自的「開啟」按鈕

**理由**：醫療收據本質就是「申請人上傳的原始檔案」，列印 = 開啟原檔。再做一個「印表頁」只是多餘的封裝層，且圖片/PDF 直接給瀏覽器處理列印效果最好。

### 新增 `applications.board_review_comments` 欄位

**選擇**：

```sql
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS board_review_comments TEXT;
```

寫入時機：`saveBoardReviewDraft` 同時寫入 `application_workflow.comments` 與 `applications.board_review_comments`（語意：board_review 階段的編輯狀態同步落到永久欄位）。

清除時機：`retreatWorkflowStage` 退回到 `admin_review` 或 `home_visit` 時，連同 `board_review_assignments` + `board_review_signatures`（既有清除邏輯）一起 `UPDATE applications SET board_review_comments = NULL`。退回到非 board_review 之前的 stage（沒有這種情況；reimbursement 不能退到 reimbursement 之後）不影響。

讀取：列印審核意見表的資料組裝專讀 `applications.board_review_comments`。其他既有 UI 維持讀 `application_workflow.comments`。

**為什麼不選「約束 advanceWorkflowStage 不覆寫 comments」**：
- 隱性契約：仰賴未來所有開發者都記得這條規則
- 推進到 reimbursement 後若想記錄「會計處理意見」就會破壞契約
- 跟 `application_workflow.comments` 是 stage 通用欄位的本意衝突
- 獨立欄位 = schema 強制保證，不靠人 review

**為什麼不選「append-only stage history table」**：
- 範圍太大、不必要的複雜度
- 本 change 只需要保存「董事審核意見」這一個值

### 案件類別從 `case_number` 第一碼解析

**選擇**：新增 `src/lib/caseCategory.ts`，**優先讀既有 `applications.application_type` 欄位，NULL 則 fallback 解析 `case_number` 第一碼**：

```ts
export const CATEGORY_LABEL: Record<'A'|'B'|'C'|'D', string> = {
  A: '自費醫療補助',
  B: '臨終安寧自費醫療補助',
  C: '預立醫療照護諮商補助',
  D: '醫事人員進修補助',
};

export function parseCategory(caseNumber: string | null | undefined): 'A'|'B'|'C'|'D'|null {
  const c = caseNumber?.[0] as 'A'|'B'|'C'|'D' | undefined;
  return c && CATEGORY_LABEL[c] ? c : null;
}

/** 優先讀 application_type；NULL 時 fallback 到 parseCategory(case_number) */
export function resolveCategory(app: { application_type: string | null; case_number: string | null }): 'A'|'B'|'C'|'D'|null {
  const t = app.application_type as 'A'|'B'|'C'|'D' | null;
  if (t && CATEGORY_LABEL[t]) return t;
  return parseCategory(app.case_number);
}
```

**為什麼這樣設計**：
- 系統 schema 早已有 `applications.application_type CHAR(1)` 欄位（comment：申請類別 A/B/C/D），是欄位語意上的權威來源
- 但既有資料可能 NULL（無 NOT NULL 約束），且 `case_number` 第一碼本身就帶類別資訊 → fallback 提供向後相容
- 印表頁直接 `resolveCategory(applicationRow)` 即可，呼叫端不需關心是哪個來源

### 簽章呈現 = 同一張表並列所有董事簽章圖

**選擇**：審核意見表「審核委員（親筆簽名）」一欄，server-side 從 `board_review_signatures` 撈該案所有簽章 → 在欄位內以 flex 排版水平並列每個 `<img src="data:image/png;base64,...">`，每個簽章下方顯示董事姓名（從 `users.name_enc` 解密）。

**理由**：使用者明確選「會計留底使用，並沒有要印出給審核委員實體簽名」，所以紙本表「一委員一張」的本意被改寫為「電子簽章列印留底」。

### 審核日期 = 推進到 reimbursement 的時間

**選擇**：審核意見表「審核日期」 = `application_workflow.reviewed_at`（當 stage='reimbursement'）。實作上 server action 撈：

```sql
SELECT reviewed_at FROM application_workflow
WHERE application_id = $1 AND stage = 'reimbursement'
LIMIT 1
```

如該案件還沒推進到 reimbursement（理論上不會發生，因為印表入口在核銷畫面），fallback 用今天日期。

### 金額國字大寫工具

**選擇**：實作支援 0~9999999 的轉換，**中間補零**規則：

- 1,234 → 「壹仟貳佰參拾肆」
- 10,500 → 「壹萬零伍佰」
- 1,000,000 → 「壹佰萬」
- 0 → 「零」
- 超過 7 位數：截斷後仍處理（依使用者決策「不用管超過」），可用 `console.warn` 提示

**為什麼自己寫不引用套件**：依賴極簡（純文字函式），不需新增 npm 依賴。

### 民國年日期工具

**選擇**：

```ts
export function toRocDate(d: Date | string | null): { year: number; month: number; day: number } | null
export function formatRocDate(d: Date | string | null, sep = ' 年 '): string
```

民國年 = 西元年 - 1911。null/undefined 回傳 null（caller 自行 fallback）。

### 組織資料 system_settings 命名與預設值

**選擇**：8 個 key，全部走 TEXT 型別（包括 url），`ensureDefaultSettings` 設預設值如下（依使用者提供的範本影本）：

| key | 預設 |
|---|---|
| `org_full_name` | `財團法人萬美基金會` |
| `org_license_no` | `衛部醫字第 1121668099 號` |
| `org_registration_no` | `113 證他字第 000974 號` |
| `org_uniform_no` | `93155400` |
| `org_address` | `106005 台北市大安區金山南路二段 165 號 4 樓` |
| `org_phone` | `(02) 2321-2777` |
| `org_fax` | `(02) 2321-3828` |
| `org_line_qr_url` | `/org-line-qr.png` |

`SettingsPanel` UI 加入這 8 個 key 的 LABEL/HINT/INPUT_TYPE（全 text）。

### 列印區塊權限與位置

**選擇**：核銷撥款畫面（具體元件待確認，可能是 `App.tsx` 內 `view='reimbursement'` 對應的 panel 或新增的元件）：
- 區塊只在 `loggedInUser.roles` 包含 `'admin'` 或 `'accountant'` 時 render
- 列印頁面的 server component **也要做 server-side 權限檢查**（防止直接訪問 URL 繞過）：未具備角色 → 回 403 / 重新導向首頁

### 印表 server actions 集中於新檔

**選擇**：印表頁需要的 server-side 資料組裝（解密、JOIN 多張表、轉換金額/日期）集中在 `src/app/actions/printDocumentActions.ts`，避免散到既有 actions：
- `fetchReviewOpinionPrintData(applicationId)`
- `fetchPaymentReceiptPrintData(applicationId)`
- `fetchMedicalReceipts(applicationId)`

每個函式內部做角色檢查（透過 cookie/session 拿 operatorUserId → 查 user_roles）。

## Risks / Trade-offs

- **[列印樣式跨瀏覽器差異]** Chrome / Edge / Firefox 的 `@media print` 渲染略有差異（margin、邊框、字級） → 以 Chrome（會計最可能用的）為主測試；提供 `@page` 設定 A4 邊距。
- **[`saveBoardReviewDraft` 雙寫一致性]** 兩個欄位若其中一個 UPDATE 失敗會不一致 → 全部包在同一交易內，要嘛都成功要嘛都 rollback。
- **[既有未結案案件沒有 `board_review_comments`]** Migration 後既有資料的新欄位都是 NULL，列印出來會空白 → 印表頁 fallback 顯示「（未保存審核意見）」之文字；新增的審核會自動填入。
- **[直接訪問 print URL 繞過 UI 權限]** → server component 做 server-side 角色驗證，未通過回 403。
- **[QR code 圖片漏放]** 若 `public/org-line-qr.png` 沒擺，列印頁該位置會顯示破圖 → 印表 server component 檢查設定值若為相對路徑則 fallback 顯示空白方塊（不破圖）。
- **[case_number 異常]** 萬一未來有資料 case_number 第一碼不是 A/B/C/D（例如手動匯入的舊資料），`parseCategory` 回 null → 列印時所有類別 checkbox 都不勾，正常顯示。

## Migration Plan

1. 部署前在開發 DB 跑 init_db.sql 驗證 idempotent
2. 部署：先跑 `psql $DATABASE_URL -f scripts/init_db.sql`（加欄位 + seed 8 個 settings）
3. Code 部署後既有資料：`board_review_comments` 全部 NULL；列印頁面對 NULL 顯示 fallback。新審核會逐步填入
4. （選擇性 backfill）若想替過去結案的案件補上意見：`UPDATE applications a SET board_review_comments = w.comments FROM application_workflow w WHERE w.application_id = a.id AND w.stage = 'board_review'` — 但因 stage 已被推進覆寫過，這個 SQL 撈不到原始 board_review 的 comments，**意義不大，建議跳過**
5. 把使用者提供的 LINE QR PNG 放到 `public/org-line-qr.png`
6. Rollback：欄位 ALTER 是 add column，rollback `ALTER TABLE applications DROP COLUMN board_review_comments` 即可；settings rows 留著無害

## Open Questions

- 核銷撥款畫面的具體元件檔名為何？需在實作 step 確認（grep `reimbursement` / view='reimbursement' 找到後在 tasks 標明）
- 領款收據「申請補助類別」的 4 個 checkbox 命名與審核意見表略有差異（影本顯示沒有 (A)(B)(C)(D) 字尾） → 實作時兩邊都用 `caseCategory.ts` 的 `CATEGORY_LABEL`，預期 label 一致
