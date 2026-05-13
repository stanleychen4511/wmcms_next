## Context

本專案的新增案件流程由 `NewApplicationPage`（外部與內部共用）透過 `createNewApplication` server action 寫入 `applications` 表。AdminPanel 已有多個字典維護分頁（如 `DocumentTypeManager`、`StorageLocationManager`），本次要新增「轉介單位管理」延續相同 UI 模式。

目前 `applications` 欄位皆為「單一案件資料」，無指向其他字典表的 FK（除 `applicant_id` / `officer_id` 指向 users）。此次新增的 `referral_unit_id` 是第一個指向「基金會自建字典」的欄位；schema 設計需考慮未來刪除轉介單位時的行為。

## Goals / Non-Goals

**Goals:**

- 新增案件時可結構化記錄來源（自提 / 轉介）與轉介單位。
- 後台管理員可 CRUD 轉介單位，停用後不再出現於下拉，但既有案件仍保留 FK 關聯。
- 表單驗證：選「轉介」必選單位、選「自提」時清空 referral_unit_id。
- 既有案件向下相容（無需 backfill）。

**Non-Goals:**

- 不硬刪轉介單位（只提供 is_active toggle），因既有案件可能已引用；硬刪要留到未來若需要時再設計。
- 不在 CaseListPage 加篩選或欄位顯示（首版只在詳情顯示）。
- 不提供匯入 / 匯出轉介單位清單（手動 CRUD 足夠）。

## Decisions

### 轉介單位 FK 採 `ON DELETE SET NULL`（不硬刪）

**選擇**：`referral_unit_id BIGINT REFERENCES referral_units(id) ON DELETE SET NULL`，搭配 `is_active` 軟刪。

**Alternatives considered**：

1. *`ON DELETE RESTRICT`*：阻止刪除已被引用的單位；缺點：後台刪除按鈕要先檢查引用、UX 麻煩。
2. *`ON DELETE CASCADE`*：跟著刪除案件；**絕對不能**，會炸掉歷史資料。
3. *在 applications 存單位名稱 snapshot*：避免 FK；缺點：名稱改了歷史案件就不同步、也無法用 FK 直接 JOIN。

決定以軟刪（`is_active=false`）為主要操作；真的要硬刪時 SET NULL 是最保守的退路。

### `application_way` 用 CHAR(1) 而非 ENUM

**選擇**：`application_way CHAR(1) NOT NULL DEFAULT '1' CHECK (application_way IN ('1','2'))`。

**Alternatives considered**：

1. *PostgreSQL ENUM type*：變更值很痛（需要 ALTER TYPE）；專案其他 status 欄位也用 CHAR(1)（例如 `applications.status`、`application_documents.status`），保持一致。
2. *BOOLEAN is_referral*：無法擴充（未來若要加「外機關移送」等第 3 種來源），且語意不如 CHAR 直觀。

沿用專案既有慣例，CHAR(1) + CHECK。

### 單位名稱 UNIQUE 但允許停用後重建

`referral_units.name TEXT NOT NULL UNIQUE`。若使用者想停用舊單位再建同名新單位，需先改舊單位名稱（例如加 `_舊` 後綴），符合一般字典表維運慣例。

### 後台 UI：複用 `AdminPanel` 分頁容器

在 `AdminPanel.tsx` 已有的 tabs 結構新增一個「轉介單位管理」tab，觸發 `<ReferralUnitManager />` 元件。元件內部 CRUD 流程比照 `DocumentTypeManager`：inline edit + 新增表單 + 啟停用 toggle + 排序拖拉。首版不做拖拉排序，只提供數字 input 的 `sort_order`。

### 表單驗證由前後端雙重把關

- **前端**：`NewApplicationPage` 本地 state 檢查 way='2' 時 referralUnitId 必選；否則顯示錯誤訊息、不呼叫 server action。
- **後端**：`createNewApplication` 在事務內再驗證，且額外檢查 `referral_units.id` 存在且 `is_active=true`。錯誤時回傳 `{ success: false, error: '轉介單位無效或已停用' }`。雙重把關避免前端繞過。

## Risks / Trade-offs

- **既有案件無來源資料** → 以 DEFAULT '1' 自動回填；若未來要區分「自提」與「歷史未填」可能需再加一個 '0' 或 NULL 選項。Mitigation：首版先接受「DEFAULT '1' 視同自提」，若實際統計有誤差再決定是否新增 migration。
- **轉介單位名稱改名歷史追蹤** → 改名後所有 JOIN 結果都會顯示新名，歷史案件不會保留當時的名稱。Mitigation：視需求若要快照，未來在 audit_logs 可查到改名紀錄；首版不做 snapshot。
- **停用中單位仍可能出現在詳情頁** → 既有 FK 的案件詳情會照常顯示該單位名稱（即使已停用），這是對的行為；停用只影響「新案件的下拉清單」。
- **排序欄位無預設值混亂** → `sort_order INT NOT NULL DEFAULT 0`；後台建立時允許留空（前端送 0）。下拉在 server action 以 `ORDER BY sort_order ASC, name ASC` 組合排序避免純 0 時混亂。
