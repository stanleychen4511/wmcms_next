'use client';
import { useState, useEffect, useCallback } from 'react';
import { Users2, Plus, Pencil, Check, X, Power, PowerOff, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import {
    BoardGroup,
    fetchAllBoardGroups,
    createBoardGroup,
    updateBoardGroup,
    toggleBoardGroupActive,
    deleteBoardGroup,
    fetchBoardMemberCandidates,
} from '../app/actions/boardGroupActions';
import { useToast } from './FloatingToast';

interface Props {
    operatorUserId: string;
}

interface Candidate {
    id: string;
    name: string;
    account: string;
    currentGroupId: string | null;
}

export function BoardGroupManager({ operatorUserId }: Props) {
    const { push: pushToast } = useToast();
    const [groups, setGroups] = useState<BoardGroup[]>([]);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Add form
    const [showAdd, setShowAdd] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPriority, setNewPriority] = useState<number>(0);
    const [newMemberIds, setNewMemberIds] = useState<Set<string>>(new Set());

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editPriority, setEditPriority] = useState<number>(0);
    const [editMemberIds, setEditMemberIds] = useState<Set<string>>(new Set());

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        const [gRes, cRes] = await Promise.all([fetchAllBoardGroups(), fetchBoardMemberCandidates()]);
        if (gRes.success && gRes.data) setGroups(gRes.data);
        else pushToast({ type: 'error', msg: gRes.error ?? '載入組別失敗' });
        if (cRes.success && cRes.data) setCandidates(cRes.data);
        if (!silent) setLoading(false);
    }, []);

    useEffect(() => { void load(); }, [load]);

    function resetAddForm() {
        setNewName(''); setNewPriority(0); setNewMemberIds(new Set()); setShowAdd(false);
    }

    async function handleAdd() {
        if (!newName.trim()) { pushToast({ type: 'error', msg: '組別名稱為必填' }); return; }
        if (newMemberIds.size === 0) { pushToast({ type: 'error', msg: '至少需指定一位董事成員' }); return; }
        setSaving(true);
        const res = await createBoardGroup(newName.trim(), newPriority, Array.from(newMemberIds), operatorUserId);
        setSaving(false);
        if (!res.success) { pushToast({ type: 'error', msg: res.error ?? '新增失敗' }); return; }
        resetAddForm();
        await load(true);
    }

    function startEdit(g: BoardGroup) {
        setEditingId(g.id);
        setEditName(g.name);
        setEditPriority(g.priority);
        setEditMemberIds(new Set(g.members.map(m => m.userId)));
    }

    function cancelEdit() {
        setEditingId(null);
    }

    async function saveEdit(id: string) {
        if (!editName.trim()) { pushToast({ type: 'error', msg: '組別名稱為必填' }); return; }
        if (editMemberIds.size === 0) { pushToast({ type: 'error', msg: '至少需保留一位董事成員' }); return; }
        setSaving(true);
        const res = await updateBoardGroup(id, editName.trim(), editPriority, Array.from(editMemberIds), operatorUserId);
        setSaving(false);
        if (!res.success) { pushToast({ type: 'error', msg: res.error ?? '更新失敗' }); return; }
        setEditingId(null);
        await load(true);
    }

    async function handleToggle(g: BoardGroup) {
        const res = await toggleBoardGroupActive(g.id, !g.isActive, operatorUserId);
        if (!res.success) { pushToast({ type: 'error', msg: res.error ?? '操作失敗' }); return; }
        await load(true);
    }

    async function handleDelete(g: BoardGroup) {
        if (!confirm(`確定刪除組別「${g.name}」？此動作不可復原。`)) return;
        const res = await deleteBoardGroup(g.id, operatorUserId);
        if (!res.success) { pushToast({ type: 'error', msg: res.error ?? '刪除失敗' }); return; }
        await load(true);
    }

    // For "add" form: exclude candidates already in another group
    const availableForAdd = candidates.filter(c => c.currentGroupId === null);
    // For "edit" form: allow candidates who are either in this group or free
    function availableForEdit(currentGroupId: string): Candidate[] {
        return candidates.filter(c => c.currentGroupId === null || c.currentGroupId === currentGroupId);
    }

    function toggleSetMember(set: Set<string>, setter: (v: Set<string>) => void, id: string) {
        const next = new Set(set);
        if (next.has(id)) next.delete(id); else next.add(id);
        setter(next);
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                    <Users2 className="w-5 h-5 text-blue-600" />
                    董事組別管理
                </h2>
                <button
                    type="button"
                    onClick={() => { setShowAdd(s => !s); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    {showAdd ? '取消新增' : '新增組別'}
                </button>
            </div>

            {showAdd && (
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">組別名稱 *</label>
                            <input
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="例：A 組"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">優先序</label>
                            <input
                                type="number"
                                value={newPriority}
                                onChange={e => setNewPriority(Number(e.target.value) || 0)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">小者優先（平手時高優先）</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">成員 *（至少一位，僅列出未指派的董事）</label>
                        {availableForAdd.length === 0 ? (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                目前沒有未指派的董事（board_member 角色）
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {availableForAdd.map(c => (
                                    <label key={c.id} className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-slate-300 rounded-full text-xs cursor-pointer hover:bg-blue-50">
                                        <input
                                            type="checkbox"
                                            checked={newMemberIds.has(c.id)}
                                            onChange={() => toggleSetMember(newMemberIds, setNewMemberIds, c.id)}
                                            className="w-3 h-3"
                                        />
                                        <span>{c.name} <span className="text-slate-400">(@{c.account})</span></span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={resetAddForm} disabled={saving}
                            className="px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition">取消</button>
                        <button type="button" onClick={handleAdd} disabled={saving}
                            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer">
                            {saving ? '處理中…' : '確認新增'}
                        </button>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase">
                            <th className="py-2 px-3 w-[18%]">組別名稱</th>
                            <th className="py-2 px-3 w-[10%]">優先序</th>
                            <th className="py-2 px-3 w-[38%]">成員</th>
                            <th className="py-2 px-3 w-[12%]">目前案件數</th>
                            <th className="py-2 px-3 w-[10%]">狀態</th>
                            <th className="py-2 px-3 w-[12%] text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={6} className="py-8 text-center text-slate-400">載入中…</td></tr>
                        ) : groups.length === 0 ? (
                            <tr><td colSpan={6} className="py-8 text-center text-slate-400">尚未建立任何董事組別</td></tr>
                        ) : groups.map(g => {
                            const isEditing = editingId === g.id;
                            return (
                                <tr key={g.id} className={clsx(!g.isActive && 'bg-slate-50/60')}>
                                    <td className="py-2 px-3">
                                        {isEditing ? (
                                            <input
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                className="w-full border border-slate-300 rounded-lg px-2 py-1 text-sm"
                                            />
                                        ) : <span className={clsx('font-medium', !g.isActive && 'text-slate-400')}>{g.name}</span>}
                                    </td>
                                    <td className="py-2 px-3">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                value={editPriority}
                                                onChange={e => setEditPriority(Number(e.target.value) || 0)}
                                                className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-sm"
                                            />
                                        ) : <span className="text-slate-600">{g.priority}</span>}
                                    </td>
                                    <td className="py-2 px-3">
                                        {isEditing ? (
                                            <div className="flex flex-wrap gap-1">
                                                {availableForEdit(g.id).map(c => (
                                                    <label key={c.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-slate-300 rounded-full text-xs cursor-pointer hover:bg-blue-50">
                                                        <input
                                                            type="checkbox"
                                                            checked={editMemberIds.has(c.id)}
                                                            onChange={() => toggleSetMember(editMemberIds, setEditMemberIds, c.id)}
                                                            className="w-3 h-3"
                                                        />
                                                        <span>{c.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {g.members.length === 0 ? (
                                                    <span className="text-xs text-red-500">（無成員）</span>
                                                ) : g.members.map(m => (
                                                    <span key={m.userId} className="inline-flex items-center px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs">
                                                        {m.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">{g.openCaseCount}</span>
                                    </td>
                                    <td className="py-2 px-3">
                                        {g.isActive ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">啟用中</span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-xs font-medium">已停用</span>
                                        )}
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                        <div className="inline-flex items-center gap-1">
                                            {isEditing ? (
                                                <>
                                                    <button type="button" onClick={() => saveEdit(g.id)} disabled={saving}
                                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition" title="儲存">
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button type="button" onClick={cancelEdit} disabled={saving}
                                                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded transition" title="取消">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button type="button" onClick={() => startEdit(g)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition" title="編輯">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button type="button" onClick={() => handleToggle(g)}
                                                        className={clsx('p-1.5 rounded transition', g.isActive ? 'text-slate-500 hover:bg-slate-100' : 'text-emerald-600 hover:bg-emerald-50')}
                                                        title={g.isActive ? '停用' : '啟用'}>
                                                        {g.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                                    </button>
                                                    <button type="button" onClick={() => handleDelete(g)}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded transition" title="刪除">
                                                        <Trash2 className="w-4 h-4" />
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
