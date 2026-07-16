'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Send, Users, FileText, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, UserCircle, ClipboardList, Plus, Trash2, Upload, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import {
    NotificationTemplate,
    NotificationRecipient,
    fetchActiveTemplates,
    fetchEmailRecipients,
    fetchApplicantRecipient,
    fetchReferralRecipient,
    cleanupManualNotificationAttachments,
    sendManualNotificationEmail,
} from '../app/actions/notificationActions';
import { applyPlaceholders } from '../lib/notificationUtils';
import { getNotificationTemplateLabel } from '../lib/systemTemplates';
import { isApplicationInPendingDocState } from '../app/actions/pendingDocAlertActions';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { uploadFileToBlob, type UploadedBlob } from '../lib/uploadClient';
import {
    mapNotificationAttachmentsConcurrently,
    NOTIFICATION_ATTACHMENT_ACCEPT,
    validateNotificationAttachments,
} from '../lib/notificationAttachments';

// ─── Role display helpers ──────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
    admin:         '系統管理員',
    chairman:      '董事長',
    supervisor:    '主管',
    case_officer:  '承辦人員',
    accountant:    '會計',
    board_member:  '董事',
    volunteer:     '志工',
};

const ROLE_PRIORITY = ['admin', 'chairman', 'supervisor', 'case_officer', 'accountant', 'board_member', 'volunteer'];

function getPrimaryRole(roles: string[]): string {
    for (const r of ROLE_PRIORITY) {
        if (roles.includes(r)) return ROLE_LABEL[r] ?? r;
    }
    return roles[0] ? (ROLE_LABEL[roles[0]] ?? roles[0]) : '人員';
}

