'use client';
/**
 * 後台「聯絡方式類別」管理（WMCMS-1 #75）：來電紀錄的聯絡方式下拉選項。
 * 停用而非刪除，已使用的類別仍保留於歷史紀錄與來電統計中。
 */
import { useState, useEffect, useCallback } from 'react';
import { Phone, Plus, Pencil, Check, X, Power, PowerOff } from 'lucide-react';
import { clsx } from 'clsx';
import {
    type ContactChannelOption,
    fetchContactChannelOptions,
    createContactChannelOption,
    updateContactChannelOption,
    toggleContactChannelOptionActive,
} from '../app/actions/contactChannelActions';
import { useToast } from './FloatingToast';

interface ContactChannelManagerProps {
    operatorUserId: string;
}

export function ContactChannelManager({ operatorUserId }: ContactChannelManagerProps) {
    const { push: pushToast } = useToast();
    const [options, setOptions] = useState<ContactChannelOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [showAdd, setShowAdd] = useState(false);
    const [newName, setNewName] = useState('');
    const [newSort, setNewSort] = useState<number>(0);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editSort, setEditSort] = useState<number>(0);

    // silent=true：儲存後背景刷新，保留 DOM 避免捲動回頂端
    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await fetchContactChannelOptions(false);
            if (res.success && res.data) setOptions(res.data);
            else pushToast({ type: 'error', msg: res.error ?? '載入失敗' });
        } finally {
            if (!silent) setLoading(false);
        }
    }, [pushToast]);

    useEffect(() => { void load(); }, [load]);

    async function handleAdd() {
        const name = newName.trim();
        if (!name) { pushToast({ type: 'error', msg: '類別名稱為必填' }); return; }
        setSaving(true);
        const res = await createContactChannelOption(operatorUserId, name, newSort);
        setSaving(false);
        if (!res.success) { pushToast({ type: 'error', msg: res.error ?? '新增失敗' }); return; }
        pushToast({ type: 'success', msg: '已新增' });
        setNewName(''); setNewSort(0); setShowAdd(false);
        await load(true);
    }

    function startEdit(o: ContactChannelOption) {
        setEditingId(o.id);
        setEditName(o.name);
        setEditSort(o.sortOrder);
    }

    async function saveEdit(id: string) {
        const name = editName.trim();
        if (!name) { pushToast({ type: 'error', msg: '類別名稱為必填' }); return; }
        setSaving(true);
        const res = await updateContactChannelOption(operatorUserId, id, name, editSort);
        setSaving(false);
        if (!res.success) { pushToast({ type: 'error', msg: res.error ?? '更新失敗' }); return; }
        pushToast({ type: 'success', msg: '已儲存' });
        setEditingId(null);
        await load(true);
    }

    async function handleToggle(o: ContactChannelOption) {
        const res = await toggleContactChannelOptionActive(operatorUserId, o.id, !o.isActive);
        if (!res.success) { pushToast({ type: 'error', msg: res.error ?? '操作失敗' }); return; }
        await load(true);
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                        <Phone className="w-5 h-5 text-blue-600" />
                        聯絡方式類別
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">來電紀錄「聯絡方式類別」的下拉選項；停用後不再出現在選單，但舊紀錄與統計仍保留。</p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowAdd(s => !s)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    {showAdd ? '取消新增' : '新增類別'}
                </button>
            </div>

            {showAdd && (
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-600 mb-1">類別名稱 *</label>
                            <input
                                value={newName}
                                maxLength={30}
                                onChange={e => setNewName(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="例：Facebook 私訊"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">排序</label>
                            <input
                                type="number"
                                value={newSort}
                                onChange={e => setNewSort(Number(e.target.value) || 0)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setShowAdd(false)}
                            disabled={saving}
                            className="px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                        >
                            取消
                        </button>
                        <button
                            type="button"
                            onClick={handleAdd}
                            disabled={saving}
                            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer"
                        >
                            {saving ? '處理中…' : '確認新增'}
                        </button>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase">
                            <th className="py-2 px-3 w-[50%]">類別名稱</th>
                            <th className="py-2 px-3 w-[15%]">排序</th>
                            <th className="py-2 px-3 w-[15%]">狀態</th>
                            <th className="py-2 px-3 w-[20%] text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={4} className="py-8 text-center text-slate-400">載入中…</td></tr>
                        ) : options.length === 0 ? (
                            <tr><td colSpan={4} className="py-8 text-center text-slate-400">尚未建立任何類別</td></tr>
                        ) : options.map(o => {
                            const isEditing = editingId === o.id;
                            return (
                                <tr key={o.id} className={clsx(!o.isActive && 'bg-slate-50/60')}>
                                    <td className="py-2 px-3">
                                        {isEditing ? (
                                            <input
                                                value={editName}
                                                maxLength={30}
                                                onChange={e => setEditName(e.target.value)}
                                                className="w-full border border-slate-300 rounded-lg px-2 py-1 text-sm"
                                            />
                                        ) : (
                                            <span className={clsx('font-medium', !o.isActive && 'text-slate-400')}>{o.name}</span>
                                        )}
                                    </td>
                                    <td className="py-2 px-3">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                value={editSort}
                                                onChange={e => setEditSort(Number(e.target.value) || 0)}
                                                className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-sm"
                                            />
                                        ) : (
                                            <span className="text-slate-600">{o.sortOrder}</span>
                                        )}
                                    </td>
                                    <td className="py-2 px-3">
                                        {o.isActive ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">啟用中</span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-xs font-medium">已停用</span>
                                        )}
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                        <div className="inline-flex items-center gap-1">
                                            {isEditing ? (
                                                <>
                                                    <button type="button" onClick={() => saveEdit(o.id)} disabled={saving}
                                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition" title="儲存">
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button type="button" onClick={() => setEditingId(null)} disabled={saving}
                                                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded transition" title="取消">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button type="button" onClick={() => startEdit(o)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition" title="編輯">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button type="button" onClick={() => handleToggle(o)}
                                                        className={clsx('p-1.5 rounded transition',
                                                            o.isActive ? 'text-slate-500 hover:bg-slate-100' : 'text-emerald-600 hover:bg-emerald-50')}
                                                        title={o.isActive ? '停用' : '啟用'}>
                                                        {o.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
