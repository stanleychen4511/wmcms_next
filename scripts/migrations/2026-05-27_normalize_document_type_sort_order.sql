BEGIN;

WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY phase
            ORDER BY sort_order, id
        ) AS next_sort_order
    FROM document_type_config
)
UPDATE document_type_config d
SET sort_order = ranked.next_sort_order
FROM ranked
WHERE d.id = ranked.id;

SELECT setval(
    pg_get_serial_sequence('document_type_config', 'id')::regclass,
    COALESCE((SELECT MAX(id) FROM document_type_config), 0) + 1,
    false
);

COMMIT;
