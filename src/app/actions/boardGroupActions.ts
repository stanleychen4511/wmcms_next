'use server';

import { pool } from '../../lib/db';
import { decryptAES } from '../../lib/crypto';
import { writeAuditLog } from './auditActions';
import { canViewApplication } from '../../lib/applicationAccess';
import { fetchSetting } from './settingsActions';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BoardGroupMember {
    userId: string;
    name: string;
    account: string;
}

export interface BoardGroup {
    id: string;
    name: string;
    priority: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    members: BoardGroupMember[];
    openCaseCount: number;   // count of currently-open board_review assignments
}

export interface CaseBoardInfo {
    applicationId: string;
    groupId: string;
    groupName: string;
    assignedAt: string;
    assignedBy: string | null;
    assignMode: 'auto' | 'manual';
    members: Array<{
        userId: string;
        name: string;
        account: string;
    }>;
}

type ActionResult<T = undefined> = T extends undefined
    ? { success: boolean; error?: string }
    : { success: boolean; data?: T; error?: string };

// ─── Permission helper ───────────────────────────────────────────────────────

async function hasRole(client: any, userId: string | null, roles: string[]): Promise<boolean> {
    if (!userId) return false;
    const res = await client.query(
        `SELECT 1 FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1::bigint AND r.code = ANY($2::text[])
         LIMIT 1`,
        [userId, roles]
    );
    return (res.rowCount ?? 0) > 0;
}

async function isChairmanOrAdmin(client: any, userId: string | null): Promise<boolean> {
    return hasRole(client, userId, ['chairman', 'admin']);
}

// ─── CRUD: board_groups ──────────────────────────────────────────────────────

function decryptName(enc: any, iv: any): string {
    if (!enc || !iv) return '未知';
    return decryptAES(enc, iv) || '未知';
}

async function loadGroupRows(client: any, activeOnly: boolean): Promise<BoardGroup[]> {
    const filter = activeOnly ? `WHERE g.is_active = TRUE` : '';
    const groupRes = await client.query(
        `SELECT g.id, g.name, g.priority, g.is_active, g.created_at, g.updated_at,
                COALESCE(c.cnt, 0) AS open_count
         FROM board_groups g
         LEFT JOIN (
             SELECT a.group_id, COUNT(*)::int AS cnt
             FROM board_review_assignments a
             JOIN applications ap ON ap.id = a.application_id
             JOIN LATERAL (
                 SELECT stage FROM application_workflow
                 WHERE application_id = ap.id
                 ORDER BY id DESC LIMIT 1
             ) w ON TRUE
             WHERE ap.status = '1' AND w.stage = 'board_review'
             GROUP BY a.group_id
         ) c ON c.group_id = g.id
         ${filter}
         ORDER BY g.priority ASC, g.name ASC`
    );
    if (groupRes.rows.length === 0) return [];

    const ids = groupRes.rows.map((r: any) => r.id);
    const memRes = await client.query(
        `SELECT m.group_id, u.id::text AS user_id, u.account, u.name_enc, u.name_iv
         FROM board_group_members m
         JOIN users u ON u.id = m.user_id
         WHERE m.group_id = ANY($1::bigint[])
         ORDER BY u.account ASC`,
        [ids]
    );
    const byGroup = new Map<string, BoardGroupMember[]>();
    for (const row of memRes.rows) {
        const gid = String(row.group_id);
        if (!byGroup.has(gid)) byGroup.set(gid, []);
        byGroup.get(gid)!.push({
            userId: String(row.user_id),
            name: decryptName(row.name_enc, row.name_iv),
            account: row.account,
        });
    }

    return groupRes.rows.map((r: any) => ({
        id: String(r.id),
        name: r.name,
        priority: r.priority ?? 0,
        isActive: r.is_active,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : '',
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : '',
        members: byGroup.get(String(r.id)) ?? [],
        openCaseCount: r.open_count ?? 0,
    }));
}

