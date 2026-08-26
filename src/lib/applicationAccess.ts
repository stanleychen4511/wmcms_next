import type { PoolClient } from 'pg';

const BROAD_CASE_VIEW_ROLES = new Set([
    'admin',
    'supervisor',
    'case_officer',
    'accountant',
    'executive',
]);

export async function fetchUserRoleCodes(client: PoolClient, userId: string): Promise<Set<string>> {
    if (!/^\d+$/.test(userId)) return new Set();
    const res = await client.query<{ code: string }>(
        `SELECT r.code
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1::bigint`,
        [userId],
    );
    return new Set(res.rows.map(row => row.code));
}

/**
 * 董事最小曝光：
 * - 董事長不受限制。
 * - 目前以董事身分操作，或帳號只有董事而沒有其他廣域案件角色時，僅能看獲派／已簽章案件。
 * - 多角色帳號切換到其合法的非董事角色時，保留該角色原有視野。
 */
export async function isRestrictedBoardViewer(
    client: PoolClient,
    userId: string,
    actingRole?: string,
): Promise<boolean> {
    const roles = await fetchUserRoleCodes(client, userId);
    if (roles.has('chairman')) return false;
    if (!roles.has('board_member')) return false;
    if (actingRole === 'board_member') return true;
    return !Array.from(roles).some(role => BROAD_CASE_VIEW_ROLES.has(role));
}

/** SQL 片段；userParam 必須是已加入 query params 的 bigint placeholder。 */
export function boardApplicationAccessSql(applicationAlias: string, userParam: string): string {
    return `(
        EXISTS (
            SELECT 1
            FROM board_review_signatures access_sig
            WHERE access_sig.application_id = ${applicationAlias}.id
              AND access_sig.signer_user_id = ${userParam}::bigint
        )
        OR (
            ${applicationAlias}.status = '1'
            AND EXISTS (
                SELECT 1
                FROM board_review_assignments access_bra
                JOIN board_group_members access_bgm ON access_bgm.group_id = access_bra.group_id
                WHERE access_bra.application_id = ${applicationAlias}.id
                  AND access_bgm.user_id = ${userParam}::bigint
            )
            AND (
                SELECT access_w.stage
                FROM application_workflow access_w
                WHERE access_w.application_id = ${applicationAlias}.id
                ORDER BY access_w.id DESC
                LIMIT 1
            ) = 'board_review'
        )
    )`;
}

export async function canViewApplication(
    client: PoolClient,
    userId: string,
    applicationId: string,
    actingRole?: string,
): Promise<boolean> {
    if (!/^\d+$/.test(userId) || !/^\d+$/.test(applicationId)) return false;
    if (!(await isRestrictedBoardViewer(client, userId, actingRole))) return true;

    const accessSql = boardApplicationAccessSql('a', '$2');
    const res = await client.query(
        `SELECT 1
         FROM applications a
         WHERE a.id = $1::bigint
           AND ${accessSql}
         LIMIT 1`,
        [applicationId, userId],
    );
    return (res.rowCount ?? 0) > 0;
}
