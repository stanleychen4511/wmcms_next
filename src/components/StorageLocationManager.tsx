'use client';
import { useState, useEffect, useCallback } from 'react';
import { FolderOpen, Folder, Plus, Pencil, ToggleLeft, ToggleRight, ChevronRight, ChevronDown, AlertTriangle, X } from 'lucide-react';
import { clsx } from 'clsx';
import {
    StorageLocation,
    fetchAllStorageLocations,
    addStorageLocation,
    updateStorageLocation,
    disableStorageLocation,
    enableStorageLocation,
} from '../app/actions/storageLocationActions';
import { useToast } from './FloatingToast';
import { useModalDismiss } from '../hooks/useModalDismiss';

// ─── Tree helpers ────────────────────────────────────────────────────────────

function buildTree(flat: StorageLocation[]): StorageLocation[] {
    const map = new Map<number, StorageLocation>();
    flat.forEach(n => map.set(n.id, { ...n, children: [], level: 0 }));
    const roots: StorageLocation[] = [];
    map.forEach(node => {
        if (node.parent_id == null) {
            node.level = 0;
            roots.push(node);
        } else {
            const parent = map.get(node.parent_id);
            if (parent) {
                node.level = (parent.level ?? 0) + 1;
                parent.children!.push(node);
            }
        }
    });
    // Sort children by sort_order then name
    const sortChildren = (nodes: StorageLocation[]) => {
        nodes.sort((a, b) => a.sort_order - b.sort_order || a.location_name.localeCompare(b.location_name, 'zh-TW'));
        nodes.forEach(n => n.children && sortChildren(n.children));
    };
    sortChildren(roots);
    return roots;
}

function flattenEnabled(nodes: StorageLocation[], maxLevel = 1): StorageLocation[] {
    const result: StorageLocation[] = [];
    const walk = (list: StorageLocation[]) => {
        list.forEach(n => {
            if (n.status === 1 && (n.level ?? 0) <= maxLevel) result.push(n);
            if (n.children) walk(n.children);
        });
    };
    walk(nodes);
    return result;
}

// ─── Modal ───────────────────────────────────────────────────────────────────

interface ModalProps {
    mode: 'add' | 'edit';
    node?: StorageLocation;
    parentOptions: StorageLocation[];   // nodes that can be parents (level < 2, status=1)
    onClose: () => void;
    onSaved: () => void;
}

