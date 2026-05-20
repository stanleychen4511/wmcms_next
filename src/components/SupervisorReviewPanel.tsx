'use client';

/**
 * 主管雙閘門面板（user feedback #7）
 *
 * 用途：在 visit / admin_review 階段插入主管審核 checkpoint，
 *      個管按【送主管】→ 主管按【通過】（自動推進到董事審核）或【退件】。
 *
 * 不顯示時機：
 *   - 案件已結案 / 已過 board_review 階段
 *   - 當前操作角色既非個管亦非主管 / admin
 */

import { useState } from 'react';
import { CheckCircle, XCircle, Send, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useToast } from './FloatingToast';
import {
    requestSupervisorReviewForBoard,
    supervisorReviewForBoard,
} from '../app/actions/workflowActions';

interface Props {
    applicationId: string;
    /** 當前 workflow stage（admin_review / visit / ...） */
    stage: string;
    /** 案件 status */
    status: string;
    /** 主管送董事閘門狀態：null=待審, true=已通過, false=已退件 */
    supervisorApprovedForBoard: boolean | null | undefined;
    /** 主管退件原因 */
    supervisorReviewNote?: string | null;
    /** 當前登入使用者 id */
    operatorUserId: string;
    /** 當前使用者角色清單 */
    userRoles: string[];
    /** 個管 user id */
    officerId?: string | null;
    /** 操作完成後 caller 重新載入 */
    onChanged: () => void | Promise<void>;
}

export function SupervisorReviewPanel({
    applicationId, stage, status,
    supervisorApprovedForBoard, supervisorReviewNote,
    operatorUserId, userRoles, officerId,
    onChanged,
}: Props) {
    const { push: pushToast } = useToast();
    const [busy, setBusy] = useState(false);
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [rejectNote, setRejectNote] = useState('');
    const [approveNote, setApproveNote] = useState('');

    // 顯示時機：案件進行中 + 當前在 admin_review 或 visit/home_visit 階段
    const isApplicableStage = stage === 'admin_review' || stage === 'visit' || stage === 'home_visit';
    if (status !== '1' || !isApplicableStage) return null;

    const isOfficer = String(operatorUserId) === String(officerId ?? '');
    const isSupervisorOrAdmin = userRoles.includes('admin') || userRoles.includes('supervisor');

    // 任何不相干的角色都不顯示
    if (!isOfficer && !isSupervisorOrAdmin) return null;

    const supState = supervisorApprovedForBoard;
    // 三態：null=待主管審, true=已通過, false=已退件

    const handleSendToSupervisor = async () => {
        setBusy(true);
        const res = await requestSupervisorReviewForBoard(applicationId, operatorUserId);
        setBusy(false);
        if (res.success) {
            pushToast({ type: 'success', msg: '已送主管審核' });
            await onChanged();
        } else {
            pushToast({ type: 'error', msg: res.error ?? '送主管失敗' });
        }
    };

    const handleApprove = async () => {
        setBusy(true);
        const res = await supervisorReviewForBoard(applicationId, true, approveNote, operatorUserId);
        setBusy(false);
        if (res.success) {
            pushToast({ type: 'success', msg: '主管已通過，案件已推進至董事審核' });
            await onChanged();
        } else {
            pushToast({ type: 'error', msg: res.error ?? '通過失敗' });
        }
    };

    const handleReject = async () => {
        if (rejectNote.trim().length < 3) {
            pushToast({ type: 'error', msg: '退件原因至少 3 字' });
            return;
        }
        setBusy(true);
        const res = await supervisorReviewForBoard(applicationId, false, rejectNote, operatorUserId);
        setBusy(false);
        if (res.success) {
            pushToast({ type: 'success', msg: '已退件給個管' });
            setShowRejectForm(false);
            setRejectNote('');
            await onChanged();
        } else {
            pushToast({ type: 'error', msg: res.error ?? '退件失敗' });
        }
    };

    // ─── UI 分支 ──────────────────────────────────────────────

    // (1) 已通過 → 顯示綠色徽章
    if (supState === true) {
        return (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                    <ShieldCheck className="w-4 h-4" />
                    主管已審核通過送董事
                </div>
                {supervisorReviewNote && (
                    <p className="text-xs text-emerald-600 mt-1">{supervisorReviewNote}</p>
                )}
            </div>
        );
    }

    // (2) 已退件 → 個管見可重送；主管見可撤銷
    if (supState === false) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm space-y-2">
                <div className="flex items-center gap-2 text-red-700 font-medium">
                    <XCircle className="w-4 h-4" />
                    主管已退件
                </div>
                <p className="text-xs text-red-600 whitespace-pre-wrap">
                    {supervisorReviewNote ?? '（無註記）'}
                </p>
                {isOfficer && (
                    <button
                        type="button"
                        onClick={handleSendToSupervisor}
                        disabled={busy}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        修正後重送主管
                    </button>
                )}
            </div>
        );
    }

    // (3) 待審：null
    // 個管：顯示「送主管」按鈕
    if (isOfficer) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm space-y-2">
                <div className="flex items-center gap-2 text-amber-700 font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    待送主管審核
                </div>
                <p className="text-xs text-amber-700">
                    案件文件齊全後，按下方按鈕送主管審核。主管通過後案件會自動推進到董事審核。
                </p>
                <button
                    type="button"
                    onClick={handleSendToSupervisor}
                    disabled={busy}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    送主管審核
                </button>
            </div>
        );
    }

    // 主管/admin：顯示通過/退件按鈕
    if (isSupervisorOrAdmin) {
        return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm space-y-2">
                <div className="flex items-center gap-2 text-blue-700 font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    待您審核（送董事前的文件審核）
                </div>
                <p className="text-xs text-blue-700">
                    請確認文件齊全、資格判定無誤後，按【通過】會自動推進到董事審核；如有問題請按【退件】並填寫原因。
                </p>
                {showRejectForm ? (
                    <div className="space-y-2 bg-white border border-red-200 rounded p-2">
                        <label className="block text-xs font-medium text-red-700">退件原因（至少 3 字）</label>
                        <textarea
                            value={rejectNote}
                            onChange={e => setRejectNote(e.target.value)}
                            rows={2}
                            className="w-full border border-red-300 rounded px-2 py-1 text-xs"
                            placeholder="例：缺少存摺封面影本、診斷證明日期過舊..."
                        />
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleReject}
                                disabled={busy}
                                className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                            >
                                確認退件
                            </button>
                            <button
                                type="button"
                                onClick={() => { setShowRejectForm(false); setRejectNote(''); }}
                                disabled={busy}
                                className="px-3 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <input
                            type="text"
                            value={approveNote}
                            onChange={e => setApproveNote(e.target.value)}
                            placeholder="（選填）通過備註"
                            className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                        />
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleApprove}
                                disabled={busy}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                                通過（送董事）
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowRejectForm(true)}
                                disabled={busy}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-red-300 text-red-700 rounded hover:bg-red-50"
                            >
                                <XCircle className="w-3 h-3" />
                                退件
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return null;
}
