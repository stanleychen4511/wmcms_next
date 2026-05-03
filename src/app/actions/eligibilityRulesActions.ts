'use server';

/**
 * 申請規則設定（115 年辦法）
 *
 * 對應修改計畫 #2 + #3。所有資格門檻參數化，無 hardcode 預設值，
 * 唯一資料來源 = DB（subsidy_amount_limits、mid_class_eligibility_matrix、
 * system_settings 中以 'elig_' 為前綴的 key）。
 */

import { pool } from '../../lib/db';
import { writeAuditLog } from './auditActions';
// 'use server' 檔案不可 export 非 async function；常數與型別搬到 lib/eligibilityConstants.ts
import {
    SUBSIDY_SUBTYPE_LABEL,
    MARITAL_STATUS_LABEL,
    CHILDREN_STATUS_LABEL,
    type SubsidySubtype,
    type MaritalStatus,
    type ChildrenStatus,
} from '../../lib/eligibilityConstants';

export interface SubsidyAmountLimit {
    subsidyType: SubsidySubtype;
    amountMax: number;          // 元
}

export interface MidClassMatrixEntry {
    maritalStatus: MaritalStatus;
    childrenStatus: ChildrenStatus;
    incomeMin: number;          // 萬
    incomeMax: number;          // 萬
    assetsMax: number;          // 萬
}

export interface CommonEligibilityCriteria {
    ageMin: number;
    ageMax: number;
    realEstateMax: number;      // 萬
    econDepositMax: number;     // 萬（經濟弱勢）
    econMonthlyIncomeMax: number; // 萬（經濟弱勢）
}

export interface EligibilityRulesSnapshot {
    common: CommonEligibilityCriteria;
    amountLimits: SubsidyAmountLimit[];
    midClassMatrix: MidClassMatrixEntry[];
}

// ─── Fetch ────────────────────────────────────────────────────────────────

async function fetchCommon(): Promise<CommonEligibilityCriteria> {
    const res = await pool.query<{ key: string; value: string }>(
        `SELECT key, value FROM system_settings WHERE key LIKE 'elig\\_%' ESCAPE '\\'`
    );
    const map = new Map(res.rows.map(r => [r.key, Number(r.value)]));
    const need = (k: string) => {
        const v = map.get(k);
        if (v == null || isNaN(v)) {
            throw new Error(`系統設定缺少必要參數：${k}（請執行 init_db.sql 重設）`);
        }
        return v;
    };
    return {
        ageMin: need('elig_age_min'),
        ageMax: need('elig_age_max'),
        realEstateMax: need('elig_real_estate_max'),
        econDepositMax: need('elig_econ_deposit_max'),
        econMonthlyIncomeMax: need('elig_econ_monthly_income_max'),
    };
}

async function fetchAmountLimits(): Promise<SubsidyAmountLimit[]> {
    const res = await pool.query<{ subsidy_subtype: SubsidySubtype; amount_max: string }>(
        `SELECT subsidy_subtype, amount_max FROM subsidy_amount_limits ORDER BY subsidy_subtype`
    );
    return res.rows.map(r => ({
        subsidyType: r.subsidy_subtype,
        amountMax: Number(r.amount_max),
    }));
}

async function fetchMatrix(): Promise<MidClassMatrixEntry[]> {
    const res = await pool.query<{
        marital_status: MaritalStatus;
        children_status: ChildrenStatus;
        income_min: string;
        income_max: string;
        assets_max: string;
    }>(
        `SELECT marital_status, children_status, income_min, income_max, assets_max
         FROM mid_class_eligibility_matrix
         ORDER BY marital_status, children_status`
    );
    return res.rows.map(r => ({
        maritalStatus: r.marital_status,
        childrenStatus: r.children_status,
        incomeMin: Number(r.income_min),
        incomeMax: Number(r.income_max),
        assetsMax: Number(r.assets_max),
    }));
}

/**
 * Convenience helper：只回傳兩個子類型的補助上限（元）。
 * 給只在乎金額上限的元件（CaseListPage / NewApplicationPage / ExternalIntake / App.tsx）使用。
 *
 * 回傳形如 `{ '1': 30000, '2': 350000 }`；若 DB 缺少某子類型則該 key 為 0。
 */
export async function fetchSubsidyAmountLimitsMap(): Promise<Record<SubsidySubtype, number>> {
    const limits = await fetchAmountLimits();
    const map: Record<SubsidySubtype, number> = { '1': 0, '2': 0 };
    for (const l of limits) map[l.subsidyType] = l.amountMax;
    return map;
}

export async function fetchEligibilityRules(): Promise<EligibilityRulesSnapshot> {
    const [common, amountLimits, midClassMatrix] = await Promise.all([
        fetchCommon(),
        fetchAmountLimits(),
        fetchMatrix(),
    ]);
    return { common, amountLimits, midClassMatrix };
}

