import { z } from 'zod';

/**
 * 資格表單 schema（115 年辦法後重整）
 *
 * - subsidyType：補助子類型（'1'=經濟弱勢、'2'=小康家庭）
 * - maritalStatus：婚姻狀態（'1'=已婚、'2'=單親、'3'=單身）
 * - hasChildren / underageChildrenCount / adultChildrenCount 維持，
 *   childrenStatus 由前端依此推導（hasChildren=false → 無；underageCount>0 → 未成年；其餘 → 已成年）
 * - econDeposit / econMonthlyIncome：經濟弱勢專屬欄位（萬元）
 */
export const applicantSchema = z.object({
    subsidyType:    z.enum(['1', '2']).optional(),
    type:           z.enum(['1', '2', '3']),  // 1=已婚 2=單親 3=單身
    age: z.coerce.number().min(0, "年齡不能為負數"),
    hasChildren: z.boolean().default(false),
    underageChildrenCount: z.coerce.number().min(0, "人數不能為負數").max(99, "人數上限為 99").optional(),
    adultChildrenCount:    z.coerce.number().min(0, "人數不能為負數").max(99, "人數上限為 99").optional(),
    annualIncome:    z.coerce.number().min(0, "年收入不能為負數"),
    movableAssets:   z.coerce.number().min(0, "動產不能為負數"),
    realEstateValue: z.coerce.number().min(0, "不動產不能為負數"),
    // 經濟弱勢專屬（萬元）
    econDeposit:        z.coerce.number().min(0, "存款不能為負數").optional(),
    econMonthlyIncome:  z.coerce.number().min(0, "月收入不能為負數").optional(),
});

export type ApplicantFormValues = z.infer<typeof applicantSchema>;
