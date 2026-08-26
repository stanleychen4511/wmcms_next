'use server';

/**
 * 案件統計 server actions（admin / supervisor / chairman / board_member 可呼叫）。
 *
 * 狀態定義：
 *   通過 (approved)  = applications.status IN ('3', '4')
 *   未通過 (rejected) = applications.status = '2'
 *   進行中 (inProgress) = applications.status = '1' — 不列入 approval rate 分母
 *
 * 日期區間以 applications.apply_at 為基準（包含 toDate 當日，apply_at IS NULL 排除）。
 */

import { pool } from '../../lib/db';
import { formatDateOnly } from '../../lib/dateOnly';
import { decryptAES } from '../../lib/crypto';
import { writeAuditLog } from './auditActions';
import { boardApplicationAccessSql, isRestrictedBoardViewer } from '../../lib/applicationAccess';

const VIEW_ROLES = ['admin', 'supervisor', 'chairman', 'board_member'] as const;
type ViewRole = typeof VIEW_ROLES[number];

// ─── Types ────────────────────────────────────────────────────────────────

export interface CaseStatisticsTotal {
    approved: number;
    rejected: number;
    inProgress: number;
    approvalRate: number;   // 0..1，4 位小數
}

export interface ByCategoryItem {
    category: 'A' | 'B' | 'C' | 'D' | 'unknown';
    approved: number;
    rejected: number;
}

export interface ByOfficerItem {
    officerId: string | null;
    officerName: string;
    approved: number;
    rejected: number;
}

export interface BySourceData {
    selfApply: { approved: number; rejected: number };
    referrals: Array<{
        referralUnitId: string | null;
        referralUnitName: string;
        approved: number;
        rejected: number;
    }>;
}

export interface ByMonthItem {
    yearMonth: string;   // YYYY-MM
    approved: number;
    rejected: number;
}

export interface CaseStatistics {
    fromDate: string;
    toDate: string;
    total: CaseStatisticsTotal;
    byCategory: ByCategoryItem[];
    byOfficer: ByOfficerItem[];
    bySource: BySourceData;
    byMonth: ByMonthItem[];
}

export interface StatsDrillDownRow {
    caseId: string;
    caseNumber: string;
    applicantName: string;
    applyAt: string;       // YYYY-MM-DD
    approvedAmount: number | null;
    latestComment: string;
}

export type StatsDimension = 'category' | 'officer' | 'source' | 'month';
export type StatsOutcome = 'approved' | 'rejected';

type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────

async function assertHasAnyRole(
    operatorUserId: string,
    codes: readonly string[]
): Promise<boolean> {
    if (!operatorUserId || !/^\d+$/.test(operatorUserId)) return false;
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT 1 FROM user_roles ur
             JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = $1::bigint AND r.code = ANY($2::text[])
             LIMIT 1`,
            [operatorUserId, codes as readonly string[]]
        );
        return (res.rowCount ?? 0) > 0;
    } finally {
        client.release();
    }
}

/** 回傳優先序最高的 view role（admin > supervisor > chairman > board_member）。 */
async function resolveOperatorRole(operatorUserId: string): Promise<ViewRole | null> {
    if (!operatorUserId || !/^\d+$/.test(operatorUserId)) return null;
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT r.code FROM user_roles ur
             JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = $1::bigint AND r.code = ANY($2::text[])`,
            [operatorUserId, VIEW_ROLES as readonly string[]]
        );
        const got = new Set<string>(res.rows.map((r: any) => r.code));
        for (const role of VIEW_ROLES) {
            if (got.has(role)) return role;
        }
        return null;
    } finally {
        client.release();
    }
}

function decryptName(enc: Buffer | null, iv: Buffer | null, fallback: string): string {
    if (!enc || !iv) return fallback;
    try {
        return decryptAES(enc, iv) || fallback;
    } catch {
        return fallback;
    }
}

function isApproved(status: string): boolean {
    return status === '3' || status === '4';
}
function isRejected(status: string): boolean {
    return status === '2';
}
function isInProgress(status: string): boolean {
    return status === '1';
}

