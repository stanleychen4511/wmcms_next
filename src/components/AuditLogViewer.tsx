import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchAuditLogs, AuditLogEntry, AuditAction, AuditTargetType } from '../app/actions/auditActions';
import { DateInput } from './DateInput';

// ── Chinese label maps ────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
    'application.create':        '新增申請案件',
    'application.update':        '修改申請資料',
    'application.stage_advance': '推進申請階段',
    'application.stage_rollback':'退回申請階段',
    'application.officer_assign':'派案',
    'application.close':         '結案',
    'home_visit.create':         '新增家訪紀錄',
    'home_visit.update':         '修改家訪紀錄',
    'document.upload':           '上傳文件',
    'document.preview':          '預覽文件',
    'document.delete':           '刪除文件',
    'document.status_update':    '審核文件狀態',
    'user.login':                '使用者登入',
    'user.create':               '新增使用者',
    'user.update':               '修改使用者',
    'user.deactivate':           '停用使用者',
    'file_location.create':      '新增實體位置',
    'file_location.update':      '修改實體位置',
    'file_location.disable':     '停用實體位置',
    'file_location.enable':      '啟用實體位置',
};

const TARGET_TYPE_LABELS: Record<string, string> = {
    'application':   '申請案件',
    'home_visit':    '家訪紀錄',
    'document':      '文件',
    'user':          '使用者',
    'file_location': '實體位置',
};

