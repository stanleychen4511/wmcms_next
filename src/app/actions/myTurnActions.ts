'use server';

/**
 * 「輪到我處理」清單（user feedback #12）
 *
 * 規則（依角色）：
 *   - case_officer: 自己負責的案件中, 處於下列狀態之一者
 *       a) admin_review/home_visit 階段且
 *           - supervisor_approved_for_board = false（被退，待修正重送），或
 *           - supervisor_approved_for_board IS NULL **且尚未送過主管**（無 request audit log）
 *          已送主管、等待主管處理中的案件不算 officer 的待處理（換成主管的）
 *       b) 案件狀態 '3'（待核銷）且存在 payment_disbursements.review_stage IN ('1','X')（要送主管或被退）
 *   - supervisor: admin_review/home_visit 階段、supervisor_approved_for_board IS NULL **且 officer 已送出**（有 request audit log）
 *                 + 任何 payment_disbursements.review_stage='2'（要簽核領款收據）
 *   - board_member: 我屬於 board_group_members 的群組，且該群組指派的案件處於 board_review 且我尚未簽署
 *   - accountant: 任何 payment_disbursements.review_stage='3'
 *   - executive: 任何 payment_disbursements.review_stage='4'
 *
 * 回傳：{ items: [{ applicationId, caseNumber, applicantName, reasonText }] }
 * 不需嚴格 dedup；同一案件不同 reason 各列一筆，UI 可依 applicationId 群組。
 */

import pool from '../../lib/db';
import { decryptAES } from '../../lib/crypto';

export interface MyTurnItem {
    applicationId: string;
    caseNumber: string;
    applicantName: string;
    reasonText: string;
}

export interface MyTurnResult {
    items: MyTurnItem[];
    applicationIds: string[]; // 去重過的 case id（給 CaseList filter 用）
}

async function getRoles(userId: string): Promise<string[]> {
    const r = await pool.query(
        `SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1::bigint`,
        [userId]
    );
    return r.rows.map(x => x.code);
}

function decryptName(enc: Buffer | null, iv: Buffer | null): string {
    if (!enc || !iv) return '未知';
    try { return decryptAES(enc, iv) || '未知'; } catch { return '未知'; }
}

