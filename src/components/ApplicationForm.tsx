import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { applicantSchema, ApplicantFormValues } from '../schemas/applicant';
import { clsx } from 'clsx';

interface ApplicationFormProps {
    initialValues: ApplicantFormValues;
    onValidation: (isValid: boolean, values: ApplicantFormValues) => void;
    readOnly?: boolean;
    applicationType?: string | null;
    /** 各子類型補助上限（依 115 辦法）；UI 顯示用，未提供則 fallback 0 */
    subtypeMaxAmounts?: Record<'1' | '2', number>;
    /** 隱藏子類型 radio（呼叫端自行管理時用，例如 NewApplicationPage 在外層另有 radio） */
    hideSubsidyType?: boolean;
}

const APPLICATION_TYPE_LABEL: Record<string, string> = {
    A: 'A 類', B: 'B 類', C: 'C 類', D: 'D 類',
};

export function ApplicationForm({ initialValues, onValidation, readOnly = false, applicationType, subtypeMaxAmounts, hideSubsidyType = false }: ApplicationFormProps) {
    const {
        register,
        watch,
        setValue,
        formState: { errors, isValid }
    } = useForm<ApplicantFormValues>({
        // @ts-ignore - known issue with zodResolver type inference for optional defaults
        resolver: zodResolver(applicantSchema),
        defaultValues: initialValues,
        mode: 'onChange'
    });

    const hasChildren     = watch('hasChildren');
    const maritalStatus   = watch('type');           // '1'=已婚 '2'=單親 '3'=單身
    const subsidyType     = watch('subsidyType');    // '1'=經濟弱勢 '2'=小康家庭
    const isEcon          = subsidyType === '1';
    const isMidClass      = subsidyType === '2';

    useEffect(() => {
        if (!hasChildren) {
            setValue('underageChildrenCount', 0);
            setValue('adultChildrenCount', 0);
        }
    }, [hasChildren, setValue]);

    useEffect(() => {
        setValue('age', initialValues.age ?? 0, {
            shouldDirty: false,
            shouldValidate: true,
        });
    }, [initialValues.age, setValue]);

    // 婚姻狀態變動 → 清空育兒相關欄位（不影響首次 mount）
    const prevMaritalRef = useRef<typeof maritalStatus | undefined>(undefined);
    useEffect(() => {
        const prev = prevMaritalRef.current;
        prevMaritalRef.current = maritalStatus;
        // 首次 mount 時 prev=undefined → 不重設（避免清掉 initialValues 帶入的值）
        if (prev !== undefined && prev !== maritalStatus) {
            setValue('hasChildren', false);
            setValue('underageChildrenCount', 0);
            setValue('adultChildrenCount', 0);
        }
    }, [maritalStatus, setValue]);

    // 單親 → 強制有子女（115 辦法矩陣中單親無「無子女」一列）
    // 注意：執行順序在重設之後（依 useEffect 順序），所以單親切換時會：
    //   1. 上面 effect 把 hasChildren 重設為 false（婚姻變動）
    //   2. 此 effect 看到 maritalStatus='2' && !hasChildren → 強制設為 true
    //   人數仍維持 0，由使用者填入
    useEffect(() => {
        if (maritalStatus === '2' && !hasChildren) {
            setValue('hasChildren', true);
        }
    }, [maritalStatus, hasChildren, setValue]);

    useEffect(() => {
        const subscription = watch((value) => {
            onValidation(isValid, value as ApplicantFormValues);
        });
        return () => subscription.unsubscribe();
    }, [watch, isValid, onValidation]);

    return (
        <form className="space-y-4">
            {applicationType && (
                <p className="text-xs text-slate-500">案件類別：{APPLICATION_TYPE_LABEL[applicationType] ?? applicationType}</p>
            )}

            {/* 補助子類型（115 年辦法第三條） */}
            {!hideSubsidyType && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                <label className="block text-sm font-medium text-slate-700">補助子類型（115 年辦法）</label>
                <div className="flex gap-4">
                    {[
                        {
                            v: '1' as const,
                            name: '經濟弱勢',
                            limit: subtypeMaxAmounts?.['1'] ?? 0,
                            hint: '僅接受轉介',
                        },
                        {
                            v: '2' as const,
                            name: '小康家庭',
                            limit: subtypeMaxAmounts?.['2'] ?? 0,
                            hint: '自提或轉介均可',
                        },
                    ].map(opt => (
                        <label key={opt.v} className="flex items-start gap-2 cursor-pointer">
                            <input
                                type="radio"
                                value={opt.v}
                                {...register('subsidyType')}
                                disabled={readOnly}
                                className="mt-0.5"
                            />
                            <span className="text-sm">
                                <span className="font-medium text-slate-700">
                                    {opt.name}
                                    {opt.limit > 0 && (
                                        <span className="font-normal text-slate-500 ml-1">
                                            （補助上限 NT${opt.limit.toLocaleString()}）
                                        </span>
                                    )}
                                </span>
                                <span className="block text-xs text-slate-500">{opt.hint}</span>
                            </span>
                        </label>
                    ))}
                </div>
                {errors.subsidyType && <p className="text-red-500 text-xs">{errors.subsidyType.message}</p>}
            </div>
            )}

            {/* Row 1: 婚姻狀態（3 選 1）| 育有子女 | 未成年子女 | 成年子女 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">婚姻狀態</label>
                    <select
                        {...register('type')}
                        disabled={readOnly}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="1">已婚</option>
                        <option value="2">單親</option>
                        <option value="3">單身</option>
                    </select>
                    {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type.message}</p>}
                </div>

                <div className="flex flex-col justify-end pb-1">
                    <div className="flex items-center h-[38px]">
                        <input
                            type="checkbox"
                            id="hasChildren"
                            {...register('hasChildren')}
                            disabled={readOnly || maritalStatus === '2'}
                            className="rounded text-blue-600 focus:ring-blue-500 mr-2 h-4 w-4"
                        />
                        <label htmlFor="hasChildren" className="text-sm font-medium text-gray-700 select-none whitespace-nowrap">
                            育有子女{maritalStatus === '2' && <span className="text-red-500">*</span>}
                        </label>
                    </div>
                    {maritalStatus === '2' && (
                        <p className="text-[11px] text-slate-500 mt-1">單親身份必須育有子女</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">未成年子女人數</label>
                    <input
                        type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2}
                        {...register('underageChildrenCount')}
                        disabled={readOnly || !hasChildren}
                        placeholder={hasChildren ? '' : '—'}
                        className={clsx(
                            "mt-1 block w-full rounded-md shadow-sm p-2 border",
                            !hasChildren ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                                         : errors.underageChildrenCount
                                            ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                                            : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        )}
                    />
                    {errors.underageChildrenCount && (
                        <p className="text-red-500 text-xs mt-1">{errors.underageChildrenCount.message}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">成年子女人數</label>
                    <input
                        type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2}
                        {...register('adultChildrenCount')}
                        disabled={readOnly || !hasChildren}
                        placeholder={hasChildren ? '' : '—'}
                        className={clsx(
                            "mt-1 block w-full rounded-md shadow-sm p-2 border",
                            !hasChildren ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                                         : errors.adultChildrenCount
                                            ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                                            : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        )}
                    />
                    {errors.adultChildrenCount && (
                        <p className="text-red-500 text-xs mt-1">{errors.adultChildrenCount.message}</p>
                    )}
                </div>
            </div>

            {/* 共同欄位 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">年齡</label>
                    <input
                        type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3}
                        {...register('age')} disabled={readOnly}
                        className={clsx("mt-1 block w-full rounded-md shadow-sm p-2 border",
                            errors.age ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                                       : "border-gray-300 focus:border-blue-500 focus:ring-blue-500")}
                    />
                    {errors.age && <p className="text-red-500 text-xs mt-1">{errors.age.message}</p>}
                </div>

                {/* 不動產：經濟弱勢不限制（user feedback #1），故只在小康家庭時顯示 */}
                {isMidClass && (
                <div>
                    <label className="block text-sm font-medium text-gray-700">
                        不動產現值（戶籍內直系合計）
                        <span className="text-xs text-gray-500 font-normal ml-1">（依國稅局財產清冊累計）</span>
                    </label>
                    <div className="relative mt-1">
                        <input
                            type="text" inputMode="numeric" pattern="[0-9]*" maxLength={5}
                            {...register('realEstateValue')} disabled={readOnly}
                            className={clsx("block w-full rounded-md shadow-sm p-2 border",
                                errors.realEstateValue ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                                                       : "border-gray-300 focus:border-blue-500 focus:ring-blue-500")}
                        />
                        <span className="absolute right-3 top-2 text-gray-400 text-sm">萬元</span>
                    </div>
                    {errors.realEstateValue && <p className="text-red-500 text-xs mt-1">{errors.realEstateValue.message}</p>}
                </div>
                )}

                {/* 小康家庭專屬欄位 */}
                {isMidClass && (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                {maritalStatus === '1' ? '配偶合計年收入' : '個人年收入'}
                                <span className="text-xs text-gray-500 font-normal ml-1">（依最新年度之綜所稅清單）</span>
                            </label>
                            <div className="relative mt-1">
                                <input
                                    type="text" inputMode="numeric" pattern="[0-9]*" maxLength={5}
                                    {...register('annualIncome')} disabled={readOnly}
                                    className={clsx("block w-full rounded-md shadow-sm p-2 border",
                                        errors.annualIncome ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                                                            : "border-gray-300 focus:border-blue-500 focus:ring-blue-500")}
                                />
                                <span className="absolute right-3 top-2 text-gray-400 text-sm">萬元</span>
                            </div>
                            {errors.annualIncome && <p className="text-red-500 text-xs mt-1">{errors.annualIncome.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">存款＋有價證券</label>
                            <div className="relative mt-1">
                                <input
                                    type="text" inputMode="numeric" pattern="[0-9]*" maxLength={5}
                                    {...register('movableAssets')} disabled={readOnly}
                                    className={clsx("block w-full rounded-md shadow-sm p-2 border",
                                        errors.movableAssets ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                                                             : "border-gray-300 focus:border-blue-500 focus:ring-blue-500")}
                                />
                                <span className="absolute right-3 top-2 text-gray-400 text-sm">萬元</span>
                            </div>
                            {errors.movableAssets && <p className="text-red-500 text-xs mt-1">{errors.movableAssets.message}</p>}
                        </div>
                    </>
                )}

                {/* 經濟弱勢專屬欄位 */}
                {isEcon && (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                存款（配偶取平均）
                            </label>
                            <div className="relative mt-1">
                                <input
                                    type="text" inputMode="numeric" pattern="[0-9]*" maxLength={5}
                                    {...register('econDeposit')} disabled={readOnly}
                                    className={clsx("block w-full rounded-md shadow-sm p-2 border",
                                        errors.econDeposit ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                                                           : "border-gray-300 focus:border-blue-500 focus:ring-blue-500")}
                                />
                                <span className="absolute right-3 top-2 text-gray-400 text-sm">萬元</span>
                            </div>
                            {errors.econDeposit && <p className="text-red-500 text-xs mt-1">{errors.econDeposit.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                每月收入（配偶取平均）
                            </label>
                            <div className="relative mt-1">
                                <input
                                    type="text" inputMode="numeric" pattern="[0-9]*" maxLength={5}
                                    {...register('econMonthlyIncome')} disabled={readOnly}
                                    className={clsx("block w-full rounded-md shadow-sm p-2 border",
                                        errors.econMonthlyIncome ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                                                                  : "border-gray-300 focus:border-blue-500 focus:ring-blue-500")}
                                />
                                <span className="absolute right-3 top-2 text-gray-400 text-sm">萬元</span>
                            </div>
                            {errors.econMonthlyIncome && <p className="text-red-500 text-xs mt-1">{errors.econMonthlyIncome.message}</p>}
                        </div>
                    </>
                )}
            </div>
        </form>
    );
}
