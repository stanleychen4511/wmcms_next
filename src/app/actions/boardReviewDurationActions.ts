'use server';

/**
 * 董事審核所需天數統計（WMCMS-9 #84）
 *
 * 需求：後台統計每位董事從「派案日」到「審核完畢」所需天數；董事不可查看。
 * 權限：admin，或 supervisor 且帳號沒有 board_member / chairman 角色（多角色帳號也擋）。
 *
 * 資料來源（派案與簽核會被改派 / 退回覆蓋，故合併現況表與歷史紀錄）：
 *   派案時間：audit_logs board_review.assign / reassign（排除退回時清空派組的 cleared_on_retreat）
 *            ＋ board_review_assignments.assigned_at（目前派組）
 *   簽核時間：board_review_signatures（正式簽核，signature_data_url <> ''）
 *            ＋ board_review_rounds.signatures 快照 ＋ audit_logs board_review.signature_added
 *   每筆簽核對應「簽核當下最近一次派案」；同一派案輪次只取該董事第一次簽核（修改後重簽不重算）。
 *   目前派組中尚未簽核的組員列為審核中。
 */

import { pool } from '../../lib/db';
import { decryptAES } from '../../lib/crypto';
import {
    summarizeBoardReviewDurations,
    type BoardReviewDurationItem,
    type BoardMemberDurationSummary,
} from '../../lib/boardReviewDuration';

export interface BoardReviewDurationReport {
    members: BoardMemberDurationSummary[];
    items: BoardReviewDurationItem[];
}

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

interface DurationRow {
    application_id: string;
    case_number: string | null;
    signer_user_id: string;
    account: string | null;
    name_enc: Buffer | null;
    name_iv: Buffer | null;
    is_chairman: boolean;
    assigned_at: Date;
    signed_at: Date | null;
    days: number | string | null;
}

/** admin，或 supervisor 且不具董事身分 */
export async function canViewBoardReviewDurations(operatorUserId: string): Promise<boolean> {
    if (!/^\d+$/.test(operatorUserId ?? '')) return false;
    const res = await pool.query(
        `SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1::bigint`,
        [operatorUserId]
    );
    const roles = new Set(res.rows.map((r: { code: string }) => r.code));
    if (roles.has('admin')) return true;
    return roles.has('supervisor') && !roles.has('board_member') && !roles.has('chairman');
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function fetchBoardReviewDurations(
    operatorUserId: string,
    filter: { from?: string; to?: string },
): Promise<ActionResult<BoardReviewDurationReport>> {
    if (!(await canViewBoardReviewDurations(operatorUserId))) {
        return { success: false, error: '權限不足' };
    }
    const from = filter.from && DATE_RE.test(filter.from) ? filter.from : null;
    const to = filter.to && DATE_RE.test(filter.to) ? filter.to : null;

    try {
        const res = await pool.query(
            `WITH assigns AS (
                 SELECT al.target_id::bigint AS application_id, al.created_at AS assigned_at
                   FROM audit_logs al
                  WHERE al.action IN ('board_review.assign', 'board_review.reassign')
                    AND al.target_id ~ '^[0-9]+$'
                    AND COALESCE(al.detail->>'cleared_on_retreat', 'false') <> 'true'
                 UNION
                 SELECT application_id, assigned_at FROM board_review_assignments
             ),
             signs AS (
                 SELECT application_id, signer_user_id, signed_at
                   FROM board_review_signatures
                  WHERE signature_data_url <> ''
                 UNION
                 SELECT r.application_id, (s->>'signerUserId')::bigint, (s->>'signedAt')::timestamptz
                   FROM board_review_rounds r
                   CROSS JOIN LATERAL jsonb_array_elements(r.signatures) s
                  WHERE (s->>'signerUserId') ~ '^[0-9]+$' AND s->>'signedAt' IS NOT NULL
                 UNION
                 SELECT al.target_id::bigint, (al.detail->>'signer_user_id')::bigint, al.created_at
                   FROM audit_logs al
                  WHERE al.action = 'board_review.signature_added'
                    AND al.target_id ~ '^[0-9]+$'
                    AND (al.detail->>'signer_user_id') ~ '^[0-9]+$'
             ),
             matched AS (
                 -- 每筆簽核對應簽核當下最近一次派案
                 SELECT s.application_id, s.signer_user_id, s.signed_at,
                        (SELECT max(a.assigned_at) FROM assigns a
                          WHERE a.application_id = s.application_id AND a.assigned_at <= s.signed_at) AS assigned_at
                   FROM signs s
             ),
             completed AS (
                 -- 同一派案輪次只取第一次簽核
                 SELECT application_id, signer_user_id, assigned_at, min(signed_at) AS signed_at
                   FROM matched
                  WHERE assigned_at IS NOT NULL
                  GROUP BY application_id, signer_user_id, assigned_at
             ),
             pending AS (
                 SELECT bra.application_id, bgm.user_id AS signer_user_id, bra.assigned_at, NULL::timestamptz AS signed_at
                   FROM board_review_assignments bra
                   JOIN applications a ON a.id = bra.application_id AND a.status = '1'
                   JOIN board_group_members bgm ON bgm.group_id = bra.group_id
                  WHERE NOT EXISTS (
                      SELECT 1 FROM board_review_signatures brs
                       WHERE brs.application_id = bra.application_id
                         AND brs.signer_user_id = bgm.user_id
                         AND brs.signature_data_url <> ''
                         AND brs.signed_at >= bra.assigned_at
                  )
             ),
             all_items AS (
                 SELECT * FROM completed
                 UNION ALL
                 SELECT * FROM pending
             )
             SELECT i.application_id::text, a.case_number,
                    i.signer_user_id::text, u.account, u.name_enc, u.name_iv,
                    EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                             WHERE ur.user_id = i.signer_user_id AND r.code = 'chairman') AS is_chairman,
                    i.assigned_at, i.signed_at,
                    (COALESCE(i.signed_at, NOW()) AT TIME ZONE 'Asia/Taipei')::date
                      - (i.assigned_at AT TIME ZONE 'Asia/Taipei')::date AS days
               FROM all_items i
               JOIN applications a ON a.id = i.application_id
               LEFT JOIN users u ON u.id = i.signer_user_id
              WHERE ($1::date IS NULL OR (i.assigned_at AT TIME ZONE 'Asia/Taipei')::date >= $1::date)
                AND ($2::date IS NULL OR (i.assigned_at AT TIME ZONE 'Asia/Taipei')::date <= $2::date)
              ORDER BY i.assigned_at DESC, a.case_number`,
            [from, to]
        );

        const items: BoardReviewDurationItem[] = res.rows.map((r: DurationRow) => ({
            applicationId: r.application_id,
            caseNumber: r.case_number ?? '',
            signerUserId: r.signer_user_id,
            signerName: (r.name_enc && r.name_iv ? decryptAES(r.name_enc, r.name_iv) : null) || r.account || '（已刪除帳號）',
            isChairman: r.is_chairman === true,
            assignedAt: new Date(r.assigned_at).toISOString(),
            signedAt: r.signed_at ? new Date(r.signed_at).toISOString() : null,
            days: Math.max(0, Number(r.days) || 0),
        }));
        return { success: true, data: { members: summarizeBoardReviewDurations(items), items } };
    } catch (err) {
        console.error('fetchBoardReviewDurations error:', err);
        return { success: false, error: err instanceof Error ? err.message : '查詢失敗' };
    }
}
