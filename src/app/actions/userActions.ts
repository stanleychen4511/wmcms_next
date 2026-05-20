'use server';

import { pool } from '../../lib/db';
import { encryptAES, decryptAES, hashPassword, generateSalt, generateBlindIndex } from '../../lib/crypto';
import { Role } from '../../types';
import { writeAuditLog } from './auditActions';

// The return interface for our client
export interface AdminUserView {
    id: string;
    account: string;
    username: string; // Decrypted name
    id_number: string; // Decrypted ID（後台帳號可能無，回傳 'N/A'）
    email: string | null;
    roles: Role[];
    is_active: boolean;
    created_at: string;
}

export interface RoleOption {
    code: Role;
    name: string; // Chinese display name from DB
}

export async function fetchRoles(): Promise<RoleOption[]> {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT code, name FROM roles ORDER BY id');
        return res.rows.map(row => ({ code: row.code as Role, name: row.name }));
    } catch (err) {
        console.error('fetchRoles error', err);
        return [];
    } finally {
        client.release();
    }
}

export async function getUsers(): Promise<AdminUserView[]> {
    const client = await pool.connect();
    try {
        const query = `
            SELECT
                u.id,
                u.account,
                u.name_enc, u.name_iv,
                u.id_number_enc, u.id_number_iv,
                u.email,
                u.is_active,
                u.created_at,
                COALESCE(
                    json_agg(r.code) FILTER (WHERE r.code IS NOT NULL),
                    '[]'
                ) as roles
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            GROUP BY u.id, u.account, u.name_enc, u.name_iv, u.id_number_enc, u.id_number_iv, u.email, u.is_active, u.created_at
            ORDER BY u.created_at DESC;
        `;
        const res = await client.query(query);

        return res.rows.map(row => {
            // Decrypt the name and id_number on the server before sending to client UI
            const name = decryptAES(row.name_enc, row.name_iv) || 'Unknown';
            let idNum = 'N/A';
            if (row.id_number_enc && row.id_number_iv) {
                idNum = decryptAES(row.id_number_enc, row.id_number_iv) || 'N/A';
            }

            return {
                id: row.id,
                account: row.account,
                username: name,
                id_number: idNum,
                email: row.email ?? null,
                roles: row.roles,
                is_active: row.is_active,
                created_at: row.created_at.toISOString().split('T')[0],
            };
        });
    } finally {
        client.release();
    }
}

export async function createUser(data: {
    account: string;
    plainName: string;
    plainId?: string;          // 後台帳號可選；申請人帳號才必填
    plainPass: string;
    roles: Role[];
    email?: string;
}): Promise<{ success: boolean; error?: string }> {
    // Email 若有提供則驗證格式
    const trimmedEmail = (data.email ?? '').trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return { success: false, error: '請填寫有效的 Email 地址' };
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Prepare secure data
        //    salt 一律以 32-byte Buffer 存入 BYTEA（與 seed_admin / CLAUDE.md 規定一致）；
        //    hashPassword 用 saltBuffer 當 key — login 時讀回的 Buffer 直接傳 HMAC 才能對上。
        //    bidx 仍用 hex string 當 key（generateBlindIndex 內部會 utf-8 encode，與 .toString('hex') 等價）。
        const searchSalt = generateSalt();
        const saltBuffer = Buffer.from(searchSalt, 'hex');
        const passHash = hashPassword(data.plainPass, saltBuffer);

        const { enc: nameEnc, iv: nameIv } = encryptAES(data.plainName);
        const nameBidx = generateBlindIndex(data.plainName, searchSalt);

        // ID 為可選；空字串時三欄一律存 NULL
        const plainId = (data.plainId ?? '').trim();
        const hasId = plainId.length > 0;
        const { enc: idEnc, iv: idIv } = hasId ? encryptAES(plainId) : { enc: null, iv: null };
        const idBidx = hasId ? generateBlindIndex(plainId, searchSalt) : null;

        // 2. Insert into users
        const insertUserQuery = `
            INSERT INTO users (
                account, password, search_salt,
                name_enc, name_iv, name_bidx,
                id_number_enc, id_number_iv, id_number_bidx,
                email, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
            RETURNING id;
        `;

        const res = await client.query(insertUserQuery, [
            data.account, passHash, saltBuffer,
            nameEnc, nameIv, nameBidx,
            idEnc, idIv, idBidx,
            trimmedEmail || null,
        ]);
        
        const userId = res.rows[0].id;

        // 3. Insert roles
        if (data.roles && data.roles.length > 0) {
            // Get role IDs
            const roleRes = await client.query(`SELECT id, code FROM roles WHERE code = ANY($1)`, [data.roles]);
            const roleIds = roleRes.rows.map(r => r.id);
            
            for (const rId of roleIds) {
                await client.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [userId, rId]);
            }
        }

        await client.query('COMMIT');
        void writeAuditLog({
            userId: null,
            action: 'user.create',
            targetType: 'user',
            targetId: String(userId),
            detail: { account: data.account, roles: data.roles },
        });
        return { success: true };
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Error creating user', err);
        return { success: false, error: err.message || 'Unknown error' };
    } finally {
        client.release();
    }
}

