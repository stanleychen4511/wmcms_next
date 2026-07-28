'use client';

/**
 * 「當前案件」的關懷紀錄唯讀檢視 Modal
 *
 * 用途：在案件詳情頁（申請流程 block 下方）點按鈕後彈出，
 *      顯示此 application_id 對應的所有 contact_records（來電 + 關懷）。
 *
 * 限制：純檢視 — 不可新增、不可編輯、不可刪除。
 */

import { useEffect, useMemo, useState } from 'react';
import { Heart, X, Loader2, Phone, ClipboardList, AlertTriangle } from 'lucide-react';
import {
    fetchContactRecords,
    type ContactRecord,
} from '../app/actions/contactRecordActions';
import { ImageLightbox, looksLikeImageUrl } from './ImageLightbox';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface Props {
    applicationId: string;
    /** 案件對應的申請人 user.id；用以撈出該申請人所有相關來電 */
    applicantUserId?: string | null;
    caseNumber?: string | null;
    operatorUserId: string;
    onClose: () => void;
}

export function ApplicationCareRecordsModal({ applicationId, applicantUserId, caseNumber, operatorUserId, onClose }: Props) {
    const [records, setRecords] = useState<ContactRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    // 媒體 lightbox — 一次只開一張紀錄的圖片清單
    const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

    // 預先計算每筆紀錄的「可預覽圖片」清單，方便點縮圖時直接帶入
    const imageMap = useMemo(() => {
        const m = new Map<string, string[]>();
        for (const r of records) {
            const imgs = r.mediaUrls.map(u => u.trim()).filter(u => looksLikeImageUrl(u));
            if (imgs.length > 0) m.set(r.id, imgs);
        }
        return m;
    }, [records]);

    useModalDismiss(onClose);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            // 兩路平行：
            //   - 此案件的關懷紀錄（recordType='2', application_id = applicationId）
            //   - 此申請人的所有來電（recordType='1', applicant_user_id = applicantUserId）
            //   兩者再 union（dedup by id），按日期排序
            const [careRes, phoneRes] = await Promise.all([
                fetchContactRecords(operatorUserId, { applicationId, recordType: '2' }),
                applicantUserId
                    ? fetchContactRecords(operatorUserId, { applicantUserId, recordType: '1' })
                    : Promise.resolve({ success: true as const, data: [] }),
            ]);
            if (cancelled) return;
            const errs = [
                careRes.success ? null : careRes.error,
                phoneRes.success ? null : phoneRes.error,
            ].filter(Boolean);
            if (errs.length > 0) setError(errs.join('； '));
            const careData = careRes.success ? careRes.data : [];
            const phoneData = phoneRes.success ? phoneRes.data : [];
            const merged = new Map<string, ContactRecord>();
            for (const r of [...careData, ...phoneData]) merged.set(r.id, r);
            const sorted = Array.from(merged.values()).sort((a, b) => {
                if (a.hasSpecialAttention !== b.hasSpecialAttention) return a.hasSpecialAttention ? -1 : 1;
                return (b.contactDate || '').localeCompare(a.contactDate || '');
            });
            setRecords(sorted);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [applicationId, applicantUserId, operatorUserId]);

    const phoneCount = records.filter(r => r.recordType === '1').length;
    const careCount  = records.filter(r => r.recordType === '2').length;

    return (
        <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Heart className="w-5 h-5 text-rose-600" />
                        關懷紀錄
                        {caseNumber && (
                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                {caseNumber}
                            </span>
                        )}
                        <span className="text-xs font-normal text-slate-400 ml-2">（檢視模式）</span>
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-5 py-2 text-xs text-slate-500 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                    <ClipboardList className="w-3.5 h-3.5 text-emerald-600" />
                    共 {records.length} 筆
                    {records.length > 0 && (
                        <span className="text-slate-400">
                            （來電 {phoneCount} / 關懷 {careCount}）
                        </span>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-3">
                            {error}
                        </div>
                    )}
                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-slate-400">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            載入中…
                        </div>
                    ) : records.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Heart className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                            此案件尚無關懷紀錄
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {records.map(r => {
                                const expanded = expandedId === r.id;
                                const isPhone = r.recordType === '1';
                                const tagClass = isPhone ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700';
                                const tagLabel = isPhone ? '來電' : '關懷';
                                const summary = r.summary?.trim() || '（無摘要）';
                                return (
                                    <div key={r.id}>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedId(expanded ? null : r.id)}
                                            className="w-full flex items-center gap-3 p-2 rounded hover:bg-slate-50 text-left transition"
                                        >
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${tagClass}`}>
                                                {tagLabel}
                                            </span>
                                            {r.hasSpecialAttention && (
                                                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded shrink-0 bg-amber-100 text-amber-800 border border-amber-300 font-medium">
                                                    <AlertTriangle className="w-3 h-3" />特殊注意
                                                </span>
                                            )}
                                            <span className="text-xs text-slate-600 font-mono shrink-0">{r.contactDate}</span>
                                            <span className="text-xs text-slate-500 shrink-0">· {r.handlerName}</span>
                                            {isPhone && r.callerName && (
                                                <span className="text-xs text-slate-700 shrink-0 truncate max-w-[120px]">
                                                    {r.callerName}
                                                </span>
                                            )}
                                            {isPhone && r.callerPhone && (
                                                <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-mono shrink-0">
                                                    <Phone className="w-3 h-3" />{r.callerPhone}
                                                </span>
                                            )}
                                            <span className="text-xs text-slate-700 truncate flex-1">{summary}</span>
                                        </button>
                                        {expanded && (
                                            <div className="px-3 pb-3 pt-1 text-xs text-slate-700 bg-slate-50/60 rounded space-y-1">
                                                {isPhone && r.callerName && (
                                                    <p>來電人：{r.callerName}{r.callerPhone ? `（${r.callerPhone}）` : ''}</p>
                                                )}
                                                {!isPhone && r.contactedParty && (
                                                    <p>聯絡對象：
                                                        {r.contactedParty === '1' && '本人'}
                                                        {r.contactedParty === '2' && '配偶'}
                                                        {r.contactedParty === '9' && (r.contactedPartyOther || '其他')}
                                                    </p>
                                                )}
                                                {r.summary
                                                    ? <p className="whitespace-pre-wrap">{r.summary}</p>
                                                    : <p className="text-slate-400">（無摘要內容）</p>}
                                                {r.isSpecialAttention && r.specialAttentionNote && (
                                                    <p className="whitespace-pre-wrap rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-900">
                                                        <span className="font-medium">特殊注意：</span>{r.specialAttentionNote}
                                                    </p>
                                                )}
                                                {r.mediaUrls.length > 0 && (() => {
                                                    const imgs = imageMap.get(r.id) ?? [];
                                                    const nonImgs = r.mediaUrls.map(u => u.trim()).filter(u => u && !looksLikeImageUrl(u));
                                                    return (
                                                        <div className="space-y-1.5 pt-1">
                                                            {imgs.length > 0 && (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {imgs.map((url, i) => (
                                                                        <button
                                                                            key={`${r.id}-img-${i}`}
                                                                            type="button"
                                                                            onClick={() => setLightbox({ images: imgs, index: i })}
                                                                            className="block border border-slate-200 rounded-lg overflow-hidden cursor-zoom-in hover:border-indigo-400 transition bg-white"
                                                                            title="點擊放大檢視"
                                                                        >
                                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                            <img
                                                                                src={url}
                                                                                alt={`媒體 ${i + 1}`}
                                                                                className="h-24 max-w-[200px] object-cover"
                                                                                onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
                                                                            />
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {nonImgs.length > 0 && (
                                                                <ul className="text-[11px] space-y-0.5">
                                                                    {nonImgs.map((url, i) => (
                                                                        <li key={`${r.id}-link-${i}`}>
                                                                            <a
                                                                                href={url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="text-indigo-600 hover:text-indigo-800 underline break-all"
                                                                            >
                                                                                {url}
                                                                            </a>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                                <p className="text-slate-400 text-[11px]">
                                                    建立 {r.createdAt?.slice(0, 16).replace('T', ' ')}
                                                    {r.createdAt !== r.updatedAt && (
                                                        <span className="ml-2">· 最後編輯 {r.updatedAt?.slice(0, 16).replace('T', ' ')}</span>
                                                    )}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="px-5 py-3 border-t border-slate-200 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50"
                    >
                        關閉
                    </button>
                </div>
            </div>

            {/* 媒體圖片放大檢視 */}
            {lightbox && (
                <ImageLightbox
                    images={lightbox.images}
                    index={lightbox.index}
                    onChange={(i) => setLightbox(prev => prev ? { ...prev, index: i } : null)}
                    onClose={() => setLightbox(null)}
                />
            )}
        </div>
    );
}
