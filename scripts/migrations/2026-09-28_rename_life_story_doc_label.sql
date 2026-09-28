-- WMCMS-2 (#76)：文件名稱「生命故事同意刊登截圖證明」改為「生命故事暨同意刊登截圖證明」。
-- 已上傳檔案的 file_path 保留舊名，不需處理。

BEGIN;

UPDATE document_type_config
   SET label = '生命故事暨同意刊登截圖證明'
 WHERE id = 20
   AND label = '生命故事同意刊登截圖證明';

COMMIT;