export async function resetUserPassword(userId: string, newPass: string): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();
    try {
        // Fetch existing search_salt
        const res = await client.query(`SELECT search_salt FROM users WHERE id = $1`, [userId]);
        if (res.rows.length === 0) return { success: false, error: 'User not found' };
        
        const salt = res.rows[0].search_salt;
        const passHash = hashPassword(newPass, salt);
        
        await client.query(`UPDATE users SET password = $1 WHERE id = $2`, [passHash, userId]);
        return { success: true };
    } catch (err: any) {
        console.error('Error resetting password', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function updateUserEmail(userId: string, email: string): Promise<{ success: boolean; error?: string }> {
    const trimmed = (email ?? '').trim();
    // 允許清空（傳 null）或填入有效 email；其他格式拒絕
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return { success: false, error: '請填寫有效的 Email 地址' };
    }
    try {
        const res = await pool.query(
            `UPDATE users SET email = $1 WHERE id = $2::bigint RETURNING id`,
            [trimmed || null, userId]
        );
        if (res.rowCount === 0) return { success: false, error: '帳號不存在' };
        void writeAuditLog({
            userId: null,
            action: 'user.update',
            targetType: 'user',
            targetId: userId,
            detail: { field: 'email', new_value: trimmed || null },
        });
        return { success: true };
    } catch (err: any) {
        console.error('updateUserEmail error', err);
        return { success: false, error: err.message ?? '更新失敗' };
    }
}

export async function deleteUserAccount(userId: string): Promise<{ success: boolean; error?: string }> {
     // User Roles cascade on delete based on our DB schema
    try {
        await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
        return { success: true };
    } catch (err: any) {
        console.error('Error deleting user', err);
        return { success: false, error: err.message };
    }
}

export async function updateUserRoles(userId: string, targetRoles: Role[]): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();
    try {
        // 防呆：若要移除 board_member 角色，但該使用者仍是某個董事派組成員 → 阻擋並提示
        const removingBoardMember = !targetRoles.includes('board_member' as Role);
        if (removingBoardMember) {
            const grpRes = await client.query(
                `SELECT bg.name AS group_name
                 FROM board_group_members bgm
                 JOIN board_groups bg ON bg.id = bgm.group_id
                 WHERE bgm.user_id = $1::bigint`,
                [userId]
            );
            if ((grpRes.rowCount ?? 0) > 0) {
                const groupNames = grpRes.rows.map(r => r.group_name).join('、');
                return {
                    success: false,
                    error: `此人員仍隸屬於董事組別「${groupNames}」，無法移除董事身分；請先到「董事組別管理」將其從組別中移除後再操作。`,
                };
            }
        }

        await client.query('BEGIN');

        // 1. Delete old roles
        await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);

        // 2. Insert new ones
        if (targetRoles.length > 0) {
            const roleRes = await client.query(`SELECT id FROM roles WHERE code = ANY($1)`, [targetRoles]);
            for (const row of roleRes.rows) {
                await client.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [userId, row.id]);
            }
        }

        await client.query('COMMIT');
        void writeAuditLog({
            userId: null,
            action: 'user.update',
            targetType: 'user',
            targetId: userId,
            detail: { roles: targetRoles },
        });
        return { success: true };
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Error updating roles', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function loginAction(account: string, pass: string): Promise<{ success: boolean; user?: AdminUserView; error?: string }> {
    const client = await pool.connect();
    try {
        const query = `
            SELECT
                u.id, u.account, u.search_salt, u.password,
                u.name_enc, u.name_iv,
                u.id_number_enc, u.id_number_iv,
                u.email,
                u.is_active, u.created_at,
                COALESCE(
                    json_agg(r.code ORDER BY r.id) FILTER (WHERE r.code IS NOT NULL),
                    '[]'
                ) as roles
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE u.account = $1
            GROUP BY u.id, u.account, u.search_salt, u.password, u.name_enc, u.name_iv, u.id_number_enc, u.id_number_iv, u.email, u.is_active, u.created_at
        `;
        const res = await client.query(query, [account]);
        if (res.rows.length === 0) return { success: false, error: '帳號或密碼錯誤' };
        
        const row = res.rows[0];
        
        // Check active status
        if (!row.is_active) return { success: false, error: '帳號已停用' };

        // Verify password
        const passHash = hashPassword(pass, row.search_salt);
        if (passHash !== row.password) {
            return { success: false, error: '帳號或密碼錯誤' };
        }

        // Decrypt
        const name = decryptAES(row.name_enc, row.name_iv) || 'Unknown';
        let idNum = 'N/A';
        if (row.id_number_enc && row.id_number_iv) idNum = decryptAES(row.id_number_enc, row.id_number_iv) || 'N/A';

        const user: AdminUserView = {
            id: row.id,
            account: row.account,
            username: name,
            id_number: idNum,
            email: row.email ?? null,
            roles: row.roles,
            is_active: row.is_active,
            created_at: row.created_at.toISOString().split('T')[0],
        };

        void writeAuditLog({
            userId: user.id,
            action: 'user.login',
            targetType: 'user',
            targetId: user.id,
        });
        return { success: true, user };
    } catch (err: any) {
        console.error('Login error', err);
        return { success: false, error: '系統錯誤' };
    } finally {
        client.release();
    }
}

