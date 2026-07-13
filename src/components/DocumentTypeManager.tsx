'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, FileText, GripVertical, Pencil, Plus, X } from 'lucide-react';
import { clsx } from 'clsx';
import {
    createDocumentTypeConfig,
    DocumentPaperRequirement,
    DocumentPhase,
    DocumentTypeConfig,
    fetchDocumentTypeConfigs,
    reorderDocumentTypeConfigs,
    updateDocumentTypeConfig,
} from '../app/actions/documentActions';
import { StorageLocation, fetchAllStorageLocations } from '../app/actions/storageLocationActions';
import { useToast } from './FloatingToast';

const PHASE_LABEL: Record<string, string> = {
    apply: '申請階段',
    reimbursement: '核銷撥款階段',
};

const SUBSIDY_SUBTYPE_LABEL: Record<'1' | '2', string> = {
    '1': '經濟弱勢',
    '2': '小康家庭',
};

const PAPER_REQUIREMENT_LABEL: Record<DocumentPaperRequirement, string> = {
    original: '正本',
    copy: '影本',
    original_or_copy: '正本或影本',
    none: '不須紙本',
};

type DraftByPhase = Record<DocumentPhase, {
    label: string;
    subsidy_subtype: '' | '1' | '2';
    is_required: boolean;
    allow_supplement: boolean;
    paper_requirement: DocumentPaperRequirement;
    storage_location_id: number | null;
    tooltip_text: string;
}>;

const EMPTY_DRAFT: DraftByPhase = {
    apply: {
        label: '',
        subsidy_subtype: '',
        is_required: true,
        allow_supplement: false,
        paper_requirement: 'original',
        storage_location_id: null,
        tooltip_text: '',
    },
    reimbursement: {
        label: '',
        subsidy_subtype: '',
        is_required: true,
        allow_supplement: false,
        paper_requirement: 'original',
        storage_location_id: null,
        tooltip_text: '',
    },
};

