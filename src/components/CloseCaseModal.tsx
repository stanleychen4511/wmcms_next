'use client';

/**
 * 通用「不通過結案」Modal
 *
 * 用途：在任何 workflow 階段（admin_review / visit / board_review / reimbursement）
 *      讓承辦人勾選結案原因 + 補充說明後結案。
 *
 * 自動帶入機制：
 *   - prefillReasonCodes：caller 預先帶入勾選 + 金額（資格判定不符會用到）
 *   - prefillNote：caller 預先帶入文字說明（補件超時會用到）
 *
 * 結案後 application.status = '2'，
 * application_close_reasons 寫入結構化原因。
 */

import { useEffect, useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from './FloatingToast';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { closeCaseWithReasons } from '../app/actions/workflowActions';
import { CLOSE_REASON_OPTIONS, type CloseReasonCode } from '../lib/closeReasonConstants';

interface PrefillReason {
    code: CloseReasonCode;
    value?: string;
}

interface Props {
    applicationId: string;
    operatorUserId: string;
    /** 觸發結案當下的 stage；用於審計與 UI 顯示 */
    stage?: 'admin_review' | 'home_visit' | 'visit' | 'board_review' | 'reimbursement' | string;
    /** 預填 codes + values（資格判定 reasonCodes、補件超時 '98' 等場景用） */
    prefillReasonCodes?: PrefillReason[];
    /** 預填底下「補充說明」自由文字 */
    prefillNote?: string;
    /** 標題附加文字（例：「補件超時結案」） */
    titleSuffix?: string;
    onClose: () => void;
    onClosed: () => void;
}

const STAGE_LABEL: Record<string, string> = {
    admin_review: '行政初審',
    home_visit: '家庭訪視',
    visit: '家庭訪視',
    board_review: '董事審核',
    reimbursement: '核銷撥款',
};

export function CloseCaseModal({
    applicationId, operatorUserId, stage,
    prefillReasonCodes, prefillNote, titleSuffix,
    onClose, onClosed,
}: Props) {
    useModalDismiss(onClose);
    const { push: pushToast } = useToast();

    /** code → checked 狀態 */
    const [checked, setChecked] = useState<Set<string>>(new Set(prefillReasonCodes?.map(r => r.code) ?? []));
    /** code → detail string */
    const [details, setDetails] = useState<Record<string, string>>(
        Object.fromEntries((prefillReasonCodes ?? []).map(r => [r.code, r.value ?? '']))
    );
    const [note, setNote] = useState(prefillNote ?? '');
    const [submitting, setSubmitting] = useState(false);

    // prefill 變動時同步（caller 在 modal 已開啟後改 props 的少見情境）
    useEffect(() => {
        if (prefillReasonCodes && prefillReasonCodes.length > 0) {
            setChecked(new Set(prefillReasonCodes.map(r => r.code)));
            setDetails(Object.fromEntries(prefillReasonCodes.map(r => [r.code, r.value ?? ''])));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggle = (code: string) => {
        setChecked(prev => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code); else next.add(code);
            return next;
        });
    };

    const handleSubmit = async () => {
        if (checked.size === 0) {
            pushToast({ type: 'error', msg: '請至少勾選一項結案原因' });
            return;
        }
        // detail 驗證：有 hint 的 code 至少需要 1 字
        const rows = Array.from(checked).map(code => {
            const opt = CLOSE_REASON_OPTIONS.find(o => o.code === code);
            const detail = (details[code] ?? '').trim();
            return { code, detail, requiresDetail: !!opt?.detailHint, hint: opt?.detailHint };
        });
        const missing = rows.find(r => r.requiresDetail && !r.detail);
        if (missing) {
            pushToast({ type: 'error', msg: `「${CLOSE_REASON_OPTIONS.find(o => o.code === missing.code)?.label}」需填寫詳細資料` });
            return;
        }
        setSubmitting(true);
        const res = await closeCaseWithReasons(
            applicationId,
            rows.map(r => ({ code: r.code, detail: r.detail || null })),
            operatorUserId,
            stage,
            note.trim() || undefined,
        );
        setSubmitting(false);
        if (!res.success) {
            pushToast({ type: 'error', msg: res.error ?? '結案失敗' });
            return;
        }
        pushToast({ type: 'success', msg: '已結案' });
        onClosed();
    };

    const stageLabel = stage ? STAGE_LABEL[stage] ?? stage : '';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8 flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        不通過結案
                        {titleSuffix && <span className="text-sm font-normal text-slate-500">— {titleSuffix}</span>}
                        {stageLabel && <span className="text-xs font-normal text-slate-400 ml-1">（{stageLabel} 階段）</span>}
                    </h3>
                    <button onClick={onClose} disabled={submitting} className="text-slate-400 hover:text-slate-600 disabled:opacity-50">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        ⚠ 結案後此案件 status 將設為「審核未通過」（不可逆），請確認結案原因。
                    </p>

                    <div>
                        <label className="text-xs font-semibold text-slate-700">結案原因（至少勾選一項）</label>
                        <div className="mt-2 space-y-1.5">
                            {CLOSE_REASON_OPTIONS.map(opt => {
                                const isChecked = checked.has(opt.code);
                                return (
                                    <div key={opt.code} className={`border rounded-lg ${isChecked ? 'border-red-300 bg-red-50/40' : 'border-slate-200'}`}>
                                        <label className="flex items-center gap-2 px-3 py-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => toggle(opt.code)}
                                                className="accent-red-600"
                                            />
                                            <span className="text-sm text-slate-700 flex-1">{opt.label}</span>
                                            <span className="text-[10px] text-slate-400 font-mono">{opt.code}</span>
                                        </label>
                                        {isChecked && opt.detailHint && (
                                            <div className="px-3 pb-2 -mt-1">
                                                <input
                                                    type={opt.detailHint === 'amount' || opt.detailHint === 'age' ? 'number' : 'text'}
                                                    value={details[opt.code] ?? ''}
                                                    onChange={e => setDetails(prev => ({ ...prev, [opt.code]: e.target.value }))}
                                                    placeholder={opt.detailLabel}
                                                    className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-700">補充說明（選填）</label>
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={3}
                            placeholder="補充原因細節、背景說明等"
                            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-y"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                    >
                        取消
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting || checked.size === 0}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                        {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        確認結案
                    </button>
                </div>
            </div>
        </div>
    );
}