function LocationModal({ mode, node, parentOptions, onClose, onSaved }: ModalProps) {
    useModalDismiss(onClose);
    const [locationName, setLocationName] = useState(node?.location_name ?? '');
    const [parentId, setParentId] = useState<number | null>(node?.parent_id ?? null);
    const [description, setDescription] = useState(node?.description ?? '');
    const [sortOrder, setSortOrder] = useState<number>(node?.sort_order ?? 1);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!locationName.trim()) { setError('請輸入位置名稱'); return; }
        setSaving(true); setError('');
        try {
            let res;
            if (mode === 'add') {
                res = await addStorageLocation(locationName, parentId, description || null, sortOrder);
            } else {
                res = await updateStorageLocation(node!.id, locationName, description || null, sortOrder);
            }
            if (res.success) { onSaved(); onClose(); }
            else setError(res.error ?? '操作失敗');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800">
                        {mode === 'add' ? '新增位置' : '編輯位置'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    {/* 父節點 (add only) */}
                    {mode === 'add' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">父節點</label>
                            <select
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={parentId ?? ''}
                                onChange={e => setParentId(e.target.value === '' ? null : Number(e.target.value))}
                            >
                                <option value="">（最頂層）</option>
                                {parentOptions.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {'　'.repeat(p.level ?? 0)}{p.location_name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-400 mt-1">最多三層，第三層節點不可再新增子項目</p>
                        </div>
                    )}

                    {/* 位置名稱 */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">位置名稱 <span className="text-red-500">*</span></label>
                        <input
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={locationName}
                            onChange={e => setLocationName(e.target.value)}
                            placeholder="例：A 區、第 1 號櫃"
                            maxLength={255}
                        />
                    </div>

                    {/* 排序 */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">排序順序</label>
                        <input
                            type="number"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={sortOrder}
                            onChange={e => setSortOrder(Number(e.target.value))}
                            min={0}
                        />
                    </div>

                    {/* 備註 */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">備註</label>
                        <textarea
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={2}
                            placeholder="選填"
                        />
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>
                <div className="flex gap-3 px-6 py-4 border-t border-slate-100 justify-end">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 transition">取消</button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                        {saving ? '儲存中…' : '儲存'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Disable warning dialog ──────────────────────────────────────────────────

interface DisableDialogProps {
    node: StorageLocation;
    onClose: () => void;
}

/** Recursive tree list of active descendants */
function ActiveDescendantTree({ nodes, indent = 0 }: { nodes: StorageLocation[]; indent?: number }) {
    const active = nodes.filter(n => n.status === 1);
    if (active.length === 0) return null;
    return (
        <ul className="space-y-1">
            {active.map(n => (
                <li key={n.id}>
                    <div className="flex items-center gap-1.5" style={{ paddingLeft: indent * 16 }}>
                        {indent > 0 && <span className="text-slate-300 select-none">└</span>}
                        <span className={clsx(
                            'text-xs font-medium px-1.5 py-0.5 rounded',
                            indent === 0 ? 'text-amber-700 bg-amber-50' : 'text-slate-600 bg-slate-100'
                        )}>
                            {n.location_name}
                        </span>
                    </div>
                    {n.children && n.children.length > 0 && (
                        <ActiveDescendantTree nodes={n.children} indent={indent + 1} />
                    )}
                </li>
            ))}
        </ul>
    );
}

function DisableBlockedDialog({ node, onClose }: DisableDialogProps) {
    useModalDismiss(onClose);
    // Count all active descendants
    const countActive = (nodes: StorageLocation[]): number =>
        nodes.reduce((sum, n) => sum + (n.status === 1 ? 1 : 0) + countActive(n.children ?? []), 0);
    const total = countActive(node.children ?? []);

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    <h3 className="text-lg font-bold text-slate-800">無法停用</h3>
                </div>
                <div className="px-6 py-5 space-y-3 text-sm text-slate-700">
                    <p>「<strong>{node.location_name}</strong>」底下仍有 <strong>{total}</strong> 個啟用中的子節點，請先逐一停用後再停用此節點：</p>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 max-h-60 overflow-y-auto">
                        <ActiveDescendantTree nodes={node.children ?? []} />
                    </div>
                </div>
                <div className="flex justify-end px-6 py-4 border-t border-slate-100">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-700 transition">確認</button>
                </div>
            </div>
        </div>
    );
}

// ─── Tree Node Row ────────────────────────────────────────────────────────────

const LEVEL_INDENT = 24; // px per level

interface TreeNodeProps {
    node: StorageLocation;
    expanded: Set<number>;
    onToggleExpand: (id: number) => void;
    onEdit: (node: StorageLocation) => void;
    onToggleStatus: (node: StorageLocation) => void;
}

function TreeNodeRow({ node, expanded, onToggleExpand, onEdit, onToggleStatus }: TreeNodeProps) {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const level = node.level ?? 0;

    const levelLabel = ['第一層', '第二層', '第三層'][level] ?? `第 ${level + 1} 層`;

    return (
        <>
            <tr className={clsx(
                'border-b border-slate-100 hover:bg-slate-50 transition-colors',
                node.status === 0 && 'opacity-50'
            )}>
                <td className="py-3 px-4">
                    <div className="flex items-center gap-1" style={{ paddingLeft: level * LEVEL_INDENT }}>
                        {/* Expand toggle */}
                        {hasChildren ? (
                            <button onClick={() => onToggleExpand(node.id)} className="text-slate-400 hover:text-slate-600 w-5 h-5 flex items-center justify-center">
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                        ) : (
                            <span className="w-5" />
                        )}
                        {/* Icon */}
                        {hasChildren
                            ? <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
                            : <Folder className="w-4 h-4 text-slate-300 shrink-0" />}
                        <span className="ml-1 text-sm font-medium text-slate-800">{node.location_name}</span>
                    </div>
                </td>
                <td className="py-3 px-4 text-xs text-slate-500">{levelLabel}</td>
                <td className="py-3 px-4 text-xs text-slate-500">{node.sort_order}</td>
                <td className="py-3 px-4 text-xs text-slate-500 max-w-xs truncate">{node.description ?? '—'}</td>
                <td className="py-3 px-4">
                    <span className={clsx(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        node.status === 1 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    )}>
                        {node.status === 1 ? '啟用' : '停用'}
                    </span>
                </td>
                <td className="py-3 px-4">
                    <button
                        onClick={() => onEdit(node)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition"
                    >
                        <Pencil className="w-4 h-4" />
                    </button>
                </td>
                <td className="py-3 px-4">
                    <button
                        onClick={() => onToggleStatus(node)}
                        title={node.status === 1 ? '停用' : '啟用'}
                        className={clsx(
                            'p-1.5 rounded-lg transition',
                            node.status === 1
                                ? 'text-slate-500 hover:bg-amber-50 hover:text-amber-600'
                                : 'text-slate-400 hover:bg-green-50 hover:text-green-600'
                        )}
                    >
                        {node.status === 1 ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                    </button>
                </td>
            </tr>
            {/* Render children */}
            {isExpanded && node.children?.map(child => (
                <TreeNodeRow
                    key={child.id}
                    node={child}
                    expanded={expanded}
                    onToggleExpand={onToggleExpand}
                    onEdit={onEdit}
                    onToggleStatus={onToggleStatus}
                />
            ))}
        </>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function StorageLocationManager() {
    const { push: pushToast } = useToast();
    const [tree, setTree] = useState<StorageLocation[]>([]);
    const [flatAll, setFlatAll] = useState<StorageLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

    const [modal, setModal] = useState<{ mode: 'add' | 'edit'; node?: StorageLocation } | null>(null);
    const [disableDialog, setDisableDialog] = useState<StorageLocation | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchAllStorageLocations();
            if (res.success && res.data) {
                setFlatAll(res.data);
                const t = buildTree(res.data);
                setTree(t);
                // Expand all by default
                const allIds = new Set<number>(res.data.map(n => n.id));
                setExpanded(allIds);
            }
        } catch (err: any) {
            console.error('StorageLocationManager loadData error:', err);
            pushToast({ type: 'error', msg: err?.message ? `載入存放位置失敗：${err.message}` : '載入存放位置失敗' });
        } finally {
            setLoading(false);
        }
    }, [pushToast]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleToggleExpand = (id: number) => {
        setExpanded(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    /** Collect IDs of nodes whose level < maxLevel (so their children are visible up to maxLevel) */
    const idsUpToLevel = useCallback((maxLevel: number): Set<number> => {
        const ids = new Set<number>();
        const walk = (nodes: StorageLocation[]) => {
            nodes.forEach(n => {
                if ((n.level ?? 0) < maxLevel) {
                    ids.add(n.id);
                    if (n.children) walk(n.children);
                }
            });
        };
        walk(tree);
        return ids;
    }, [tree]);

    const collapseAll  = () => setExpanded(new Set());
    const expandLevel2 = () => setExpanded(idsUpToLevel(1)); // show level 0 children → expand level-0 nodes
    const expandAll    = () => setExpanded(idsUpToLevel(3));

    const handleEdit = (node: StorageLocation) => setModal({ mode: 'edit', node });

    /** Find node in the tree (which has populated children) by id */
    const findInTree = (nodes: StorageLocation[], id: number): StorageLocation | null => {
        for (const n of nodes) {
            if (n.id === id) return n;
            if (n.children) { const found = findInTree(n.children, id); if (found) return found; }
        }
        return null;
    };

    const handleToggleStatus = async (node: StorageLocation) => {
        if (node.status === 1) {
            // Disabling
            const res = await disableStorageLocation(node.id);
            if (!res.success) {
                if (res.activeChildren && res.activeChildren.length > 0) {
                    // Use the tree node (which has full children populated) for the dialog
                    const treeNode = findInTree(tree, node.id) ?? node;
                    setDisableDialog(treeNode);
                } else {
                    pushToast({ type: 'error', msg: res.error ?? '停用失敗' });
                }
            } else {
                await loadData();
            }
        } else {
            // Enabling
            const res = await enableStorageLocation(node.id);
            if (!res.success) pushToast({ type: 'error', msg: res.error ?? '啟用失敗' });
            else await loadData();
        }
    };

    // Parent options for "add" modal: only nodes at level 0 or 1 (can accept children), status=1
    const parentOptions = flattenEnabled(tree, 1);

    return (
        <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">檔案實體位置管理</h2>
                    <p className="text-xs text-slate-500 mt-0.5">管理檔案存放的實體位置，最多支援三層階層結構</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Expand level buttons */}
                    <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-1 bg-slate-50">
                        <button
                            onClick={collapseAll}
                            title="全收合"
                            className="px-2.5 py-1 text-xs rounded-md text-slate-600 hover:bg-white hover:shadow-sm transition"
                        >
                            全收合
                        </button>
                        <button
                            onClick={expandLevel2}
                            title="展開至第二層"
                            className="px-2.5 py-1 text-xs rounded-md text-slate-600 hover:bg-white hover:shadow-sm transition"
                        >
                            展開第二層
                        </button>
                        <button
                            onClick={expandAll}
                            title="全展開"
                            className="px-2.5 py-1 text-xs rounded-md text-slate-600 hover:bg-white hover:shadow-sm transition"
                        >
                            全展開
                        </button>
                    </div>
                    <button
                        onClick={() => setModal({ mode: 'add' })}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        新增位置
                    </button>
                </div>
            </div>

            {/* Tree Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">位置名稱</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">層級</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">排序</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">備註</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">狀態</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">編輯</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">啟/停用</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} className="py-12 text-center text-sm text-slate-400">載入中…</td></tr>
                        ) : tree.length === 0 ? (
                            <tr><td colSpan={7} className="py-12 text-center text-sm text-slate-400">尚無位置資料，請點擊「新增位置」開始建立。</td></tr>
                        ) : tree.map(node => (
                            <TreeNodeRow
                                key={node.id}
                                node={node}
                                expanded={expanded}
                                onToggleExpand={handleToggleExpand}
                                onEdit={handleEdit}
                                onToggleStatus={handleToggleStatus}
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add / Edit Modal */}
            {modal && (
                <LocationModal
                    mode={modal.mode}
                    node={modal.node}
                    parentOptions={parentOptions}
                    onClose={() => setModal(null)}
                    onSaved={loadData}
                />
            )}

            {/* Disable blocked dialog */}
            {disableDialog && (
                <DisableBlockedDialog
                    node={disableDialog}
                    onClose={() => setDisableDialog(null)}
                />
            )}
        </div>
    );
}