export function DocumentTypeManager() {
    const { push: pushToast } = useToast();
    const [configs, setConfigs] = useState<DocumentTypeConfig[]>([]);
    const [locations, setLocations] = useState<StorageLocation[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editData, setEditData] = useState<Partial<DocumentTypeConfig>>({});
    const [drafts, setDrafts] = useState<DraftByPhase>(EMPTY_DRAFT);
    const [creatingPhase, setCreatingPhase] = useState<DocumentPhase | null>(null);
    const [draggingId, setDraggingId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const pendingDragOrderRef = useRef<Partial<Record<DocumentPhase, number[]>>>({});
    const dropHandledRef = useRef(false);

    const load = useCallback(async () => {
        try {
            const [cfgs, locsRes] = await Promise.all([
                fetchDocumentTypeConfigs(),
                fetchAllStorageLocations(),
            ]);
            setConfigs(cfgs);
            setLocations((locsRes.data ?? []).filter((l: StorageLocation) => l.status === 1));
        } catch (err: any) {
            console.error('DocumentTypeManager load error:', err);
            pushToast({ type: 'error', msg: err?.message ? `文件類型載入失敗：${err.message}` : '文件類型載入失敗' });
        }
    }, [pushToast]);

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
            subsidy_subtype: cfg.subsidy_subtype,
            paper_requirement: cfg.paper_requirement,
            tooltip_text: cfg.tooltip_text ?? '',
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

    async function handleCreate(phase: DocumentPhase) {
        const draft = drafts[phase];
        const label = draft.label.trim();
        if (!label) {
            pushToast({ type: 'error', msg: '請輸入文件名稱' });
            return;
        }
        setSaving(true);
        const res = await createDocumentTypeConfig({
            label,
            phase,
            is_required: draft.is_required,
            allow_supplement: draft.allow_supplement,
            storage_location_id: draft.storage_location_id,
            subsidy_subtype: draft.subsidy_subtype || null,
            paper_requirement: draft.paper_requirement,
            tooltip_text: draft.tooltip_text,
        });
        setSaving(false);
        if (!res.success) {
            pushToast({ type: 'error', msg: res.error ?? '新增失敗' });
            return;
        }
        setDrafts(prev => ({
            ...prev,
            [phase]: { ...EMPTY_DRAFT[phase] },
        }));
        setCreatingPhase(null);
        await load();
    }

    async function persistOrder(phase: DocumentPhase, orderedIds: number[]) {
        const res = await reorderDocumentTypeConfigs(phase, orderedIds);
        if (!res.success) {
            pushToast({ type: 'error', msg: res.error ?? '排序儲存失敗' });
            await load();
            return;
        }
        await load();
    }

    function moveDraggedItem(phase: DocumentPhase, targetId: number) {
        if (!draggingId || draggingId === targetId) return null;
        const phaseItems = grouped[phase] ?? [];
        const fromIndex = phaseItems.findIndex(item => item.id === draggingId);
        const toIndex = phaseItems.findIndex(item => item.id === targetId);
        if (fromIndex < 0 || toIndex < 0) return null;

        const reordered = [...phaseItems];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, moved);
        const orderedIds = reordered.map(item => item.id);
        pendingDragOrderRef.current[phase] = orderedIds;
        setConfigs(prev => {
            const byId = new Map(reordered.map((item, index) => [
                item.id,
                { ...item, sort_order: index + 1 },
            ]));
            return prev
                .map(item => byId.get(item.id) ?? item)
                .sort((a, b) => (
                    a.phase.localeCompare(b.phase)
                    || a.sort_order - b.sort_order
                    || a.id - b.id
                ));
        });
        return reordered;
    }

    async function handleDrop(phase: DocumentPhase, targetId: number) {
        dropHandledRef.current = true;
        const reordered = moveDraggedItem(phase, targetId);
        const orderedIds = reordered?.map(item => item.id) ?? pendingDragOrderRef.current[phase];
        setDraggingId(null);
        delete pendingDragOrderRef.current[phase];
        if (orderedIds?.length) await persistOrder(phase, orderedIds);
    }

    function handleDragEnd(phase: DocumentPhase) {
        setDraggingId(null);
        if (!dropHandledRef.current && pendingDragOrderRef.current[phase]) {
            delete pendingDragOrderRef.current[phase];
            void load();
        }
        dropHandledRef.current = false;
    }

    // Group by phase
    const grouped = configs.reduce<Record<string, DocumentTypeConfig[]>>((acc, c) => {
        (acc[c.phase] ??= []).push(c);
        return acc;
    }, {});
    Object.values(grouped).forEach(items => items.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id));

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
                <p className="text-sm text-slate-500 mt-1">管理各申請階段、核銷撥款階段的應繳文件、適用補助類別與實體存放位置</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {(['apply', 'reimbursement'] as DocumentPhase[]).map((phase) => {
                    const items = grouped[phase] ?? [];
                    const draft = drafts[phase];
                    const isCreating = creatingPhase === phase;
                    return (
                    <div key={phase}>
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                                {PHASE_LABEL[phase] ?? phase}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setCreatingPhase(prev => prev === phase ? null : phase)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-medium"
                            >
                                {isCreating ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                                {isCreating ? '取消新增' : '新增文件'}
                            </button>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                            <table className="w-full min-w-[1180px] text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600 w-8">#</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600">文件名稱</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600">提示文字</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600 w-32">適用類別</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600 w-28">必填</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600 w-28">可補件</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600 w-28">紙本要求</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600">實體存放位置</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600 w-20">狀態</th>
                                        <th className="px-4 py-3 w-24"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {isCreating && (
                                    <tr className="bg-slate-50/70">
                                        <td className="px-4 py-3 text-slate-300">
                                            <Plus className="w-4 h-4" />
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={draft.label}
                                                onChange={e => setDrafts(prev => ({
                                                    ...prev,
                                                    [phase]: { ...prev[phase], label: e.target.value },
                                                }))}
                                                placeholder={`新增${PHASE_LABEL[phase]}文件`}
                                                className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={draft.tooltip_text}
                                                onChange={e => setDrafts(prev => ({
                                                    ...prev,
                                                    [phase]: { ...prev[phase], tooltip_text: e.target.value },
                                                }))}
                                                placeholder="滑鼠停留時顯示"
                                                className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={draft.subsidy_subtype}
                                                onChange={e => setDrafts(prev => ({
                                                    ...prev,
                                                    [phase]: {
                                                        ...prev[phase],
                                                        subsidy_subtype: e.target.value === '1' || e.target.value === '2'
                                                            ? e.target.value
                                                            : '',
                                                    },
                                                }))}
                                                className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                                            >
                                                <option value="">共用</option>
                                                <option value="1">經濟弱勢</option>
                                                <option value="2">小康家庭</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={draft.is_required ? '1' : '0'}
                                                onChange={e => setDrafts(prev => ({
                                                    ...prev,
                                                    [phase]: {
                                                        ...prev[phase],
                                                        is_required: e.target.value === '1',
                                                        allow_supplement: e.target.value === '1'
                                                            ? prev[phase].allow_supplement
                                                            : false,
                                                    },
                                                }))}
                                                className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                                            >
                                                <option value="1">必填</option>
                                                <option value="0">非必填</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={draft.allow_supplement ? '1' : '0'}
                                                onChange={e => setDrafts(prev => ({
                                                    ...prev,
                                                    [phase]: { ...prev[phase], allow_supplement: e.target.value === '1' },
                                                }))}
                                                disabled={!draft.is_required}
                                                className="border border-slate-300 rounded px-2 py-1 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-400"
                                            >
                                                <option value="0">須隨附</option>
                                                <option value="1">可補件</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={draft.paper_requirement}
                                                onChange={e => setDrafts(prev => ({
                                                    ...prev,
                                                    [phase]: {
                                                        ...prev[phase],
                                                        paper_requirement: e.target.value as DocumentPaperRequirement,
                                                    },
                                                }))}
                                                className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                                            >
                                                <option value="original">正本</option>
                                                <option value="copy">影本</option>
                                                <option value="original_or_copy">正本或影本</option>
                                                <option value="none">不須紙本</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={draft.storage_location_id ?? ''}
                                                onChange={e => setDrafts(prev => ({
                                                    ...prev,
                                                    [phase]: {
                                                        ...prev[phase],
                                                        storage_location_id: e.target.value ? Number(e.target.value) : null,
                                                    },
                                                }))}
                                                className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                                            >
                                                <option value="">— 未設定 —</option>
                                                {locationOptions.map(opt => (
                                                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                                啟用
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => handleCreate(phase)}
                                                disabled={saving || !draft.label.trim()}
                                                className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="新增"
                                            >
                                                <Check className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDrafts(prev => ({
                                                        ...prev,
                                                        [phase]: { ...EMPTY_DRAFT[phase] },
                                                    }));
                                                    setCreatingPhase(null);
                                                }}
                                                disabled={saving}
                                                className="p-1.5 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 disabled:opacity-50"
                                                title="取消新增"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                            </div>
                                        </td>
                                    </tr>
                                    )}
                                    {items.map((cfg, index) => {
                                        const isEditing = editingId === cfg.id;
                                        return (
                                            <tr
                                                key={cfg.id}
                                                draggable={!isEditing}
                                                onDragStart={() => {
                                                    dropHandledRef.current = false;
                                                    delete pendingDragOrderRef.current[phase];
                                                    setDraggingId(cfg.id);
                                                }}
                                                onDragOver={e => {
                                                    e.preventDefault();
                                                    moveDraggedItem(phase, cfg.id);
                                                }}
                                                onDrop={async e => {
                                                    e.preventDefault();
                                                    await handleDrop(phase, cfg.id);
                                                }}
                                                onDragEnd={() => handleDragEnd(phase)}
                                                className={clsx(
                                                    'transition-colors',
                                                    draggingId === cfg.id && 'opacity-50',
                                                    isEditing ? 'bg-blue-50' : 'hover:bg-slate-50'
                                                )}
                                            >
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
                                                        <span className="inline-flex items-center gap-1 text-xs cursor-grab active:cursor-grabbing" title="拖曳調整排序">
                                                            <GripVertical className="w-4 h-4" />
                                                            {index + 1}
                                                        </span>
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
                                                {/* Tooltip */}
                                                <td className="px-4 py-3">
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            value={editData.tooltip_text ?? ''}
                                                            onChange={e => setEditData(p => ({ ...p, tooltip_text: e.target.value }))}
                                                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                                                            placeholder="滑鼠停留時顯示"
                                                        />
                                                    ) : (
                                                        cfg.tooltip_text
                                                            ? <span className="block max-w-56 truncate text-xs text-slate-500" title={cfg.tooltip_text}>{cfg.tooltip_text}</span>
                                                            : <span className="text-xs text-slate-300">—</span>
                                                    )}
                                                </td>
                                                {/* Subsidy subtype */}
                                                <td className="px-4 py-3">
                                                    {isEditing ? (
                                                        <select
                                                            value={editData.subsidy_subtype ?? ''}
                                                            onChange={e => setEditData(p => ({
                                                                ...p,
                                                                subsidy_subtype: e.target.value === '1' || e.target.value === '2'
                                                                    ? e.target.value
                                                                    : null,
                                                            }))}
                                                            className="border border-slate-300 rounded px-2 py-1 text-sm"
                                                        >
                                                            <option value="">共用</option>
                                                            <option value="1">經濟弱勢</option>
                                                            <option value="2">小康家庭</option>
                                                        </select>
                                                    ) : (
                                                        cfg.subsidy_subtype ? (
                                                            <span className={clsx(
                                                                'text-xs font-semibold px-2 py-0.5 rounded-full',
                                                                cfg.subsidy_subtype === '1'
                                                                    ? 'bg-rose-100 text-rose-700'
                                                                    : 'bg-emerald-100 text-emerald-700'
                                                            )}>
                                                                {SUBSIDY_SUBTYPE_LABEL[cfg.subsidy_subtype]}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">共用</span>
                                                        )
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
                                                {/* Paper requirement */}
                                                <td className="px-4 py-3">
                                                    {isEditing ? (
                                                        <select
                                                            value={editData.paper_requirement ?? cfg.paper_requirement}
                                                            onChange={e => setEditData(p => ({
                                                                ...p,
                                                                paper_requirement: e.target.value as DocumentPaperRequirement,
                                                            }))}
                                                            className="border border-slate-300 rounded px-2 py-1 text-sm"
                                                        >
                                                            <option value="original">正本</option>
                                                            <option value="copy">影本</option>
                                                            <option value="original_or_copy">正本或影本</option>
                                                            <option value="none">不須紙本</option>
                                                        </select>
                                                    ) : (
                                                        <span className={clsx(
                                                            'text-xs font-semibold px-2 py-0.5 rounded-full',
                                                            cfg.paper_requirement === 'copy'
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : cfg.paper_requirement === 'original_or_copy'
                                                                    ? 'bg-amber-100 text-amber-700'
                                                                    : cfg.paper_requirement === 'none'
                                                                        ? 'bg-slate-100 text-slate-500'
                                                                        : 'bg-indigo-100 text-indigo-700'
                                                        )}>
                                                            {PAPER_REQUIREMENT_LABEL[cfg.paper_requirement]}
                                                        </span>
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
                    );
                })}
            </div>
        </div>
    );
}
