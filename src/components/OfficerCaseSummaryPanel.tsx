'use client';

/**
 * 個管師案件說明面板（#17）
 *
 * 兩種模式：
 * - editable=true：個管師 / 主管 / admin 可編輯（家訪、行政初審階段使用）
 * - editable=false：純唯讀（董事審核階段顯示給董事看）
 *
 * 內容建議 5 點條列（1. ~ 5.）；UI 不強制格式，但 placeholder 與 hint 引導使用者。
 */

import { useEffect, useState } from 'react';
import { ClipboardList, Save, Loader2 } from 'lucide-react';
import { saveOfficerCaseSummary } from '../app/actions/workflowActions';
import { useToast } from './FloatingToast';

interface Props {
    applicationId: string;
    operatorUserId: string;
    initialValue: string | null;
    /** 可否編輯：受限於角色與案件狀態 */
    editable: boolean;
    /** 視覺強調樣式（user feedback #17：董事審核頁要明顯突出） */
    emphasize?: boolean;
    onSaved?: (newValue: string) => void;
}

// user feedback #17：placeholder 改成 4 點建議格式
const PLACEHOLDER = `建議以 4 點條列說明本案重點：
1. 申請人病情及醫師評估治療的必要性
2. 申請人說明預計療程與費用之計算
3. 本案審核需注意之處（例：證明書說明不足、療程計算、家訪環境互動特殊、建議補助金額等）
4. 本案為電子/紙本申請，後續核銷方式為何`;

export function OfficerCaseSummaryPanel({
    applicationId, operatorUserId, initialValue, editable, emphasize, onSaved,
}: Props) {
    const [value, setValue] = useState(initialValue ?? '');
    const [saving, setSaving] = useState(false);
    const { push: pushToast } = useToast();

    useEffect(() => {
        setValue(initialValue ?? '');
    }, [initialValue]);

    const dirty = value.trim() !== (initialValue ?? '').trim();

    const handleSave = async () => {
        setSaving(true);
        const res = await saveOfficerCaseSummary(applicationId, value, operatorUserId);
        setSaving(false);
        if (res.success) {
            pushToast({ type: 'success', msg: '已儲存案件說明' });
            onSaved?.(value);
        } else {
            pushToast({ type: 'error', msg: res.error ?? '儲存失敗' });
        }
    };

    return (
        <div className={emphasize
            ? "bg-amber-50 border-2 border-amber-300 rounded-lg p-4 space-y-3 shadow-sm"
            : "bg-white border border-slate-200 rounded-lg p-4 space-y-3"}
        >
            <div className="flex items-center gap-2">
                <ClipboardList className={`w-4 h-4 ${emphasize ? 'text-amber-700' : 'text-indigo-600'}`} />
                <h4 className={`text-sm font-bold ${emphasize ? 'text-amber-800' : 'text-slate-700'}`}>
                    {emphasize ? '📋 個管師案件說明（請董事務必參考）' : '案件說明（個管師填寫）'}
                </h4>
                {!editable && !emphasize && (
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">唯讀</span>
                )}
            </div>

            {editable ? (
                <>
                    <textarea
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        rows={8}
                        placeholder={PLACEHOLDER}
                        disabled={saving}
                        className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white resize-y"
                    />
                    <p className="text-[11px] text-slate-400">
                        建議以 1.、2.、3. 條列；本欄會顯示在董事審核頁與「補助案審核意見表」列印頁。
                    </p>
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={!dirty || saving}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                        >
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            儲存案件說明
                        </button>
                    </div>
                </>
            ) : (
                value.trim() === '' ? (
                    <p className="text-xs text-slate-400 italic py-3">（個管師尚未填寫案件說明）</p>
                ) : (
                    <pre className="whitespace-pre-wrap text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 font-sans leading-relaxed">
                        {value}
                    </pre>
                )
            )}
        </div>
    );
}
