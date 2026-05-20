'use client';

/**
 * 聯絡紀錄查詢 Modal — 給首頁「查詢聯絡紀錄」flow 用。
 *
 * 支援篩選：
 *   - 姓名（申請人 / 來電者；client-side 過濾，因加密欄位無法 SQL LIKE）
 *   - 電話（部分數字；server-side 比對）
 *   - 紀錄類型（來電/關懷；server-side）
 *   - 日期區間（預設最近 6 個月；server-side）
 * 改用手動【搜尋】按鈕（Enter 也行），避免每打一個字就打 server。
 * 點任一筆 → 開 ContactRecordModal（edit 模式）
 */

import { useEffect, useMemo, useState } from 'react';
import { Search, X, Loader2, Phone, Heart, Plus, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import {
    fetchContactRecords,
    searchContactsByIdNumber,
    type ContactRecord,
    type ApplicantSearchResult,
    type IdNumberSearchResult,
} from '../app/actions/contactRecordActions';
import { ContactRecordModal } from './ContactRecordModal';
import { ApplicantPickerModal } from './ApplicantPickerModal';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface Props {
    operatorUserId: string;
    onClose: () => void;
}

type RecordTypeFilter = '' | '1' | '2';

/** 預設日期範圍：最近 6 個月（避免一次抓太久遠的資料） */
function defaultDateRange(): { from: string; to: string } {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return { from: fmt(sixMonthsAgo), to: fmt(today) };
}

export function ContactSearchModal({ operatorUserId, onClose }: Props) {
    const initialRange = useMemo(defaultDateRange, []);
    // 暫存中的篩選（使用者編輯中、未送出）
    const [nameQuery, setNameQuery]   = useState('');
    const [phoneQuery, setPhoneQuery] = useState('');
    const [idNumberQuery, setIdNumberQuery] = useState('');
    const [dateFrom, setDateFrom]     = useState(initialRange.from);
    const [dateTo, setDateTo]         = useState(initialRange.to);
    // 自動觸發的篩選（typeFilter 改了立刻送）
    const [typeFilter, setTypeFilter] = useState<RecordTypeFilter>('');
    // 已送出的搜尋條件（決定當前 query 內容）
    const [appliedFilters, setAppliedFilters] = useState({
        name:  '',
        phone: '',
        idNumber: '',
        from:  initialRange.from,
        to:    initialRange.to,
    });

    const [loading, setLoading] = useState(false);
    const [records, setRecords] = useState<ContactRecord[]>([]);
    const [truncated, setTruncated] = useState(false);
    /** 身分證查詢的申請摘要（appliedFilters.idNumber 非空時才有）*/
    const [idLookup, setIdLookup] = useState<IdNumberSearchResult | null>(null);
    const [editing, setEditing] = useState<ContactRecord | null>(null);
    // 新增 flow 狀態
    const [phoneCreateOpen, setPhoneCreateOpen] = useState(false);
    const [pickerOpen, setPickerOpen]           = useState(false);
    const [careTarget, setCareTarget]           = useState<ApplicantSearchResult | null>(null);
    /** 重新載入搜尋結果用的 trigger（任一寫入動作 +1） */
    const [reloadTick, setReloadTick] = useState(0);
    // 分頁
    const [pageSize, setPageSize] = useState<10 | 30 | 50>(10);
    const [page, setPage] = useState(1);

    useModalDismiss(onClose);

    // 觸發查詢：appliedFilters / typeFilter / reloadTick 變化即重新查
    // 注意：name / phone / date 這幾項只有在使用者按【搜尋】後才會進到 appliedFilters
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                // 身分證搜尋走專用 path（會回傳申請摘要 + 聯絡紀錄；隱私模式遮罩）
                if (appliedFilters.idNumber) {
                    const r = await searchContactsByIdNumber(operatorUserId, appliedFilters.idNumber);
                    if (cancelled) return;
                    if (!r.success) {
                        setIdLookup(null);
                        setRecords([]);
                        setTruncated(false);
                        return;
                    }
                    setIdLookup(r.data);
                    // 套用本地 type / date 過濾在身分證查到的紀錄上
                    let recs = r.data.contactRecords;
                    if (typeFilter) recs = recs.filter(x => x.recordType === typeFilter);
                    if (appliedFilters.from) recs = recs.filter(x => (x.contactDate || '') >= appliedFilters.from);
                    if (appliedFilters.to)   recs = recs.filter(x => (x.contactDate || '') <= appliedFilters.to);
                    recs.sort((a, b) => (b.contactDate || '').localeCompare(a.contactDate || ''));
                    setRecords(recs);
                    setTruncated(false);
                    return;
                }

                // 一般搜尋（姓名／電話／日期／類型）
                setIdLookup(null);
                const HARD_LIMIT = 500;
                // 後端 SQL 已套姓名以外的條件（電話、日期、類型）；
                // 姓名因為加密欄位無法 SQL 直接 LIKE，仍保留 client-side filter。
                const r = await fetchContactRecords(operatorUserId, {
                    recordType: typeFilter || undefined,
                    callerPhoneContains: appliedFilters.phone || undefined,
                    contactDateFrom: appliedFilters.from || undefined,
                    contactDateTo: appliedFilters.to || undefined,
                    limit: HARD_LIMIT,
                });
                if (cancelled) return;
                let allRecords: ContactRecord[] = r.success ? r.data : [];
                const cleanName = appliedFilters.name.trim();
                if (cleanName) {
                    allRecords = allRecords.filter(rec =>
                        (rec.applicantName ?? '').includes(cleanName)
                        || (rec.callerName ?? '').includes(cleanName)
                    );
                }
                allRecords.sort((a, b) => (b.contactDate || '').localeCompare(a.contactDate || ''));
                setRecords(allRecords);
                setTruncated((r.success ? r.data.length : 0) >= HARD_LIMIT);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [appliedFilters, typeFilter, operatorUserId, reloadTick]);

    // 篩選或頁大小改變 → 跳回第 1 頁
    useEffect(() => { setPage(1); }, [appliedFilters, typeFilter, pageSize, reloadTick]);

    /** 套用目前編輯中的條件 → 觸發實際查詢 */
    const runSearch = () => {
        // 身分證查詢必須是完整 10 碼（DB 用 HMAC blind index，無法部分比對）
        const rawId = idNumberQuery.trim().toUpperCase();
        const idNumber = /^[A-Z][0-9]{9}$/.test(rawId) ? rawId : '';
        setAppliedFilters({
            name:  nameQuery.trim(),
            phone: phoneQuery.replace(/[^0-9]/g, ''),
            idNumber,
            from:  dateFrom,
            to:    dateTo,
        });
    };

    /** 重置條件回預設（最近 6 個月） */
    const resetFilters = () => {
        const r = defaultDateRange();
        setNameQuery('');
        setPhoneQuery('');
        setIdNumberQuery('');
        setDateFrom(r.from);
        setDateTo(r.to);
        setTypeFilter('');
        setAppliedFilters({ name: '', phone: '', idNumber: '', from: r.from, to: r.to });
    };

    const handleEnterSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); runSearch(); }
    };

    const phoneCount = useMemo(() => records.filter(r => r.recordType === '1').length, [records]);
    const careCount  = useMemo(() => records.filter(r => r.recordType === '2').length, [records]);
    const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const pagedRecords = useMemo(
        () => records.slice((safePage - 1) * pageSize, safePage * pageSize),
        [records, safePage, pageSize],
    );

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
                        <Search className="w-5 h-5 text-blue-600" />
                        聯絡紀錄
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setPhoneCreateOpen(true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <Phone className="w-3.5 h-3.5" />
                            新增來電
                        </button>
                        <button
                            type="button"
                            onClick={() => setPickerOpen(true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg transition"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <Heart className="w-3.5 h-3.5" />
                            新增關懷
                        </button>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-2">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* 篩選器 */}
                <div className="px-5 py-3 border-b border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-medium text-slate-600">姓名（申請人 / 來電者）</label>
                        <input
                            type="text"
                            value={nameQuery}
                            onChange={e => setNameQuery(e.target.value)}
                            onKeyDown={handleEnterSearch}
                            placeholder="同時比對申請人與來電人...（Enter 搜尋）"
                            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-600">電話</label>
                        <input
                            type="text"
                            value={phoneQuery}
                            onChange={e => setPhoneQuery(e.target.value)}
                            onKeyDown={handleEnterSearch}
                            placeholder="部分數字即可...（Enter 搜尋）"
                            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-600">
                            身分證字號
                            <span className="text-slate-400 font-normal ml-1">（須完整 10 碼）</span>
                        </label>
                        <input
                            type="text"
                            value={idNumberQuery}
                            onChange={e => setIdNumberQuery(e.target.value.toUpperCase())}
                            onKeyDown={handleEnterSearch}
                            maxLength={10}
                            placeholder="A123456789（Enter 搜尋）"
                            className={`mt-1 w-full border rounded-lg px-3 py-2 text-sm font-mono ${
                                idNumberQuery && !/^[A-Z][0-9]{9}$/.test(idNumberQuery)
                                    ? 'border-amber-400 bg-amber-50'
                                    : 'border-slate-300'
                            }`}
                        />
                        {idNumberQuery && !/^[A-Z][0-9]{9}$/.test(idNumberQuery) && (
                            <p className="text-[11px] text-amber-700 mt-0.5">
                                ⚠ 身分證資料庫加密儲存，無法部分比對；請輸入完整 10 碼（1 字母 + 9 數字）。
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-600">類型</label>
                        <select
                            value={typeFilter}
                            onChange={e => setTypeFilter(e.target.value as RecordTypeFilter)}
                            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        >
                            <option value="">全部</option>
                            <option value="1">來電</option>
                            <option value="2">關懷</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="text-xs font-medium text-slate-600">起始日</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-medium text-slate-600">結束日</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                    <div className="md:col-span-2 flex justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
                        >
                            重置
                        </button>
                        <button
                            type="button"
                            onClick={runSearch}
                            disabled={loading}
                            className="inline-flex items-center gap-1 px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                        >
                            <Search className="w-3.5 h-3.5" />
                            搜尋
                        </button>
                    </div>
                </div>

                {/* 身分證查詢 — 申請摘要 */}
                {idLookup && (
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                        {!idLookup.found ? (
                            <p className="text-sm text-slate-500">⚠ 此身分證字號查無申請紀錄</p>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                    <span className="font-semibold text-slate-700">申請紀錄摘要</span>
                                    <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                                        共 {idLookup.applicationCount} 件
                                    </span>
                                    {idLookup.applicantName && (
                                        <span className="text-xs text-slate-600">申請人：{idLookup.applicantName}</span>
                                    )}
                                </div>
                                {idLookup.applicationCount > 0 && (
                                    <div className="text-xs text-slate-600 flex items-center gap-3 flex-wrap">
                                        <span>
                                            最早：<span className="font-mono">{idLookup.earliestApplyAt ?? '—'}</span>
                                        </span>
                                        <span>
                                            最近：<span className="font-mono">{idLookup.latestApplyAt ?? '—'}</span>
                                        </span>
                                    </div>
                                )}
                                {idLookup.applications.length > 0 && (
                                    <ul className="text-xs text-slate-700 space-y-0.5">
                                        {idLookup.applications.map((a, i) => (
                                            <li key={a.applicationId ?? `app-${i}`} className="flex items-center gap-2">
                                                <span className="font-mono text-slate-500">{a.applyAt || '—'}</span>
                                                {a.caseNumber && (
                                                    <span className="font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                                        {a.caseNumber}
                                                    </span>
                                                )}
                                                {a.status && (
                                                    <span className="text-slate-500">
                                                        {a.status === '1' ? '審核中' :
                                                         a.status === '2' ? '審核未通過' :
                                                         a.status === '3' ? '待核銷' :
                                                         a.status === '4' ? '核銷完成' : a.status}
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* 結果上限警示 */}
                {truncated && (
                    <div className="px-5 py-2 text-xs bg-amber-50 border-b border-amber-200 text-amber-800">
                        ⚠ 結果已達上限 500 筆，請縮小日期區間或加上電話 / 類型條件以查看完整資料。
                    </div>
                )}

                {/* 結果統計列 + 每頁筆數 */}
                <div className="px-5 py-2 text-xs text-slate-500 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
                    <span className="flex items-center gap-2">
                        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
                        共 {records.length} 筆（來電 {phoneCount} / 關懷 {careCount}）
                        {loading && <span className="text-blue-500">· 搜尋中…</span>}
                    </span>
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1">
                            每頁
                            <select
                                value={pageSize}
                                onChange={e => setPageSize(Number(e.target.value) as 10 | 30 | 50)}
                                className="border border-slate-300 rounded px-1.5 py-0.5 text-xs"
                            >
                                <option value={10}>10</option>
                                <option value={30}>30</option>
                                <option value={50}>50</option>
                            </select>
                            筆
                        </label>
                    </div>
                </div>

                {/* 結果 — loading 時保留現有清單避免閃爍，僅淡化 */}
                <div className={`flex-1 overflow-y-auto transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
                    {records.length === 0 ? (
                        <p className="text-center text-slate-400 text-sm py-12">
                            {loading ? '載入中…' : '無符合篩選條件的紀錄'}
                        </p>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {pagedRecords.map(r => (
                                <button
                                    key={r.id}
                                    type="button"
                                    onClick={() => setEditing(r)}
                                    className="w-full text-left px-5 py-3 hover:bg-slate-50 transition flex items-center gap-3"
                                >
                                    {/* 1. icon */}
                                    {r.recordType === '1'
                                        ? <Phone className="w-4 h-4 text-blue-600 shrink-0" />
                                        : <Heart className="w-4 h-4 text-rose-600 shrink-0" />}
                                    {/* 2. 類型 tag */}
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                                        r.recordType === '1' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
                                    }`}>
                                        {r.recordType === '1' ? '來電' : '關懷'}
                                    </span>
                                    {/* 3. 日期（最先顯示） */}
                                    <span className="text-xs text-slate-600 font-mono shrink-0">{r.contactDate}</span>
                                    {/* 4. 姓名（來電→callerName / 關懷→applicantName） */}
                                    {(() => {
                                        const name = r.recordType === '1' ? r.callerName : r.applicantName;
                                        return name ? (
                                            <span className="text-xs font-medium text-slate-800 shrink-0 truncate max-w-[100px]">
                                                {name}
                                            </span>
                                        ) : null;
                                    })()}
                                    {/* 5. 電話（來電才有） */}
                                    {r.callerPhone && (
                                        <span className="text-xs text-slate-500 font-mono shrink-0">{r.callerPhone}</span>
                                    )}
                                    {/* 6. 摘要 — 佔可用空間 */}
                                    <span className="text-xs text-slate-700 truncate flex-1">
                                        {r.summary?.trim() || '（無摘要）'}
                                    </span>
                                    {/* 7. 案號 — 最右邊（只關懷才有；來電的 caseNumber 一般為 null） */}
                                    {r.caseNumber && (
                                        <span className="text-xs px-2 py-0.5 rounded font-mono bg-emerald-100 text-emerald-700 shrink-0 ml-auto">
                                            {r.caseNumber}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 分頁列 — 只在結果筆數 > pageSize 時顯示 */}
                {!loading && records.length > pageSize && (
                    <div className="px-5 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
                        <span>
                            第 {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, records.length)} 筆 / 共 {records.length} 筆
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setPage(1)}
                                disabled={safePage <= 1}
                                className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-30"
                                title="第一頁"
                            >«</button>
                            <button
                                type="button"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={safePage <= 1}
                                className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
                                title="上一頁"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="px-2">第 {safePage} / {totalPages} 頁</span>
                            <button
                                type="button"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={safePage >= totalPages}
                                className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
                                title="下一頁"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setPage(totalPages)}
                                disabled={safePage >= totalPages}
                                className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-30"
                                title="最末頁"
                            >»</button>
                        </div>
                    </div>
                )}
            </div>

            {editing && (
                <ContactRecordModal
                    mode="edit"
                    operatorUserId={operatorUserId}
                    applicantUserId={editing.applicantUserId}
                    existingRecord={editing}
                    onSaved={() => { setEditing(null); setReloadTick(t => t + 1); }}
                    onClose={() => setEditing(null)}
                />
            )}

            {/* 新增來電 */}
            {phoneCreateOpen && (
                <ContactRecordModal
                    mode="create"
                    operatorUserId={operatorUserId}
                    defaultRecordType="1"
                    onSaved={() => { setPhoneCreateOpen(false); setReloadTick(t => t + 1); }}
                    onClose={() => setPhoneCreateOpen(false)}
                />
            )}

            {/* 新增關懷 step 1：選申請人 */}
            {pickerOpen && (
                <ApplicantPickerModal
                    operatorUserId={operatorUserId}
                    onPick={picked => { setPickerOpen(false); setCareTarget(picked); }}
                    onClose={() => setPickerOpen(false)}
                />
            )}

            {/* 新增關懷 step 2：開 modal */}
            {careTarget && (
                <ContactRecordModal
                    mode="create"
                    operatorUserId={operatorUserId}
                    defaultRecordType="2"
                    applicantUserId={careTarget.userId}
                    applicantName={careTarget.name}
                    applications={careTarget.applications.map(a => ({
                        id: a.id, caseNumber: a.caseNumber, status: a.status,
                    }))}
                    onSaved={() => { setCareTarget(null); setReloadTick(t => t + 1); }}
                    onClose={() => setCareTarget(null)}
                />
            )}
        </div>
    );
}
