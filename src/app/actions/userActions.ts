'use server';

import { pool } from '../../lib/db';
import { encryptAES, decryptAES, hashPassword, generateSalt, generateBlindIndex } from '../../lib/crypto';
import { Role } from '../../types';

// The return interface for our client
export interface AdminUserView {
    id: string;
    account: string;
    username: string; // Decrypted name
    id_number: string; // Decrypted ID
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
                u.is_active, 
                u.created_at,
                COALESCE(
                    json_agg(r.code) FILTER (WHERE r.code IS NOT NULL), 
                    '[]'
                ) as roles
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            GROUP BY u.id, u.account, u.name_enc, u.name_iv, u.id_number_enc, u.id_number_iv, u.is_active, u.created_at
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
                roles: row.roles,
                is_active: row.is_active,
                created_at: row.created_at.toISOString().split('T')[0],
            };
        });
    } finally {
        client.release();
    }
}

export async function createUser(data: { account: string; plainName: string; plainId: string; plainPass: string; roles: Role[] }): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Prepare secure data
        const searchSalt = generateSalt();
        const passHash = hashPassword(data.plainPass, searchSalt);
        
        const { enc: nameEnc, iv: nameIv } = encryptAES(data.plainName);
        const nameBidx = generateBlindIndex(data.plainName, searchSalt);
        
        const { enc: idEnc, iv: idIv } = encryptAES(data.plainId);
        const idBidx = generateBlindIndex(data.plainId, searchSalt);

        // 2. Insert into users
        const insertUserQuery = `
            INSERT INTO users (
                account, password, search_salt,
                name_enc, name_iv, name_bidx,
                id_number_enc, id_number_iv, id_number_bidx,
                is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
            RETURNING id;
        `;
        
        const res = await client.query(insertUserQuery, [
            data.account, passHash, searchSalt,
            nameEnc, nameIv, nameBidx,
            idEnc, idIv, idBidx
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
                u.is_active, u.created_at,
                COALESCE(
                    json_agg(r.code ORDER BY r.id) FILTER (WHERE r.code IS NOT NULL),
                    '[]'
                ) as roles
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE u.account = $1
            GROUP BY u.id, u.account, u.search_salt, u.password, u.name_enc, u.name_iv, u.id_number_enc, u.id_number_iv, u.is_active, u.created_at
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
            roles: row.roles,
            is_active: row.is_active,
            created_at: row.created_at.toISOString().split('T')[0],
        };

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
            SELECT u.name_enc, u.name_iv 
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE r.code = 'case_officer' OR r.id = 2;
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
