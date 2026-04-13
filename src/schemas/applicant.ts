import { z } from 'zod';

export const applicantSchema = z.object({
    type: z.enum(['married', 'single']),
    age: z.coerce.number().min(0, "年齡不能為負數"),
    hasChildren: z.boolean().default(false),
    underageChildrenCount: z.coerce.number().min(0, "人數不能為負數").max(99, "人數上限為 99").optional(),
    adultChildrenCount: z.coerce.number().min(0, "人數不能為負數").max(99, "人數上限為 99").optional(),
    annualIncome: z.coerce.number().min(0, "年收入不能為負數"),
    movableAssets: z.coerce.number().min(0, "動產不能為負數"),
    realEstateValue: z.coerce.number().min(0, "不動產不能為負數"),
});

export type ApplicantFormValues = z.infer<typeof applicantSchema>;