export async function fetchMyTurnCases(operatorUserId: string): Promise<MyTurnResult> {
    if (!operatorUserId || !/^\d+$/.test(operatorUserId)) {
        return { items: [], applicationIds: [] };
    }
    const roles = await getRoles(operatorUserId);
    const items: MyTurnItem[] = [];

    const client = await pool.connect();
    try {
        // Home-visit assignee: when a user is assigned to perform the visit,
        // show the case in "my turn" even if they are not the case officer.
        const hvAssigned = await client.query(
            `SELECT a.id::text AS app_id, a.case_number,
                    u.name_enc, u.name_iv
             FROM applications a
             JOIN users u ON u.id = a.applicant_id
             LEFT JOIN LATERAL (
                 SELECT stage FROM application_workflow
                 WHERE application_id = a.id
                 ORDER BY id DESC LIMIT 1
             ) w ON TRUE
             WHERE a.home_visit_assignee_id = $1::bigint
               AND a.status = '1'
               AND w.stage IN ('home_visit','visit')`,
            [operatorUserId]
        );
        for (const row of hvAssigned.rows) {
            items.push({
                applicationId: row.app_id,
                caseNumber: row.case_number,
                applicantName: decryptName(row.name_enc, row.name_iv),
                reasonText: '家庭訪視待處理',
            });
        }

        // case_officer
        if (roles.includes('case_officer')) {
            // (a) 主管雙閘門 — 只取「officer 還沒送」與「主管已退件」兩種狀態
            //     已送主管但主管尚未回覆 → 屬於主管的待處理，不出現在 officer 的清單
            const r1 = await client.query(
                `SELECT a.id::text AS app_id, a.case_number,
                        u.name_enc, u.name_iv,
                        a.supervisor_approved_for_board AS sup
                 FROM applications a
                 JOIN users u ON u.id = a.applicant_id
                 LEFT JOIN LATERAL (
                     SELECT stage FROM application_workflow
                     WHERE application_id = a.id
                     ORDER BY id DESC LIMIT 1
                 ) w ON TRUE
                 WHERE a.officer_id = $1::bigint
                   AND a.status = '1'
                   AND w.stage IN ('admin_review','home_visit','visit')
                   AND (
                       a.supervisor_approved_for_board = false
                       OR (a.supervisor_approved_for_board IS NULL AND NOT EXISTS (
                           SELECT 1 FROM audit_logs al
                           WHERE al.target_type = 'application'
                             AND al.target_id = a.id::text
                             AND al.action = 'application.request_supervisor_review_board'
                       ))
                   )`,
                [operatorUserId]
            );
            for (const row of r1.rows) {
                items.push({
                    applicationId: row.app_id,
                    caseNumber: row.case_number,
                    applicantName: decryptName(row.name_enc, row.name_iv),
                    reasonText: row.sup === false ? '主管已退件，待修正重送' : '待送主管審核',
                });
            }
            // (b) 核銷階段個管要處理
            const r2 = await client.query(
                `SELECT DISTINCT a.id::text AS app_id, a.case_number,
                        u.name_enc, u.name_iv,
                        BOOL_OR(pd.review_stage = 'X') AS has_rej
                 FROM applications a
                 JOIN users u ON u.id = a.applicant_id
                 JOIN payment_disbursements pd ON pd.application_id = a.id
                 WHERE a.officer_id = $1::bigint
                   AND a.status = '3'
                   AND pd.review_stage IN ('1','X')
                 GROUP BY a.id, a.case_number, u.name_enc, u.name_iv`,
                [operatorUserId]
            );
            for (const row of r2.rows) {
                items.push({
                    applicationId: row.app_id,
                    caseNumber: row.case_number,
                    applicantName: decryptName(row.name_enc, row.name_iv),
                    reasonText: row.has_rej ? '核銷被退件，待處理' : '待送主管核銷',
                });
            }
        }

        // supervisor
        if (roles.includes('supervisor') || roles.includes('admin')) {
            // 只列「officer 已送主管、主管尚未通過/退件」的案件
            const r3 = await client.query(
                `SELECT a.id::text AS app_id, a.case_number,
                        u.name_enc, u.name_iv
                 FROM applications a
                 JOIN users u ON u.id = a.applicant_id
                 LEFT JOIN LATERAL (
                     SELECT stage FROM application_workflow
                     WHERE application_id = a.id
                     ORDER BY id DESC LIMIT 1
                 ) w ON TRUE
                 WHERE a.status = '1'
                   AND w.stage IN ('admin_review','home_visit','visit')
                   AND a.supervisor_approved_for_board IS NULL
                   AND EXISTS (
                       SELECT 1 FROM audit_logs al
                       WHERE al.target_type = 'application'
                         AND al.target_id = a.id::text
                         AND al.action = 'application.request_supervisor_review_board'
                   )`,
                []
            );
            for (const row of r3.rows) {
                items.push({
                    applicationId: row.app_id,
                    caseNumber: row.case_number,
                    applicantName: decryptName(row.name_enc, row.name_iv),
                    reasonText: '主管審核（送董事前）',
                });
            }
            const r4 = await client.query(
                `SELECT DISTINCT a.id::text AS app_id, a.case_number,
                        u.name_enc, u.name_iv
                 FROM payment_disbursements pd
                 JOIN applications a ON a.id = pd.application_id
                 JOIN users u ON u.id = a.applicant_id
                 WHERE pd.review_stage = '2'`,
                []
            );
            for (const row of r4.rows) {
                items.push({
                    applicationId: row.app_id,
                    caseNumber: row.case_number,
                    applicantName: decryptName(row.name_enc, row.name_iv),
                    reasonText: '主管審核（送會計前）',
                });
            }

            // board_review 階段、簽核完成、待 supervisor 推進到核銷
            //   - 所有派組成員都已簽（signature_data_url 非空）
            //   - 派組成員意見一致 OR 不一致但董事長已簽（第三審）
            const r4b = await client.query(
                `WITH board_cases AS (
                    SELECT a.id::text AS app_id, a.case_number,
                           u.name_enc, u.name_iv, bra.group_id
                    FROM applications a
                    JOIN users u ON u.id = a.applicant_id
                    JOIN LATERAL (
                        SELECT stage FROM application_workflow
                        WHERE application_id = a.id
                        ORDER BY id DESC LIMIT 1
                    ) w ON TRUE
                    JOIN board_review_assignments bra ON bra.application_id = a.id
                    WHERE a.status = '1' AND w.stage = 'board_review'
                ),
                member_status AS (
                    SELECT bc.app_id,
                           (SELECT COUNT(*) FROM board_group_members
                            WHERE group_id = bc.group_id) AS member_count,
                           (SELECT COUNT(*) FROM board_review_signatures bs
                            JOIN board_group_members bgm
                                 ON bgm.group_id = bc.group_id AND bgm.user_id = bs.signer_user_id
                            WHERE bs.application_id::text = bc.app_id
                              AND bs.signature_data_url IS NOT NULL
                              AND bs.signature_data_url <> '') AS signed_count,
                           (SELECT (COUNT(DISTINCT COALESCE(bs.member_approved::text, 'null')) > 1
                                 OR COUNT(DISTINCT COALESCE(bs.member_amount::text, 'null')) > 1)
                            FROM board_review_signatures bs
                            JOIN board_group_members bgm
                                 ON bgm.group_id = bc.group_id AND bgm.user_id = bs.signer_user_id
                            WHERE bs.application_id::text = bc.app_id
                              AND bs.signature_data_url IS NOT NULL
                              AND bs.signature_data_url <> '') AS members_disagree,
                           EXISTS (
                               SELECT 1 FROM board_review_signatures bs
                               JOIN user_roles ur ON ur.user_id = bs.signer_user_id
                               JOIN roles r ON r.id = ur.role_id AND r.code = 'chairman'
                               WHERE bs.application_id::text = bc.app_id
                                 AND bs.signature_data_url IS NOT NULL
                                 AND bs.signature_data_url <> ''
                           ) AS chairman_signed
                    FROM board_cases bc
                )
                SELECT bc.app_id, bc.case_number, bc.name_enc, bc.name_iv
                FROM board_cases bc
                JOIN member_status ms ON ms.app_id = bc.app_id
                WHERE ms.member_count > 0
                  AND ms.signed_count = ms.member_count
                  AND (NOT ms.members_disagree OR ms.chairman_signed = true)`,
                []
            );
            for (const row of r4b.rows) {
                items.push({
                    applicationId: row.app_id,
                    caseNumber: row.case_number,
                    applicantName: decryptName(row.name_enc, row.name_iv),
                    reasonText: '董事審核已完成，待推進至撥款',
                });
            }
        }

        // board_member（一般董事 — 屬於派組成員）
        if (roles.includes('board_member') || roles.includes('chairman')) {
            const r5 = await client.query(
                `SELECT DISTINCT a.id::text AS app_id, a.case_number,
                        u.name_enc, u.name_iv
                 FROM applications a
                 JOIN users u ON u.id = a.applicant_id
                 LEFT JOIN LATERAL (
                     SELECT stage FROM application_workflow
                     WHERE application_id = a.id
                     ORDER BY id DESC LIMIT 1
                 ) w ON TRUE
                 JOIN board_review_assignments bra ON bra.application_id = a.id
                 JOIN board_group_members bgm ON bgm.group_id = bra.group_id
                 LEFT JOIN board_review_signatures brs
                        ON brs.application_id = a.id AND brs.signer_user_id = $1::bigint
                 WHERE a.status = '1'
                   AND w.stage = 'board_review'
                   AND bgm.user_id = $1::bigint
                   AND brs.signer_user_id IS NULL`,
                [operatorUserId]
            );
            for (const row of r5.rows) {
                items.push({
                    applicationId: row.app_id,
                    caseNumber: row.case_number,
                    applicantName: decryptName(row.name_enc, row.name_iv),
                    reasonText: '董事審核（待簽署）',
                });
            }
        }

        // chairman 第三審：兩位以上組員已簽，且 (同意/否 OR 金額) 不一致，且 chairman 尚未簽
        if (roles.includes('chairman')) {
            const r5b = await client.query(
                `WITH signed_members AS (
                    SELECT bs.application_id,
                           bs.member_approved,
                           bs.member_amount
                    FROM board_review_signatures bs
                    JOIN board_review_assignments bra ON bra.application_id = bs.application_id
                    JOIN board_group_members bgm
                         ON bgm.group_id = bra.group_id AND bgm.user_id = bs.signer_user_id
                    WHERE bs.signature_data_url IS NOT NULL AND bs.signature_data_url <> ''
                ),
                disagree_apps AS (
                    SELECT application_id
                    FROM signed_members
                    GROUP BY application_id
                    HAVING COUNT(*) >= 2
                       AND (COUNT(DISTINCT COALESCE(member_approved::text, 'null')) > 1
                            OR COUNT(DISTINCT COALESCE(member_amount::text, 'null')) > 1)
                )
                SELECT DISTINCT a.id::text AS app_id, a.case_number,
                       u.name_enc, u.name_iv
                FROM applications a
                JOIN users u ON u.id = a.applicant_id
                LEFT JOIN LATERAL (
                    SELECT stage FROM application_workflow
                    WHERE application_id = a.id
                    ORDER BY id DESC LIMIT 1
                ) w ON TRUE
                LEFT JOIN board_review_signatures chair_sig
                       ON chair_sig.application_id = a.id
                      AND chair_sig.signer_user_id = $1::bigint
                WHERE a.status = '1'
                  AND w.stage = 'board_review'
                  AND a.id IN (SELECT application_id FROM disagree_apps)
                  AND (chair_sig.signature_data_url IS NULL OR chair_sig.signature_data_url = '')`,
                [operatorUserId]
            );
            for (const row of r5b.rows) {
                items.push({
                    applicationId: row.app_id,
                    caseNumber: row.case_number,
                    applicantName: decryptName(row.name_enc, row.name_iv),
                    reasonText: '董事長第三審（董事意見/金額不一致）',
                });
            }
        }

        // accountant
        if (roles.includes('accountant')) {
            const r6 = await client.query(
                `SELECT DISTINCT a.id::text AS app_id, a.case_number,
                        u.name_enc, u.name_iv
                 FROM payment_disbursements pd
                 JOIN applications a ON a.id = pd.application_id
                 JOIN users u ON u.id = a.applicant_id
                 WHERE pd.review_stage = '3'`,
                []
            );
            for (const row of r6.rows) {
                items.push({
                    applicationId: row.app_id,
                    caseNumber: row.case_number,
                    applicantName: decryptName(row.name_enc, row.name_iv),
                    reasonText: '會計核對核銷',
                });
            }
        }

        // executive
        if (roles.includes('executive')) {
            const r7 = await client.query(
                `SELECT DISTINCT a.id::text AS app_id, a.case_number,
                        u.name_enc, u.name_iv
                 FROM payment_disbursements pd
                 JOIN applications a ON a.id = pd.application_id
                 JOIN users u ON u.id = a.applicant_id
                 WHERE pd.review_stage = '4'`,
                []
            );
            for (const row of r7.rows) {
                items.push({
                    applicationId: row.app_id,
                    caseNumber: row.case_number,
                    applicantName: decryptName(row.name_enc, row.name_iv),
                    reasonText: '執行長最終核可',
                });
            }
        }
    } finally {
        client.release();
    }

    const byId = new Map<string, MyTurnItem>();
    for (const item of items) {
        if (!byId.has(item.applicationId)) byId.set(item.applicationId, item);
    }
    return { items: Array.from(byId.values()), applicationIds: Array.from(byId.keys()) };
}