function groupByRole(recipients: NotificationRecipient[]): { label: string; members: NotificationRecipient[] }[] {
    const groups: Record<string, NotificationRecipient[]> = {};
    for (const r of recipients) {
        const primary = getPrimaryRole(r.roles ?? []);
        if (!groups[primary]) groups[primary] = [];
        groups[primary].push(r);
    }
    return Object.entries(groups)
        .sort(([a], [b]) => {
            const labels = Object.values(ROLE_LABEL);
            return (labels.indexOf(a) === -1 ? 99 : labels.indexOf(a)) -
                   (labels.indexOf(b) === -1 ? 99 : labels.indexOf(b));
        })
        .map(([label, members]) => ({ label, members }));
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PlaceholderVars extends Record<string, string> {
    案號: string;
    申請人: string;
    階段: string;
    申請日期: string;
    申請金額: string;
    承辦人: string;
}

export interface ChecklistDoc {
    id: string;
    label: string;
}

interface SendNotificationModalProps {
    applicationId: string;
    placeholderVars: PlaceholderVars;
    senderUserId: string;
    checklistDocs?: ChecklistDoc[];   // all 11 checklist items
    onClose: () => void;
    onSent: () => void;
}

interface PreuploadedNotificationAttachment {
    id: string;
    file: File;
    uploaded: UploadedBlob | null;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function SendNotificationModal({
    applicationId,
    placeholderVars,
    senderUserId,
    checklistDocs = [],
    onClose,
    onSent,
}: SendNotificationModalProps) {
    const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
    const [staffRecipients, setStaffRecipients] = useState<NotificationRecipient[]>([]);
    const [applicantRecipient, setApplicantRecipient] = useState<NotificationRecipient | null>(null);
    const [referralRecipient, setReferralRecipient] = useState<NotificationRecipient | null>(null);
    const [loadingInit, setLoadingInit] = useState(true);

    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
    const [bccRecipients, setBccRecipients] = useState<Set<string>>(new Set());
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');

    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [showRecipients, setShowRecipients] = useState(true);
    const [isPendingDocReminder, setIsPendingDocReminder] = useState(false);
    const [customRecipientName, setCustomRecipientName] = useState('');
    const [customRecipientEmail, setCustomRecipientEmail] = useState('');
    const [customRecipients, setCustomRecipients] = useState<NotificationRecipient[]>([]);
    const [customRecipientError, setCustomRecipientError] = useState('');
    const [customAttachments, setCustomAttachments] = useState<PreuploadedNotificationAttachment[]>([]);
    const customAttachmentBytes = customAttachments.reduce((sum, item) => sum + item.file.size, 0);
    const preuploadingAttachments = customAttachments.some(item => item.uploaded === null);
    const closedRef = useRef(false);
    const closingRef = useRef(false);

    const bodyRef = useRef<HTMLTextAreaElement>(null);

    const selectableReferralRecipient =
        referralRecipient && (!applicantRecipient || referralRecipient.email.trim().toLowerCase() !== applicantRecipient.email.trim().toLowerCase())
            ? referralRecipient
            : null;

    const allRecipients: NotificationRecipient[] = [
        ...(applicantRecipient ? [applicantRecipient] : []),
        ...(selectableReferralRecipient ? [selectableReferralRecipient] : []),
        ...staffRecipients,
        ...customRecipients,
    ];
    const totalCount = allRecipients.length;

    // Load templates + recipients on mount.
    // Also probe the pending-doc state to default the reminder checkbox.
    const loadInit = useCallback(async () => {
        setLoadingInit(true);
        const [tRes, rRes, aRes, referralRes, pdRes] = await Promise.all([
            fetchActiveTemplates(),
            fetchEmailRecipients(),
            fetchApplicantRecipient(applicationId),
            fetchReferralRecipient(applicationId),
            isApplicationInPendingDocState(applicationId),
        ]);
        if (tRes.success && tRes.data) setTemplates(tRes.data);
        if (rRes.success && rRes.data) {
            setStaffRecipients(rRes.data);
            setBccRecipients(new Set(rRes.data.map(r => r.user_id)));
        }
        if (aRes.success && aRes.data) {
            const recipient = aRes.data;
            setApplicantRecipient(recipient);
            setSelectedRecipients(prev => new Set(prev).add(recipient.user_id));
        }
        if (referralRes.success) setReferralRecipient(referralRes.data ?? null);
        if (pdRes.success) setIsPendingDocReminder(!!pdRes.data);
        setLoadingInit(false);
    }, [applicationId]);

    useEffect(() => { loadInit(); }, [loadInit]);

    // Insert text at cursor position (or append if no focus)
    const insertAtCursor = useCallback((text: string) => {
        const ta = bodyRef.current;
        if (!ta) {
            setBody(prev => prev ? `${prev}\n${text}` : text);
            return;
        }
        const start = ta.selectionStart ?? body.length;
        const end = ta.selectionEnd ?? body.length;
        const newBody = body.slice(0, start) + text + body.slice(end);
        setBody(newBody);
        // Restore cursor after inserted text
        requestAnimationFrame(() => {
            ta.focus();
            ta.setSelectionRange(start + text.length, start + text.length);
        });
    }, [body]);

    // Insert a single missing doc name
    const insertDoc = (label: string) => insertAtCursor(label);

    // Insert all checklist docs as a bullet list
    const insertAllMissing = () => {
        if (checklistDocs.length === 0) return;
        const list = checklistDocs.map(d => `・${d.label}`).join('\n');
        insertAtCursor(list);
    };

    // Apply template
    const handleSelectTemplate = (id: number) => {
        setSelectedTemplateId(id);
        const tpl = templates.find(t => t.id === id);
        if (!tpl) return;
        setSubject(applyPlaceholders(tpl.subject ?? '', placeholderVars));
        setBody(applyPlaceholders(tpl.body, placeholderVars));
    };

    const shouldDefaultBcc = (userId: string) =>
        staffRecipients.some(r => r.user_id === userId);

    const toggleRecipient = (userId: string) => {
        setSelectedRecipients(prev => {
            const next = new Set(prev);
            if (next.has(userId)) {
                next.delete(userId);
                setBccRecipients(prevBcc => {
                    const nextBcc = new Set(prevBcc);
                    nextBcc.delete(userId);
                    return nextBcc;
                });
            } else {
                next.add(userId);
                if (shouldDefaultBcc(userId)) {
                    setBccRecipients(prevBcc => new Set(prevBcc).add(userId));
                }
            }
            return next;
        });
    };

    const toggleBccRecipient = (userId: string) => {
        setBccRecipients(prev => {
            const next = new Set(prev);
            next.has(userId) ? next.delete(userId) : next.add(userId);
            return next;
        });
    };

    const toggleGroup = (members: NotificationRecipient[]) => {
        const ids = members.map(m => m.user_id);
        const allChecked = ids.every(id => selectedRecipients.has(id));
        setSelectedRecipients(prev => {
            const next = new Set(prev);
            if (allChecked) {
                ids.forEach(id => next.delete(id));
                setBccRecipients(prevBcc => {
                    const nextBcc = new Set(prevBcc);
                    ids.forEach(id => nextBcc.delete(id));
                    return nextBcc;
                });
            }
            else {
                ids.forEach(id => next.add(id));
                setBccRecipients(prevBcc => {
                    const nextBcc = new Set(prevBcc);
                    ids.forEach(id => {
                        if (shouldDefaultBcc(id)) nextBcc.add(id);
                    });
                    return nextBcc;
                });
            }
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedRecipients.size === totalCount) {
            setSelectedRecipients(new Set());
            setBccRecipients(new Set());
        } else {
            setSelectedRecipients(new Set(allRecipients.map(r => r.user_id)));
            setBccRecipients(new Set(staffRecipients.map(r => r.user_id)));
        }
    };

    const addCustomRecipient = () => {
        const name = customRecipientName.trim();
        const email = customRecipientEmail.trim().toLowerCase();

        if (!name) {
            setCustomRecipientError('請輸入收件人姓名');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setCustomRecipientError('請輸入有效的 Email');
            return;
        }
        if (allRecipients.some(r => r.email.trim().toLowerCase() === email)) {
            setCustomRecipientError('這個 Email 已在收件人清單中');
            return;
        }

        const recipient: NotificationRecipient = {
            user_id: `custom:${email}`,
            name,
            email,
            roles: ['external'],
        };
        setCustomRecipients(prev => [...prev, recipient]);
        setSelectedRecipients(prev => new Set(prev).add(recipient.user_id));
        setCustomRecipientName('');
        setCustomRecipientEmail('');
        setCustomRecipientError('');
    };

    const removeCustomRecipient = (userId: string) => {
        setCustomRecipients(prev => prev.filter(r => r.user_id !== userId));
        setSelectedRecipients(prev => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
        });
        setBccRecipients(prev => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
        });
    };

    const cleanupUploadedAttachments = useCallback(async (uploaded: readonly UploadedBlob[]) => {
        if (uploaded.length === 0) return;
        await cleanupManualNotificationAttachments(
            senderUserId,
            applicationId,
            uploaded.map(file => file.url),
        );
    }, [applicationId, senderUserId]);

    const handleClose = useCallback(async () => {
        if (sending || closingRef.current) return;
        closingRef.current = true;
        closedRef.current = true;
        try {
            await cleanupUploadedAttachments(
                customAttachments.flatMap(item => item.uploaded ? [item.uploaded] : []),
            );
        } finally {
            onClose();
        }
    }, [cleanupUploadedAttachments, customAttachments, onClose, sending]);

    useModalDismiss(handleClose);

    const addAttachments = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const seen = new Set(customAttachments.map(item => item.id));
        const additions = Array.from(files).filter(file => {
            const id = `${file.name}-${file.size}-${file.lastModified}`;
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });
        if (additions.length === 0) return;

        const validationError = validateNotificationAttachments([
            ...customAttachments.map(item => item.file),
            ...additions,
        ]);
        if (validationError) {
            setResult({ type: 'error', msg: validationError });
            return;
        }

        const batch = additions.map(file => ({
            id: `${file.name}-${file.size}-${file.lastModified}`,
            file,
            uploaded: null,
        } satisfies PreuploadedNotificationAttachment));
        const batchIds = new Set(batch.map(item => item.id));
        const completedUploads: UploadedBlob[] = [];
        setResult(null);
        setCustomAttachments(current => [...current, ...batch]);

        try {
            const orderedUploads = await mapNotificationAttachmentsConcurrently(additions, async file => {
                const uploaded = await uploadFileToBlob(file, {
                    pathPrefix: `notification-attachments/${applicationId}/manual`,
                });
                completedUploads.push(uploaded);
                return uploaded;
            });
            if (closedRef.current) {
                await cleanupUploadedAttachments(orderedUploads);
                return;
            }
            const uploadsById = new Map(batch.map((item, index) => [item.id, orderedUploads[index]]));
            setCustomAttachments(current => current.map(item => (
                uploadsById.has(item.id) ? { ...item, uploaded: uploadsById.get(item.id)! } : item
            )));
        } catch (uploadError) {
            await cleanupUploadedAttachments(completedUploads).catch(() => {});
            if (!closedRef.current) {
                setCustomAttachments(current => current.filter(item => !batchIds.has(item.id)));
                setResult({
                    type: 'error',
                    msg: uploadError instanceof Error ? uploadError.message : '附件上傳失敗',
                });
            }
        }
    };

    const removeAttachment = async (id: string) => {
        const item = customAttachments.find(attachment => attachment.id === id);
        if (!item || !item.uploaded) return;
        setCustomAttachments(current => current.filter(attachment => attachment.id !== id));
        try {
            await cleanupUploadedAttachments([item.uploaded]);
        } catch {
            setResult({ type: 'error', msg: `${item.file.name}：暫存附件清除失敗` });
        }
    };

    const handleSend = async () => {
        if (selectedRecipients.size === 0) { setResult({ type: 'error', msg: '請至少選擇一位收件人。' }); return; }
        if (!subject.trim()) { setResult({ type: 'error', msg: '請填寫主旨。' }); return; }
        if (!body.trim()) { setResult({ type: 'error', msg: '請填寫內文。' }); return; }
        if (preuploadingAttachments) { setResult({ type: 'error', msg: '附件仍在上傳，請稍候再送出。' }); return; }

        setSending(true);
        setResult(null);

        const recipients = allRecipients
            .filter(r => selectedRecipients.has(r.user_id))
            .map(r => ({ ...r, is_bcc: bccRecipients.has(r.user_id) }));
        const uploadedAttachments = customAttachments.flatMap(item => item.uploaded ? [item.uploaded] : []);
        try {
            const res = await sendManualNotificationEmail(
                applicationId,
                recipients,
                subject,
                body,
                selectedTemplateId,
                senderUserId,
                isPendingDocReminder,
                uploadedAttachments,
            );
            if (res.success) {
                setCustomAttachments([]);
                setResult({ type: 'success', msg: `已成功發送至 ${recipients.length} 位收件人。` });
                onSent();
            } else {
                await cleanupUploadedAttachments(uploadedAttachments).catch(() => {});
                setCustomAttachments([]);
                setResult({
                    type: 'error',
                    msg: `${res.error ?? '發送失敗，請確認 SMTP 設定。'}${uploadedAttachments.length > 0 ? '；請重新選擇附件後再送出' : ''}`,
                });
            }
        } catch (error) {
            await cleanupUploadedAttachments(uploadedAttachments).catch(() => {});
            setCustomAttachments([]);
            const message = error instanceof Error ? error.message : '發送失敗，請確認 SMTP 設定。';
            setResult({
                type: 'error',
                msg: `${message}${uploadedAttachments.length > 0 ? '；請重新選擇附件後再送出' : ''}`,
            });
        } finally {
            setSending(false);
        }
    };

    const allSelected = totalCount > 0 && selectedRecipients.size === totalCount;
    const someSelected = selectedRecipients.size > 0 && !allSelected;
    const staffGroups = groupByRole(staffRecipients);

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={handleClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <Send className="w-4 h-4 text-blue-600" />
                        發送通知
                    </h3>
                    <button onClick={handleClose} disabled={sending} className="text-slate-400 hover:text-slate-600 disabled:opacity-50">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loadingInit ? (
                    <div className="flex-1 flex items-center justify-center py-16 text-sm text-slate-400">載入中…</div>
                ) : (
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                        {/* Template selector */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-slate-400" />
                                套用範本
                            </label>
                            <select
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={selectedTemplateId ?? ''}
                                onChange={e => e.target.value ? handleSelectTemplate(Number(e.target.value)) : setSelectedTemplateId(null)}
                            >
                                <option value="">（不使用範本，自行填寫）</option>
                                {templates.filter(t => t.channel === 'email').map(t => (
                                    <option key={t.id} value={t.id}>{getNotificationTemplateLabel(t.name)}</option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-400 mt-1">套用後仍可自由修改主旨與內文</p>
                        </div>

                        {/* Recipients */}
                        <div>
                            <button
                                type="button"
                                onClick={() => setShowRecipients(v => !v)}
                                className="w-full flex items-center justify-between text-sm font-medium text-slate-700 mb-2"
                            >
                                <span className="flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-slate-400" />
                                    收件人
                                    <span className="text-xs font-normal text-slate-400 ml-1">
                                        （已選 {selectedRecipients.size}/{totalCount}）
                                    </span>
                                </span>
                                {showRecipients
                                    ? <ChevronUp className="w-4 h-4 text-slate-400" />
                                    : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </button>

                            {showRecipients && (
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    {/* Select all */}
                                    <label className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            ref={el => { if (el) el.indeterminate = someSelected; }}
                                            onChange={toggleAll}
                                            className="w-4 h-4 accent-blue-600"
                                        />
                                        <span className="text-xs font-semibold text-slate-600">全選</span>
                                    </label>

                                    <div className="max-h-52 overflow-y-auto">
                                        {totalCount === 0 && (
                                            <p className="px-4 py-3 text-xs text-slate-400">系統中無具備 Email 的使用者。</p>
                                        )}

                                        {/* Applicant section */}
                                        {applicantRecipient && (
                                            <div>
                                                <div className="px-4 py-1.5 bg-amber-50 border-b border-amber-100 flex items-center gap-1.5">
                                                    <UserCircle className="w-3 h-3 text-amber-500" />
                                                    <span className="text-xs font-semibold text-amber-700">
                                                        {applicantRecipient.is_referral ? '轉介窗口' : '申請人'}
                                                    </span>
                                                    <span className="text-xs text-amber-500 ml-1">
                                                        {applicantRecipient.is_referral ? '（經濟弱勢主要聯繫窗口）' : '（本案）'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50 transition border-b border-slate-100">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedRecipients.has(applicantRecipient.user_id)}
                                                        onChange={() => toggleRecipient(applicantRecipient.user_id)}
                                                        className="w-4 h-4 accent-amber-500 shrink-0"
                                                    />
                                                    <span className="text-sm text-slate-800">{applicantRecipient.name}</span>
                                                    <span className="text-xs text-slate-400 ml-auto">{applicantRecipient.email}</span>
                                                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 shrink-0 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={bccRecipients.has(applicantRecipient.user_id)}
                                                            onChange={() => toggleBccRecipient(applicantRecipient.user_id)}
                                                            disabled={!selectedRecipients.has(applicantRecipient.user_id)}
                                                            className="w-3.5 h-3.5 accent-slate-600 disabled:opacity-40"
                                                        />
                                                        密件
                                                    </label>
                                                </div>
                                            </div>
                                        )}

                                        {selectableReferralRecipient && (
                                            <div>
                                                <div className="px-4 py-1.5 bg-emerald-50 border-b border-emerald-100 flex items-center gap-1.5">
                                                    <UserCircle className="w-3 h-3 text-emerald-500" />
                                                    <span className="text-xs font-semibold text-emerald-700">轉介人</span>
                                                    <span className="text-xs text-emerald-500 ml-1">（本案轉介窗口）</span>
                                                </div>
                                                <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-50 transition border-b border-slate-100">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedRecipients.has(selectableReferralRecipient.user_id)}
                                                        onChange={() => toggleRecipient(selectableReferralRecipient.user_id)}
                                                        className="w-4 h-4 accent-emerald-600 shrink-0"
                                                    />
                                                    <span className="text-sm text-slate-800">{selectableReferralRecipient.name}</span>
                                                    <span className="text-xs text-slate-400 ml-auto">{selectableReferralRecipient.email}</span>
                                                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 shrink-0 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={bccRecipients.has(selectableReferralRecipient.user_id)}
                                                            onChange={() => toggleBccRecipient(selectableReferralRecipient.user_id)}
                                                            disabled={!selectedRecipients.has(selectableReferralRecipient.user_id)}
                                                            className="w-3.5 h-3.5 accent-slate-600 disabled:opacity-40"
                                                        />
                                                        密件
                                                    </label>
                                                </div>
                                            </div>
                                        )}

                                        {/* Staff sections */}
                                        {staffGroups.map(group => {
                                            const groupIds = group.members.map(m => m.user_id);
                                            const allGroupSelected = groupIds.every(id => selectedRecipients.has(id));
                                            const someGroupSelected = groupIds.some(id => selectedRecipients.has(id)) && !allGroupSelected;
                                            return (
                                                <div key={group.label}>
                                                    <label className="flex items-center gap-2 px-4 py-1.5 bg-slate-50 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition">
                                                        <input
                                                            type="checkbox"
                                                            checked={allGroupSelected}
                                                            ref={el => { if (el) el.indeterminate = someGroupSelected; }}
                                                            onChange={() => toggleGroup(group.members)}
                                                            className="w-3.5 h-3.5 accent-blue-600"
                                                        />
                                                        <span className="text-xs font-semibold text-slate-500">{group.label}</span>
                                                        <span className="text-xs text-slate-400 ml-auto">{group.members.length} 人</span>
                                                    </label>
                                                    {group.members.map(r => (
                                                        <div key={r.user_id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition border-b border-slate-100 last:border-b-0">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedRecipients.has(r.user_id)}
                                                                onChange={() => toggleRecipient(r.user_id)}
                                                                className="w-4 h-4 accent-blue-600 shrink-0"
                                                            />
                                                            <span className="text-sm text-slate-800">{r.name}</span>
                                                            <span className="text-xs text-slate-400 ml-auto">{r.email}</span>
                                                            <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 shrink-0 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={bccRecipients.has(r.user_id)}
                                                                    onChange={() => toggleBccRecipient(r.user_id)}
                                                                    disabled={!selectedRecipients.has(r.user_id)}
                                                                    className="w-3.5 h-3.5 accent-slate-600 disabled:opacity-40"
                                                                />
                                                                密件
                                                            </label>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })}

                                        {/* Custom external recipients */}
                                        {customRecipients.length > 0 && (
                                            <div>
                                                <div className="px-4 py-1.5 bg-violet-50 border-b border-violet-100 flex items-center gap-1.5">
                                                    <UserCircle className="w-3 h-3 text-violet-500" />
                                                    <span className="text-xs font-semibold text-violet-700">自行新增收件人</span>
                                                </div>
                                                {customRecipients.map(r => (
                                                    <div key={r.user_id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-violet-50 transition border-b border-slate-100 last:border-b-0">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedRecipients.has(r.user_id)}
                                                            onChange={() => toggleRecipient(r.user_id)}
                                                            className="w-4 h-4 accent-violet-600 shrink-0"
                                                        />
                                                        <span className="text-sm text-slate-800">{r.name}</span>
                                                        <span className="text-xs text-slate-400 ml-auto">{r.email}</span>
                                                        <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 shrink-0 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={bccRecipients.has(r.user_id)}
                                                                onChange={() => toggleBccRecipient(r.user_id)}
                                                                disabled={!selectedRecipients.has(r.user_id)}
                                                                className="w-3.5 h-3.5 accent-slate-600 disabled:opacity-40"
                                                            />
                                                            密件
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeCustomRecipient(r.user_id)}
                                                            className="text-slate-400 hover:text-red-600 transition"
                                                            title="移除此收件人"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="border-t border-slate-100 bg-white px-4 py-3 space-y-2">
                                        <p className="text-[11px] text-slate-400">勾選「密件」後，該收件人會放在 Bcc，不會顯示在其他收件人的收件人列表中。</p>
                                        <p className="text-xs font-semibold text-slate-500">新增其他收件人</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_auto] gap-2">
                                            <input
                                                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                value={customRecipientName}
                                                onChange={e => {
                                                    setCustomRecipientName(e.target.value);
                                                    setCustomRecipientError('');
                                                }}
                                                placeholder="姓名"
                                            />
                                            <input
                                                type="email"
                                                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                value={customRecipientEmail}
                                                onChange={e => {
                                                    setCustomRecipientEmail(e.target.value);
                                                    setCustomRecipientError('');
                                                }}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        addCustomRecipient();
                                                    }
                                                }}
                                                placeholder="email@example.com"
                                            />
                                            <button
                                                type="button"
                                                onClick={addCustomRecipient}
                                                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 transition"
                                            >
                                                <Plus className="w-4 h-4" />
                                                新增
                                            </button>
                                        </div>
                                        {customRecipientError && (
                                            <p className="text-xs text-red-600">{customRecipientError}</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Pending-doc reminder flag */}
                        <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isPendingDocReminder}
                                onChange={e => setIsPendingDocReminder(e.target.checked)}
                                className="mt-0.5 w-4 h-4 accent-amber-600 shrink-0"
                            />
                            <span className="text-xs text-amber-900 leading-relaxed">
                                <span className="font-semibold">此為未補件提醒</span>
                                <span className="text-amber-700">
                                    {' — 勾選後將計入該案件的提醒次數，達門檻時系統會建議以不通過結案。預設值依案件目前是否處於未補件狀態自動勾選。'}
                                </span>
                            </span>
                        </label>

                        {/* Subject */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">主旨</label>
                            <input
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                placeholder="請輸入信件主旨"
                            />
                        </div>

                        {/* Checklist quick insert */}
                        {checklistDocs.length > 0 && (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                                        <ClipboardList className="w-3.5 h-3.5" />
                                        應備文件清單
                                    </span>
                                    <button
                                        type="button"
                                        onClick={insertAllMissing}
                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2 transition"
                                    >
                                        全部插入內文
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {checklistDocs.map(doc => (
                                        <button
                                            key={doc.id}
                                            type="button"
                                            onClick={() => insertDoc(doc.label)}
                                            title="點選插入內文游標位置"
                                            className="px-2.5 py-1 rounded-full text-xs bg-white border border-slate-300 text-slate-600 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition cursor-pointer"
                                        >
                                            + {doc.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-400">點選項目可插入至內文游標位置，或點「全部插入」一次帶入</p>
                            </div>
                        )}

                        {/* Body */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">內文</label>
                            <textarea
                                ref={bodyRef}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                rows={8}
                                value={body}
                                onChange={e => setBody(e.target.value)}
                                placeholder="請輸入通知內容"
                            />
                        </div>

                        {/* Attachments */}
                        <div className="border border-slate-200 rounded-lg p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <div className="text-sm font-medium text-slate-700">其他附件（選填）</div>
                                    <div className="text-xs text-slate-500 mt-0.5">
                                        PDF、Word、Excel、JPG、PNG、GIF、WebP、BMP；合計不可超過 18 MB
                                    </div>
                                </div>
                                <label className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 cursor-pointer">
                                    {preuploadingAttachments
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <Upload className="w-4 h-4" />}
                                    {preuploadingAttachments ? '上傳中…' : '選擇檔案'}
                                    <input
                                        type="file"
                                        multiple
                                        accept={NOTIFICATION_ATTACHMENT_ACCEPT}
                                        disabled={sending || preuploadingAttachments}
                                        className="hidden"
                                        onChange={event => {
                                            void addAttachments(event.target.files);
                                            event.target.value = '';
                                        }}
                                    />
                                </label>
                            </div>
                            {customAttachments.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    <div className="text-xs text-slate-500 text-right">
                                        已選 {customAttachments.length} 個檔案，共 {(customAttachmentBytes / 1024 / 1024).toFixed(2)} MB
                                        {preuploadingAttachments ? '；上傳中' : ''}
                                    </div>
                                    {customAttachments.map(item => (
                                        <div key={item.id} className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs">
                                            <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                                            <span className="text-slate-700 truncate" title={item.file.name}>{item.file.name}</span>
                                            <span className="text-slate-400 ml-auto shrink-0">
                                                {item.uploaded ? `${Math.ceil(item.file.size / 1024)} KB` : '上傳中…'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => { void removeAttachment(item.id); }}
                                                disabled={sending || !item.uploaded}
                                                className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-50"
                                                aria-label={`移除附件 ${item.file.name}`}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Result message */}
                        {result && (
                            <div className={clsx(
                                'flex items-start gap-2 text-sm rounded-lg px-4 py-3 border',
                                result.type === 'success'
                                    ? 'bg-green-50 border-green-200 text-green-700'
                                    : 'bg-red-50 border-red-200 text-red-700'
                            )}>
                                {result.type === 'success'
                                    ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
                                <span>{result.msg}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="flex gap-3 px-6 py-4 border-t border-slate-100 justify-end shrink-0">
                    <button onClick={handleClose} disabled={sending} className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition">
                        {result?.type === 'success' ? '關閉' : '取消'}
                    </button>
                    {result?.type !== 'success' && (
                        <button
                            onClick={handleSend}
                            disabled={sending || loadingInit || preuploadingAttachments}
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
                        >
                            {sending ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            {sending ? '發送中…' : '發送'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
