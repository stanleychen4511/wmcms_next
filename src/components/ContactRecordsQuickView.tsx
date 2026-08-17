'use client';

/**
 * 聯絡紀錄速查卡 — 用於家庭訪視頁
 *
 * 預設摺疊；標頭顯示計數（讓家訪人員一眼看到「曾有 N 通聯絡紀錄」）。
 * 展開後條列顯示摘要；點任一列開 ContactRecordModal 看完整資訊。
 *
 * 角色：靠 contactRecordActions.ts 的 ALLOWED_ROLES（含 volunteer）守門。
 */

import { useEffect, useState } from 'react';
import { Phone, Heart, ChevronDown, ChevronUp, Loader2, AlertTriangle } from 'lucide-react';
import { fetchContactRecords, type ContactRecord } from '../app/actions/contactRecordActions';
import { RECORD_TYPE_LABEL } from '../lib/contactRecordConstants';
import { ContactRecordModal } from './ContactRecordModal';
import { formatRocDateOnly } from '../lib/rocDate';

interface Props {
    applicantUserId: string;
    applicantName: string;
    operatorUserId: string;
    /** 點擊紀錄列開啟詳情 modal 後的儲存事件 — 通常傳 reload 之類的 */
    onChanged?: () => void;
}

export function ContactRecordsQuickView({ applicantUserId, applicantName, operatorUserId, onChanged }: Props) {
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [records, setRecords] = useState<ContactRecord[] | null>(null);
    const [error, setError] = useState<string>('');
    const [openRecord, setOpenRecord] = useState<ContactRecord | null>(null);

    // 進元件時就 fetch（同時取得計數 + 後續展開直接顯示，不再二次載入）
    const load = async () => {
        setLoading(true);
        setError('');
        const r = await fetchContactRecords(operatorUserId, { applicantUserId, limit: 100 });
        setLoading(false);
        if (r.success) setRecords(r.data);
        else setError(r.error);
    };
    useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [applicantUserId, operatorUserId]);

    const phoneCount = records?.filter(r => r.recordType === '1').length ?? 0;
    const careCount  = records?.filter(r => r.recordType === '2').length ?? 0;
    const total = (records?.length ?? 0);

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-lg transition"
            >
                <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-5 h-5 text-amber-600" />
                    <span className="font-bold text-slate-800">該申請人的聯絡紀錄</span>
                    {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-2" />}
                    {!loading && error && <span className="text-rose-600 text-xs ml-2">{error}</span>}
                    {!loading && !error && records && (
                        <span className="text-xs text-slate-500 ml-2">
                            {total === 0 ? '尚無聯絡紀錄' : (
                                <>
                                    共 {total} 筆
                                    <span className="ml-1">— 來電 {phoneCount} 筆 / 關懷 {careCount} 筆</span>
                                </>
                            )}
                        </span>
                    )}
                </div>
                {total > 0 && (
                    expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
            </button>

            {expanded && total > 0 && (
                <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {records!.map(r => (
                        <button
                            key={r.id}
                            type="button"
                            onClick={() => setOpenRecord(r)}
                            className="w-full flex items-start gap-3 p-3 hover:bg-amber-50/50 text-left transition"
                        >
                            <span className="shrink-0 mt-0.5">
                                {r.recordType === '1'
                                    ? <Phone className="w-4 h-4 text-blue-600" />
                                    : <Heart className="w-4 h-4 text-rose-600" />}
                            </span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span className={`px-1.5 py-0.5 rounded ${
                                        r.recordType === '1' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
                                    }`}>
                                        {RECORD_TYPE_LABEL[r.recordType]}
                                    </span>
                                    {r.hasSpecialAttention && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-medium">
                                            <AlertTriangle className="w-3 h-3" />特殊注意
                                        </span>
                                    )}
                                    <span className="font-mono">{formatRocDateOnly(r.contactDate)}</span>
                                    {r.handlerName && <span>· 處理者 {r.handlerName}</span>}
                                    {r.callerName && <span>· {r.callerName}{r.callerPhone ? `（${r.callerPhone}）` : ''}</span>}
                                </div>
                                <p className="text-sm text-slate-700 mt-1 truncate">
                                    {r.summary?.trim() || <span className="text-slate-400">（無摘要）</span>}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {openRecord && (
                <ContactRecordModal
                    mode="edit"
                    operatorUserId={operatorUserId}
                    applicantUserId={applicantUserId}
                    applicantName={applicantName}
                    existingRecord={openRecord}
                    onSaved={() => { void load(); onChanged?.(); }}
                    onClose={() => setOpenRecord(null)}
                />
            )}
        </div>
    );
}