/** 從 application_type / case_number 解析類別 */
function resolveCategory(applicationType: string | null, caseNumber: string | null): 'A' | 'B' | 'C' | 'D' | 'unknown' {
    const t = applicationType as 'A' | 'B' | 'C' | 'D' | null;
    if (t === 'A' || t === 'B' || t === 'C' || t === 'D') return t;
    if (caseNumber) {
        const c = caseNumber[0] as 'A' | 'B' | 'C' | 'D';
        if (c === 'A' || c === 'B' || c === 'C' || c === 'D') return c;
    }
    return 'unknown';
}

/** 列出 from~to 月份，YYYY-MM */
function enumerateMonths(fromDate: string, toDate: string): string[] {
    const months: string[] = [];
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return months;
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cursor <= end) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, '0');
        months.push(`${y}-${m}`);
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
}

function isValidDate(s: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s);
    return !isNaN(d.getTime());
}

// ─── Main: fetchCaseStatistics ────────────────────────────────────────────

export async function fetchCaseStatistics(
    operatorUserId: string,
    fromDate: string,
    toDate: string
): Promise<ActionResult<CaseStatistics>> {
    if (!(await assertHasAnyRole(operatorUserId, VIEW_ROLES))) {
        return { success: false, error: '權限不足' };
    }
    if (!isValidDate(fromDate) || !isValidDate(toDate)) {
        return { success: false, error: '日期格式無效（YYYY-MM-DD）' };
    }

    const operatorRole = await resolveOperatorRole(operatorUserId);

    const client = await pool.connect();
    try {
        const queryParams: unknown[] = [fromDate, toDate];
        let boardAccessWhere = '';
        if (await isRestrictedBoardViewer(client, operatorUserId)) {
            queryParams.push(operatorUserId);
            boardAccessWhere = `AND ${boardApplicationAccessSql('a', `$${queryParams.length}`)}`;
        }
        // 一次撈出範圍內所有案件 + 必要關聯
        // 含 application_type, case_number, status, officer_id, application_way,
        //    referral_unit_id, apply_at；以及 officer 姓名 / referral unit 名稱
        const res = await client.query(
            `SELECT
                a.id::text                AS id,
                a.case_number,
                a.application_type,
                a.status,
                a.officer_id::text        AS officer_id,
                a.application_way,
                a.referral_unit_id::text  AS referral_unit_id,
                a.apply_at,
                ou.name_enc               AS officer_name_enc,
                ou.name_iv                AS officer_name_iv,
                ou.account                AS officer_account,
                ru.name                   AS referral_unit_name
             FROM applications a
             LEFT JOIN users ou           ON ou.id = a.officer_id
             LEFT JOIN referral_units ru  ON ru.id = a.referral_unit_id
             WHERE a.apply_at IS NOT NULL
               AND a.apply_at >= $1::date
               AND a.apply_at <  ($2::date + INTERVAL '1 day')
               ${boardAccessWhere}`,
            queryParams
        );

        // ── 聚合 ──
        let approved = 0, rejected = 0, inProgress = 0;

        const catBuckets: Record<'A' | 'B' | 'C' | 'D' | 'unknown', { approved: number; rejected: number }> = {
            A: { approved: 0, rejected: 0 },
            B: { approved: 0, rejected: 0 },
            C: { approved: 0, rejected: 0 },
            D: { approved: 0, rejected: 0 },
            unknown: { approved: 0, rejected: 0 },
        };

        // officer key = string(id) or '__null__'
        const officerMap = new Map<string, ByOfficerItem>();

        const selfApply = { approved: 0, rejected: 0 };
        const referralMap = new Map<string, BySourceData['referrals'][number]>();

        const monthMap = new Map<string, ByMonthItem>();

        for (const row of res.rows) {
            const status = row.status as string;
            const isAppr = isApproved(status);
            const isRej = isRejected(status);
            const isInProg = isInProgress(status);
            if (isInProg) inProgress++;
            if (!isAppr && !isRej) continue;
            if (isAppr) approved++; else rejected++;

            // category
            const cat = resolveCategory(row.application_type, row.case_number);
            if (isAppr) catBuckets[cat].approved++; else catBuckets[cat].rejected++;

            // officer
            const ofKey = row.officer_id ?? '__null__';
            if (!officerMap.has(ofKey)) {
                officerMap.set(ofKey, {
                    officerId: row.officer_id,
                    officerName: row.officer_id
                        ? decryptName(row.officer_name_enc, row.officer_name_iv, row.officer_account ?? '（未知）')
                        : '（未派案）',
                    approved: 0,
                    rejected: 0,
                });
            }
            const oitem = officerMap.get(ofKey)!;
            if (isAppr) oitem.approved++; else oitem.rejected++;

            // source
            if (row.application_way === '2') {
                const ruKey = row.referral_unit_id ?? '__null__';
                if (!referralMap.has(ruKey)) {
                    referralMap.set(ruKey, {
                        referralUnitId: row.referral_unit_id,
                        referralUnitName: row.referral_unit_id ? (row.referral_unit_name ?? '（未知單位）') : '（未指定單位）',
                        approved: 0,
                        rejected: 0,
                    });
                }
                const r = referralMap.get(ruKey)!;
                if (isAppr) r.approved++; else r.rejected++;
            } else {
                if (isAppr) selfApply.approved++; else selfApply.rejected++;
            }

            // month
            const apply = new Date(row.apply_at);
            const ym = `${apply.getFullYear()}-${String(apply.getMonth() + 1).padStart(2, '0')}`;
            if (!monthMap.has(ym)) monthMap.set(ym, { yearMonth: ym, approved: 0, rejected: 0 });
            const mitem = monthMap.get(ym)!;
            if (isAppr) mitem.approved++; else mitem.rejected++;
        }

        // byCategory：A/B/C/D 一定出現；unknown 只在有資料時加
        const byCategory: ByCategoryItem[] = (['A', 'B', 'C', 'D'] as const).map(cat => ({
            category: cat,
            approved: catBuckets[cat].approved,
            rejected: catBuckets[cat].rejected,
        }));
        if (catBuckets.unknown.approved > 0 || catBuckets.unknown.rejected > 0) {
            byCategory.push({ category: 'unknown', ...catBuckets.unknown });
        }

        const byOfficer: ByOfficerItem[] = Array.from(officerMap.values())
            .sort((a, b) => (b.approved + b.rejected) - (a.approved + a.rejected));

        const bySource: BySourceData = {
            selfApply,
            referrals: Array.from(referralMap.values())
                .sort((a, b) => (b.approved + b.rejected) - (a.approved + a.rejected)),
        };

        // byMonth：gap-fill 所有月份
        const allMonths = enumerateMonths(fromDate, toDate);
        const byMonth: ByMonthItem[] = allMonths.map(ym => {
            const got = monthMap.get(ym);
            return got ?? { yearMonth: ym, approved: 0, rejected: 0 };
        });

        const denom = approved + rejected;
        const approvalRate = denom === 0 ? 0 : Math.round((approved / denom) * 10000) / 10000;

        const stats: CaseStatistics = {
            fromDate,
            toDate,
            total: { approved, rejected, inProgress, approvalRate },
            byCategory,
            byOfficer,
            bySource,
            byMonth,
        };

        // 寫 audit
        void writeAuditLog({
            userId: operatorUserId,
            action: 'case_statistics.viewed',
            targetType: 'event',
            targetId: `${fromDate}_${toDate}`,
            detail: {
                from: fromDate,
                to: toDate,
                operatorRole: operatorRole ?? 'unknown',
            },
        });

        return { success: true, data: stats };
    } catch (err: any) {
        console.error('fetchCaseStatistics error:', err);
        return { success: false, error: err.message ?? '查詢失敗' };
    } finally {
        client.release();
    }
}

