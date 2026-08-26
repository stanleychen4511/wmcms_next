'use client';

/**
 * 來電 / 關懷紀錄 Modal（#14，取代舊 CareRecordModal）
 *
 * 模式：
 * - mode='create'：建立新紀錄；上方 record_type 切換（來電 / 關懷）
 * - mode='edit'：編輯既有紀錄；record_type 不可變
 *
 * 來電模式：caller_name / caller_gender / caller_phone（含歷史檢索）+ 3 組 enum + summary
 * 關懷模式：applicant_user_id（用 prop 傳入鎖定）+ summary + media_urls
 * 兩者皆可選 application_id（簡化：先以文字輸入，未來改下拉）
 */

import { useEffect, useState } from 'react';
import { X, Plus, Trash2, Save, Loader2, Phone, History, User, Search, AlertTriangle } from 'lucide-react';
import { useToast } from './FloatingToast';
import { DateInput } from './DateInput';
import {
    createContactRecord,
    updateContactRecord,
    fetchPhoneHistory,
    fetchContactRecordFollowups,
    createContactRecordFollowup,
    updateContactRecordFollowup,
    type ContactRecord,
    type ContactRecordInput,
    type ContactRecordFollowup,
    type ApplicantSearchResult,
} from '../app/actions/contactRecordActions';
import { ApplicantPickerModal } from './ApplicantPickerModal';
import { ImageLightbox, looksLikeImageUrl } from './ImageLightbox';
import { useModalDismiss } from '../hooks/useModalDismiss';
import {
    RECORD_TYPE_LABEL,
    GENDER_LABEL,
    FROM_SOURCE_OPTIONS,
    CONSULTANT_TYPE_OPTIONS,
    CONSULT_PROGRAM_OPTIONS,
    REJECT_REASON_OPTIONS,
    REJECT_REASON_LABEL,
    type Gender,
    type RecordType,
} from '../lib/contactRecordConstants';
import { todayDateOnly } from '../lib/dateOnly';
import { formatRocDateOnly, formatRocDateTime } from '../lib/rocDate';

interface ApplicationOption {
    id: string;
    caseNumber: string;
    status: string;          // '1'/'2'/'3'/'4'
}

interface Props {
    mode: 'create' | 'edit';
    operatorUserId: string;
    /** 預設 record_type；create 模式可變、edit 模式鎖死 */
    defaultRecordType?: RecordType;
    /** 已是申請人時可直接綁定（關懷紀錄常見） */
    applicantUserId?: string | null;
    applicantName?: string;
    /** edit 模式：傳入既有紀錄 */
    existingRecord?: ContactRecord;
    /** 關懷模式（recordType='2'）時可綁定的案件清單；傳入後 modal 顯示案件下拉 */
    applications?: ApplicationOption[];
    onSaved: () => void;
    onClose: () => void;
}

function todayIsoDate(): string {
    return todayDateOnly();
}

function formatDateTime(value: string): string {
    if (!value) return '';
    return formatRocDateTime(value) || value;
}

