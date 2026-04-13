import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { applicantSchema, ApplicantFormValues } from '../schemas/applicant';
import { clsx } from 'clsx';

interface ApplicationFormProps {
    initialValues: ApplicantFormValues;
    onValidation: (isValid: boolean, values: ApplicantFormValues) => void;
    readOnly?: boolean;
    applicationType?: string | null;
}

const APPLICATION_TYPE_LABEL: Record<string, string> = {
    A: 'A 類',
    B: 'B 類',
    C: 'C 類',
    D: 'D 類',
};

export function ApplicationForm({ initialValues, onValidation, readOnly = false, applicationType }: ApplicationFormProps) {
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

    const hasChildren = watch('hasChildren');

    useEffect(() => {
        if (!hasChildren) {
            setValue('underageChildrenCount', 0);
            setValue('adultChildrenCount', 0);
        }
    }, [hasChildren, setValue]);

    useEffect(() => {
        // Notify parent about current values and validity whenever they change
        const subscription = watch((value) => {
            // Ideally we debounce this or handle it on explicit action, 
            // but for this interaction model we want live updates for the "Eligibility Check" button in parent
            onValidation(isValid, value as ApplicantFormValues);
        });
        return () => subscription.unsubscribe();
    }, [watch, isValid, onValidation]);

    return (
        <form className="space-y-4">
            {/* Row 1: 婚姻狀態 | 育有子女 | 未成年子女人數 | 成年子女人數 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Marital Status — col 1 */}
                <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">婚姻狀態</label>
                    <select
                        {...register('type')}
                        disabled={readOnly}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="married">已婚 (Married)</option>
                        <option value="single">單身 (Single)</option>
                    </select>
                    {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type.message}</p>}
                </div>

                {/* Children Checkbox — col 2 */}
                <div className="flex flex-col justify-end pb-1">
                    <div className="flex items-center h-[38px]">
                        <input
                            type="checkbox"
                            id="hasChildren"
                            {...register('hasChildren')}
                            disabled={readOnly}
                            className="rounded text-blue-600 focus:ring-blue-500 mr-2 h-4 w-4"
                        />
                        <label htmlFor="hasChildren" className="text-sm font-medium text-gray-700 select-none whitespace-nowrap">
                            育有子女
                        </label>
                    </div>
                    {errors.hasChildren && (
                        <p className="text-red-500 text-xs">{errors.hasChildren.message}</p>
                    )}
                </div>

                {/* Underage Children Count — col 3 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700">未成年子女人數</label>
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={2}
                        {...register('underageChildrenCount')}
                        disabled={readOnly || !hasChildren}
                        placeholder={hasChildren ? '' : '—'}
                        className={clsx(
                            "mt-1 block w-full rounded-md shadow-sm p-2 border",
                            !hasChildren
                                ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                                : errors.underageChildrenCount
                                    ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                                    : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        )}
                    />
                    {errors.underageChildrenCount && (
                        <p className="text-red-500 text-xs mt-1">{errors.underageChildrenCount.message}</p>
                    )}
                </div>

                {/* Adult Children Count — col 4 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700">成年子女人數</label>
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={2}
                        {...register('adultChildrenCount')}
                        disabled={readOnly || !hasChildren}
                        placeholder={hasChildren ? '' : '—'}
                        className={clsx(
                            "mt-1 block w-full rounded-md shadow-sm p-2 border",
                            !hasChildren
                                ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Age */}
                <div>
                    <label className="block text-sm font-medium text-gray-700">年齡</label>
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={3}
                        {...register('age')}
                        disabled={readOnly}
                        className={clsx(
                            "mt-1 block w-full rounded-md shadow-sm p-2 border",
                            errors.age ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        )}
                    />
                    {errors.age && <p className="text-red-500 text-xs mt-1">{errors.age.message}</p>}
                </div>

                {/* Income */}
                <div>
                    <label className="block text-sm font-medium text-gray-700">年收入 (萬)</label>
                    <div className="relative mt-1">
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={5}
                            {...register('annualIncome')}
                            disabled={readOnly}
                            className={clsx(
                                "block w-full rounded-md shadow-sm p-2 border",
                                errors.annualIncome ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                            )}
                        />
                        <span className="absolute right-3 top-2 text-gray-400 text-sm">萬元</span>
                    </div>
                    {errors.annualIncome && <p className="text-red-500 text-xs mt-1">{errors.annualIncome.message}</p>}
                </div>

                {/* Movable Assets */}
                <div>
                    <label className="block text-sm font-medium text-gray-700">動產 (萬)</label>
                    <div className="relative mt-1">
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={5}
                            {...register('movableAssets')}
                            disabled={readOnly}
                            className={clsx(
                                "block w-full rounded-md shadow-sm p-2 border",
                                errors.movableAssets ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                            )}
                        />
                        <span className="absolute right-3 top-2 text-gray-400 text-sm">萬元</span>
                    </div>
                    {errors.movableAssets && <p className="text-red-500 text-xs mt-1">{errors.movableAssets.message}</p>}
                </div>

                {/* Real Estate */}
                <div>
                    <label className="block text-sm font-medium text-gray-700">不動產總值 (萬)</label>
                    <div className="relative mt-1">
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={5}
                            {...register('realEstateValue')}
                            disabled={readOnly}
                            className={clsx(
                                "block w-full rounded-md shadow-sm p-2 border",
                                errors.realEstateValue ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                            )}
                        />
                        <span className="absolute right-3 top-2 text-gray-400 text-sm">萬元</span>
                    </div>
                    {errors.realEstateValue && <p className="text-red-500 text-xs mt-1">{errors.realEstateValue.message}</p>}
                </div>
            </div>
        </form>
    );
}
