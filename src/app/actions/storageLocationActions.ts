'use server';
import { PoolClient } from 'pg';
import { pool } from '../../lib/db';

export interface StorageLocation {
    id: number;
    parent_id: number | null;
    location_name: string;
    status: 0 | 1;
    description: string | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
    /** computed client-side */
    level?: number;
    children?: StorageLocation[];
}

export interface StorageLocationResult {
    success: boolean;
    error?: string;
    data?: StorageLocation[];
    activeChildren?: StorageLocation[];
}

/** Fetch all locations (flat list, all statuses) */
export async function fetchAllStorageLocations(): Promise<StorageLocationResult> {
    const client = await pool.connect();
    try {
        const res = await client.query<StorageLocation>(
            `SELECT id, parent_id, location_name, status, description, sort_order,
                    created_at::text, updated_at::text
             FROM file_storage_location
             ORDER BY COALESCE(parent_id, 0), sort_order, location_name`
        );
        return { success: true, data: res.rows };
    } catch (err: any) {
        console.error('fetchAllStorageLocations error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/** Get level of a node (0-indexed). */
async function getNodeLevel(client: PoolClient, parentId: number | null): Promise<number> {
    if (parentId === null) return 0; // top-level
    // Walk up the tree using a recursive CTE to count depth
    const res = await client.query<{ depth: number }>(
        `WITH RECURSIVE ancestors AS (
            SELECT id, parent_id, 0 AS depth
            FROM file_storage_location
            WHERE id = $1
            UNION ALL
            SELECT f.id, f.parent_id, a.depth + 1
            FROM file_storage_location f
            JOIN ancestors a ON f.id = a.parent_id
        )
        SELECT MAX(depth) AS depth FROM ancestors`,
        [parentId]
    );
    const depth = res.rows[0]?.depth ?? 0;
    return depth + 1; // child will be one level deeper
}

/** Add a new location */
export async function addStorageLocation(
    locationName: string,
    parentId: number | null,
    description: string | null,
    sortOrder: number
): Promise<StorageLocationResult> {
    const client = await pool.connect();
    try {
        // Enforce max 3 levels (0, 1, 2)
        const level = await getNodeLevel(client, parentId);
        if (level >= 3) {
            return { success: false, error: '位置最多只能有三層，無法在此節點下新增子項目。' };
        }

        await client.query(
            `INSERT INTO file_storage_location (parent_id, location_name, description, sort_order)
             VALUES ($1, $2, $3, $4)`,
            [parentId, locationName.trim(), description?.trim() || null, sortOrder]
        );
        return { success: true };
    } catch (err: any) {
        console.error('addStorageLocation error:', err);
        if (err.code === '23505') {
            return { success: false, error: '同一層級下已有相同名稱的位置，請使用不同的名稱。' };
        }
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/** Update an existing location */
export async function updateStorageLocation(
    id: number,
    locationName: string,
    description: string | null,
    sortOrder: number
): Promise<StorageLocationResult> {
    const client = await pool.connect();
    try {
        await client.query(
            `UPDATE file_storage_location
             SET location_name = $1, description = $2, sort_order = $3
             WHERE id = $4`,
            [locationName.trim(), description?.trim() || null, sortOrder, id]
        );
        return { success: true };
    } catch (err: any) {
        console.error('updateStorageLocation error:', err);
        if (err.code === '23505') {
            return { success: false, error: '同一層級下已有相同名稱的位置，請使用不同的名稱。' };
        }
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/** Disable a location. Checks for active children first. */
export async function disableStorageLocation(id: number): Promise<StorageLocationResult> {
    const client = await pool.connect();
    try {
        // Find active direct children
        const childRes = await client.query<StorageLocation>(
            `SELECT id, location_name FROM file_storage_location
             WHERE parent_id = $1 AND status = 1`,
            [id]
        );
        if (childRes.rows.length > 0) {
            return {
                success: false,
                error: '此節點底下仍有啟用中的子節點，請先停用所有子節點後再停用此節點。',
                activeChildren: childRes.rows as StorageLocation[],
            };
        }

        await client.query(
            `UPDATE file_storage_location SET status = 0 WHERE id = $1`,
            [id]
        );
        return { success: true };
    } catch (err: any) {
        console.error('disableStorageLocation error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}

/** Enable a location */
export async function enableStorageLocation(id: number): Promise<StorageLocationResult> {
    const client = await pool.connect();
    try {
        await client.query(
            `UPDATE file_storage_location SET status = 1 WHERE id = $1`,
            [id]
        );
        return { success: true };
    } catch (err: any) {
        console.error('enableStorageLocation error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
}
