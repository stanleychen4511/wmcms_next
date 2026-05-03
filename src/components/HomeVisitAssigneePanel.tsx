'use client';

/**
 * 家訪指派區塊 — 案件詳情家庭訪視階段使用。
 *
 * 功能：
 * - 顯示目前被指派的家訪人員
 * - case_officer / supervisor / admin 可從下拉選單選擇 volunteer 或 case_officer 進行指派
 * - 指派後該案會出現在被指派者的「申請案件管理」清單（純志工身份）
 */
import { useEffect, useState } from 'react';
import { UserCheck, Loader2 } from 'lucide-react';
import { fetchHomeVisitCandidates, assignHomeVisitor } from '../app/actions/applicationActions';
import { useToast } from './FloatingToast';

interface Props {
    applicationId: string;
    operatorUserId: string;
    currentAssigneeId: string | null;
    currentAssigneeName: string | null;
    onChanged: () => void;
}

interface Candidate { id: string; name: string; account: string; roleCodes: string[]; }

export function HomeVisitAssigneePanel({
    applicationId, operatorUserId, currentAssigneeId, currentAssigneeName, onChanged,
}: Props) {
    const { push: pushToast } = useToast();
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [selected, setSelected] = useState<string>(currentAssigneeId ?? '');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        void fetchHomeVisitCandidates().then(setCandidates);
    }, []);

    useEffect(() => {
        setSelected(currentAssigneeId ?? '');
    }, [currentAssigneeId]);

    const handleSave = async () => {
        setSaving(true);
        const res = await assignHomeVisitor(
            operatorUserId,
            applicationId,
            selected || null,
        );
        setSaving(false);
        if (res.success) {
            pushToast({ type: 'success', msg: '已儲存家訪指派' });
            onChanged();
        } else {
            pushToast({ type: 'error', msg: res.error ?? '指派失敗' });
        }
    };

    const dirty = (selected || null) !== (currentAssigneeId || null);

    return (
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                家訪指派
            </h4>
            <div className="text-xs text-slate-500">
                目前指派：
                <span className="font-medium text-slate-700 ml-1">
                    {currentAssigneeName || '（未指派）'}
                </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <select
                    value={selected}
                    onChange={e => setSelected(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    <option value="">（清除指派）</option>
                    {candidates.map(c => (
                        <option key={c.id} value={c.id}>
                            {c.name}（{c.account}）— {c.roleCodes.includes('volunteer') ? '志工' : '個管師'}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!dirty || saving}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    儲存指派
                </button>
            </div>
            <p className="text-[11px] text-slate-400">
                指派後該案會自動出現在被指派者的「申請案件管理」清單中（純志工身份）。
            </p>
        </div>
    );
}
