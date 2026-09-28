-- WMCMS-5 (#80)：已綁定 LINE 的使用者，通知偏好補上 'line'。
-- 原因：綁定流程過去只寫 line_user_id，notification_channels 仍是預設 {email}，
--       通知規則 respect_user_preferences=true 時 LINE 一律被略過（skipped_user_preference）。
-- 新版綁定時會自動加上 'line'；本檔只補既有資料。
-- 使用者若曾自行在「個人設定」儲存過通知偏好（audit: user.notification_channels_updated），
-- 視為本人選擇，不覆蓋。

BEGIN;

UPDATE users u
   SET notification_channels = array_append(u.notification_channels, 'line')
 WHERE u.line_user_id IS NOT NULL
   AND NOT ('line' = ANY(u.notification_channels))
   AND NOT EXISTS (
       SELECT 1 FROM audit_logs al
        WHERE al.action = 'user.notification_channels_updated'
          AND al.target_id = u.id::text
   );

COMMIT;