// ─── Drill-down: fetchCaseStatisticsDrillDown ─────────────────────────────

export async function fetchCaseStatisticsDrillDown(
    operatorUserId: string,
    fromDate: string,
    toDate: string,
    dimension: StatsDimension,
    dimensionValue: string,
    outcome: StatsOutcome
): Promise<ActionResult<StatsDrillDownRow[]>> {
    if (!(await assertHasAnyRole(operatorUserId, VIEW_ROLES))) {
        return { success: false, error: '權限不足' };
    }
    if (!isValidDate(fromDate) || !isValidDate(toDate)) {
        return { success: false, error: '日期格式無效' };
    }

    // outcome → status filter
    const statusList: string[] = outcome === 'approved' ? ['3', '4'] : ['2'];

    // dimension → extra WHERE
    const params: any[] = [fromDate, toDate, statusList];
    let extraWhere = '';

    switch (dimension) {
        case 'category': {
            // dimensionValue = A/B/C/D/unknown
            if (dimensionValue === 'unknown') {
                extraWhere = `AND COALESCE(NULLIF(a.application_type, ''), LEFT(a.case_number, 1)) NOT IN ('A','B','C','D')`;
            } else if (['A', 'B', 'C', 'D'].includes(dimensionValue)) {
                params.push(dimensionValue);
                extraWhere = `AND COALESCE(NULLIF(a.application_type, ''), LEFT(a.case_number, 1)) = $${params.length}`;
            } else {
                return { success: false, error: '類別參數無效' };
            }
            break;
        }
        case 'officer': {
            if (dimensionValue === 'null' || dimensionValue === '__null__') {
                extraWhere = `AND a.officer_id IS NULL`;
            } else if (/^\d+$/.test(dimensionValue)) {
                params.push(dimensionValue);
                extraWhere = `AND a.officer_id = $${params.length}::bigint`;
            } else {
                return { success: false, error: 'officer 參數無效' };
            }
            break;
        }
        case 'source': {
            if (dimensionValue === 'self') {
                extraWhere = `AND a.application_way = '1'`;
            } else if (dimensionValue.startsWith('referral:')) {
                const ruId = dimensionValue.slice('referral:'.length);
                if (ruId === 'null' || ruId === '__null__') {
                    extraWhere = `AND a.application_way = '2' AND a.referral_unit_id IS NULL`;
                } else if (/^\d+$/.test(ruId)) {
                    params.push(ruId);
                    extraWhere = `AND a.application_way = '2' AND a.referral_unit_id = $${params.length}::bigint`;
                } else {
                    return { success: false, error: '轉介單位參數無效' };
                }
            } else {
                return { success: false, error: 'source 參數無效' };
            }
            break;
        }
        case 'month': {
            if (!/^\d{4}-\d{2}$/.test(dimensionValue)) {
                return { success: false, error: '月份格式無效（YYYY-MM）' };
            }
            params.push(dimensionValue);
            extraWhere = `AND TO_CHAR(a.apply_at, 'YYYY-MM') = $${params.length}`;
            break;
        }
    }

    const client = await pool.connect();
    try {
        let boardAccessWhere = '';
        if (await isRestrictedBoardViewer(client, operatorUserId)) {
            params.push(operatorUserId);
            boardAccessWhere = `AND ${boardApplicationAccessSql('a', `$${params.length}`)}`;
        }
        const res = await client.query(
            `SELECT
                 a.id::text          AS id,
                 a.case_number,
                 a.apply_at,
                 a.approved_amount,
                 u.name_enc          AS app_name_enc,
                 u.name_iv           AS app_name_iv,
                 (SELECT comments FROM application_workflow w
                  WHERE w.application_id = a.id
                  ORDER BY w.reviewed_at DESC NULLS LAST, w.id DESC
                  LIMIT 1) AS latest_comment
             FROM applications a
             LEFT JOIN users u ON u.id = a.applicant_id
             WHERE a.apply_at IS NOT NULL
               AND a.apply_at >= $1::date
               AND a.apply_at <  ($2::date + INTERVAL '1 day')
               AND a.status = ANY($3::text[])
               ${extraWhere}
               ${boardAccessWhere}
             ORDER BY a.apply_at DESC`,
            params
        );

        const rows: StatsDrillDownRow[] = res.rows.map((r: any) => ({
            caseId: r.id,
            caseNumber: r.case_number,
            applicantName: decryptName(r.app_name_enc, r.app_name_iv, '（未知）'),
            applyAt: formatDateOnly(r.apply_at) ?? '',
            approvedAmount: r.approved_amount != null ? Number(r.approved_amount) : null,
            latestComment: r.latest_comment ?? '',
        }));

        return { success: true, data: rows };
    } catch (err: any) {
        console.error('fetchCaseStatisticsDrillDown error:', err);
        return { success: false, error: err.message ?? '查詢失敗' };
    } finally {
        client.release();
    }
}
