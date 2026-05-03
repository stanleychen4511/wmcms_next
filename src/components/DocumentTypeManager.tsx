'use client';
import { useState, useEffect, useCallback } from 'react';
import { FileText, Pencil, Check, X, ChevronUp, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import {
    DocumentTypeConfig,
    fetchDocumentTypeConfigs,
    updateDocumentTypeConfig,
} from '../app/actions/documentActions';
import { StorageLocation, fetchAllStorageLocations } from '../app/actions/storageLocationActions';
import { useToast } from './FloatingToast';

const PHASE_LABEL: Record<string, string> = {
    apply: '申請階段',
    reimbursement: '核銷撥款階段',
};

export function DocumentTypeManager() {
    const { push: pushToast } = useToast();
    const [configs, setConfigs] = useState<DocumentTypeConfig[]>([]);
    const [locations, setLocations] = useState<StorageLocation[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editData, setEditData] = useState<Partial<DocumentTypeConfig>>({});
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        const [cfgs, locsRes] = await Promise.all([
            fetchDocumentTypeConfigs(),
            fetchAllStorageLocations(),
        ]);
        setConfigs(cfgs);
        setLocations((locsRes.data ?? []).filter((l: StorageLocation) => l.status === 1));
    }, []);

    useEffect(() => { void load(); }, [load]);

    function startEdit(cfg: DocumentTypeConfig) {
        setEditingId(cfg.id);
        setEditData({
            label: cfg.label,
            phase: cfg.phase,
            is_required: cfg.is_required,
            allow_supplement: cfg.allow_supplement,
            storage_location_id: cfg.storage_location_id,
            sort_order: cfg.sort_order,
            is_active: cfg.is_active,
        });
    }

    function cancelEdit() {
        setEditingId(null);
        setEditData({});
    }

    async function saveEdit(id: number) {
        setSaving(true);
        const res = await updateDocumentTypeConfig(id, editData);
        setSaving(false);
        if (!res.success) {
            pushToast({ type: 'error', msg: res.error ?? '儲存失敗' });
            return;
        }
        setEditingId(null);
        setEditData({});
        await load();
    }

    // Group by phase
    const grouped = configs.reduce<Record<string, DocumentTypeConfig[]>>((acc, c) => {
        (acc[c.phase] ??= []).push(c);
        return acc;
    }, {});

    // Flat location options (depth-aware label)
    function buildLocationOptions(locs: StorageLocation[]): { id: number; label: string }[] {
        const map = new Map<number, StorageLocation>();
        locs.forEach(l => map.set(l.id, l));
        const options: { id: number; label: string }[] = [];
        function getPath(id: number): string {
            const node = map.get(id);
            if (!node) return '';
            if (node.parent_id == null) return node.location_name;
            return `${getPath(node.parent_id)} / ${node.location_name}`;
        }
        locs.forEach(l => options.push({ id: l.id, label: getPath(l.id) }));
        options.sort((a, b) => a.label.localeCompare(b.label, 'zh-TW'));
        return options;
    }
    const locationOptions = buildLocationOptions(locations);

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <div className="p-6 border-b border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-6 h-6 text-blue-600" />
                    文件類型管理
                </h2>
                <p className="text-sm text-slate-500 mt-1">管理各申請階段的應繳文件與其對應的實體存放位置</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {Object.entries(grouped).map(([phase, items]) => (
                    <div key={phase}>
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                            {PHASE_LABEL[phase] ?? phase}
                        </h3>
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600 w-8">#</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600">文件名稱</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600 w-28">必填</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600 w-28">可補件</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600">實體存放位置</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600 w-20">狀態</th>
                                        <th className="px-4 py-3 w-24"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((cfg, idx) => {
                                        const isEditing = editingId === cfg.id;
                                        return (
                                            <tr key={cfg.id} className={clsx('transition-colors', isEditing ? 'bg-blue-50' : 'hover:bg-slate-50')}>
                                                {/* Sort order */}
                                                <td className="px-4 py-3 text-slate-400">
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            maxLength={3}
                                                            value={editData.sort_order ?? cfg.sort_order}
                                                            onChange={e => setEditData(p => ({ ...p, sort_order: Number(e.target.value) || 0 }))}
                                                            className="w-12 border border-slate-300 rounded px-1 py-0.5 text-center text-sm"
                                                        />
                                                    ) : (
                                                        <span className="text-xs">{cfg.sort_order}</span>
                                                    )}
                                                </td>
                                                {/* Label */}
                                                <td className="px-4 py-3">
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            value={editData.label ?? cfg.label}
                                                            onChange={e => setEditData(p => ({ ...p, label: e.target.value }))}
                                                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                                                        />
                                                    ) : (
                                                        <span className="font-medium text-slate-800">{cfg.label}</span>
                                                    )}
                                                </td>
                                                {/* Required */}
                                                <td className="px-4 py-3">
                                                    {isEditing ? (
                                                        <select
                                                            value={editData.is_required ? '1' : '0'}
                                                            onChange={e => setEditData(p => ({ ...p, is_required: e.target.value === '1' }))}
                                                            className="border border-slate-300 rounded px-2 py-1 text-sm"
                                                        >
                                                            <option value="1">必填</option>
                                                            <option value="0">非必填</option>
                                                        </select>
                                                    ) : (
                                                        <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', cfg.is_required ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500')}>
                                                            {cfg.is_required ? '必填' : '非必填'}
                                                        </span>
                                                    )}
                                                </td>
                                                {/* Allow supplement */}
                                                <td className="px-4 py-3">
                                                    {isEditing ? (
                                                        <select
                                                            value={editData.allow_supplement ? '1' : '0'}
                                                            onChange={e => setEditData(p => ({ ...p, allow_supplement: e.target.value === '1' }))}
                                                            disabled={!(editData.is_required ?? cfg.is_required)}
                                                            className="border border-slate-300 rounded px-2 py-1 text-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                                        >
                                                            <option value="0">須隨附</option>
                                                            <option value="1">可補件</option>
                                                        </select>
                                                    ) : (
                                                        cfg.is_required ? (
                                                            <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', cfg.allow_supplement ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500')}>
                                                                {cfg.allow_supplement ? '可補件' : '須隨附'}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-slate-300">—</span>
                                                        )
                                                    )}
                                                </td>
                                                {/* Storage location */}
                                                <td className="px-4 py-3">
                                                    {isEditing ? (
                                                        <select
                                                            value={editData.storage_location_id ?? ''}
                                                            onChange={e => setEditData(p => ({ ...p, storage_location_id: e.target.value ? Number(e.target.value) : null }))}
                                                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                                                        >
                                                            <option value="">— 未設定 —</option>
                                                            {locationOptions.map(opt => (
                                                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        cfg.storage_location_path
                                                            ? <span className="text-xs text-slate-500">📍 {cfg.storage_location_path}</span>
                                                            : <span className="text-xs text-slate-300">—</span>
                                                    )}
                                                </td>
                                                {/* Active */}
                                                <td className="px-4 py-3">
                                                    {isEditing ? (
                                                        <select
                                                            value={editData.is_active ? '1' : '0'}
                                                            onChange={e => setEditData(p => ({ ...p, is_active: e.target.value === '1' }))}
                                                            className="border border-slate-300 rounded px-2 py-1 text-sm"
                                                        >
                                                            <option value="1">啟用</option>
                                                            <option value="0">停用</option>
                                                        </select>
                                                    ) : (
                                                        <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', cfg.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400')}>
                                                            {cfg.is_active ? '啟用' : '停用'}
                                                        </span>
                                                    )}
                                                </td>
                                                {/* Actions */}
                                                <td className="px-4 py-3">
                                                    {isEditing ? (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => saveEdit(cfg.id)}
                                                                disabled={saving}
                                                                className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                                                title="儲存"
                                                            >
                                                                <Check className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={cancelEdit}
                                                                disabled={saving}
                                                                className="p-1.5 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300"
                                                                title="取消"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => startEdit(cfg)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                                            title="編輯"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
