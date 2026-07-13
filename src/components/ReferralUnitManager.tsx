'use client';
import { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Pencil, Check, X, Power, PowerOff } from 'lucide-react';
import { clsx } from 'clsx';
import {
    ReferralUnit,
    fetchAllReferralUnits,
    createReferralUnit,
    updateReferralUnit,
    toggleReferralUnitActive,
} from '../app/actions/referralUnitActions';
import { useToast } from './FloatingToast';

interface ReferralUnitManagerProps {
    operatorUserId: string;
}

export function ReferralUnitManager({ operatorUserId }: ReferralUnitManagerProps) {
    const { push: pushToast } = useToast();
    const [units, setUnits] = useState<ReferralUnit[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // New-unit form
    const [showAdd, setShowAdd] = useState(false);
    const [newName, setNewName] = useState('');
    const [newContact, setNewContact] = useState('');
    const [newSort, setNewSort] = useState<number>(0);

    // Inline edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editContact, setEditContact] = useState('');
    const [editSort, setEditSort] = useState<number>(0);

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
        const res = await fetchAllReferralUnits();
        if (res.success && res.data) setUnits(res.data);
        else pushToast({ type: 'error', msg: res.error ?? '載入失敗' });
        } catch (err: any) {
            console.error('ReferralUnitManager load error:', err);
            pushToast({ type: 'error', msg: err?.message ? `載入轉介單位失敗：${err.message}` : '載入轉介單位失敗' });
        } finally {
        if (!silent) setLoading(false);
        }
    }, [pushToast]);

    useEffect(() => { void load(); }, [load]);

    async function handleAdd() {
        const name = newName.trim();
        if (!name) { pushToast({ type: 'error', msg: '單位名稱為必填' }); return; }
        setSaving(true);
        const res = await createReferralUnit(name, newContact.trim() || null, newSort, operatorUserId);
        setSaving(false);
        if (!res.success) { pushToast({ type: 'error', msg: res.error ?? '新增失敗' }); return; }
        setNewName(''); setNewContact(''); setNewSort(0); setShowAdd(false);
        await load(true);
    }

    function startEdit(u: ReferralUnit) {
        setEditingId(u.id);
        setEditName(u.name);
        setEditContact(u.contactInfo ?? '');
        setEditSort(u.sortOrder);
    }

    function cancelEdit() {
        setEditingId(null);
    }

    async function saveEdit(id: string) {
        const name = editName.trim();
        if (!name) { pushToast({ type: 'error', msg: '單位名稱為必填' }); return; }
        setSaving(true);
        const res = await updateReferralUnit(id, name, editContact.trim() || null, editSort, operatorUserId);
        setSaving(false);
        if (!res.success) { pushToast({ type: 'error', msg: res.error ?? '更新失敗' }); return; }
        setEditingId(null);
        await load(true);
    }

    async function handleToggle(u: ReferralUnit) {
        const res = await toggleReferralUnitActive(u.id, !u.isActive, operatorUserId);
        if (!res.success) { pushToast({ type: 'error', msg: res.error ?? '操作失敗' }); return; }
        await load(true);
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    轉介單位管理
                </h2>
                <button
                    type="button"
                    onClick={() => { setShowAdd(s => !s); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    {showAdd ? '取消新增' : '新增單位'}
                </button>
            </div>

            {showAdd && (
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">單位名稱 *</label>
                            <input
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="例：XX 醫院社服部"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">聯絡資訊</label>
                            <input
                                value={newContact}
                                onChange={e => setNewContact(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="聯絡人 / 電話 / Email"
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
                            <th className="py-2 px-3 w-[28%]">單位名稱</th>
                            <th className="py-2 px-3 w-[38%]">聯絡資訊</th>
                            <th className="py-2 px-3 w-[10%]">排序</th>
                            <th className="py-2 px-3 w-[10%]">狀態</th>
                            <th className="py-2 px-3 w-[14%] text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={5} className="py-8 text-center text-slate-400">載入中…</td></tr>
                        ) : units.length === 0 ? (
                            <tr><td colSpan={5} className="py-8 text-center text-slate-400">尚未建立任何轉介單位</td></tr>
                        ) : units.map(u => {
                            const isEditing = editingId === u.id;
                            return (
                                <tr key={u.id} className={clsx(!u.isActive && 'bg-slate-50/60')}>
                                    <td className="py-2 px-3">
                                        {isEditing ? (
                                            <input
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                className="w-full border border-slate-300 rounded-lg px-2 py-1 text-sm"
                                            />
                                        ) : (
                                            <span className={clsx('font-medium', !u.isActive && 'text-slate-400')}>{u.name}</span>
                                        )}
                                    </td>
                                    <td className="py-2 px-3">
                                        {isEditing ? (
                                            <input
                                                value={editContact}
                                                onChange={e => setEditContact(e.target.value)}
                                                className="w-full border border-slate-300 rounded-lg px-2 py-1 text-sm"
                                                placeholder="（選填）"
                                            />
                                        ) : (
                                            <span className={clsx('text-slate-600', !u.isActive && 'text-slate-400')}>
                                                {u.contactInfo ?? <span className="text-slate-300">—</span>}
                                            </span>
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
                                            <span className="text-slate-600">{u.sortOrder}</span>
                                        )}
                                    </td>
                                    <td className="py-2 px-3">
                                        {u.isActive ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">啟用中</span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-xs font-medium">已停用</span>
                                        )}
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                        <div className="inline-flex items-center gap-1">
                                            {isEditing ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => saveEdit(u.id)}
                                                        disabled={saving}
                                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition"
                                                        title="儲存"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={cancelEdit}
                                                        disabled={saving}
                                                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded transition"
                                                        title="取消"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => startEdit(u)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                                                        title="編輯"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggle(u)}
                                                        className={clsx(
                                                            'p-1.5 rounded transition',
                                                            u.isActive
                                                                ? 'text-slate-500 hover:bg-slate-100'
                                                                : 'text-emerald-600 hover:bg-emerald-50'
                                                        )}
                                                        title={u.isActive ? '停用' : '啟用'}
                                                    >
                                                        {u.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
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