// ─── Update ───────────────────────────────────────────────────────────────

async function assertAdmin(operatorUserId: string) {
    const res = await pool.query<{ code: string }>(
        `SELECT r.code FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1::bigint`,
        [operatorUserId]
    );
    const codes = res.rows.map(x => x.code);
    if (!codes.includes('admin')) {
        throw new Error('僅 admin 角色可修改申請規則設定');
    }
}

export async function updateSubsidyAmountLimit(
    operatorUserId: string,
    subsidyType: SubsidySubtype,
    amountMax: number,
): Promise<{ success: boolean; error?: string }> {
    try {
        await assertAdmin(operatorUserId);
        if (!Number.isFinite(amountMax) || amountMax < 0) {
            return { success: false, error: '補助金額必須為非負整數' };
        }

        await pool.query(
            `UPDATE subsidy_amount_limits
             SET amount_max = $2, updated_at = now(), updated_by = $3::bigint
             WHERE subsidy_subtype = $1`,
            [subsidyType, Math.round(amountMax), operatorUserId]
        );
        await writeAuditLog({
            userId: operatorUserId,
            action: 'setting.update',
            targetType: 'setting',
            targetId: `subsidy_amount_limit:${subsidyType}`,
            detail: { subtype: subsidyType, label: SUBSIDY_SUBTYPE_LABEL[subsidyType], amountMax },
        });
        return { success: true };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : '更新失敗' };
    }
}

export async function updateMidClassMatrixEntry(
    operatorUserId: string,
    maritalStatus: MaritalStatus,
    childrenStatus: ChildrenStatus,
    incomeMin: number,
    incomeMax: number,
    assetsMax: number,
): Promise<{ success: boolean; error?: string }> {
    try {
        await assertAdmin(operatorUserId);
        for (const [k, v] of [['incomeMin', incomeMin], ['incomeMax', incomeMax], ['assetsMax', assetsMax]] as const) {
            if (!Number.isFinite(v as number) || (v as number) < 0) {
                return { success: false, error: `${k} 必須為非負整數` };
            }
        }
        if (incomeMin > incomeMax) {
            return { success: false, error: '收入下限不可大於上限' };
        }

        const upd = await pool.query(
            `UPDATE mid_class_eligibility_matrix
             SET income_min = $3, income_max = $4, assets_max = $5,
                 updated_at = now(), updated_by = $6::bigint
             WHERE marital_status = $1 AND children_status = $2`,
            [maritalStatus, childrenStatus, Math.round(incomeMin), Math.round(incomeMax), Math.round(assetsMax), operatorUserId]
        );
        if (upd.rowCount === 0) {
            return { success: false, error: '指定的婚姻/子女組合不存在於矩陣中' };
        }
        await writeAuditLog({
            userId: operatorUserId,
            action: 'setting.update',
            targetType: 'setting',
            targetId: `mid_class_matrix:${maritalStatus}-${childrenStatus}`,
            detail: {
                marital: MARITAL_STATUS_LABEL[maritalStatus],
                children: CHILDREN_STATUS_LABEL[childrenStatus],
                incomeMin, incomeMax, assetsMax,
            },
        });
        return { success: true };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : '更新失敗' };
    }
}

export async function updateCommonEligibility(
    operatorUserId: string,
    common: Partial<CommonEligibilityCriteria>,
): Promise<{ success: boolean; error?: string }> {
    try {
        await assertAdmin(operatorUserId);

        const map: Record<keyof CommonEligibilityCriteria, string> = {
            ageMin:               'elig_age_min',
            ageMax:               'elig_age_max',
            realEstateMax:        'elig_real_estate_max',
            econDepositMax:       'elig_econ_deposit_max',
            econMonthlyIncomeMax: 'elig_econ_monthly_income_max',
        };
        const updates: { key: string; value: number; label: string }[] = [];
        for (const [k, dbKey] of Object.entries(map) as [keyof CommonEligibilityCriteria, string][]) {
            const v = common[k];
            if (v == null) continue;
            if (!Number.isFinite(v) || v < 0) {
                return { success: false, error: `${k} 必須為非負整數` };
            }
            updates.push({ key: dbKey, value: Math.round(v), label: k });
        }
        if (common.ageMin != null && common.ageMax != null && common.ageMin > common.ageMax) {
            return { success: false, error: '年齡下限不可大於上限' };
        }
        for (const u of updates) {
            await pool.query(
                `UPDATE system_settings SET value = $2 WHERE key = $1`,
                [u.key, String(u.value)]
            );
        }
        await writeAuditLog({
            userId: operatorUserId,
            action: 'setting.update',
            targetType: 'setting',
            targetId: 'common_eligibility',
            detail: Object.fromEntries(updates.map(u => [u.label, u.value])),
        });
        return { success: true };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : '更新失敗' };
    }
}
