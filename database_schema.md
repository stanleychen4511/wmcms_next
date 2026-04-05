# 資料庫資料表規格文件 (Database Schema Specification)

此文件根據專案內的 `db_schema.sql` 產生，包含系統中所有資料表的結構與說明。

## 1. 使用者表 (users)
**用途**: 系統使用者表

| 欄位名稱 | 欄位型態 | 必填/預設值 | 欄位用途 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | 唯一識別碼 |
| `username` | VARCHAR(100) | NOT NULL | 使用者名稱/帳號 |
| `password_hash` | VARCHAR(255) | NOT NULL | 密碼雜湊值 |
| `role` | VARCHAR(50) | NOT NULL | 角色: applicant(申請人), processor(承辦人), social_worker(社工/志工), supervisor(主管), accountant(會計), reviewer(審核委員/董事) |
| `id_card_number` | VARCHAR(20) | UNIQUE | 身分證字號 (作為額度檢核依據) |
| `email` | VARCHAR(255) | | 電子郵件 |
| `phone` | VARCHAR(50) | | 聯絡電話 |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | 建立時間 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | 更新時間 |

---

## 2. 申請案件表 (applications)
**用途**: 醫療補助申請案件表

| 欄位名稱 | 欄位型態 | 必填/預設值 | 欄位用途 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | 唯一識別碼 |
| `applicant_id` | UUID | NOT NULL | 申請人 ID (關聯 users.id) |
| `application_stage` | VARCHAR(50) | NOT NULL | 申請階段: pre_application(預先申請), post_application(事後申請) |
| `marital_status` | VARCHAR(50) | NOT NULL | 婚姻狀態: single, married, divorced, widowed |
| `economic_status` | VARCHAR(50) | NOT NULL | 經濟狀況: general(一般), well_off(小康), low_income(低收) |
| `status` | VARCHAR(50) | NOT NULL, DEFAULT 'draft' | 案件狀態: draft, submitted, pre_review, board_review, accounting, completed, returned |
| `requested_amount` | NUMERIC(10, 2) | DEFAULT 0 | 申請金額 |
| `approved_amount` | NUMERIC(10, 2) | DEFAULT 0 | 核定金額 (影響35萬上限) |
| `application_date` | TIMESTAMP WITH TIME ZONE| DEFAULT CURRENT_TIMESTAMP | 申請日期 |
| `created_at` | TIMESTAMP WITH TIME ZONE| DEFAULT CURRENT_TIMESTAMP | 建立時間 |
| `updated_at` | TIMESTAMP WITH TIME ZONE| DEFAULT CURRENT_TIMESTAMP | 更新時間 |

---

## 3. 申請文件表 (documents)
**用途**: 申請文件表

| 欄位名稱 | 欄位型態 | 必填/預設值 | 欄位用途 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | 唯一識別碼 |
| `application_id` | UUID | NOT NULL | 申請案件 ID (關聯 applications.id) |
| `document_type` | VARCHAR(100) | NOT NULL | 文件類型: id_card_front, id_card_back, consent_form, family_registry, diagnosis, receipt, tax_list, mortgage_interest, job_cert... |
| `file_path` | VARCHAR(500) | NOT NULL | 檔案儲存路徑/網址 |
| `uploaded_by` | UUID | NOT NULL | 上傳者 ID (關聯 users.id) |
| `upload_date` | TIMESTAMP WITH TIME ZONE| DEFAULT CURRENT_TIMESTAMP | 上傳時間 |

---

## 4. 審核紀錄表 (review_logs)
**用途**: 各階段審核紀錄表

| 欄位名稱 | 欄位型態 | 必填/預設值 | 欄位用途 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | 唯一識別碼 |
| `application_id` | UUID | NOT NULL | 申請案件 ID (關聯 applications.id) |
| `reviewer_id` | UUID | NOT NULL | 審核員 ID (關聯 users.id) |
| `review_stage` | VARCHAR(50) | NOT NULL | 審核階段: processor, supervisor, board, accountant |
| `action` | VARCHAR(50) | NOT NULL | 執行動作: approve, reject, return_for_correction |
| `comments` | TEXT | | 審核意見 (委員需填寫至少50字) |
| `approved_amount` | NUMERIC(10, 2)| | 此階段建議或核定之補助金額 |
| `review_date` | TIMESTAMP WITH TIME ZONE| DEFAULT CURRENT_TIMESTAMP | 審核時間 |

---

## 5. 家訪紀錄表 (home_visits)
**用途**: 家訪紀錄表 (取代原本 Google 表單)

| 欄位名稱 | 欄位型態 | 必填/預設值 | 欄位用途 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | 唯一識別碼 |
| `application_id` | UUID | NOT NULL | 申請案件 ID (關聯 applications.id) |
| `visitor_id` | UUID | NOT NULL | 執行家訪之社工或志工UUID (關聯 users.id) |
| `visit_date` | DATE | NOT NULL | 家訪日期 |
| `visit_notes` | TEXT | NOT NULL | 家訪詳細紀錄內容 |
| `created_at` | TIMESTAMP WITH TIME ZONE| DEFAULT CURRENT_TIMESTAMP | 建立時間 |
| `updated_at` | TIMESTAMP WITH TIME ZONE| DEFAULT CURRENT_TIMESTAMP | 更新時間 |

---

## 6. 追蹤紀錄表 (tracking_logs)
**用途**: 後續追蹤關懷紀錄 (結案後)

| 欄位名稱 | 欄位型態 | 必填/預設值 | 欄位用途 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | 唯一識別碼 |
| `application_id` | UUID | NOT NULL | 申請案件 ID (關聯 applications.id) |
| `recorder_id` | UUID | NOT NULL | 紀錄者 ID (關聯 users.id) |
| `log_type` | VARCHAR(50) | NOT NULL | 紀錄類型: text(文字紀錄), image(圖片紀錄) |
| `content` | TEXT | | 文字紀錄內容 |
| `file_path` | VARCHAR(500) | | 圖片檔案路徑 |
| `created_at` | TIMESTAMP WITH TIME ZONE| DEFAULT CURRENT_TIMESTAMP | 建立時間 |