export function ContactRecordModal({
    mode, operatorUserId, defaultRecordType,
    applicantUserId, applicantName, existingRecord, applications, onSaved, onClose,
}: Props) {
    useModalDismiss(onClose);
    const { push: pushToast } = useToast();
    // ─── form state ──────────────────────────────────────────────────────
    const [recordType, setRecordType] = useState<RecordType>(
        existingRecord?.recordType ?? defaultRecordType ?? '1'
    );
    const [contactDate, setContactDate] = useState<string>(
        existingRecord?.contactDate ?? todayIsoDate()
    );
    const [callerName, setCallerName] = useState(existingRecord?.callerName ?? '');
    const [callerGender, setCallerGender] = useState<Gender | ''>(existingRecord?.callerGender ?? '');
    const [callerPhone, setCallerPhone] = useState(existingRecord?.callerPhone ?? '');
    const [callerPhoneFromCallerId, setCallerPhoneFromCallerId] = useState(existingRecord?.callerPhoneFromCallerId ?? false);
    const [fromSource, setFromSource] = useState(existingRecord?.fromSource ?? '');
    const [consultantType, setConsultantType] = useState(existingRecord?.consultantType ?? '');
    const [consultProgram, setConsultProgram] = useState(existingRecord?.consultProgram ?? '');
    const [rejectReasons, setRejectReasons] = useState<string[]>(existingRecord?.rejectReasons ?? []);
    const [summary, setSummary] = useState(existingRecord?.summary ?? '');
    const [isSpecialAttention, setIsSpecialAttention] = useState(existingRecord?.isSpecialAttention ?? false);
    const [specialAttentionNote, setSpecialAttentionNote] = useState(existingRecord?.specialAttentionNote ?? '');
    const [mediaUrls, setMediaUrls] = useState<string[]>(() => {
        if (existingRecord && existingRecord.mediaUrls.length > 0) return [...existingRecord.mediaUrls];
        return [''];
    });
    // 關懷專屬欄位
    const [applicationId, setApplicationId] = useState<string>(existingRecord?.applicationId ?? '');
    const [contactedParty, setContactedParty] = useState<'1' | '2' | '9' | ''>(existingRecord?.contactedParty ?? '');
    const [contactedPartyOther, setContactedPartyOther] = useState(existingRecord?.contactedPartyOther ?? '');

    // 來電紀錄的「申請人關聯」(選填) — 若 props 已傳 applicantUserId/Name 則鎖定
    //   開啟方式：歷史申請紀錄頁 / 申請流程「關懷紀錄」按鈕 → 已知申請人，鎖定不可改
    //              首頁 + 新增來電 → 可選擇關聯申請人
    const isApplicantLocked = !!applicantUserId;
    const [linkedApplicant, setLinkedApplicant] = useState<{ userId: string; name: string } | null>(
        applicantUserId ? { userId: applicantUserId, name: applicantName ?? '' } : null
    );
    const [pickerOpen, setPickerOpen] = useState(false);

    const [saving, setSaving] = useState(false);
    const canEditRecord = mode === 'create' || existingRecord?.handlerUserId === operatorUserId;
    const [followups, setFollowups] = useState<ContactRecordFollowup[]>([]);
    const [followupsLoading, setFollowupsLoading] = useState(false);
    const [newFollowup, setNewFollowup] = useState('');
    const [addingFollowup, setAddingFollowup] = useState(false);
    const [editingFollowupId, setEditingFollowupId] = useState<string | null>(null);
    const [editingFollowupText, setEditingFollowupText] = useState('');
    const [savingFollowupEdit, setSavingFollowupEdit] = useState(false);

    // 媒體預覽 lightbox — 點縮圖開啟；以 imageUrls（過濾掉「不是直接圖片連結」的 URL）為基底
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
    const imageUrls = mediaUrls.filter(u => looksLikeImageUrl(u.trim()));

    // ─── 電話歷史檢索 ────────────────────────────────────────────────────
    //   觸發時機：使用者停打字 400ms 後自動查（debounced）
    //   電話 ≥ 7 碼才查避免雜訊；不分申請人，全系統 phone 比對（方案 A）
    const [phoneHistory, setPhoneHistory] = useState<ContactRecord[]>([]);
    const [phoneHistoryLoading, setPhoneHistoryLoading] = useState(false);
    // 自動 debounce 查詢 — 停打字 400ms 後觸發
    useEffect(() => {
        if (recordType !== '1') { setPhoneHistory([]); return; }  // 只在來電模式查
        const id = setTimeout(() => { void lookupPhoneHistory(callerPhone); }, 400);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [callerPhone, recordType]);

    const lookupPhoneHistory = async (phone: string) => {
        const digits = phone.replace(/[^0-9]/g, '');
        if (digits.length < 7) {
            setPhoneHistory([]);
            return;
        }
        setPhoneHistoryLoading(true);
        try {
            // edit 模式下排除自己，避免「過往紀錄」把當前這筆也列出
            const res = await fetchPhoneHistory(operatorUserId, phone, existingRecord?.id ?? null);
            setPhoneHistory(res.success ? res.data : []);
        } finally {
            setPhoneHistoryLoading(false);
        }
    };

    // 重設 useEffect 當 existingRecord 切換
    useEffect(() => {
        if (mode === 'edit' && existingRecord) {
            setRecordType(existingRecord.recordType);
            setContactDate(existingRecord.contactDate);
            setCallerName(existingRecord.callerName ?? '');
            setCallerGender(existingRecord.callerGender ?? '');
            setCallerPhone(existingRecord.callerPhone ?? '');
            setCallerPhoneFromCallerId(existingRecord.callerPhoneFromCallerId);
            setFromSource(existingRecord.fromSource ?? '');
            setConsultantType(existingRecord.consultantType ?? '');
            setConsultProgram(existingRecord.consultProgram ?? '');
            setRejectReasons(existingRecord.rejectReasons);
            setSummary(existingRecord.summary ?? '');
            setIsSpecialAttention(existingRecord.isSpecialAttention);
            setSpecialAttentionNote(existingRecord.specialAttentionNote ?? '');
            setMediaUrls(existingRecord.mediaUrls.length > 0 ? [...existingRecord.mediaUrls] : ['']);
            setApplicationId(existingRecord.applicationId ?? '');
            setContactedParty(existingRecord.contactedParty ?? '');
            setContactedPartyOther(existingRecord.contactedPartyOther ?? '');
            // 編輯既有來電紀錄：若有 applicant_user_id 則顯示為已關聯
            if (existingRecord.applicantUserId) {
                setLinkedApplicant({
                    userId: existingRecord.applicantUserId,
                    name: existingRecord.applicantName ?? '（未知）',
                });
            }
        }
    }, [mode, existingRecord]);

    useEffect(() => {
        if (mode !== 'edit' || !existingRecord?.id) {
            setFollowups([]);
            return;
        }
        let cancelled = false;
        setFollowupsLoading(true);
        fetchContactRecordFollowups(operatorUserId, existingRecord.id)
            .then(res => {
                if (!cancelled) setFollowups(res.success ? res.data : []);
            })
            .finally(() => {
                if (!cancelled) setFollowupsLoading(false);
            });
        return () => { cancelled = true; };
    }, [mode, existingRecord?.id, operatorUserId]);

    // ─── handlers ────────────────────────────────────────────────────────
    const toggleRejectReason = (code: string) => {
        setRejectReasons(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
    };

    const addMediaUrl = () => setMediaUrls(prev => [...prev, '']);
    const removeMediaUrl = (idx: number) => setMediaUrls(prev => prev.filter((_, i) => i !== idx));
    const setMediaUrl = (idx: number, val: string) =>
        setMediaUrls(prev => prev.map((u, i) => i === idx ? val : u));

    const handleAddFollowup = async () => {
        if (mode !== 'edit' || !existingRecord?.id) return;
        const text = newFollowup.trim();
        if (!text) {
            pushToast({ type: 'error', msg: '請填寫追蹤摘要' });
            return;
        }
        setAddingFollowup(true);
        try {
            const res = await createContactRecordFollowup(operatorUserId, existingRecord.id, text);
            if (res.success) {
                setFollowups(prev => [...prev, res.data]);
                setNewFollowup('');
                pushToast({ type: 'success', msg: '已新增追蹤摘要' });
            } else {
                pushToast({ type: 'error', msg: res.error ?? '新增追蹤摘要失敗' });
            }
        } finally {
            setAddingFollowup(false);
        }
    };

    const handleStartEditFollowup = (item: ContactRecordFollowup) => {
        setEditingFollowupId(item.id);
        setEditingFollowupText(item.summary);
    };

    const handleCancelEditFollowup = () => {
        setEditingFollowupId(null);
        setEditingFollowupText('');
    };

    const handleSaveFollowupEdit = async () => {
        if (!editingFollowupId) return;
        const text = editingFollowupText.trim();
        if (!text) {
            pushToast({ type: 'error', msg: '請填寫追蹤摘要' });
            return;
        }
        setSavingFollowupEdit(true);
        try {
            const res = await updateContactRecordFollowup(operatorUserId, editingFollowupId, text);
            if (res.success) {
                setFollowups(prev => prev.map(item => item.id === editingFollowupId ? res.data : item));
                handleCancelEditFollowup();
                pushToast({ type: 'success', msg: '追蹤摘要已更新' });
            } else {
                pushToast({ type: 'error', msg: res.error ?? '修改追蹤摘要失敗' });
            }
        } finally {
            setSavingFollowupEdit(false);
        }
    };

    const handleSave = async () => {
        if (!canEditRecord) return;
        // 關懷模式必填驗證
        if (recordType === '2') {
            if (!applicationId) {
                pushToast({ type: 'error', msg: '請選擇對應案件' });
                return;
            }
            if (!contactedParty) {
                pushToast({ type: 'error', msg: '請選擇聯絡對象' });
                return;
            }
            if (mode === 'create' && !summary.trim()) {
                pushToast({ type: 'error', msg: '請填寫關懷摘要' });
                return;
            }
        }
        if (isSpecialAttention && !specialAttentionNote.trim()) {
            pushToast({ type: 'error', msg: '特殊注意時請填寫說明' });
            return;
        }
        setSaving(true);
        try {
            // 關懷強制使用 prop 傳入的 applicantUserId；
            // 來電則使用使用者選擇的（linkedApplicant），若已鎖定亦會反映
            const effectiveApplicantId = recordType === '2'
                ? (applicantUserId ?? null)
                : (linkedApplicant?.userId ?? null);
            const input: ContactRecordInput = {
                recordType,
                contactDate,
                applicantUserId: effectiveApplicantId,
                callerName: callerName.trim() || null,
                callerGender: callerGender || null,
                callerPhone: callerPhone.trim() || null,
                callerPhoneFromCallerId: recordType === '1' && !!callerPhone.trim() && callerPhoneFromCallerId,
                applicationId: recordType === '2' ? (applicationId || null) : null,
                fromSource: fromSource || null,
                consultantType: consultantType || null,
                consultProgram: consultProgram || null,
                rejectReasons,
                summary: summary.trim() || null,
                isSpecialAttention,
                specialAttentionNote: specialAttentionNote.trim() || null,
                mediaUrls: mediaUrls.map(u => u.trim()).filter(u => u),
                contactedParty: recordType === '2' ? (contactedParty || null) : null,
                contactedPartyOther: recordType === '2' && contactedParty === '9'
                    ? (contactedPartyOther.trim() || null) : null,
            };
            const res = mode === 'create'
                ? await createContactRecord(operatorUserId, input)
                : await updateContactRecord(operatorUserId, existingRecord!.id, input);
            if (res.success) {
                pushToast({ type: 'success', msg: mode === 'create' ? '已新增' : '已儲存' });
                onSaved();
                onClose();
            } else {
                pushToast({ type: 'error', msg: res.error ?? '儲存失敗' });
            }
        } finally {
            setSaving(false);
        }
    };

    const isPhone = recordType === '1';
    // 類型由 caller 決定（兩顆按鈕分別開不同類型 modal），modal 內不允許切換

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                {/* Header — 類型由標題反映（取代既有的 radio；類型決定權在外部 caller，modal 內不可改） */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800">
                        {mode === 'create' ? '新增' : '編輯'}{RECORD_TYPE_LABEL[recordType]}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {mode === 'edit' && existingRecord && (
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5" />
                                建立者：<span className="font-medium text-slate-800">{existingRecord.handlerName}</span>
                            </span>
                            {!canEditRecord && <span className="text-amber-700">僅建立者可修改原始紀錄</span>}
                        </div>
                    )}
                    <fieldset disabled={!canEditRecord} className="contents">
                    {applicantName && recordType === '2' && (
                        <p className="text-xs text-slate-500">
                            關懷對象：<span className="font-medium text-slate-700">{applicantName}</span>
                        </p>
                    )}

                    {/* 共同：日期 */}
                    <div>
                        <label className="text-xs font-medium text-slate-600">日期 <span className="text-red-500">*</span></label>
                        <DateInput
                            value={contactDate}
                            onChange={setContactDate}
                            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        />
                    </div>

                    {/* 關懷專屬：對應案件 + 聯絡對象 */}
                    {!isPhone && (
                        <>
                            <div>
                                <label className="text-xs font-medium text-slate-600">
                                    對應案件 <span className="text-red-500">*</span>
                                </label>
                                {applications && applications.length > 0 ? (
                                    <select
                                        value={applicationId}
                                        onChange={e => setApplicationId(e.target.value)}
                                        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                    >
                                        <option value="">— 請選擇 —</option>
                                        {applications.map(app => (
                                            <option key={app.id} value={app.id}>
                                                {app.caseNumber}
                                                {app.status === '4' ? '（核銷完成）'
                                                    : app.status === '2' ? '（審核未通過）'
                                                    : app.status === '3' ? '（待核銷）'
                                                    : '（審核中）'}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className="text-xs text-slate-400 mt-1">此申請人尚無案件可關聯</p>
                                )}
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-600">
                                    聯絡對象 <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-3 mt-1">
                                    {([
                                        { v: '1', label: '本人' },
                                        { v: '2', label: '配偶' },
                                        { v: '9', label: '其他' },
                                    ] as const).map(opt => (
                                        <label key={opt.v} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm ${
                                            contactedParty === opt.v
                                                ? 'bg-rose-50 border-rose-300 text-rose-700'
                                                : 'bg-white border-slate-200 text-slate-600'
                                        }`}>
                                            <input
                                                type="radio"
                                                checked={contactedParty === opt.v}
                                                onChange={() => setContactedParty(opt.v)}
                                                className="accent-rose-600"
                                            />
                                            {opt.label}
                                        </label>
                                    ))}
                                </div>
                                {contactedParty === '9' && (
                                    <input
                                        type="text"
                                        maxLength={50}
                                        value={contactedPartyOther}
                                        onChange={e => setContactedPartyOther(e.target.value)}
                                        placeholder="關係描述（選填，例：兒子、社工）"
                                        className="mt-2 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                    />
                                )}
                            </div>
                        </>
                    )}

                    {/* 來電專屬 */}
                    {isPhone && (
                        <>
                            {/* 關聯申請人（選填） — 用以將此通來電與特定申請人連結，
                                之後在「歷史申請紀錄／申請流程的關懷紀錄」清單會看到此筆 */}
                            <div>
                                <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    關聯申請人 <span className="text-slate-400 font-normal">（選填）</span>
                                </label>
                                {linkedApplicant ? (
                                    <div className="mt-1 flex items-center gap-2 px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm">
                                        <User className="w-3.5 h-3.5 text-emerald-700" />
                                        <span className="font-medium text-emerald-800">{linkedApplicant.name || '（未知姓名）'}</span>
                                        {isApplicantLocked ? (
                                            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                                自動關聯
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setLinkedApplicant(null)}
                                                className="ml-auto text-slate-400 hover:text-rose-600"
                                                title="取消關聯"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setPickerOpen(true)}
                                        className="mt-1 w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition"
                                    >
                                        <Search className="w-3.5 h-3.5" />
                                        選擇申請人（若此通來電與特定申請人有關）
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-slate-600 flex items-center gap-1 h-4">姓名</label>
                                    <input
                                        type="text" maxLength={50}
                                        value={callerName}
                                        onChange={e => setCallerName(e.target.value)}
                                        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        placeholder="例：王小姐"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600 flex items-center gap-1 h-4">性別</label>
                                    <select
                                        value={callerGender}
                                        onChange={e => setCallerGender(e.target.value as Gender | '')}
                                        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                    >
                                        <option value="">— 未填 —</option>
                                        {(['M', 'F', 'U'] as Gender[]).map(g => (
                                            <option key={g} value={g}>{GENDER_LABEL[g]}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600 flex items-center gap-1 h-4">
                                        <Phone className="w-3 h-3" />聯絡方式（選填）
                                    </label>
                                    <input
                                        type="text" maxLength={50}
                                        value={callerPhone}
                                        onChange={e => {
                                            setCallerPhone(e.target.value);
                                            if (!e.target.value.trim()) setCallerPhoneFromCallerId(false);
                                        }}
                                        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        placeholder="電話 / LINE / Email"
                                    />
                                    <label className={`mt-2 inline-flex items-center gap-2 text-xs ${callerPhone.trim() ? 'text-slate-600 cursor-pointer' : 'text-slate-400 cursor-not-allowed'}`}>
                                        <input
                                            type="checkbox"
                                            checked={callerPhoneFromCallerId}
                                            disabled={!callerPhone.trim()}
                                            onChange={e => setCallerPhoneFromCallerId(e.target.checked)}
                                            className="accent-blue-600"
                                        />
                                        此號碼由來電顯示取得
                                    </label>
                                </div>
                            </div>

                            {/* 電話歷史檢索結果 — 重新查詢時保留舊清單避免閃爍，僅淡化 + 旁邊小 spinner */}
                            {phoneHistory.length > 0 && (
                                <div className={`bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5 transition-opacity ${phoneHistoryLoading ? 'opacity-60' : 'opacity-100'}`}>
                                    <p className="text-xs font-bold text-amber-700 flex items-center gap-1">
                                        <History className="w-3.5 h-3.5" />
                                        此電話過去有 {phoneHistory.length} 筆紀錄
                                        {phoneHistoryLoading && (
                                            <Loader2 className="w-3 h-3 animate-spin text-amber-600 ml-1" />
                                        )}
                                    </p>
                                    <ul className="text-xs text-slate-600 space-y-0.5 max-h-32 overflow-y-auto">
                                        {phoneHistory.slice(0, 10).map(r => (
                                            <li key={r.id} className="border-l-2 border-amber-300 pl-2">
                                                <span className="font-mono">{formatRocDateOnly(r.contactDate)}</span>
                                                {' · '}
                                                {RECORD_TYPE_LABEL[r.recordType]}
                                                {' · '}
                                                {r.callerName ?? r.applicantUserId ?? '—'}
                                                {r.summary && <span className="text-slate-500"> — {r.summary.slice(0, 30)}{r.summary.length > 30 ? '…' : ''}</span>}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* 從何得知本補助 */}
                            <div>
                                <label className="text-xs font-medium text-slate-600">從何得知本補助</label>
                                <select
                                    value={fromSource}
                                    onChange={e => setFromSource(e.target.value)}
                                    className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                >
                                    <option value="">— 未填 —</option>
                                    {FROM_SOURCE_OPTIONS.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-slate-600">諮詢人</label>
                                    <select
                                        value={consultantType}
                                        onChange={e => setConsultantType(e.target.value)}
                                        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                    >
                                        <option value="">— 未填 —</option>
                                        {CONSULTANT_TYPE_OPTIONS.map(o => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600">諮詢方案</label>
                                    <select
                                        value={consultProgram}
                                        onChange={e => setConsultProgram(e.target.value)}
                                        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                    >
                                        <option value="">— 未填 —</option>
                                        {CONSULT_PROGRAM_OPTIONS.map(o => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* 無法申請原因（多選） */}
                            <div>
                                <label className="text-xs font-medium text-slate-600">無法申請原因（可複選）</label>
                                <div className="mt-1 grid grid-cols-2 md:grid-cols-3 gap-1.5">
                                    {REJECT_REASON_OPTIONS.map(o => (
                                        <label key={o.value} className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={rejectReasons.includes(o.value)}
                                                onChange={() => toggleRejectReason(o.value)}
                                                className="accent-indigo-600"
                                            />
                                            <span>{REJECT_REASON_LABEL[o.value]}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* 共同：備註 */}
                    <div>
                        <label className="text-xs font-medium text-slate-600">
                            {isPhone ? '初始摘要' : '關懷摘要'}
                            {!isPhone && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <textarea
                            value={summary}
                            onChange={e => setSummary(e.target.value)}
                            readOnly={mode === 'edit'}
                            rows={4}
                            className={`mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-y ${mode === 'edit' ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                            placeholder={isPhone ? '需追蹤的摘要、特殊狀況等…' : '紀錄關懷對話內容…'}
                        />
                        {mode === 'edit' && (
                            <p className="mt-1 text-[11px] text-slate-400">初始摘要首次登打後不可修改，請使用下方追蹤摘要補充後續內容。</p>
                        )}
                    </div>

                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-amber-900 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isSpecialAttention}
                                onChange={e => setIsSpecialAttention(e.target.checked)}
                                className="w-4 h-4 accent-amber-600"
                            />
                            <AlertTriangle className="w-4 h-4" />
                            特殊注意
                        </label>
                        {isSpecialAttention && (
                            <div className="mt-2">
                                <label className="text-xs font-medium text-amber-900">
                                    特殊注意說明 <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={specialAttentionNote}
                                    onChange={e => setSpecialAttentionNote(e.target.value)}
                                    rows={3}
                                    className="mt-1 w-full border border-amber-300 rounded-lg px-3 py-2 text-sm resize-y bg-white"
                                    placeholder="請說明需特別留意的事項…"
                                />
                            </div>
                        )}
                    </div>

                    </fieldset>

                    {mode === 'edit' && existingRecord?.id && (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-slate-600">追蹤摘要</label>
                                {followupsLoading && (
                                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        載入中
                                    </span>
                                )}
                            </div>

                            {followups.length > 0 ? (
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {followups.map(item => {
                                        const isMine = item.authorUserId === operatorUserId;
                                        const isEditing = editingFollowupId === item.id;
                                        const wasUpdated = item.updatedAt && item.updatedAt !== item.createdAt;
                                        return (
                                            <div key={item.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                                                {isEditing ? (
                                                    <div className="space-y-2">
                                                        <textarea
                                                            value={editingFollowupText}
                                                            onChange={e => setEditingFollowupText(e.target.value)}
                                                            rows={3}
                                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-y"
                                                        />
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={handleSaveFollowupEdit}
                                                                disabled={savingFollowupEdit || !editingFollowupText.trim()}
                                                                className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                                                            >
                                                                {savingFollowupEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                                                儲存
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={handleCancelEditFollowup}
                                                                disabled={savingFollowupEdit}
                                                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                                                            >
                                                                <X className="w-3 h-3" />
                                                                取消
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex items-start gap-2">
                                                            <p className="whitespace-pre-wrap text-sm text-slate-700 flex-1">{item.summary}</p>
                                                            {isMine && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStartEditFollowup(item)}
                                                                    className="text-[11px] text-indigo-600 hover:text-indigo-800 shrink-0"
                                                                >
                                                                    編輯
                                                                </button>
                                                            )}
                                                        </div>
                                                        <p className="mt-1 text-[11px] text-slate-400">
                                                            {item.authorName} 新增於 {formatDateTime(item.createdAt)}
                                                            {wasUpdated && `，修改於 ${formatDateTime(item.updatedAt)}`}
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400">尚無追蹤摘要</p>
                            )}

                            <div className="space-y-2">
                                <textarea
                                    value={newFollowup}
                                    onChange={e => setNewFollowup(e.target.value)}
                                    rows={3}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-y bg-white"
                                    placeholder="輸入新的追蹤摘要"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddFollowup}
                                    disabled={addingFollowup || !newFollowup.trim()}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {addingFollowup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                    新增追蹤摘要
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 關懷專屬：媒體 URL */}
                    {!isPhone && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">媒體連結（圖片/影片 URL）</label>
                            {mediaUrls.map((url, idx) => {
                                const trimmed = url.trim();
                                const isImage = looksLikeImageUrl(trimmed);
                                const imageIdx = isImage ? imageUrls.indexOf(url) : -1;
                                return (
                                    <div key={idx} className="space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="url"
                                                value={url}
                                                onChange={e => setMediaUrl(idx, e.target.value)}
                                                disabled={!canEditRecord}
                                                placeholder="https://photos.google.com/... 或直接貼上 .jpg/.png 圖片網址"
                                                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                            />
                                            {mediaUrls.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeMediaUrl(idx)}
                                                    disabled={!canEditRecord}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                        {/* 圖片連結 → 顯示縮圖、點擊放大；非圖片 → 顯示「開啟連結」按鈕 */}
                                        {trimmed && isImage && imageIdx >= 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setLightboxIdx(imageIdx)}
                                                className="block border border-slate-200 rounded-lg overflow-hidden cursor-zoom-in hover:border-indigo-400 transition"
                                                title="點擊放大檢視"
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={trimmed}
                                                    alt={`媒體 ${idx + 1}`}
                                                    className="h-28 max-w-[240px] object-cover bg-slate-50"
                                                    onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
                                                />
                                            </button>
                                        )}
                                        {trimmed && !isImage && (
                                            <a
                                                href={trimmed}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 underline"
                                            >
                                                開啟連結（非直接圖片網址）
                                            </a>
                                        )}
                                    </div>
                                );
                            })}
                            <button
                                type="button"
                                onClick={addMediaUrl}
                                disabled={!canEditRecord}
                                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                            >
                                <Plus className="w-3.5 h-3.5" />新增連結
                            </button>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                    >
                        取消
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !canEditRecord}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        儲存
                    </button>
                </div>
            </div>

            {/* 申請人選擇 modal（巢狀） */}
            {pickerOpen && (
                <ApplicantPickerModal
                    operatorUserId={operatorUserId}
                    onPick={(picked: ApplicantSearchResult) => {
                        setLinkedApplicant({ userId: picked.userId, name: picked.name });
                        setPickerOpen(false);
                    }}
                    onClose={() => setPickerOpen(false)}
                />
            )}

            {/* 媒體圖片放大檢視 */}
            {lightboxIdx !== null && imageUrls.length > 0 && (
                <ImageLightbox
                    images={imageUrls.map(u => u.trim())}
                    index={Math.min(lightboxIdx, imageUrls.length - 1)}
                    onChange={setLightboxIdx}
                    onClose={() => setLightboxIdx(null)}
                />
            )}
        </div>
    );
}
