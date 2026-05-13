## Context

Phase 1 完成 LINE 通路（webhook + push）但缺「使用者 ↔ LINE userId」對應。Phase 2 補這個橋樑後，Phase 3 才能用 `users.line_user_id` 做事件觸發。

LINE Messaging API 的兩個發訊管道：
- **Push API**：對任意 LINE userId 推送，會計入訊息配額（LINE 免費方案每月有上限）
- **Reply API**：對某 webhook event 的 reply token 回覆，**不計入配額**，但 reply token 限時 1 分鐘且僅可使用一次

Phase 2 的 webhook 內回覆（綁定成功 / 失敗 / 引導）一律用 Reply API 節省配額。

「6 位數字綁定碼」設計考量：
- 易於使用者在 LINE 手機端輸入（純數字鍵盤）
- 6 位足夠抗暴力（10^6 = 100 萬種，配合 30 分鐘有效期 + 一人一碼，現實中無攻擊面）

## Goals / Non-Goals

**Goals:**

- 任一系統使用者可自助綁定自己的 LINE 帳號（不需 admin 介入）
- 綁定後 `users.line_user_id` 唯一指向某 LINE 帳號（UNIQUE 約束）
- 綁定碼一人一碼、30 分鐘失效、產新覆蓋舊
- webhook 可辨識「已綁定」「未綁定」並適切回應
- 解綁可由使用者自助執行
- 完整 audit log 追蹤（綁定碼產生、綁定成功、解綁）

**Non-Goals:**

- 不支援一個 user 綁多個 LINE 帳號（schema UNIQUE 限制）
- 不支援同一 LINE 帳號綁多個系統 user
- 不做業務指令（傳「狀態」回案件清單之類）→ Phase 3
- 不做事件觸發 → Phase 3
- 不做綁定碼過期清理 cron（DB 量少，不需）
- 不整合 LINE Login

## Decisions

### 綁定碼一人一碼（PK = user_id）vs 多碼歷史

**選擇**：`user_line_link_codes.user_id` 為 PRIMARY KEY，產新碼用 UPSERT 覆寫舊碼。

**Alternatives considered**：

1. *允許多碼共存*：使用者可能多次按「產生綁定碼」累積多個有效碼；安全性與 UX 都差（不知道哪個有效）。
2. *自增 id PK + 軟標記過期*：增加複雜度，無實質好處。

一人一碼最直觀。

### 綁定碼長度與字元集：6 位純數字

**選擇**：`crypto.randomInt(100000, 999999)` 產 6 位 0-9 數字。

**Alternatives considered**：

1. *8 位英數混合*：抗暴力更強但 LINE 手機輸入麻煩。
2. *純英文*：易混淆 (l/1, O/0)，UX 差。

6 位數字 + 30 分鐘 expiry + UNIQUE active code 抗暴力綽綽有餘（理論攻擊期望 50 萬次嘗試才中一次，30 分鐘內無法觸發）。

### Webhook 收訊邏輯：先查 line_user_id，後查 link_code

**選擇**（流程）：

```
收到 message event:
  ↓
SELECT FROM users WHERE line_user_id = $1
  ├─ 找到 → 已綁定 user → return（Phase 3 才做業務指令）
  └─ 沒找到 → 未綁定
       ↓
       text 是否為 6 位數字？
       ├─ 否 → reply 引導訊息「請至個人設定產生綁定碼」
       └─ 是 → SELECT FROM user_line_link_codes WHERE code=$1 AND expires_at > NOW()
            ├─ 找到 → 事務內 UPDATE users.line_user_id + DELETE link_code → reply 「綁定成功！您是 [姓名]」
            │     └─ UNIQUE 衝突 → reply「此 LINE 帳號已綁定其他系統使用者」
            └─ 沒找到 → reply「綁定碼無效或已過期」
```

**理由**：
- 已綁定者優先走「沉默」路徑，避免每次發訊都被回覆引導
- 6 位數字判別足夠精確（其他訊息形式如「您好」「123」短的就回引導）
- DELETE link_code 在綁定成功後立即執行，避免重複綁定漏洞

### Reply API 失敗的容錯

Reply token 1 分鐘內僅一次有效。若 webhook 處理慢或 reply 呼叫失敗：
- 不重試（避免 token expired 錯誤反覆觸發）
- console.error log + 寫一筆 audit `line.webhook_received` 帶 `detail.reply_error`
- 使用者體驗：看不到回覆但 DB 仍正確（綁定可能已成功）→ 使用者再傳一次訊息會走「已綁定 → 沉默」路徑，他可以從系統介面驗證

### `line_user_id` 完整值不傳到前端

**選擇**：`fetchLineLinkStatus` 只回末 6 碼（`lineUserIdSuffix`）。

**理由**：
- LINE userId 雖無敏感資訊，但屬個人識別碼，最小揭露原則
- UI 只需呈現「已綁定」狀態 + 提示性末 6 碼即可
- admin 若需完整值可從 audit_logs 撈

### bot 加好友連結來源：`system_settings.line_official_account_id`

**選擇**：admin 在「系統參數設定」填入 LINE bot 的 `@id`（例如 `@123abcde`），前端組成 `https://line.me/R/ti/p/@123abcde` 顯示為「加好友」連結。

**Alternatives considered**：

1. *.env 變數*：admin 修改要改檔案重啟，較不便；改用 system_settings 線上可調。
2. *直接顯示 QR code 圖檔*：要 admin 上傳圖、佔額外存儲。

@id 設定後整個基金會通用，不常變。

### Spec 修改：line-messaging-foundation 的 log-only 約束

Phase 1 spec 中的「Phase 1 webhook handler is log-only」requirement 在 Phase 2 必須 MODIFY：
- 移除「SHALL NOT execute any business logic」
- 替換為「webhook handler dispatches by binding state（Phase 2 後規則）」
- 保留「audit log per event」的承諾

Spec delta 會用 `## MODIFIED Requirements` 區塊處理。

## Risks / Trade-offs

- **使用者把綁定碼貼給錯的 bot**：若使用者誤加另一 LINE 帳號為好友、把碼發過去 → 對方拿不到我們系統的 callback。對使用者而言看似「無回應」。Mitigation：UI 操作步驟強調「請務必加 [基金會官方帳號 @id] 為好友」，並顯示加好友連結。
- **同一 LINE 帳號嘗試綁多個系統 user**：UNIQUE 約束會擋；webhook 觸發 UNIQUE 衝突時 reply「此 LINE 帳號已綁定其他系統使用者」。
- **使用者按產生碼但沒去 LINE 完成 → 30 分鐘後過期**：過期 row 留在 DB（沒 cron 清理）；數量極少（每人最多 1 row），可接受。Phase 4 視需要可加每日清理 cron。
- **Reply token 1 分鐘失效**：若 dev 環境 webhook 慢或 debugging 太久，reply 可能 fail。Mitigation：Phase 2 不重試；audit 仍會記錄使用者已傳碼，他可再傳一次再驗。
- **使用者解綁但忘記把 bot 從 LINE app 刪好友**：bot 仍可推訊息給他（但他系統端已解綁，Phase 3 不會推）。Mitigation：UI 解綁完顯示提示「已解除綁定。如不再需要接收訊息，請於 LINE app 中封鎖 [基金會官方帳號]」。
- **6 位數字綁定碼被肩窺**：若有人在使用者旁邊看到碼、立即衝去 LINE 傳碼 → 會綁到攻擊者的 LINE。Mitigation：30 分鐘 + 一人一碼有限制；且攻擊者後續仍只能收訊，無法登入系統。可接受風險。
