'use client';

import { useState } from 'react';
import { ArrowLeft, ArchiveX, Loader2, Save } from 'lucide-react';
import { AppHeader } from './AppHeader';
import { DateInput } from './DateInput';
import { useToast } from './FloatingToast';
import { CLOSE_REASON_OPTIONS, CloseReasonCode } from '../lib/closeReasonConstants';
import { createRejectedArchive } from '../app/actions/rejectedArchiveActions';

interface Props {
    username: string;
    operatorUserId: string;
    onBack: () => void;
    onGoHome: () => void;
    onLogout: () => void;
}

type ReasonState = Record<string, { checked: boolean; detail: string }>;

function todayString() {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function RejectedArchivePage({ username, operatorUserId, onBack, onGoHome, onLogout }: Props) {
    const { push: pushToast } = useToast();
    const [applicantName, setApplicantName] = useState('');
    const [applyAt, setApplyAt] = useState(todayString());
    const [applicationForm, setApplicationForm] = useState<'P' | 'E'>('P');
    const [reasons, setReasons] = useState<ReasonState>({});
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const toggleReason = (code: CloseReasonCode) => {
        setReasons(prev => ({
            ...prev,
            [code]: {
                checked: !prev[code]?.checked,
                detail: prev[code]?.detail ?? '',
            },
        }));
    };

    const submit = async () => {
        const selectedReasons = CLOSE_REASON_OPTIONS
            .filter(opt => reasons[opt.code]?.checked)
            .map(opt => ({
                code: opt.code,
                detail: reasons[opt.code]?.detail ?? '',
            }));

        setSaving(true);
        const res = await createRejectedArchive({
            operatorUserId,
            applicantName,
            applyAt,
            applicationForm,
            reasons: selectedReasons,
            notes,
        });
        setSaving(false);

        if (!res.success) {
            pushToast({ type: 'error', msg: res.error ?? '新增失敗' });
            return;
        }
        pushToast({ type: 'success', msg: '已新增不通過歸檔' });
        setApplicantName('');
        setApplyAt(todayString());
        setApplicationForm('P');
        setReasons({});
        setNotes('');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
            <AppHeader username={username} onGoHome={onGoHome} onLogout={onLogout} />
            <main className="flex-1 container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition font-medium mb-5"
                >
                    <ArrowLeft className="w-4 h-4" />
                    返回首頁
                </button>

                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <ArchiveX className="w-6 h-6 text-rose-600" />
                        新增不通過歸檔
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        紙本申請初判條件不符、無須建立正式案件時，於此建立報表歸檔資料。
                    </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                申請人姓名 <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={applicantName}
                                onChange={e => setApplicantName(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
                                maxLength={50}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                申請日期 <span className="text-rose-500">*</span>
                            </label>
                            <DateInput
                                value={applyAt}
                                onChange={setApplyAt}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">申請形式</label>
                            <select
                                value={applicationForm}
                                onChange={e => setApplicationForm(e.target.value as 'P' | 'E')}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-200"
                            >
                                <option value="P">紙本</option>
                                <option value="E">電子郵件</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">
                            不通過原因 <span className="text-rose-500">*</span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {CLOSE_REASON_OPTIONS.filter(opt => opt.code !== '99').map(opt => {
                                const checked = !!reasons[opt.code]?.checked;
                                return (
                                    <label
                                        key={opt.code}
                                        className={`rounded-lg border p-3 cursor-pointer transition ${
                                            checked
                                                ? 'border-rose-300 bg-rose-50'
                                                : 'border-slate-200 bg-white hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-start gap-2">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleReason(opt.code)}
                                                className="mt-0.5 accent-rose-600"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <span className="text-sm font-medium text-slate-800">{opt.label}</span>
                                                {checked && opt.detailHint && (
                                                    <input
                                                        type={opt.detailHint === 'text' ? 'text' : 'number'}
                                                        value={reasons[opt.code]?.detail ?? ''}
                                                        onChange={e => setReasons(prev => ({
                                                            ...prev,
                                                            [opt.code]: { checked: true, detail: e.target.value },
                                                        }))}
                                                        placeholder={opt.detailLabel ?? '補充說明'}
                                                        className="mt-2 w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">備註</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={4}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
                            placeholder="可填寫紙本初判補充說明"
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={submit}
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            儲存歸檔
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