export async function fetchAllBoardGroups(): Promise<ActionResult<BoardGroup[]>> {
    const client = await pool.connect();
    try {
        const data = await loadGroupRows(client, false);
        return { success: true, data };
    } catch (err: any) {
        console.error('fetchAllBoardGroups error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function fetchActiveBoardGroups(): Promise<ActionResult<BoardGroup[]>> {
    const client = await pool.connect();
    try {
        const data = await loadGroupRows(client, true);
        return { success: true, data };
    } catch (err: any) {
        console.error('fetchActiveBoardGroups error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function createBoardGroup(
    name: string,
    priority: number,
    memberUserIds: string[],
    operatorUserId: string,
): Promise<ActionResult<{ id: string }>> {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return { success: false, error: '組別名稱為必填' };
    if (!memberUserIds || memberUserIds.length === 0) {
        return { success: false, error: '至少需指定一位董事成員' };
    }

    const client = await pool.connect();
    try {
        if (!(await isChairmanOrAdmin(client, operatorUserId))) {
            return { success: false, error: '無權限執行此操作' };
        }

        await client.query('BEGIN');
        const insertRes = await client.query(
            `INSERT INTO board_groups (name, priority, is_active)
             VALUES ($1, $2, TRUE) RETURNING id`,
            [trimmed, priority | 0]
        );
        const newId = String(insertRes.rows[0].id);

        for (const uid of memberUserIds) {
            await client.query(
                `INSERT INTO board_group_members (group_id, user_id) VALUES ($1::bigint, $2::bigint)`,
                [newId, uid]
            );
        }
        await client.query('COMMIT');

        void writeAuditLog({
            userId: operatorUserId,
            action: 'board_group.create',
            targetType: 'board_group',
            targetId: newId,
            detail: { name: trimmed, priority, memberUserIds },
        });
        return { success: true, data: { id: newId } };
    } catch (err: any) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        if (err.code === '23505') {
            // UNIQUE violation: either duplicate group name or user already in another group
            const msg = err.constraint?.includes('name')
                ? `組別名稱「${trimmed}」已存在`
                : '其中一位董事已屬於其他組別（一位董事僅能屬於一組）';
            return { success: false, error: msg };
        }
        console.error('createBoardGroup error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function updateBoardGroup(
    id: string,
    name: string,
    priority: number,
    memberUserIds: string[],
    operatorUserId: string,
): Promise<ActionResult> {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return { success: false, error: '組別名稱為必填' };
    if (!memberUserIds || memberUserIds.length === 0) {
        return { success: false, error: '至少需保留一位董事成員' };
    }

    const client = await pool.connect();
    try {
        if (!(await isChairmanOrAdmin(client, operatorUserId))) {
            return { success: false, error: '無權限執行此操作' };
        }

        await client.query('BEGIN');
        const upRes = await client.query(
            `UPDATE board_groups
             SET name = $1, priority = $2, updated_at = NOW()
             WHERE id = $3::bigint`,
            [trimmed, priority | 0, id]
        );
        if (upRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '組別不存在' };
        }

        // Replace members: delete then re-insert. CASCADE 不適用（member 是 group 的子），
        // 但我們只刪 board_group_members 這張表的 row，不動既有 assignments / votes。
        await client.query(`DELETE FROM board_group_members WHERE group_id = $1::bigint`, [id]);
        for (const uid of memberUserIds) {
            await client.query(
                `INSERT INTO board_group_members (group_id, user_id) VALUES ($1::bigint, $2::bigint)`,
                [id, uid]
            );
        }
        await client.query('COMMIT');

        void writeAuditLog({
            userId: operatorUserId,
            action: 'board_group.update',
            targetType: 'board_group',
            targetId: id,
            detail: { name: trimmed, priority, memberUserIds },
        });
        return { success: true };
    } catch (err: any) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        if (err.code === '23505') {
            const msg = err.constraint?.includes('name')
                ? `組別名稱「${trimmed}」已被其他組別使用`
                : '其中一位董事已屬於其他組別';
            return { success: false, error: msg };
        }
        console.error('updateBoardGroup error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function toggleBoardGroupActive(
    id: string,
    isActive: boolean,
    operatorUserId: string,
): Promise<ActionResult> {
    const client = await pool.connect();
    try {
        if (!(await isChairmanOrAdmin(client, operatorUserId))) {
            return { success: false, error: '無權限執行此操作' };
        }

        const res = await client.query(
            `UPDATE board_groups SET is_active = $1, updated_at = NOW() WHERE id = $2::bigint`,
            [isActive, id]
        );
        if (res.rowCount === 0) return { success: false, error: '組別不存在' };

        void writeAuditLog({
            userId: operatorUserId,
            action: 'board_group.toggle_active',
            targetType: 'board_group',
            targetId: id,
            detail: { is_active: isActive },
        });
        return { success: true };
    } catch (err: any) {
        console.error('toggleBoardGroupActive error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function deleteBoardGroup(
    id: string,
    operatorUserId: string,
): Promise<ActionResult> {
    const client = await pool.connect();
    try {
        if (!(await isChairmanOrAdmin(client, operatorUserId))) {
            return { success: false, error: '無權限執行此操作' };
        }

        // Guard: fail if any assignments reference this group
        const refRes = await client.query(
            `SELECT 1 FROM board_review_assignments WHERE group_id = $1::bigint LIMIT 1`,
            [id]
        );
        if ((refRes.rowCount ?? 0) > 0) {
            return {
                success: false,
                error: '此組別已有案件派案紀錄，無法刪除；請改以「停用」保留歷史',
            };
        }

        const delRes = await client.query(
            `DELETE FROM board_groups WHERE id = $1::bigint`,
            [id]
        );
        if (delRes.rowCount === 0) return { success: false, error: '組別不存在' };

        void writeAuditLog({
            userId: operatorUserId,
            action: 'board_group.delete',
            targetType: 'board_group',
            targetId: id,
            detail: {},
        });
        return { success: true };
    } catch (err: any) {
        console.error('deleteBoardGroup error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

// ─── Case assignment ─────────────────────────────────────────────────────────

/**
 * Manually assign (or re-assign) an application to a board group.
 * On re-assignment, historical votes (is_approved IS NOT NULL) are preserved;
 * unvoted slots (is_approved IS NULL) are deleted.
 */
export async function assignCaseToBoardGroup(
    applicationId: string,
    groupId: string,
    operatorUserId: string | null,
    mode: 'auto' | 'manual',
): Promise<ActionResult<{ reassigned: boolean }>> {
    if (!/^\d+$/.test(applicationId)) return { success: false, error: '無效的案件 ID' };
    if (!/^\d+$/.test(groupId)) return { success: false, error: '無效的組別 ID' };

    const client = await pool.connect();
    try {
        // Permission: allow null (system) for auto mode; otherwise require chairman/admin
        if (operatorUserId !== null) {
            if (!(await isChairmanOrAdmin(client, operatorUserId))) {
                return { success: false, error: '無權限派案' };
            }
        } else if (mode !== 'auto') {
            return { success: false, error: '手動派案需指定操作者' };
        }

        await client.query('BEGIN');

        // Validate stage & status
        const caseRes = await client.query(
            `SELECT a.status, w.stage
             FROM applications a
             LEFT JOIN LATERAL (
                 SELECT stage FROM application_workflow
                 WHERE application_id = a.id
                 ORDER BY id DESC LIMIT 1
             ) w ON TRUE
             WHERE a.id = $1::bigint LIMIT 1`,
            [applicationId]
        );
        if (caseRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '案件不存在' };
        }
        const c = caseRes.rows[0];
        if (c.status !== '1' || c.stage !== 'board_review') {
            await client.query('ROLLBACK');
            return { success: false, error: '僅 board_review 階段的進行中案件可派組' };
        }

        // Validate group active + has members
        const gRes = await client.query(
            `SELECT g.is_active,
                    (SELECT COUNT(*) FROM board_group_members WHERE group_id = g.id) AS member_count
             FROM board_groups g WHERE g.id = $1::bigint LIMIT 1`,
            [groupId]
        );
        if (gRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '組別不存在' };
        }
        if (!gRes.rows[0].is_active) {
            await client.query('ROLLBACK');
            return { success: false, error: '組別已停用' };
        }
        if (Number(gRes.rows[0].member_count) === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '組別沒有成員，無法派案' };
        }

        // Check if already assigned → re-assignment
        const existRes = await client.query(
            `SELECT group_id FROM board_review_assignments WHERE application_id = $1::bigint LIMIT 1`,
            [applicationId]
        );
        const reassigned = (existRes.rowCount ?? 0) > 0;

        if (reassigned) {
            // Re-assignment only updates the assignment row. Do NOT touch
            // applications.approved_amount or application_workflow.comments —
            // the new group inherits whatever the previous group drafted, and
            // may overwrite via saveBoardReviewDraft.
            await client.query(
                `UPDATE board_review_assignments
                 SET group_id = $1::bigint, assigned_at = NOW(),
                     assigned_by = $2, assign_mode = $3
                 WHERE application_id = $4::bigint`,
                [groupId, operatorUserId, mode, applicationId]
            );
            // Existing signatures are bound to the previous group; reassigning invalidates all
            const { clearStaleSignatures } = await import('./boardSignatureActions');
            await clearStaleSignatures(client, applicationId, 'reassigned');
        } else {
            await client.query(
                `INSERT INTO board_review_assignments
                    (application_id, group_id, assigned_by, assign_mode)
                 VALUES ($1::bigint, $2::bigint, $3, $4)`,
                [applicationId, groupId, operatorUserId, mode]
            );
        }

        await client.query('COMMIT');

        void writeAuditLog({
            userId: operatorUserId,
            action: reassigned ? 'board_review.reassign' : 'board_review.assign',
            targetType: 'board_assignment',
            targetId: applicationId,
            detail: { group_id: groupId, mode },
        });

        // Phase 3: 觸發 case_assigned_to_board_group 事件通知（fire-and-forget）
        // Reassignment 使用新 groupId，舊組成員不會被通知
        const { notifyEvent } = await import('./notificationDispatcher');
        void notifyEvent('case_assigned_to_board_group', { applicationId, groupId })
            .catch(err => console.error('[notify] case_assigned_to_board_group failed:', err));

        return { success: true, data: { reassigned } };
    } catch (err: any) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        console.error('assignCaseToBoardGroup error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/**
 * Pick the best group (fewest open cases, ties broken by priority ASC) and
 * delegate to assignCaseToBoardGroup with mode='auto'.
 */
export async function autoAssignCaseToBoardGroup(
    applicationId: string,
    operatorUserId: string | null,
): Promise<ActionResult<{ groupId: string; reassigned: boolean }>> {
    const client = await pool.connect();
    try {
        const pickRes = await client.query(
            `SELECT g.id::text AS id
             FROM board_groups g
             LEFT JOIN (
                 SELECT a.group_id, COUNT(*)::int AS n
                 FROM board_review_assignments a
                 JOIN applications ap ON ap.id = a.application_id
                 JOIN LATERAL (
                     SELECT stage FROM application_workflow
                     WHERE application_id = ap.id
                     ORDER BY id DESC LIMIT 1
                 ) w ON TRUE
                 WHERE ap.status = '1' AND w.stage = 'board_review'
                 GROUP BY a.group_id
             ) c ON c.group_id = g.id
             WHERE g.is_active = TRUE
               AND EXISTS (SELECT 1 FROM board_group_members m WHERE m.group_id = g.id)
             ORDER BY COALESCE(c.n, 0) ASC, g.priority ASC, g.id ASC
             LIMIT 1`
        );
        if (pickRes.rowCount === 0) {
            return { success: false, error: '無可用董事組別' };
        }
        const groupId = pickRes.rows[0].id;
        client.release();   // release before calling nested action (new connection)
        const assignRes = await assignCaseToBoardGroup(applicationId, groupId, operatorUserId, 'auto');
        if (!assignRes.success) return { success: false, error: assignRes.error };
        return { success: true, data: { groupId, reassigned: !!assignRes.data?.reassigned } };
    } catch (err: any) {
        try { client.release(); } catch { /* ignore */ }
        console.error('autoAssignCaseToBoardGroup error:', err);
        return { success: false, error: err.message };
    }
}

export async function batchAutoAssignCases(
    applicationIds: string[],
    operatorUserId: string,
): Promise<{ total: number; success: number; failed: number; results: Array<{ applicationId: string; success: boolean; groupId?: string; error?: string }> }> {
    const results: Array<{ applicationId: string; success: boolean; groupId?: string; error?: string }> = [];
    for (const appId of applicationIds) {
        const res = await autoAssignCaseToBoardGroup(appId, operatorUserId);
        results.push({
            applicationId: appId,
            success: res.success,
            groupId: res.data?.groupId,
            error: res.error,
        });
    }
    const success = results.filter(r => r.success).length;
    return {
        total: applicationIds.length,
        success,
        failed: applicationIds.length - success,
        results,
    };
}

// ─── Query for detail page ───────────────────────────────────────────────────

export async function fetchBoardGroupForCase(
    applicationId: string,
    operatorUserId: string,
): Promise<ActionResult<CaseBoardInfo | null>> {
    if (!/^\d+$/.test(applicationId) || !/^\d+$/.test(operatorUserId)) return { success: false, error: '無效的案件或操作人員 ID' };
    const client = await pool.connect();
    try {
        if (!(await canViewApplication(client, operatorUserId, applicationId))) {
            return { success: false, error: '無權限查看此案件' };
        }
        const assignRes = await client.query(
            `SELECT a.group_id::text, g.name AS group_name,
                    a.assigned_at, a.assigned_by::text, a.assign_mode
             FROM board_review_assignments a
             JOIN board_groups g ON g.id = a.group_id
             WHERE a.application_id = $1::bigint LIMIT 1`,
            [applicationId]
        );
        if (assignRes.rowCount === 0) return { success: true, data: null };
        const a = assignRes.rows[0];

        const memRes = await client.query(
            `SELECT u.id::text AS user_id, u.account, u.name_enc, u.name_iv
             FROM board_group_members m
             JOIN users u ON u.id = m.user_id
             WHERE m.group_id = $1::bigint
             ORDER BY u.account ASC`,
            [a.group_id]
        );
        const members = memRes.rows.map((row: any) => ({
            userId: String(row.user_id),
            name: decryptName(row.name_enc, row.name_iv),
            account: row.account,
        }));

        return {
            success: true,
            data: {
                applicationId,
                groupId: a.group_id,
                groupName: a.group_name,
                assignedAt: a.assigned_at ? new Date(a.assigned_at).toISOString() : '',
                assignedBy: a.assigned_by ?? null,
                assignMode: a.assign_mode,
                members,
            },
        };
    } catch (err: any) {
        console.error('fetchBoardGroupForCase error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

// ─── Collaborative draft save ────────────────────────────────────────────────

export interface BoardReviewDraftPatch {
    approvedAmount?: number | null;
    comments?: string | null;
    isApproved?: boolean | null;
}

/**
 * Collaborative draft save by any current group member (or chairman/admin).
 * Writes to applications.approved_amount and application_workflow.comments/is_approved.
 * Audit log records only fields that actually changed; no-op if nothing changed.
 */
export async function saveBoardReviewDraft(
    applicationId: string,
    patch: BoardReviewDraftPatch,
    operatorUserId: string,
): Promise<ActionResult<{ changedFields: string[] }>> {
    if (!/^\d+$/.test(applicationId)) return { success: false, error: '無效的案件 ID' };

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Stage + status gate
        const caseRes = await client.query(
            `SELECT a.status, a.approved_amount,
                    w.stage, w.comments AS wf_comments, w.is_approved AS wf_is_approved
             FROM applications a
             LEFT JOIN LATERAL (
                 SELECT stage, comments, is_approved FROM application_workflow
                 WHERE application_id = a.id
                 ORDER BY id DESC LIMIT 1
             ) w ON TRUE
             WHERE a.id = $1::bigint LIMIT 1`,
            [applicationId]
        );
        if (caseRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '案件不存在' };
        }
        const row = caseRes.rows[0];
        if (row.status !== '1' || row.stage !== 'board_review') {
            await client.query('ROLLBACK');
            return { success: false, error: '僅 board_review 階段的進行中案件可儲存董事審核草稿' };
        }

        // 2. Assignment required
        const asgRes = await client.query(
            `SELECT group_id FROM board_review_assignments WHERE application_id = $1::bigint LIMIT 1`,
            [applicationId]
        );
        if (asgRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return { success: false, error: '案件尚未派組，無法儲存' };
        }
        const assignedGroupId = String(asgRes.rows[0].group_id);

        // 3. Permission: member of assigned group OR admin OR chairman
        const memRes = await client.query(
            `SELECT 1 FROM board_group_members
             WHERE group_id = $1::bigint AND user_id = $2::bigint LIMIT 1`,
            [assignedGroupId, operatorUserId]
        );
        const isMember = (memRes.rowCount ?? 0) > 0;
        const isPrivileged = !isMember && (await isChairmanOrAdmin(client, operatorUserId));
        if (!isMember && !isPrivileged) {
            await client.query('ROLLBACK');
            return { success: false, error: '僅本案派組成員、chairman 或 admin 可編輯董事審核' };
        }

        // 4. Compute diff (only fields in patch are considered)
        const currentAmount = row.approved_amount != null ? Number(row.approved_amount) : null;
        const currentComments = row.wf_comments ?? null;
        const currentIsApproved = row.wf_is_approved;

        const nextAmount = patch.approvedAmount !== undefined
            ? (patch.approvedAmount != null ? Number(patch.approvedAmount) : null)
            : currentAmount;
        const nextComments = patch.comments !== undefined
            ? (patch.comments && patch.comments.trim() !== '' ? patch.comments : null)
            : currentComments;
        const nextIsApproved = patch.isApproved !== undefined ? patch.isApproved : currentIsApproved;

        const changedFields: string[] = [];
        const before: Record<string, unknown> = {};
        const after: Record<string, unknown> = {};

        if (patch.approvedAmount !== undefined && nextAmount !== currentAmount) {
            changedFields.push('approvedAmount');
            before.approvedAmount = currentAmount;
            after.approvedAmount = nextAmount;
        }
        if (patch.comments !== undefined && nextComments !== currentComments) {
            changedFields.push('comments');
            before.comments = currentComments;
            after.comments = nextComments;
        }
        if (patch.isApproved !== undefined && nextIsApproved !== currentIsApproved) {
            changedFields.push('isApproved');
            before.isApproved = currentIsApproved;
            after.isApproved = nextIsApproved;
        }

        if (changedFields.length === 0) {
            await client.query('COMMIT');
            return { success: true, data: { changedFields: [] } };
        }

        // 5. UPDATE applications (if approvedAmount or comments changed)
        //    - approved_amount: 既有
        //    - board_review_comments: 永久保存欄位（case-scoped），與 application_workflow.comments 同步
        if (changedFields.includes('approvedAmount') || changedFields.includes('comments')) {
            const sets: string[] = [];
            const params: unknown[] = [];
            if (changedFields.includes('approvedAmount')) {
                params.push(nextAmount);
                sets.push(`approved_amount = $${params.length}`);
            }
            if (changedFields.includes('comments')) {
                params.push(nextComments);
                sets.push(`board_review_comments = $${params.length}`);
            }
            params.push(applicationId);
            await client.query(
                `UPDATE applications SET ${sets.join(', ')}, updated_at = NOW()
                 WHERE id = $${params.length}::bigint`,
                params
            );
        }

        // 6. UPDATE application_workflow（草稿存檔不 INSERT 新列，只更新「最新一列」）
        if (changedFields.includes('comments') || changedFields.includes('isApproved')) {
            await client.query(
                `UPDATE application_workflow
                 SET comments = $1, is_approved = $2, reviewed_at = NOW()
                 WHERE id = (
                     SELECT id FROM application_workflow
                     WHERE application_id = $3::bigint
                     ORDER BY id DESC LIMIT 1
                 )`,
                [nextComments, nextIsApproved, applicationId]
            );
        }

        // Invalidate any existing e-signatures since content changed
        const { clearStaleSignatures } = await import('./boardSignatureActions');
        await clearStaleSignatures(client, applicationId, 'content_changed');

        await client.query('COMMIT');

        void writeAuditLog({
            userId: operatorUserId,
            action: 'board_review.draft_save',
            targetType: 'application',
            targetId: applicationId,
            detail: { changedFields, before, after },
        });

        return { success: true, data: { changedFields } };
    } catch (err: any) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        console.error('saveBoardReviewDraft error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

// ─── Helper: predicate for "is current user on this case's assigned group?" ──

export async function isUserInAssignedGroupForCase(
    applicationId: string,
    userId: string,
): Promise<ActionResult<boolean>> {
    if (!/^\d+$/.test(applicationId)) return { success: false, error: '無效的案件 ID' };
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT 1
             FROM board_review_assignments a
             JOIN board_group_members m ON m.group_id = a.group_id
             WHERE a.application_id = $1::bigint AND m.user_id = $2::bigint
             LIMIT 1`,
            [applicationId, userId]
        );
        return { success: true, data: (res.rowCount ?? 0) > 0 };
    } catch (err: any) {
        console.error('isUserInAssignedGroupForCase error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

// ─── Helper: list candidate board members for group assignment UI ────────────

export async function fetchBoardMemberCandidates(): Promise<ActionResult<Array<{ id: string; name: string; account: string; currentGroupId: string | null }>>> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT u.id::text AS id, u.account, u.name_enc, u.name_iv,
                    m.group_id::text AS current_group_id
             FROM users u
             JOIN user_roles ur ON ur.user_id = u.id
             JOIN roles r ON r.id = ur.role_id
             LEFT JOIN board_group_members m ON m.user_id = u.id
             WHERE r.code = 'board_member' AND u.is_active = TRUE
             ORDER BY u.account ASC`
        );
        const data = res.rows.map((row: any) => ({
            id: row.id,
            name: decryptName(row.name_enc, row.name_iv),
            account: row.account,
            currentGroupId: row.current_group_id ?? null,
        }));
        return { success: true, data };
    } catch (err: any) {
        console.error('fetchBoardMemberCandidates error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

// ─── Helper for workflowActions to hook in auto-assign ───────────────────────

/**
 * Called by advanceWorkflowStage after a successful COMMIT when toStage === 'board_review'.
 * Respects the `board_auto_assign` setting. Non-blocking: failures only log.
 */
export async function maybeAutoAssignOnBoardReviewEntry(applicationId: string): Promise<void> {
    try {
        const flag = await fetchSetting('board_auto_assign', 'false');
        if (flag !== 'true') return;
        const res = await autoAssignCaseToBoardGroup(applicationId, null);
        if (!res.success) {
            console.warn(`[auto-assign] skipped for application ${applicationId}: ${res.error}`);
        }
    } catch (err: any) {
        console.warn(`[auto-assign] unexpected error for application ${applicationId}:`, err.message);
    }
}