/**
 * Fetch a list of decrypted names for all users with 'case_officer' role.
 * Used for filtering dropdowns.
 */
export async function fetchCaseOfficers(): Promise<string[]> {
    const client = await pool.connect();
    try {
        const query = `
            SELECT DISTINCT ON (u.id) u.name_enc, u.name_iv
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE r.code = 'case_officer'
              AND u.is_active = TRUE;
        `;
        const res = await client.query(query);
        return res.rows.map(row => decryptAES(row.name_enc, row.name_iv) || 'Unknown');
    } catch (err) {
        console.error('fetchCaseOfficers error', err);
        return [];
    } finally {
        client.release();
    }
}

/**
 * Fetch case officers with their user IDs for assignment dropdowns.
 */
export async function fetchCaseOfficersWithId(): Promise<{ id: string; name: string }[]> {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT DISTINCT ON (u.id) u.id, u.name_enc, u.name_iv
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE r.code = 'case_officer'
              AND u.is_active = TRUE
            ORDER BY u.id
        `);
        return res.rows.map(row => ({
            id: String(row.id),
            name: decryptAES(row.name_enc, row.name_iv) || 'Unknown',
        }));
    } catch (err) {
        console.error('fetchCaseOfficersWithId error', err);
        return [];
    } finally {
        client.release();
    }
}

export async function toggleUserActive(
    userId: string,
    activate: boolean
): Promise<{ success: boolean; blocked?: boolean; activeCases?: { caseNumber: string; applicantName: string }[]; error?: string }> {
    const client = await pool.connect();
    try {
        if (!activate) {
            // Check for active (non-terminal) cases assigned to this officer
            const casesRes = await client.query(
                `SELECT a.case_number, u2.name_enc, u2.name_iv
                 FROM applications a
                 LEFT JOIN users u2 ON u2.id = a.applicant_id
                 WHERE a.officer_id = $1 AND a.status NOT IN ('2', '4')`,
                [userId]
            );
            if (casesRes.rows.length > 0) {
                const { decryptAES } = await import('../../lib/crypto');
                const activeCases = casesRes.rows.map((r: any) => ({
                    caseNumber: r.case_number,
                    applicantName: r.name_enc && r.name_iv
                        ? (decryptAES(r.name_enc, r.name_iv) || '未知')
                        : '未知',
                }));
                return { success: false, blocked: true, activeCases };
            }
        }
        await client.query(
            `UPDATE users SET is_active = $1 WHERE id = $2`,
            [activate, userId]
        );
        void (await import('./auditActions')).writeAuditLog({
            userId: null,
            action: activate ? 'user.activate' : 'user.deactivate',
            targetType: 'user',
            targetId: userId,
            detail: {},
        });
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function reassignOfficer(
    applicationId: string,
    newOfficerId: string,
    operatorUserId?: string
): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();
    try {
        await client.query(
            `UPDATE applications SET officer_id = $1 WHERE id = $2`,
            [newOfficerId, applicationId]
        );
        void (await import('./auditActions')).writeAuditLog({
            userId: operatorUserId ?? null,
            action: 'application.reassign_officer',
            targetType: 'application',
            targetId: applicationId,
            detail: { newOfficerId },
        });
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

// ─── Notification channel preferences (Phase 3) ──────────────────────────────

const VALID_NOTIFICATION_CHANNELS = ['email', 'line'] as const;
type NotificationChannel = typeof VALID_NOTIFICATION_CHANNELS[number];

export async function fetchUserNotificationChannels(
    operatorUserId: string,
): Promise<{ success: boolean; data?: { channels: NotificationChannel[]; lineLinked: boolean; email: string | null }; error?: string }> {
    if (!/^\d+$/.test(operatorUserId)) return { success: false, error: '無效的使用者 ID' };
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT notification_channels, line_user_id, email FROM users WHERE id = $1::bigint LIMIT 1`,
            [operatorUserId]
        );
        if (res.rowCount === 0) return { success: false, error: '使用者不存在' };
        const row = res.rows[0];
        return {
            success: true,
            data: {
                channels: (row.notification_channels ?? ['email']).filter((c: string) =>
                    VALID_NOTIFICATION_CHANNELS.includes(c as NotificationChannel)
                ) as NotificationChannel[],
                lineLinked: !!row.line_user_id,
                email: row.email ?? null,
            },
        };
    } catch (err: any) {
        console.error('fetchUserNotificationChannels error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

export async function updateUserNotificationChannels(
    operatorUserId: string,
    channels: string[],
): Promise<{ success: boolean; error?: string }> {
    if (!/^\d+$/.test(operatorUserId)) return { success: false, error: '無效的使用者 ID' };
    if (!Array.isArray(channels) || channels.length < 1) {
        return { success: false, error: '請至少選擇一個通知方式' };
    }
    const dedup = Array.from(new Set(channels));
    for (const c of dedup) {
        if (!VALID_NOTIFICATION_CHANNELS.includes(c as NotificationChannel)) {
            return { success: false, error: `不支援的通知方式：${c}` };
        }
    }

    const client = await pool.connect();
    try {
        if (dedup.includes('line')) {
            const res = await client.query(
                `SELECT line_user_id FROM users WHERE id = $1::bigint LIMIT 1`,
                [operatorUserId]
            );
            if (res.rowCount === 0) return { success: false, error: '使用者不存在' };
            if (!res.rows[0].line_user_id) {
                return { success: false, error: '尚未綁定 LINE 帳號，請先完成綁定' };
            }
        }

        await client.query(
            `UPDATE users SET notification_channels = $1::text[] WHERE id = $2::bigint`,
            [dedup, operatorUserId]
        );

        void writeAuditLog({
            userId: operatorUserId,
            action: 'user.notification_channels_updated',
            targetType: 'user',
            targetId: operatorUserId,
            detail: { channels: dedup },
        });
        return { success: true };
    } catch (err: any) {
        console.error('updateUserNotificationChannels error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}
