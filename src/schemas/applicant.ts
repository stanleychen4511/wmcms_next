import { z } from 'zod';

export const applicantSchema = z.object({
    type: z.enum(['married', 'single']),
    age: z.coerce.number().min(0, "年齡不能為負數"),
    hasMinorChildren: z.boolean().default(false),
    annualIncome: z.coerce.number().min(0, "年收入不能為負數"),
    movableAssets: z.coerce.number().min(0, "動產不能為負數"),
    realEstateValue: z.coerce.number().min(0, "不動產不能為負數"),
}).refine((data) => {
    // 保持一個基本的結構性檢查：已婚者在案件建立初選時通常需勾選此項
    if (data.type === 'married' && !data.hasMinorChildren) {
        return false;
    }
    return true;
}, {
    message: "已婚申請者必須育有未成年子女才符合初步篩選",
    path: ["hasMinorChildren"],
});

export type ApplicantFormValues = z.infer<typeof applicantSchema>;