const ACTION_COLORS: Record<string, string> = {
    'application.create':        'bg-blue-100 text-blue-700',
    'application.stage_advance': 'bg-green-100 text-green-700',
    'application.stage_rollback':'bg-orange-100 text-orange-700',
    'application.officer_assign':'bg-indigo-100 text-indigo-700',
    'application.close':         'bg-slate-100 text-slate-600',
    'application.update':        'bg-yellow-100 text-yellow-700',
    'home_visit.create':         'bg-teal-100 text-teal-700',
    'home_visit.update':         'bg-teal-100 text-teal-700',
    'document.upload':           'bg-purple-100 text-purple-700',
    'document.preview':          'bg-gray-100 text-gray-600',
    'document.delete':           'bg-red-100 text-red-700',
    'document.status_update':    'bg-purple-100 text-purple-700',
    'user.login':                'bg-gray-100 text-gray-600',
    'user.create':               'bg-blue-100 text-blue-700',
    'user.update':               'bg-yellow-100 text-yellow-700',
    'user.deactivate':           'bg-red-100 text-red-700',
    'file_location.create':      'bg-blue-100 text-blue-700',
    'file_location.update':      'bg-yellow-100 text-yellow-700',
    'file_location.disable':     'bg-red-100 text-red-700',
    'file_location.enable':      'bg-green-100 text-green-700',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function formatDateTime(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 50, 100];

export function AuditLogViewer() {
    const t = today();

    // Filters
    const [userAccount, setUserAccount] = useState('');
    const [action,      setAction]      = useState<AuditAction | ''>('');
    const [targetType,  setTargetType]  = useState<AuditTargetType | ''>('');
    const [dateFrom,    setDateFrom]    = useState(t);
    const [dateTo,      setDateTo]      = useState(t);

    // Pagination
    const [page,     setPage]     = useState(1);
    const [pageSize, setPageSize] = useState(50);

    // Data
    const [rows,    setRows]    = useState<AuditLogEntry[]>([]);
    const [total,   setTotal]   = useState(0);
    const [loading, setLoading] = useState(false);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const load = useCallback(async (p: number, ps: number) => {
        setLoading(true);
        try {
            const res = await fetchAuditLogs({
                userAccount: userAccount.trim() || undefined,
                action:      action      || undefined,
                targetType:  targetType  || undefined,
                dateFrom:    dateFrom    || undefined,
                dateTo:      dateTo      || undefined,
                limit:  ps,
                offset: (p - 1) * ps,
            });
            setRows(res.rows);
            setTotal(res.total);
        } finally {
            setLoading(false);
        }
    }, [userAccount, action, targetType, dateFrom, dateTo]);

    // Re-fetch when filters change — reset to page 1
    useEffect(() => {
        setPage(1);
        load(1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userAccount, action, targetType, dateFrom, dateTo]);

    // Re-fetch when page or pageSize changes
    useEffect(() => {
        load(page, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, pageSize]);

    const handlePageSize = (ps: number) => {
        setPageSize(ps);
        setPage(1);
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Filter Bar */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {/* 日期區間 */}
                    <div className="lg:col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">日期區間</label>
                        <div className="flex items-center gap-2">
                            <DateInput
                                value={dateFrom}
                                onChange={setDateFrom}
                                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                            <span className="text-slate-400 text-sm shrink-0">至</span>
                            <DateInput
                                value={dateTo}
                                onChange={setDateTo}
                                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                        </div>
                    </div>

                    {/* 操作帳號 */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">操作帳號</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={userAccount}
                                onChange={e => setUserAccount(e.target.value)}
                                placeholder="搜尋帳號..."
                                className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                        </div>
                    </div>

                    {/* 動作類型 */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">動作類型</label>
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <select
                                value={action}
                                onChange={e => setAction(e.target.value as AuditAction | '')}
                                className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                                <option value="">全部動作</option>
                                {Object.entries(ACTION_LABELS).map(([code, label]) => (
                                    <option key={code} value={code}>{label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 目標類型 */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">目標類型</label>
                        <select
                            value={targetType}
                            onChange={e => setTargetType(e.target.value as AuditTargetType | '')}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            <option value="">全部類型</option>
                            {Object.entries(TARGET_TYPE_LABELS).map(([code, label]) => (
                                <option key={code} value={code}>{label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Result count + page size */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm text-slate-500">
                    共 <span className="font-semibold text-slate-700">{total}</span> 筆紀錄
                    {total > 0 && (
                        <span className="ml-1">
                            （第 {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} 筆）
                        </span>
                    )}
                </span>
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500">每頁顯示</span>
                    {PAGE_SIZE_OPTIONS.map(ps => (
                        <button
                            key={ps}
                            onClick={() => handlePageSize(ps)}
                            className={`px-3 py-1 rounded-lg border text-sm font-medium transition ${
                                pageSize === ps
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                            }`}
                        >
                            {ps}
                        </button>
                    ))}
                    <span className="text-slate-500">筆</span>
                </div>
            </div>

            {/* Table */}
            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
                <table className="w-full text-sm text-left min-w-[700px]">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wider border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 w-44">時間</th>
                            <th className="px-4 py-3 w-36">操作者</th>
                            <th className="px-4 py-3 w-40">動作類型</th>
                            <th className="px-4 py-3 w-28">目標類型</th>
                            <th className="px-4 py-3">目標 ID</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-16 text-center text-slate-400">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                        <span>載入中...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-16 text-center text-slate-400">
                                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                    <p>查無符合條件的操作紀錄</p>
                                </td>
                            </tr>
                        ) : rows.map(row => (
                            <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                                    {formatDateTime(row.createdAt)}
                                </td>
                                <td className="px-4 py-3">
                                    {row.userName
                                        ? <><span className="font-medium text-slate-800">{row.userName}</span><br /><span className="text-xs text-slate-400">@{row.userAccount}</span></>
                                        : <span className="text-slate-400">{row.userAccount ?? '—'}</span>
                                    }
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[row.action] ?? 'bg-gray-100 text-gray-600'}`}>
                                        {ACTION_LABELS[row.action] ?? row.action}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {TARGET_TYPE_LABELS[row.targetType] ?? row.targetType}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-400">
                                    {row.targetId ?? '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-2 rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    {/* Page numbers — show up to 7 buttons */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                        .reduce<(number | '...')[]>((acc, p, i, arr) => {
                            if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                            acc.push(p);
                            return acc;
                        }, [])
                        .map((p, i) =>
                            p === '...'
                                ? <span key={`ellipsis-${i}`} className="px-2 text-slate-400">…</span>
                                : <button
                                    key={p}
                                    onClick={() => setPage(p as number)}
                                    className={`w-9 h-9 rounded-lg border text-sm font-medium transition ${
                                        page === p
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                                    }`}
                                >
                                    {p}
                                </button>
                        )
                    }

                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-2 rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
