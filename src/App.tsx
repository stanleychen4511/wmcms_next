"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import {
    ClipboardList,
    UserCheck,
    Home,
    Gavel,
    CreditCard,
    ShieldCheck,
    AlertTriangle,
    Eye,
    Save,
    Send,
    Heart,
    Clock,
} from 'lucide-react';
import { AppHeader } from './components/AppHeader';
import { CaseStatisticsPage } from './components/CaseStatisticsPage';
import { ReportsPage } from './components/ReportsPage';
import { SecureFilePreviewModal } from './components/SecureFilePreviewModal';
import { DisbursementPanel } from './components/DisbursementPanel';
import { LoginPage } from './components/LoginPage';
import { HomePage } from './components/HomePage';
import { fetchPendingDocAlerts, fetchPendingDocThresholdAlerts, fetchPendingDocReminderStatus, PendingDocAlert, PendingDocThresholdAlert } from './app/actions/pendingDocAlertActions';
import { fetchMyTurnCases, type MyTurnItem } from './app/actions/myTurnActions';
import { CaseListPage } from './components/CaseListPage';
import { ApplicantHistoryPage } from './components/ApplicantHistoryPage';
import { ApplicationCareRecordsModal } from './components/ApplicationCareRecordsModal';
import { ModalEscapeListener } from './hooks/useModalDismiss';
import { CloseCaseModal } from './components/CloseCaseModal';
import type { CloseReasonCode } from './lib/closeReasonConstants';
import { SupervisorReviewPanel } from './components/SupervisorReviewPanel';
import { NewApplicationPage } from './components/NewApplicationPage';
import { ReviewList } from './components/ReviewList';
import { HomeVisitForm } from './components/HomeVisitForm';
import { ContactRecordsQuickView } from './components/ContactRecordsQuickView';
import { HomeVisitAssigneePanel } from './components/HomeVisitAssigneePanel';
import { OfficerCaseSummaryPanel } from './components/OfficerCaseSummaryPanel';
import { SendNotificationModal, ChecklistDoc } from './components/SendNotificationModal';
import { EditCaseBasicsModal } from './components/EditCaseBasicsModal';
import { BoardVoteCard } from './components/BoardVoteCard';
import { BoardSignaturePanel } from './components/BoardSignaturePanel';
import type { BoardReviewSignatureStatus } from './app/actions/boardSignatureActions';
import { fetchActiveBoardGroups, assignCaseToBoardGroup, isUserInAssignedGroupForCase, saveBoardReviewDraft, BoardGroup } from './app/actions/boardGroupActions';
import { fetchNotificationLogs, NotificationLog } from './app/actions/notificationActions';
import { ApplicationForm } from './components/ApplicationForm';
import { StageContainer } from './components/StageContainer';
import { Dashboard } from './components/Dashboard';
import { AuditLogViewer } from './components/AuditLogViewer';
import { AdminPanel } from './components/AdminPanel';
import { TemplateDownloadPage } from './components/TemplateDownloadPage';
import { NotificationManager } from './components/NotificationManager';
import { AnnouncementsPage } from './components/AnnouncementsPage';
import { UserSettingsPage } from './components/UserSettingsPage';
import { useToast } from './components/FloatingToast';

import {
    fetchApplicationDetail,
    advanceWorkflowStage,
    retreatWorkflowStage,
    saveQualificationData,
    saveBoardReviewData,
    closeCaseRejected,
    closeCase,
    reopenRejectedCase,
    requestSupervisorReviewForBoard,
    supervisorReviewForBoard,
    ApplicationDetail,
} from './app/actions/workflowActions';

import { fetchApplicationDocuments, DocumentEntry, fetchLastApplicationDocs, copyDocumentToApplication } from './app/actions/documentActions';

import {
    fetchCaseSummaries,
    fetchApplicantHistory,
    assignOfficerBatch,
    fetchUnassignedCount,
    fetchUnassignedCases,
    fetchDisbursableCases,
} from './app/actions/applicationActions';

import { fetchCaseOfficers, fetchCaseOfficersWithId } from './app/actions/userActions';
import { fetchSetting } from './app/actions/settingsActions';
import { fetchSettingFresh } from './lib/settingClient';
import { fetchActiveBanners, Banner } from './app/actions/bannerActions';
import { fetchHomeAnnouncements, Announcement } from './app/actions/announcementActions';

import { STATUS_TO_STAGE, STAGE_TO_STATUS } from './lib/stageMaps';

import { LoadingSpinner } from './components/LoadingSpinner';
import { CaseSummary, ApplicationRecord, WorkflowStage, Role } from './types';
import { checkEligibility } from './utils/eligibility';
import { clsx } from 'clsx';

// ── Stage metadata ────────────────────────────────────────────────────────────

const STAGES: WorkflowStage[] = ['admin_review', 'visit', 'board_review', 'reimbursement'];

const STAGE_LABEL_MAP: Record<WorkflowStage, string> = {
    admin_review: '行政初審',
    visit: '家庭訪視',
    board_review: '董事審核',
    reimbursement: '核銷撥款',
};

const STAGE_ICON_MAP: Record<WorkflowStage, React.ReactNode> = {
    admin_review: <UserCheck className="w-4 h-4" />,
    visit: <Home className="w-4 h-4" />,
    board_review: <Gavel className="w-4 h-4" />,
    reimbursement: <CreditCard className="w-4 h-4" />,
};

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
    const { push: pushToast } = useToast();
    const [role, setRole] = useState<Role>('case_officer');
    const [loggedInUser, setLoggedInUser] = useState<{ username: string; roles: Role[]; account: string; id: string } | null>(null);

    const [view, setView] = useState<'home' | 'list' | 'history' | 'detail' | 'new_application' | 'admin' | 'template_download' | 'notification_manager' | 'announcements' | 'user_settings' | 'stats' | 'reports'>('home');
    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
    const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
    // Mirror selectedAppId into a ref for use inside stable callbacks (e.g. handleSignatureStatusChange)
    // Avoids stale closure problem without re-creating the callback on every state change.

    // Restore login + navigation state from sessionStorage (runs once on mount)
    useEffect(() => {
        try {
            const saved = sessionStorage.getItem('loggedInUser');
            if (saved) {
                const user = JSON.parse(saved);
                setLoggedInUser(user);
                setRole(user.roles[0]);
            }
            const nav = sessionStorage.getItem('navState');
            if (nav) {
                const n = JSON.parse(nav);
                if (n.view)             setView(n.view);
                if (n.selectedPersonId) setSelectedPersonId(n.selectedPersonId);
                if (n.selectedAppId)    setSelectedAppId(n.selectedAppId);
            }
        } catch { /* ignore */ }
    }, []);

    // Persist navigation state whenever it changes
    useEffect(() => {
        try {
            sessionStorage.setItem('navState', JSON.stringify({ view, selectedPersonId, selectedAppId }));
        } catch { /* ignore */ }
    }, [view, selectedPersonId, selectedAppId]);

    // Viewed stage for read-only browsing (separate from true stage)
    const [viewedStage, setViewedStage] = useState<WorkflowStage | null>(null);

    // Board review state
    const [boardApproved, setBoardApproved] = useState<boolean | null>(null); // null = 未選擇
    const [boardApprovedAmount, setBoardApprovedAmount] = useState<number>(0);
    const [boardOpinion, setBoardOpinion] = useState('');
    const [eligibilityCheck, setEligibilityCheck] = useState<{ checked: boolean; eligible: boolean; reasons: string[]; reasonCodes: Array<{ code: string; value?: string }> }>({
        checked: false, eligible: false, reasons: [], reasonCodes: [],
    });
    // Tracks the latest values from the ApplicationForm for use in eligibility check
    const [liveApplicantValues, setLiveApplicantValues] = useState<any>(null);
    const [isSavingQualification, setIsSavingQualification] = useState(false);
    // 主管雙閘門 — flow controls 區的「通過送董事 / 退件」狀態（inline，不用 SupervisorReviewPanel）
    const [supBusy, setSupBusy] = useState(false);
    const [showSupRejectForm, setShowSupRejectForm] = useState(false);
    const [supRejectNote, setSupRejectNote] = useState('');
    const [retreatModal, setRetreatModal] = useState<null | { toStage: WorkflowStage; label: string }>(null);
    const [retreatReason, setRetreatReason] = useState('');
    const [retreatBusy, setRetreatBusy] = useState(false);
    const [applyAmount, setApplyAmount] = useState<number>(0);
    /** 各子類型補助上限（依 subsidy_amount_limits 表）；'1'=經濟弱勢、'2'=小康家庭。 */
    const [subtypeMaxAmounts, setSubtypeMaxAmounts] = useState<Record<'1' | '2', number>>({ '1': 0, '2': 0 });
    const [pendingThresholdDays, setPendingThresholdDays] = useState<number>(7);
    /** 董事審核意見最少字數（0=不限制） */
    const [boardOpinionMinChars, setBoardOpinionMinChars] = useState<number>(50);
    const [applyAmountError, setApplyAmountError] = useState('');

    // Last docs state (for "使用上次檔案" feature)
    const [lastDocs, setLastDocs] = useState<any[]>([]);
    const [copyingLastDocs, setCopyingLastDocs] = useState(false);

    // Notification state
    const [showNotifModal, setShowNotifModal] = useState(false);
    const [showCareRecordsModal, setShowCareRecordsModal] = useState(false);
    /** 通用「不通過結案」modal —— stage 觸發時為當下 stage；threshold 觸發時 prefill 為 '98' + 文字 */
    const [closeCaseModalProps, setCloseCaseModalProps] = useState<null | {
        prefillCodes?: Array<{ code: CloseReasonCode; value?: string }>;
        prefillNote?: string;
        titleSuffix?: string;
    }>(null);
    const [notifLogs, setNotifLogs] = useState<NotificationLog[]>([]);

    const loadNotifLogs = useCallback(async (appId: string) => {
        const res = await fetchNotificationLogs(appId);
        if (res.success && res.data) setNotifLogs(res.data);
    }, []);

    // DB-driven application detail (loaded when entering detail view)
    const [appDetail, setAppDetail] = useState<ApplicationDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [dbDocs, setDbDocs] = useState<DocumentEntry[]>([]);
    const [documentReloadKey, setDocumentReloadKey] = useState(0);

    /** 當前案件適用的上限：依 appDetail.subsidySubtype 對應；未指定子類型時取兩者較大值。 */
    const maxApplyAmount = (() => {
        const st = appDetail?.subsidySubtype;
        if (st === '1' || st === '2') return subtypeMaxAmounts[st];
        return Math.max(subtypeMaxAmounts['1'], subtypeMaxAmounts['2']);
    })();

    /** 行政初審階段可申請金額上限 = 子類型上限 - 該子類型已累積核准金額
     *  （扣除其他已核銷案件的金額，本案還未結案不影響）。
     *
     *  子類型來源優先順序：
     *    1. liveApplicantValues.subsidyType — 表單即時值（使用者剛切換但還沒儲存）
     *    2. appDetail.subsidySubtype — DB 已存值
     *  → 切換 radio 後上限即時更新，不用等儲存 / 重整。
     */
    const adminReviewApplyCap = (() => {
        const liveSt = liveApplicantValues?.subsidyType;
        const st: '1' | '2' | null =
            (liveSt === '1' || liveSt === '2') ? liveSt :
            (appDetail?.subsidySubtype === '1' || appDetail?.subsidySubtype === '2') ? appDetail.subsidySubtype :
            null;
        if (!st) return maxApplyAmount;
        const cum = st === '1'
            ? (appDetail?.totalApprovedSubtype1 ?? 0)
            : (appDetail?.totalApprovedSubtype2 ?? 0);
        return Math.max(0, subtypeMaxAmounts[st] - cum);
    })();

    /** 切換子類型後若上限變低（例如 小康→經濟弱勢），把申請金額也跟著 clamp 下來，
     *  並顯示「上限為 NT$XXX 元」黃色提示。 */
    useEffect(() => {
        if (adminReviewApplyCap <= 0) return;
        if (applyAmount > adminReviewApplyCap) {
            setApplyAmount(adminReviewApplyCap);
            setApplyAmountError(`上限為 NT$${adminReviewApplyCap.toLocaleString()} 元`);
        } else if (applyAmountError.startsWith('上限為') && applyAmount < adminReviewApplyCap) {
            // 切到上限較高的子類型後，原本的提示就不適用了 → 清掉
            setApplyAmountError('');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adminReviewApplyCap]);

    const loadAppDetail = useCallback(async (id: string, silent = false) => {
        if (!silent) setDetailLoading(true);
        const scrollY = silent ? window.scrollY : 0;
        try {
            const [detail, docs] = await Promise.all([
                fetchApplicationDetail(id),
                fetchApplicationDocuments(id),
            ]);
            setAppDetail(detail);
            setDbDocs(docs);
            if (detail) {
                // 同步 selectedPersonId — 從首頁未補件 / 輪到我處理 / 未派案 modal 進入流程頁時
                // 只設定了 selectedAppId，這裡補上 applicantId，避免「返回歷史紀錄」變空白。
                if (detail.applicantId) setSelectedPersonId(detail.applicantId);
                setViewedStage(detail.stage as WorkflowStage);
                if (detail.applyAmount != null) setApplyAmount(detail.applyAmount);
                // 結案案件（status='2'/'4'）→ 從 workflow 彙整值顯示供查閱
                // 進行中案件（status='1'）→ 完全交給後續 useEffect 處理：
                //   - 派組成員 / chairman → myMemberRow useEffect 從 board_review_signatures.member_* 載入個人意見
                //   - 非成員（supervisor/admin）→ aggregate useEffect 從簽章彙整
                //   loadAppDetail 不可在此覆寫 boardApproved/Amount/Opinion，否則會蓋掉剛存的個人意見。
                const isClosed = detail.status === '2' || detail.status === '4';
                if (isClosed) {
                    setBoardApproved(detail.wfIsApproved ?? null);
                    setBoardApprovedAmount(detail.approvedAmount ?? 0);
                    setBoardOpinion(detail.wfComments ?? '');
                    setInitialBoardValues({
                        approved: detail.wfIsApproved ?? null,
                        amount: detail.approvedAmount ?? 0,
                        opinion: detail.wfComments ?? '',
                    });
                }
            }
        } finally {
            if (!silent) {
                setDetailLoading(false);
            } else {
                // Restore scroll position after React re-render
                requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: 'instant' as ScrollBehavior }));
            }
        }
    }, []);

    // Per-application pending-doc reminder counter (for detail-view banner)
    const [reminderStatus, setReminderStatus] = useState<{ count: number; threshold: number; lastReminderAt: string | null } | null>(null);
    // (threshold-close modal 已合併到 CloseCaseModal；此處狀態整批移除)

    const loadReminderStatus = useCallback(async (appId: string) => {
        const res = await fetchPendingDocReminderStatus(appId);
        if (res.success && res.data) setReminderStatus(res.data);
        else setReminderStatus(null);
    }, []);

    // Edit-case-basics modal state
    const [showEditBasicsModal, setShowEditBasicsModal] = useState(false);

    // Board group re-assignment state (chairman/admin)
    const [showAssignDropdown, setShowAssignDropdown] = useState(false);
    const [activeBoardGroups, setActiveBoardGroups] = useState<BoardGroup[]>([]);
    const [assignBusy, setAssignBusy] = useState(false);

    // Board review collaborative edit: is the logged-in user a current member of this case's assigned group?
    const [isAssignedGroupMember, setIsAssignedGroupMember] = useState(false);
    // Initial board review values snapshot (for dirty-state detection)
    const [initialBoardValues, setInitialBoardValues] = useState<{ approved: boolean | null; amount: number; opinion: string } | null>(null);
    // Save-draft state
    const [savingBoardDraft, setSavingBoardDraft] = useState(false);
    const [boardDraftMsg, setBoardDraftMsg] = useState<string | null>(null);

    // Signature completeness (from BoardSignaturePanel callback) — feeds advance-button gating
    const [signatureStatus, setSignatureStatus] = useState<BoardReviewSignatureStatus | null>(null);
    /** 簽章/草稿存檔可能會更新 applications.approved_amount（chairman 第三審或全員一致時）。
     *  refresh appDetail 讓 Dashboard 即時顯示新通過金額，不需 F5。
     *  注意：用 useCallback 維持 reference stability，否則 BoardSignaturePanel 的 useEffect dep 會反覆觸發 → 死循環。
     *  loadAppDetail 用 queueMicrotask 延後到 render 結束才呼叫，避免「render 中更新其他 component」警告。 */
    const selectedAppIdRef = useRef<string | null>(null);
    useEffect(() => { selectedAppIdRef.current = selectedAppId; }, [selectedAppId]);
    const handleSignatureStatusChange = useCallback((status: BoardReviewSignatureStatus) => {
        setSignatureStatus(status);
        const id = selectedAppIdRef.current;
        if (id) {
            queueMicrotask(() => { void loadAppDetail(id, true); });
        }
    // loadAppDetail 在這個檔案是 useCallback 且 deps=[]，identity 穩定
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // 核銷階段：撥款是否已全部回收（DisbursementPanel callback 設定），決定能否結案
    const [canCloseCase, setCanCloseCase] = useState(false);
    // Bump this after reassign / save / anything that invalidates board card caches
    const [boardRefreshKey, setBoardRefreshKey] = useState(0);
    /** 董事審核：當前作用中的 member tab（signer_user_id 字串）；null = 尚未決定 */
    const [activeMemberTab, setActiveMemberTab] = useState<string | null>(null);
    const signaturesComplete = !!signatureStatus
        && signatureStatus.memberCount > 0
        && signatureStatus.memberCount === signatureStatus.signedCount;

    // 找出當前使用者自己在 signatureStatus 中的 row（per-member 編輯 UI 用）
    const myMemberRow = signatureStatus?.members?.find(
        m => loggedInUser && m.signerUserId === loggedInUser.id
    ) ?? null;

    // 當 signatureStatus 更新且當前 user 是組員 → 用個人 member row 覆寫 board form 狀態
    // （只在 board_review 階段；案件結案後維持顯示 applications.approved_amount 等彙總值）
    useEffect(() => {
        if (appDetail?.stage !== 'board_review' || appDetail?.status !== '1') return;
        if (!myMemberRow) return;
        setBoardApproved(myMemberRow.memberApproved);
        setBoardApprovedAmount(myMemberRow.memberAmount ?? 0);
        setBoardOpinion(myMemberRow.memberComments ?? '');
        setInitialBoardValues({
            approved: myMemberRow.memberApproved,
            amount: myMemberRow.memberAmount ?? 0,
            opinion: myMemberRow.memberComments ?? '',
        });
    }, [myMemberRow?.memberApproved, myMemberRow?.memberAmount, myMemberRow?.memberComments, appDetail?.stage, appDetail?.status]);

    // 非派組成員（supervisor / admin / chairman 但非組員）：從已簽署成員的決定彙整出
    // 「整體通過/不通過 + 通過金額」，用來決定推進按鈕標籤 & 帶入 applications.approved_amount。
    //
    // 規則：
    //   1) 若 chairman 已以「第三審」身分簽章（兩位董事意見/金額不一致才會出現）
    //      → 完全採用 chairman 的決定與金額（chairman 為裁決者）
    //   2) 否則 → 純董事多數決，金額取已同意者的最高
    //   3) 無人簽署 → null（按鈕仍顯示「進入下一階段」，由簽章閘門阻擋）
    useEffect(() => {
        if (appDetail?.stage !== 'board_review' || appDetail?.status !== '1') return;
        if (myMemberRow) return; // 組員自己的決定優先
        const signed = signatureStatus?.members?.filter(
            m => m.status === 'signed' && m.memberApproved !== null
        ) ?? [];
        if (signed.length === 0) {
            setBoardApproved(null);
            setBoardApprovedAmount(0);
            setInitialBoardValues({ approved: null, amount: 0, opinion: '' });
            return;
        }
        // 找出 chairman 第三審那筆（fetchBoardReviewSignatures 帶 "（董事長・第三審）" 後綴）
        const chairmanRow = signed.find(m => m.name.includes('（董事長・第三審）'));
        let aggregatedApproved: boolean;
        let aggregatedAmount: number;
        if (chairmanRow) {
            // chairman 第三審 = 裁決者
            aggregatedApproved = chairmanRow.memberApproved === true;
            aggregatedAmount = aggregatedApproved ? (chairmanRow.memberAmount ?? 0) : 0;
        } else {
            const yes = signed.filter(m => m.memberApproved === true).length;
            aggregatedApproved = yes > signed.length / 2; // 嚴格多數（同票時不通過）
            aggregatedAmount = aggregatedApproved
                ? Math.max(...signed.filter(m => m.memberApproved === true).map(m => m.memberAmount ?? 0))
                : 0;
        }
        setBoardApproved(aggregatedApproved);
        setBoardApprovedAmount(aggregatedAmount);
        // 同步更新 initialBoardValues — 避免 dirty detection 把這個自動彙整當成「未儲存的編輯」
        setInitialBoardValues({
            approved: aggregatedApproved,
            amount: aggregatedAmount,
            opinion: '',
        });
    }, [signatureStatus, myMemberRow, appDetail?.stage, appDetail?.status]);
    const signaturesMissing = signatureStatus
        ? Math.max(0, signatureStatus.memberCount - signatureStatus.signedCount)
        : 0;

    // 董事審核 tab：可見成員清單 + 預設選自己（若有），否則第一位
    //   - 自己是組員 → 只看自己 + 其他組員（chairman 第三審時要能看到其他董事的決定當參考）
    //   - supervisor / admin / chairman → 看全部
    //   - 其他角色 → 空清單（顯示「您不在派組成員中」）
    const userRolesListForTabs = (loggedInUser?.roles ?? []) as Role[];
    const canViewAllMemberTabs = userRolesListForTabs.includes('supervisor')
        || userRolesListForTabs.includes('admin')
        || userRolesListForTabs.includes('chairman' as Role);
    const visibleBoardMembers = (() => {
        const all = signatureStatus?.members ?? [];
        if (canViewAllMemberTabs) return all;
        return all.filter(m => loggedInUser && m.signerUserId === loggedInUser.id);
    })();
    useEffect(() => {
        if (visibleBoardMembers.length === 0) {
            if (activeMemberTab !== null) setActiveMemberTab(null);
            return;
        }
        // 若當前 tab 不在 visible 清單裡 → 重設為自己（若可見），否則第一位
        const inList = visibleBoardMembers.some(m => m.signerUserId === activeMemberTab);
        if (!inList) {
            const self = visibleBoardMembers.find(m => loggedInUser && m.signerUserId === loggedInUser.id);
            setActiveMemberTab(self?.signerUserId ?? visibleBoardMembers[0].signerUserId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signatureStatus, loggedInUser?.id, canViewAllMemberTabs]);

    // Permission: can edit the board_review section?
    const userRolesList = (loggedInUser?.roles ?? []) as Role[];
    const isAdminOrChairman = userRolesList.includes('admin') || userRolesList.includes('chairman' as Role);
    const canEditBoardReview = isAssignedGroupMember || isAdminOrChairman;
    // Permission: can press the advance-to-reimbursement button after all signatures done?
    // 僅開放：主管 / admin（董事長僅作第三審簽章；董事僅負責簽章；承辦人不負責推進核銷）
    const canAdvanceFromBoardReview =
        userRolesList.includes('supervisor') ||
        userRolesList.includes('admin');

    // Dirty state: current values differ from the loaded snapshot
    const boardDirty = !!initialBoardValues && (
        boardApproved !== initialBoardValues.approved ||
        (boardApprovedAmount || 0) !== (initialBoardValues.amount || 0) ||
        (boardOpinion || '') !== (initialBoardValues.opinion || '')
    );

    useEffect(() => {
        if (view === 'detail' && selectedAppId) {
            loadAppDetail(selectedAppId);
            loadNotifLogs(selectedAppId);
            loadReminderStatus(selectedAppId);
            // 重新抓 stage-dependent 設定，避免 admin 改完設定後其他頁面 keep 舊值
            // （app-mount 只抓一次，使用者在 SettingsPanel 改完後不會自動同步到這裡）
            fetchSettingFresh('board_opinion_min_chars', '50').then(v => {
                const n = Number(v);
                setBoardOpinionMinChars(Number.isFinite(n) && n >= 0 ? n : 50);
            });
        }
    }, [view, selectedAppId, loadAppDetail, loadNotifLogs, loadReminderStatus]);

    // Refresh "is group member?" whenever the app detail shows a board_review case
    useEffect(() => {
        if (view !== 'detail' || !selectedAppId || !loggedInUser) { setIsAssignedGroupMember(false); return; }
        if (appDetail?.stage !== 'board_review') { setIsAssignedGroupMember(false); return; }
        isUserInAssignedGroupForCase(selectedAppId, loggedInUser.id).then(res => {
            setIsAssignedGroupMember(!!res.data);
        });
    }, [view, selectedAppId, appDetail?.stage, loggedInUser]);

    useEffect(() => {
        // 載入兩個子類型的補助上限（取代舊 max_apply_amount 設定）
        import('./app/actions/eligibilityRulesActions').then(m => m.fetchSubsidyAmountLimitsMap())
            .then(setSubtypeMaxAmounts)
            .catch(err => console.error('fetchSubsidyAmountLimitsMap error:', err));
        fetchSetting('pending_doc_alert_days', '7').then(v => setPendingThresholdDays(Number(v) || 7));
        fetchSetting('board_opinion_min_chars', '50').then(v => {
            const n = Number(v);
            setBoardOpinionMinChars(Number.isFinite(n) && n >= 0 ? n : 50);
        });
    }, []);

    // Banners for HomePage carousel
    const [banners, setBanners] = useState<Banner[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [announcementNewDays, setAnnouncementNewDays] = useState(7);

    // Reload banners + announcements every time user returns to home view
    useEffect(() => {
        if (view === 'home') {
            fetchActiveBanners().then(setBanners).catch(() => {});
            fetchHomeAnnouncements().then(({ items, newDays }) => {
                setAnnouncements(items);
                setAnnouncementNewDays(newDays);
            }).catch(() => {});
        }
    }, [view]);

    useEffect(() => {
        if (appDetail?.applicantId && appDetail?.stage === 'admin_review') {
            // 排除當前案件 — 只回此申請人「過去其他案件」的文件
            fetchLastApplicationDocs(appDetail.applicantId, selectedAppId ?? undefined).then(setLastDocs);
        }
    }, [appDetail?.applicantId, appDetail?.stage, selectedAppId]);

    // Pending doc alerts (recalculated every time user returns to home)
    const [pendingAlerts, setPendingAlerts] = useState<PendingDocAlert[]>([]);
    const [thresholdAlerts, setThresholdAlerts] = useState<PendingDocThresholdAlert[]>([]);

    const loadPendingAlerts = useCallback(async (userId: string) => {
        const [res, thRes] = await Promise.all([
            fetchPendingDocAlerts(userId),
            fetchPendingDocThresholdAlerts(userId),
        ]);
        if (res.success && res.data) setPendingAlerts(res.data); else setPendingAlerts([]);
        if (thRes.success && thRes.data) setThresholdAlerts(thRes.data); else setThresholdAlerts([]);
    }, []);

    // Unassigned case count for assign-capable roles
    const ASSIGN_ROLES: Role[] = ['supervisor', 'board_member', 'admin'];
    const [unassignedCount, setUnassignedCount] = useState<number>(0);
    const [unassignedCases, setUnassignedCases] = useState<Array<{ applicationId: string; caseNumber: string; applicantName: string; appliedAt: string | null }>>([]);

    const loadUnassignedCount = useCallback(async () => {
        const [count, list] = await Promise.all([
            fetchUnassignedCount(),
            fetchUnassignedCases(),
        ]);
        setUnassignedCount(count);
        setUnassignedCases(list);
    }, []);

    // 「可撥款」清單 — case_officer 的 status='3' 且尚無 payment_disbursements 的案件
    const [disbursableCases, setDisbursableCases] = useState<Array<{
        applicationId: string; caseNumber: string; applicantName: string; approvedAmount: number | null;
    }>>([]);
    const loadDisbursableCases = useCallback(async (userId: string) => {
        const list = await fetchDisbursableCases(userId);
        setDisbursableCases(list);
    }, []);

    // 「輪到我處理」清單（user feedback #12）
    const [myTurnItems, setMyTurnItems] = useState<MyTurnItem[]>([]);
    const [myTurnAppIds, setMyTurnAppIds] = useState<Set<string>>(new Set());
    const [myTurnFilterActive, setMyTurnFilterActive] = useState(false);
    const [pendingDocFilterActive, setPendingDocFilterActive] = useState(false);
    const [unassignedFilterActive, setUnassignedFilterActive] = useState(false);
    const loadMyTurn = useCallback(async (userId: string) => {
        const r = await fetchMyTurnCases(userId);
        setMyTurnItems(r.items);
        setMyTurnAppIds(new Set(r.applicationIds));
    }, []);

    // Recalculate both alerts every time user returns to home or list view
    useEffect(() => {
        if ((view === 'home' || view === 'list') && loggedInUser) {
            const roles = loggedInUser.roles as Role[];
            if (roles.includes('case_officer')) {
                loadPendingAlerts(loggedInUser.id);
                loadDisbursableCases(loggedInUser.id);
            }
            if (roles.some(r => ASSIGN_ROLES.includes(r))) loadUnassignedCount();
            loadMyTurn(loggedInUser.id);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, loggedInUser, loadPendingAlerts, loadUnassignedCount, loadDisbursableCases]);

    // DB state for inquiry pages
    const [dbCases, setDbCases] = useState<CaseSummary[]>([]);
    const [listLoading, setListLoading] = useState(true); // start true so first render shows spinner
    const [dbHistory, setDbHistory] = useState<ApplicationRecord[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [officerList, setOfficerList] = useState<string[]>([]);
    const [officersWithId, setOfficersWithId] = useState<{ id: string; name: string }[]>([]);

    // Helper to check if user HAS a specific role (regardless of current active mode)
    const hasPermission = useCallback((target: Role) => {
        if (!loggedInUser) return false;
        return (loggedInUser.roles as Role[]).includes(target);
    }, [loggedInUser]);

    // Fetch summaries when entering list view
    const refreshCaseSummaries = useCallback(async () => {
        setListLoading(true);
        try {
            // 志工視野過濾（#11）：當前操作角色為 volunteer 時，只看家訪指派為自己的案件
            // 注意：判定的是「目前正在操作的 role」而非「使用者被授權的所有角色」，
            // 這樣多角色帳號（例：volunteer + case_officer）切到 volunteer 視野時也會生效。
            const isActingAsVolunteer = role === 'volunteer';
            const data = await fetchCaseSummaries(
                isActingAsVolunteer && loggedInUser ? { volunteerOnlyFilterUserId: loggedInUser.id } : undefined
            );
            setDbCases(data);
            
            // Also fetch officer list for filtering and assignment
            const [oList, oWithId] = await Promise.all([
                fetchCaseOfficers(),
                fetchCaseOfficersWithId(),
            ]);
            setOfficerList(oList);
            setOfficersWithId(oWithId);
        } finally {
            setListLoading(false);
        }
    }, [role, loggedInUser]);

    useEffect(() => {
        if (view === 'list') {
            refreshCaseSummaries();
        }
    }, [view, refreshCaseSummaries]);

    // Fetch history when a person is selected
    const loadApplicantHistory = useCallback(async (id: string) => {
        setHistoryLoading(true);
        try {
            const data = await fetchApplicantHistory(id);
            setDbHistory(data);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        if (view === 'history' && selectedPersonId) {
            loadApplicantHistory(selectedPersonId);
        }
    }, [view, selectedPersonId, loadApplicantHistory]);

    const handleLogout = () => {
        sessionStorage.removeItem('loggedInUser');
        sessionStorage.removeItem('navState');
        setLoggedInUser(null);
        setSelectedAppId(null);
        setSelectedPersonId(null);
        setView('home');
    };

    // ── Early returns for non-detail views ────────────────────────────────────

    if (!loggedInUser) {
        return (
            <LoginPage onLogin={(user) => {
                sessionStorage.setItem('loggedInUser', JSON.stringify(user));
                setLoggedInUser(user);
                setRole(user.roles[0]); // Default to first role
                setView('home');
            }} />
        );
    }

    if (view === 'home') {
        return (
            <HomePage
                username={loggedInUser.username}
                userId={loggedInUser.id}
                userRoles={loggedInUser.roles as Role[]}
                activeRole={role}
                pendingAlerts={pendingAlerts}
                thresholdAlerts={thresholdAlerts}
                unassignedCount={unassignedCount}
                unassignedCases={unassignedCases}
                disbursableCases={disbursableCases}
                onUnassignedGoToList={() => { setUnassignedFilterActive(true); setView('list'); }}
                onPendingDocGoToList={() => { setPendingDocFilterActive(true); setView('list'); }}
                myTurnItems={myTurnItems}
                onMyTurnGoToList={() => { setMyTurnFilterActive(true); setView('list'); }}
                onSelectCase={(appId) => { setSelectedAppId(appId); setView('detail'); }}
                banners={banners}
                announcements={announcements}
                newDays={announcementNewDays}
                onGoAnnouncements={() => setView('announcements')}
                onNavigateToCases={() => setView('list')}
                onGoAudit={() => setView('admin')}
                onGoAdmin={() => setView('admin')}
                onNewApplication={() => setView('new_application')}
                onGoTemplates={() => setView('template_download')}
                onGoNotifications={() => setView('notification_manager')}
                onGoUserSettings={() => setView('user_settings')}
                onGoStats={() => setView('stats')}
                onGoReports={() => setView('reports')}
                onLogout={handleLogout}
            />
        );
    }

    if (view === 'new_application') {
        return (
            <NewApplicationPage
                username={loggedInUser.username}
                userAccount={loggedInUser.account}
                userId={loggedInUser.id}
                onBack={() => setView('home')}
                onGoHome={() => setView('home')}
                onLogout={handleLogout}
                onSubmitSuccess={(newCaseId) => {
                    // Navigate directly to the newly created detail mode
                    setSelectedAppId(newCaseId);
                    setViewedStage('admin_review');
                    setView('detail');
                }}
            />
        );
    }

    if (view === 'announcements') {
        return (
            <AnnouncementsPage
                username={loggedInUser.username}
                onBack={() => setView('home')}
                onGoHome={() => setView('home')}
                onLogout={handleLogout}
            />
        );
    }

    if (view === 'admin') {
        return (
            <AdminPanel
                userRoles={loggedInUser.roles as Role[]}
                userId={loggedInUser.id}
                onBack={() => setView('home')}
                username={loggedInUser.username}
                onLogout={handleLogout}
            />
        );
    }

    if (view === 'user_settings') {
        return (
            <UserSettingsPage
                userId={loggedInUser.id}
                username={loggedInUser.username}
                onBack={() => setView('home')}
                onLogout={handleLogout}
            />
        );
    }

    if (view === 'stats') {
        return (
            <CaseStatisticsPage
                operatorUserId={loggedInUser.id}
                username={loggedInUser.username}
                onGoHome={() => setView('home')}
                onLogout={handleLogout}
            />
        );
    }

    if (view === 'reports') {
        return (
            <ReportsPage
                operatorUserId={loggedInUser.id}
                username={loggedInUser.username}
                onBack={() => setView('home')}
                onGoHome={() => setView('home')}
                onLogout={handleLogout}
            />
        );
    }

    if (view === 'template_download') {
        return (
            <TemplateDownloadPage
                userId={loggedInUser.id}
                onBack={() => setView('home')}
                username={loggedInUser.username}
                onLogout={handleLogout}
            />
        );
    }

    if (view === 'notification_manager') {
        return (
            <NotificationManager
                userId={loggedInUser.id}
                onBack={() => setView('home')}
                username={loggedInUser.username}
                onLogout={handleLogout}
            />
        );
    }

    if (view === 'list') {
        return (
            <CaseListPage
                username={loggedInUser.username}
                userId={loggedInUser.id}
                userRoles={loggedInUser.roles as Role[]}
                cases={dbCases}
                allOfficers={officerList}
                officersWithId={officersWithId}
                isLoading={listLoading}
                pendingAlertIds={new Set(pendingAlerts.map(a => a.applicationId))}
                thresholdReminderCounts={new Map(thresholdAlerts.map(a => [a.applicationId, a.reminderCount]))}
                myTurnAppIds={myTurnAppIds}
                myTurnFilterActive={myTurnFilterActive}
                onToggleMyTurnFilter={(v: boolean) => setMyTurnFilterActive(v)}
                pendingOnlyActive={pendingDocFilterActive}
                onTogglePendingOnly={(v: boolean) => setPendingDocFilterActive(v)}
                unassignedFilterActive={unassignedFilterActive}
                onToggleUnassignedFilter={(v: boolean) => setUnassignedFilterActive(v)}
                subtypeMaxAmounts={subtypeMaxAmounts}
                onMount={refreshCaseSummaries}
                onAssign={async (applicationIds, officerUserId) => {
                    const res = await assignOfficerBatch(applicationIds, officerUserId);
                    if (!res.success) throw new Error(res.error ?? '派案失敗');
                    await refreshCaseSummaries();
                }}
                onSelectCase={(personId) => {
                    setSelectedPersonId(personId);
                    setView('history');
                }}
                onLogout={handleLogout}
                onGoHome={() => setView('home')}
            />
        );
    }

    if (view === 'history') {
        const personName = selectedPersonId
            ? (dbCases.find(c => c.id === selectedPersonId)?.applicantName ?? 
               dbHistory[0]?.applicantName ?? '')
            : '';
        return (
            <ApplicantHistoryPage
                applicantName={personName}
                applicantUserId={selectedPersonId}
                records={dbHistory}
                isLoading={historyLoading}
                username={loggedInUser.username}
                userRoles={loggedInUser.roles as string[]}
                loggedInUserId={loggedInUser.id}
                onSelectApplication={(record: ApplicationRecord) => {
                    setSelectedAppId(record.id);
                    // Reset viewed stage to the application's true stage
                    setViewedStage(record.stage);
                    setView('detail');
                }}
                onBack={() => setView('list')}
                onGoHome={() => setView('home')}
                onLogout={handleLogout}
            />
        );
    }

    // ── Detail / Workflow view ────────────────────────────────────────────────

    // Show spinner while loading DB data for detail view
    if (view === 'detail' && detailLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <LoadingSpinner />
            </div>
        );
    }

    // Determine stage: prefer DB-driven appDetail
    const stage: WorkflowStage = (appDetail?.stage as WorkflowStage) ?? 'admin_review';

    // Build qualification form initial values: DB data takes priority
    //
    // marital_status 編碼（115 年辦法）：
    //   '1'=已婚、'2'=單親、'3'=單身（與 mid_class_eligibility_matrix 對齊）
    const qualificationInitialValues = appDetail && (
        appDetail.age != null ||
        appDetail.moveableProperty != null ||
        appDetail.immoveableProperty != null ||
        appDetail.annualIncome != null
    ) ? {
        subsidyType: (appDetail.subsidySubtype ?? undefined) as '1' | '2' | undefined,
        type: ((appDetail.maritalStatus === '1' || appDetail.maritalStatus === '2' || appDetail.maritalStatus === '3')
            ? appDetail.maritalStatus
            : '3') as '1' | '2' | '3',
        age: appDetail.age ?? 0,
        hasChildren: appDetail.hasChildren ?? false,
        underageChildrenCount: appDetail.underageChildrenCount ?? undefined,
        adultChildrenCount: appDetail.adultChildrenCount ?? undefined,
        annualIncome: appDetail.annualIncome ?? 0,
        movableAssets: appDetail.moveableProperty ?? 0,
        realEstateValue: appDetail.immoveableProperty ?? 0,
        econDeposit:       appDetail.econDeposit ?? undefined,
        econMonthlyIncome: appDetail.econMonthlyIncome ?? undefined,
    } : {
        subsidyType: undefined,
        type: '3' as const,
        age: 0,
        hasChildren: false,
        underageChildrenCount: undefined,
        adultChildrenCount: undefined,
        annualIncome: 0,
        movableAssets: 0,
        realEstateValue: 0,
        econDeposit: undefined,
        econMonthlyIncome: undefined,
    };
    const currentStageIndex = STAGES.indexOf(stage);

    // Viewed stage (for read-only browsing) — defaults to true stage
    const displayedStage: WorkflowStage = viewedStage ?? stage;
    const isViewingPastStep = displayedStage !== stage;
    const isAssignedOfficer = !!loggedInUser && !!appDetail?.officerId
        && String(loggedInUser.id) === String(appDetail.officerId);


    // Use DB applicant name if available
    const personName = appDetail?.applicantName ?? '';

    const checkEligibilityAction = async () => {
        // Use liveApplicantValues (from form) if available, fallback to DB-loaded values
        const dataToCheck = liveApplicantValues ?? qualificationInitialValues;
        if (!dataToCheck) return;

        // 載入 115 辦法資格規則 snapshot（無 hardcode 預設）
        const { fetchEligibilityRules } = await import('./app/actions/eligibilityRulesActions');
        const rules = await fetchEligibilityRules();

        // 婚姻狀態：form.type 已經是 '1'/'2'/'3'（與 DB / matrix 一致）
        const maritalStatus = (dataToCheck.type ?? '3') as '1' | '2' | '3';

        // 子女狀態由 hasChildren + underageChildrenCount 推導：
        //   無子女 → '3'；有未成年 → '1'；其餘 → '2' 已成年
        const hasUnderage = Number(dataToCheck.underageChildrenCount ?? 0) > 0;
        const childrenStatus = !dataToCheck.hasChildren
            ? '3'
            : hasUnderage ? '1' : '2';

        // 子類型：form 上的 subsidyType > 案件 DB 上的 subsidy_subtype > 預設 '2' 小康家庭
        const subsidyType = (
            dataToCheck.subsidyType
            ?? appDetail?.subsidySubtype
            ?? '2'
        ) as '1' | '2';

        const result = checkEligibility({
            subsidyType,
            age: Number(dataToCheck.age ?? 0),
            realEstateValue: Number(dataToCheck.realEstateValue ?? 0),
            maritalStatus,
            childrenStatus,
            annualIncome: Number(dataToCheck.annualIncome ?? 0),
            movableAssets: Number(dataToCheck.movableAssets ?? 0),
            deposit:       dataToCheck.econDeposit       != null ? Number(dataToCheck.econDeposit)       : undefined,
            monthlyIncome: dataToCheck.econMonthlyIncome != null ? Number(dataToCheck.econMonthlyIncome) : undefined,
        }, rules);

        setEligibilityCheck({ checked: true, eligible: result.isEligible, reasons: result.reasons, reasonCodes: result.reasonCodes });
    };

    const handleSaveQualification = async () => {
        if (!selectedAppId) return;
        // 雙保險：input 已即時 clamp 到 adminReviewApplyCap；這裡再擋一次以免被繞過
        if (adminReviewApplyCap > 0 && applyAmount > adminReviewApplyCap) {
            pushToast({ type: 'error', msg: `申請金額不可超過 NT$${adminReviewApplyCap.toLocaleString()} 元` });
            return;
        }
        setIsSavingQualification(true);
        try {
            // Use liveApplicantValues if available, otherwise fall back to DB-loaded values
            const v = liveApplicantValues ?? qualificationInitialValues;
            const maritalNew: '1' | '2' | '3' | null =
                (v?.type === '1' || v?.type === '2' || v?.type === '3') ? v.type : null;
            const result = await saveQualificationData(selectedAppId, {
                age:                    v?.age != null ? Number(v.age) : null,
                moveable_property:      v?.movableAssets != null ? Number(v.movableAssets) : null,
                immoveable_property:    v?.realEstateValue != null ? Number(v.realEstateValue) : null,
                annual_income:          v?.annualIncome != null ? Number(v.annualIncome) : null,
                marital_status:         maritalNew,
                has_children:           v?.hasChildren ?? null,
                underage_children_count: v?.hasChildren && v?.underageChildrenCount != null
                                            ? Number(v.underageChildrenCount) : null,
                adult_children_count:   v?.hasChildren && v?.adultChildrenCount != null
                                            ? Number(v.adultChildrenCount) : null,
                apply_amount:           applyAmount != null ? Number(applyAmount) : null,
                subsidy_subtype:        (v?.subsidyType === '1' || v?.subsidyType === '2') ? v.subsidyType : null,
                econ_deposit:           v?.econDeposit       != null ? Number(v.econDeposit)       : null,
                econ_monthly_income:    v?.econMonthlyIncome != null ? Number(v.econMonthlyIncome) : null,
            });
            if (result.success) {
                pushToast({ type: 'success', msg: '資格預審資料已儲存' });
                await loadAppDetail(selectedAppId, true);
                setDocumentReloadKey(key => key + 1);
            } else {
                pushToast({ type: 'error', msg: result.error ?? '儲存失敗，請稍後再試' });
            }
        } catch {
            pushToast({ type: 'error', msg: '儲存失敗，請稍後再試' });
        } finally {
            setIsSavingQualification(false);
        }
    };

    /**
     * Advance the TRUE workflow stage by one step with DB write.
     */
    const handleAdvanceStage = async () => {
        if (!selectedAppId) return;

        // ── 核銷結案 ──────────────────────────────────────────────────
        // approved_amount 由 server 端維護（chairman 第三審 / 派組多數決），
        // 不在 client 端傳值，避免操作者的個人金額（如 admin_01 自己董事意見）覆寫正確值。
        if (stage === 'reimbursement') {
            await closeCase(selectedAppId, loggedInUser?.id ?? null, null);
            await loadAppDetail(selectedAppId, false);
            return;
        }

        if (currentStageIndex < STAGES.length - 1) {
            const next = STAGES[currentStageIndex + 1];

            // 從行政初審推進時，將資格預審資料寫入 applications
            if (stage === 'admin_review' && liveApplicantValues) {
                const v = liveApplicantValues;
                await saveQualificationData(selectedAppId, {
                    age:                    v.age != null ? Number(v.age) : null,
                    moveable_property:      v.movableAssets != null ? Number(v.movableAssets) : null,
                    immoveable_property:    v.realEstateValue != null ? Number(v.realEstateValue) : null,
                    annual_income:          v.annualIncome != null ? Number(v.annualIncome) : null,
                    marital_status:         (v.type === '1' || v.type === '2' || v.type === '3') ? v.type : null,
                    has_children:           v.hasChildren ?? null,
                    underage_children_count: v.hasChildren && v.underageChildrenCount != null
                                                ? Number(v.underageChildrenCount) : null,
                    adult_children_count:   v.hasChildren && v.adultChildrenCount != null
                                                ? Number(v.adultChildrenCount) : null,
                    apply_amount:           applyAmount != null ? Number(applyAmount) : null,
                    subsidy_subtype:        (v.subsidyType === '1' || v.subsidyType === '2') ? v.subsidyType : null,
                    econ_deposit:           v.econDeposit       != null ? Number(v.econDeposit)       : null,
                    econ_monthly_income:    v.econMonthlyIncome != null ? Number(v.econMonthlyIncome) : null,
                });
            }

            // 董事審核：通過 → 前進核銷 (status='3')；明確不通過 → 結案 (status='2')；null → 阻擋
            //
            // 注意：此處不再呼叫 saveBoardReviewData 覆寫 applications.approved_amount。
            //   原因：當操作者是派組成員/admin（如 admin_01）時，前端的 boardApprovedAmount 是
            //         他「個人」的金額（350000），不是經 chairman 第三審裁決的金額（30006）。
            //         若用個人金額覆寫，會把 server 端 recomputeApplicationApprovedAmount 算好的
            //         正確值（30006）洗掉。
            //   現在的權威來源：board_review_signatures.member_amount 觸發 server 端
            //         recomputeApplicationApprovedAmount → applications.approved_amount。
            if (stage === 'board_review') {
                if (boardApproved === null) {
                    pushToast({ type: 'error', msg: '尚未取得董事決議，請等待簽章彙整完成或重新整理頁面' });
                    return;
                }
                if (boardApproved === false) {
                    await closeCaseRejected(selectedAppId, boardOpinion, loggedInUser?.id ?? null);
                    await loadAppDetail(selectedAppId, false);
                    setViewedStage('board_review');
                    return;
                }
                // boardApproved === true：直接推進；approved_amount 已由 server 端維護
            }

            const advanceRes = await advanceWorkflowStage(
                selectedAppId,
                stage,
                next,
                loggedInUser?.id ?? null,
            );
            if (!advanceRes.success) {
                // 推進失敗（例：簽章已失效、權限不足等）— 不切視野、刷一次資料、跳出錯誤 toast
                pushToast({ type: 'error', msg: advanceRes.error ?? '推進階段失敗' });
                await loadAppDetail(selectedAppId, true);
                return;
            }
            await loadAppDetail(selectedAppId, true);
            setViewedStage(next);
        }
    };

    /**
     * Retreat the TRUE workflow stage by one step (with confirmation) with DB write.
     */
    const handleRetreatStage = async () => {
        if (currentStageIndex === 0) return;
        const prev = STAGES[currentStageIndex - 1];
        setRetreatReason('');
        setRetreatModal({ toStage: prev, label: STAGE_LABEL_MAP[prev] });
    };

    const confirmRetreatStage = async () => {
        if (!retreatModal || !selectedAppId) return;
        const trimmed = retreatReason.trim();
        if (trimmed.length < 3) {
            pushToast({ type: 'error', msg: '退回原因至少 3 字' });
            return;
        }
        setRetreatBusy(true);
        const res = await retreatWorkflowStage(
            selectedAppId,
            retreatModal.toStage,
            loggedInUser?.id ?? null,
            trimmed,
        );
        setRetreatBusy(false);
        if (!res.success) {
            pushToast({ type: 'error', msg: res.error ?? '退回失敗' });
            return;
        }
        pushToast({ type: 'success', msg: `已退回至「${retreatModal.label}」` });
        const nextViewedStage = retreatModal.toStage;
        setRetreatModal(null);
        setRetreatReason('');
        await loadAppDetail(selectedAppId, true);
        setViewedStage(nextViewedStage);
    };

    const handleSupervisorRejectForBoard = async () => {
        if (!selectedAppId || !loggedInUser) return;
        if (supRejectNote.trim().length < 3) {
            pushToast({ type: 'error', msg: '不通過原因至少 3 字' });
            return;
        }
        setSupBusy(true);
        const res = await supervisorReviewForBoard(selectedAppId, false, supRejectNote, loggedInUser.id);
        setSupBusy(false);
        if (res.success) {
            pushToast({ type: 'success', msg: '已退件給個管' });
            setShowSupRejectForm(false);
            setSupRejectNote('');
            await loadAppDetail(selectedAppId, true);
        } else {
            pushToast({ type: 'error', msg: res.error ?? '退件失敗' });
        }
    };

    // Read-only when browsing a past step OR when case is closed
    const isCaseClosed = appDetail?.status === '2' || appDetail?.status === '4';
    const contentReadOnly = isViewingPastStep || !!isCaseClosed;

    // 志工視野：當前操作角色為 volunteer 時，僅顯示頂部基本資料 + 家訪紀錄；
    // 隱藏個管師案件說明、董事審核、核銷審核、聯絡紀錄
    const isVolunteerView = role === 'volunteer';
    // 社工視野：social_worker 不能切換到行政初審（會看到資格預審/財務資料等）
    const isSocialWorkerView = role === 'social_worker';
    // 受限視野統一旗標 — 不可點 admin_review 步驟
    const restrictAdminReviewStep = isVolunteerView || isSocialWorkerView;

    const renderStageContent = () => {
        switch (displayedStage) {
            case 'admin_review':
                // 受限角色（volunteer / social_worker）不可檢視行政初審內容
                if (restrictAdminReviewStep) {
                    return (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-sm text-slate-500 text-center">
                            行政初審資料僅限相關角色檢視。
                        </div>
                    );
                }
                return (
                    <div className="space-y-6 relative">
                        {/* ── 上半部：資格預審 ── */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <ClipboardList className="w-5 h-5 text-blue-600" />
                                資格預審
                            </h3>
                            {/* 申請金額欄位 — 行政初審可由 officer 修改；超過子類型可申請上限會即時 clamp */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">申請金額</label>
                                <div className="relative max-w-xs">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={applyAmount || ''}
                                        onChange={e => {
                                            const raw = e.target.value.replace(/\D/g, '');
                                            let v = raw === '' ? 0 : Number(raw);
                                            // 即時 clamp：超過子類型可申請上限直接修正
                                            if (adminReviewApplyCap > 0 && v > adminReviewApplyCap) {
                                                v = adminReviewApplyCap;
                                            }
                                            setApplyAmount(v);
                                            if (adminReviewApplyCap > 0 && v >= adminReviewApplyCap && raw !== '') {
                                                setApplyAmountError(`上限為 NT$${adminReviewApplyCap.toLocaleString()} 元`);
                                            } else {
                                                setApplyAmountError('');
                                            }
                                        }}
                                        disabled={contentReadOnly || appDetail?.status === '2' || appDetail?.status === '4'}
                                        className={clsx(
                                            'block w-full rounded-md shadow-sm p-2 border pr-12',
                                            // 「上限為...」屬資訊提示，欄位不變紅
                                            applyAmountError && !applyAmountError.startsWith('上限為')
                                                ? 'border-red-400 focus:ring-red-300'
                                                : (contentReadOnly || appDetail?.status === '2' || appDetail?.status === '4')
                                                    ? 'bg-gray-50 text-gray-500 border-gray-200 cursor-not-allowed'
                                                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                                        )}
                                    />
                                    <span className="absolute right-3 top-2 text-gray-400 text-sm">元</span>
                                </div>
                                {applyAmountError && (
                                    applyAmountError.startsWith('上限為') ? (
                                        <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                                            {applyAmountError}
                                        </p>
                                    ) : (
                                        <p className="text-xs text-red-500 mt-1">{applyAmountError}</p>
                                    )
                                )}
                            </div>

                            <ApplicationForm
                                initialValues={qualificationInitialValues}
                                readOnly={contentReadOnly || (!hasPermission('board_member') && !hasPermission('admin') && (role === 'board_member' || role === 'accountant'))}
                                applicationType={appDetail?.applicationType}
                                onValidation={(_isValid, values) => {
                                    setLiveApplicantValues(values);
                                    // Clear eligibility result when form fields are changed
                                    setEligibilityCheck(prev =>
                                        prev.checked ? { checked: false, eligible: false, reasons: [], reasonCodes: [] } : prev
                                    );
                                }}
                            />
                            {!contentReadOnly && (
                                <div className="mt-6 border-t pt-4 flex items-center gap-3 flex-wrap">
                                    <button
                                        onClick={checkEligibilityAction}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition flex items-center gap-2"
                                    >
                                        <ShieldCheck className="w-4 h-4" />
                                        執行資格判定
                                    </button>
                                    <button
                                        onClick={handleSaveQualification}
                                        disabled={isSavingQualification}
                                        className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {isSavingQualification ? (
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Save className="w-4 h-4" />
                                        )}
                                        儲存
                                    </button>
                                </div>
                            )}
                            {/* 「未執行資格判定」提示只在案件實際還在行政初審且未結案時顯示；
                                已推進到後續階段或結案的案件，資格判定必已通過，再提示反而誤導 */}
                            {!eligibilityCheck.checked && stage === 'admin_review' && !isCaseClosed && (
                                <p className="mt-4 text-sm text-amber-600 flex items-center gap-1.5">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    未執行資格判定
                                </p>
                            )}
                            {eligibilityCheck.checked && (
                                <div className={clsx('mt-4 p-4 rounded-md', eligibilityCheck.eligible ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800')}>
                                    <p className="font-bold flex items-center gap-2">
                                        {eligibilityCheck.eligible ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                                        判定結果: {eligibilityCheck.eligible ? '符合資格' : '不符合資格'}
                                    </p>
                                    {!eligibilityCheck.eligible && (
                                        <ul className="list-disc list-inside mt-2 text-sm">
                                            {eligibilityCheck.reasons.map((r, i) => <li key={i}>{r}</li>)}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                        {/* ── 下半部：文件審核（申請類） ── */}
                        {lastDocs.length > 0 && stage === 'admin_review' && (
                            <div className="flex items-center gap-3 mb-2">
                                <button
                                    onClick={handleCopyLastDocs}
                                    disabled={copyingLastDocs}
                                    className="flex items-center gap-2 bg-white border border-gray-300 text-slate-700 px-3 py-1.5 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 transition shadow-sm"
                                >
                                    {copyingLastDocs ? (
                                        <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                    ) : null}
                                    使用上次檔案（身分證、個資同意書）
                                </button>
                                {lastDocs[0]?.sourceCaseNumber && (
                                    <span className="text-xs text-gray-500">來源案號：{lastDocs[0].sourceCaseNumber}</span>
                                )}
                            </div>
                        )}
                        <ReviewList
                            applicationId={selectedAppId!}
                            caseNumber={appDetail?.caseNumber ?? ''}
                            phase="apply"
                            applyAt={appDetail?.applyAt}
                            pendingThresholdDays={pendingThresholdDays}
                            userId={loggedInUser?.id}
                            reloadKey={documentReloadKey}
                            caseClosed={!!isCaseClosed}
                            canReview={!isCaseClosed && (hasPermission('case_officer') || hasPermission('admin') || hasPermission('supervisor'))}
                            readOnly={contentReadOnly || (!hasPermission('case_officer') && !hasPermission('admin') && !hasPermission('supervisor'))}
                            onRefresh={() => {
                                if (selectedAppId) {
                                    fetchApplicationDocuments(selectedAppId).then(setDbDocs);
                                }
                            }}
                        />
                    </div>
                );

            case 'visit': {
                const skipped = !!appDetail?.homeVisitSkipped;
                const missingAssignee = !skipped && !appDetail?.homeVisitAssigneeId;
                const missingForm     = !appDetail?.homeVisitSaved; // homeVisitSaved 已涵蓋 visit_skipped 情況
                const missingSummary  = !(appDetail?.officerCaseSummary && appDetail.officerCaseSummary.trim());
                const boardRollbackReason = appDetail?.wfIsApproved === false && appDetail?.wfComments
                    ? appDetail.wfComments.trim()
                    : '';
                // 文件齊備檢查（與送主管閘門一致）：只擋 allow_supplement=false 的必備文件
                // 可延後補件（allow_supplement=true）的文件不在家訪階段擋，留到送董事前才一併檢查
                const visitMissingDocLabels = dbDocs
                    .filter(d => d.isRequired && !d.allowSupplement && d.phase === 'apply' && d.status !== '1')
                    .map(d => d.label);
                const visitChecklist: string[] = [];
                if (missingAssignee) visitChecklist.push('指派家訪人員');
                if (missingForm)     visitChecklist.push(skipped ? '勾選「免家訪」並填寫原因' : '完成家訪關懷紀錄表（所有欄位必填）');
                if (missingSummary)  visitChecklist.push('填寫個管師案件說明');
                if (visitMissingDocLabels.length > 0) {
                    visitChecklist.push(`完成必備文件審核：${visitMissingDocLabels.join('、')}`);
                }
                // 家訪指派只在「案件目前實際處於 visit 階段」且未結案時開放；
                // 一旦案件推進到 board_review 或之後，指派功能鎖死（純檢視）
                const visitStageActive = stage === 'visit' && !isCaseClosed;
                // 家訪指派 panel — 移到 HomeVisitForm 內、"本案不進行家訪" 勾選下方；
                // 勾選不家訪時由 HomeVisitForm 內部自動隱藏（不需 caller 判斷）
                const canAssignVisit = visitStageActive && (hasPermission('case_officer') || hasPermission('supervisor') || hasPermission('admin'));
                const assigneeNode = selectedAppId && canAssignVisit
                    ? (
                        <HomeVisitAssigneePanel
                            applicationId={selectedAppId}
                            operatorUserId={loggedInUser?.id ?? ''}
                            currentAssigneeId={appDetail?.homeVisitAssigneeId ?? null}
                            currentAssigneeName={appDetail?.homeVisitAssigneeName ?? null}
                            onChanged={() => loadAppDetail(selectedAppId, true)}
                        />
                    )
                    : (selectedAppId && appDetail?.homeVisitAssigneeName
                        ? (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                                <span className="font-semibold">家訪指派人員：</span>{appDetail.homeVisitAssigneeName}
                                {!visitStageActive && (
                                    <span className="text-xs text-blue-500 ml-2">（已離開家訪階段，無法重新指派）</span>
                                )}
                            </div>
                        )
                        : null);

                return (
                    <div className="space-y-6 relative">
                        {boardRollbackReason && (
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                <div className="space-y-1">
                                    <p className="font-semibold">董事審核退回家庭訪視，請依退回原因修正。</p>
                                    <p>
                                        <span className="font-semibold">退回原因：</span>
                                        {boardRollbackReason}
                                    </p>
                                </div>
                            </div>
                        )}
                        {/* 聯絡紀錄速查（讓家訪人員可看到該申請人歷次來電/關懷） */}
                        {!isVolunteerView && appDetail?.applicantId && loggedInUser && (
                            <ContactRecordsQuickView
                                applicantUserId={appDetail.applicantId}
                                applicantName={appDetail.applicantName ?? ''}
                                operatorUserId={loggedInUser.id}
                                onChanged={() => loadAppDetail(selectedAppId!, true)}
                            />
                        )}
                        <HomeVisitForm
                            applicationId={selectedAppId!}
                            visitorUserId={loggedInUser?.id}
                            readOnly={contentReadOnly || (!hasPermission('volunteer') && !hasPermission('case_officer') && !hasPermission('admin'))}
                            assigneeSlot={assigneeNode}
                        />
                        {/* #17 個管師案件說明：家訪階段可由 case_officer/supervisor/admin 編輯 — 志工視野隱藏 */}
                        {!isVolunteerView && selectedAppId && loggedInUser && (
                            <OfficerCaseSummaryPanel
                                applicationId={selectedAppId}
                                operatorUserId={loggedInUser.id}
                                initialValue={appDetail?.officerCaseSummary ?? null}
                                editable={!contentReadOnly && isAssignedOfficer && hasPermission('case_officer')}
                                onSaved={() => loadAppDetail(selectedAppId, true)}
                            />
                        )}
                        {/* 主管審核狀態提示 — 已送主管、等待主管處理中（反灰提醒） */}
                        {!isCaseClosed && appDetail?.supervisorReviewPending && (
                            <div className="bg-slate-100 border border-slate-300 rounded-lg p-3 text-sm text-slate-600 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-500" />
                                <div>
                                    <p className="font-semibold">案件已送主管審核，等待主管處理中…</p>
                                    <p className="text-xs text-slate-500 mt-0.5">主管通過後案件會自動推進到董事審核；如主管退件會通知個管修正。</p>
                                </div>
                            </div>
                        )}
                        {/* 家庭訪視階段必填提醒 — 移到案件說明下方；已送主管時不顯示綠色「可送主管」提示 */}
                        {!isCaseClosed && visitChecklist.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                                <p className="font-semibold mb-1">本階段尚需完成以下項目才能進入下一階段：</p>
                                <ul className="list-disc list-inside text-xs space-y-0.5">
                                    {visitChecklist.map(item => <li key={item}>{item}</li>)}
                                </ul>
                            </div>
                        )}
                        {!isCaseClosed && visitChecklist.length === 0 && !appDetail?.supervisorReviewPending && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
                                <p className="font-semibold">本階段所有必填項目已完成，可進入下一階段。</p>
                            </div>
                        )}
                    </div>
                );
            }

            case 'board_review': {
                // 志工視野：完全隱藏董事審核內容
                if (isVolunteerView) {
                    return (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-sm text-slate-500 text-center">
                            董事審核資料僅限相關角色檢視。
                        </div>
                    );
                }
                // 共筆模式權限：僅派組成員 OR chairman OR admin 可編輯（取代原本僅看角色的判斷）
                const boardReadOnly = contentReadOnly || !canEditBoardReview;
                const dbApplyAmount = appDetail?.applyAmount ?? null;
                const activeMember = visibleBoardMembers.find(m => m.signerUserId === activeMemberTab);
                const isOwnTab = !!(activeMember && loggedInUser && activeMember.signerUserId === loggedInUser.id);
                // 唯讀條件：自己 tab 沿用 boardReadOnly；非自己 tab 全部 disable
                const formReadOnly = boardReadOnly || !isOwnTab;
                // 顯示值：自己 tab 用 App state；非自己用該成員 persisted 值
                const displayApproved = isOwnTab ? boardApproved : (activeMember?.memberApproved ?? null);
                const displayAmount   = isOwnTab ? boardApprovedAmount : (activeMember?.memberAmount ?? 0);
                const displayOpinion  = isOwnTab ? boardOpinion : (activeMember?.memberComments ?? '');
                return (
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 relative space-y-6">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Gavel className="w-5 h-5 text-purple-600" />
                            董事審核
                        </h3>

                        {/* Member Tab strip */}
                        {visibleBoardMembers.length === 0 ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                                您不在本案派組成員中，無法檢視個別審核意見。
                            </div>
                        ) : (
                            <>
                                <div className="border-b border-slate-200 -mb-px">
                                    <div className="flex flex-wrap gap-1">
                                        {visibleBoardMembers.map(m => {
                                            const isActive = m.signerUserId === activeMemberTab;
                                            const isSelf = !!(loggedInUser && m.signerUserId === loggedInUser.id);
                                            const sigBadge =
                                                m.status === 'signed'  ? <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">已簽</span> :
                                                m.status === 'invalid' ? <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">已失效</span> :
                                                                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">未簽</span>;
                                            return (
                                                <button
                                                    key={m.signerUserId}
                                                    type="button"
                                                    onClick={() => setActiveMemberTab(m.signerUserId)}
                                                    className={clsx(
                                                        'px-4 py-2 text-sm font-medium border-b-2 transition',
                                                        isActive
                                                            ? 'border-purple-600 text-purple-700'
                                                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                                    )}
                                                >
                                                    {m.name}
                                                    {isSelf && <span className="ml-1 text-xs text-blue-600">（您）</span>}
                                                    {sigBadge}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* 不論自己/他人 tab 都用同一份表單樣式；非自己 tab 全部 disable */}
                        {activeMember && (<>

                        {/* 1. 審核結果 toggle（pt-2 上方留白避免 label 緊貼 tab） */}
                        <div className="pt-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">審核結果</label>
                            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                                <button
                                    type="button"
                                    disabled={formReadOnly}
                                    onClick={() => { setBoardApproved(true); }}
                                    className={clsx(
                                        'px-5 py-2 text-sm font-medium transition',
                                        displayApproved === true
                                            ? 'bg-green-600 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-50',
                                        formReadOnly && 'cursor-not-allowed opacity-60'
                                    )}
                                >
                                    審核通過
                                </button>
                                <button
                                    type="button"
                                    disabled={formReadOnly}
                                    onClick={() => { setBoardApproved(false); setBoardApprovedAmount(0); }}
                                    className={clsx(
                                        'px-5 py-2 text-sm font-medium border-l border-gray-200 transition',
                                        displayApproved === false
                                            ? 'bg-red-600 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-50',
                                        formReadOnly && 'cursor-not-allowed opacity-60'
                                    )}
                                >
                                    審核未通過
                                </button>
                            </div>
                        </div>

                        {/* 2. 申請金額 (read-only from DB) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">申請金額</label>
                            <div className={clsx(
                                'w-full max-w-xs border rounded-md px-3 py-2 text-sm',
                                formReadOnly
                                    ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                                    : 'bg-gray-50 text-gray-700 border-gray-200'
                            )}>
                                {dbApplyAmount != null
                                    ? `NT$ ${dbApplyAmount.toLocaleString()}`
                                    : <span className="text-gray-400">—</span>}
                            </div>
                        </div>

                        {/* 3. 通過金額 (editable only when approved) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">通過金額</label>
                            <div className="relative max-w-xs">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">NT$</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9,]*"
                                    maxLength={String(maxApplyAmount).length + Math.floor(String(maxApplyAmount).length / 3)}
                                    value={displayApproved && displayAmount > 0 ? displayAmount.toLocaleString() : ''}
                                    onChange={(e) => {
                                        const raw = e.target.value.replace(/\D/g, '');
                                        const v = Number(raw);
                                        setBoardApprovedAmount(v);
                                        setApplyAmountError(v > maxApplyAmount ? `通過金額不可超過 ${maxApplyAmount.toLocaleString()} 元` : '');
                                    }}
                                    disabled={formReadOnly || !displayApproved}
                                    className={clsx(
                                        'w-full border rounded-md pl-10 pr-3 py-2 text-sm',
                                        (applyAmountError && isOwnTab && displayApproved)
                                            ? 'border-red-400 focus:ring-red-300'
                                            : (!displayApproved || formReadOnly)
                                                ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                                                : 'border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent'
                                    )}
                                />
                            </div>
                            {applyAmountError && isOwnTab && displayApproved && (
                                <p className="text-xs text-red-500 mt-1">{applyAmountError}</p>
                            )}
                        </div>

                        {/* 4. 審核意見（最少字數依 system_settings.board_opinion_min_chars；0 = 不限制） */}
                        {(() => {
                            const opinionTooShort = boardOpinionMinChars > 0 && displayOpinion.length < boardOpinionMinChars && isOwnTab;
                            return (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        審核意見
                                        {boardOpinionMinChars > 0 && (
                                            <span className="text-gray-400 font-normal ml-1">(至少 {boardOpinionMinChars} 字)</span>
                                        )}
                                    </label>
                                    <textarea
                                        className={`w-full h-32 p-3 border rounded-md focus:ring-2 focus:border-transparent text-sm disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed ${
                                            opinionTooShort
                                                ? 'border-red-400 focus:ring-red-300 bg-red-50/40'
                                                : 'border-gray-300 focus:ring-purple-500'
                                        }`}
                                        placeholder="請輸入審核意見..."
                                        value={displayOpinion}
                                        onChange={(e) => setBoardOpinion(e.target.value)}
                                        disabled={formReadOnly}
                                    />
                                    {boardOpinionMinChars > 0 && isOwnTab && (
                                        <div className={`flex items-center justify-between mt-1 text-xs ${
                                            opinionTooShort ? 'text-red-600 font-medium' : 'text-gray-500'
                                        }`}>
                                            {opinionTooShort ? (
                                                <span>⚠️ 字數不足，還差 {boardOpinionMinChars - displayOpinion.length} 字才能儲存／簽章</span>
                                            ) : (
                                                <span className="text-emerald-600">✓ 字數已達標</span>
                                            )}
                                            <span>{displayOpinion.length} / {boardOpinionMinChars} 字</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {boardApproved === null && !boardReadOnly && isOwnTab && (
                            <p className="text-xs text-amber-600">請先選擇審核結果</p>
                        )}

                        {/* 共筆儲存按鈕 — 僅在自己 tab 顯示 */}
                        {isOwnTab && !boardReadOnly && (() => {
                            const opinionTooShort = boardOpinionMinChars > 0 && (boardOpinion ?? '').length < boardOpinionMinChars;
                            const saveDisabled = savingBoardDraft || !boardDirty || opinionTooShort;
                            const saveTitle = opinionTooShort
                                ? `審核意見尚需 ${boardOpinionMinChars - (boardOpinion ?? '').length} 字`
                                : (boardDirty ? '儲存當前編輯，讓同組成員看見' : '沒有變動');
                            return (
                            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                                <button
                                    type="button"
                                    disabled={saveDisabled}
                                    onClick={async () => {
                                        if (!selectedAppId || !loggedInUser) return;
                                        // 個人簽章若已存在會因 hash 改變而失效（per-member 模式只影響自己）
                                        if (myMemberRow?.status === 'signed') {
                                            const ok = window.confirm('修改會使您先前的簽章失效，確認繼續？');
                                            if (!ok) return;
                                        }
                                        setSavingBoardDraft(true);
                                        setBoardDraftMsg(null);
                                        const { saveMemberReviewOpinion } = await import('./app/actions/boardSignatureActions');
                                        const res = await saveMemberReviewOpinion(
                                            selectedAppId,
                                            loggedInUser.id,
                                            {
                                                approved: boardApproved,
                                                amount: boardApproved ? (boardApprovedAmount || 0) : null,
                                                comments: boardOpinion || null,
                                            },
                                        );
                                        setSavingBoardDraft(false);
                                        if (!res.success) {
                                            setBoardDraftMsg(res.error ?? '儲存失敗');
                                            return;
                                        }
                                        setBoardDraftMsg('已儲存個人審核意見');
                                        setBoardRefreshKey(k => k + 1);
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
                                    title={saveTitle}
                                >
                                    {savingBoardDraft ? '儲存中…' : '儲存'}
                                </button>
                                {opinionTooShort && (
                                    <span className="text-xs text-red-600 font-medium">⚠️ 審核意見字數不足，無法儲存</span>
                                )}
                                {!opinionTooShort && boardDirty && (
                                    <span className="text-xs text-amber-600">⚠️ 有未儲存的編輯，無法按「進入下一階段」</span>
                                )}
                                {boardDraftMsg && !boardDirty && (
                                    <span className="text-xs text-slate-500">{boardDraftMsg}</span>
                                )}
                            </div>
                            );
                        })()}

                        </>)}
                    </div>
                );
            }

            case 'reimbursement':
                // 志工視野：完全隱藏核銷審核內容
                if (isVolunteerView) {
                    return (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-sm text-slate-500 text-center">
                            核銷審核資料僅限相關角色檢視。
                        </div>
                    );
                }
                return (
                    <div className="space-y-6">
                        {/* 多層審核撥款 — admin / case_officer / supervisor / accountant / executive / chairman 皆可見
                            （結案後仍顯示供查閱簽核歷程；唯讀控制由 DisbursementPanel 內部依角色與 stage 自管） */}
                        {loggedInUser && selectedAppId && (
                            hasPermission('admin') || hasPermission('case_officer') || hasPermission('supervisor')
                            || hasPermission('accountant') || hasPermission('executive') || hasPermission('chairman' as Role)
                        ) && (
                            <DisbursementPanel
                                applicationId={selectedAppId}
                                applicantId={appDetail?.applicantId ?? undefined}
                                operatorUserId={loggedInUser.id}
                                operatorRoles={loggedInUser.roles as Role[]}
                                applicantPhone={appDetail?.applicantPhone ?? null}
                                applicantAddress={appDetail?.applicantAddress ?? null}
                                onCaseDataChanged={() => { if (selectedAppId) loadAppDetail(selectedAppId, true); }}
                                onCanCloseChange={setCanCloseCase}
                            />
                        )}
                        {/* 應備文件（核銷階段）— 移到撥款流程下方 */}
                        <ReviewList
                            applicationId={selectedAppId!}
                            caseNumber={appDetail?.caseNumber ?? ''}
                            phase="reimbursement"
                            applyAt={appDetail?.applyAt}
                            pendingThresholdDays={pendingThresholdDays}
                            userId={loggedInUser?.id}
                            reloadKey={documentReloadKey}
                            caseClosed={!!isCaseClosed}
                            canReview={!isCaseClosed && (hasPermission('accountant') || hasPermission('case_officer') || hasPermission('admin') || hasPermission('supervisor'))}
                            readOnly={contentReadOnly || (!hasPermission('accountant') && !hasPermission('case_officer') && !hasPermission('admin') && !hasPermission('supervisor'))}
                            onRefresh={() => {
                                if (selectedAppId) {
                                    fetchApplicationDocuments(selectedAppId).then(setDbDocs);
                                }
                            }}
                        />
                    </div>
                );

            default:
                return null;
        }
    };

    const handleCopyLastDocs = async () => {
        if (!selectedAppId || lastDocs.length === 0) return;
        setCopyingLastDocs(true);
        for (const doc of lastDocs) {
            await copyDocumentToApplication(
                selectedAppId,
                doc.docId,
                doc.fileUrl,
                doc.sourceCaseNumber,
                loggedInUser?.id
            );
        }
        setCopyingLastDocs(false);
        setLastDocs([]);
        // Reload documents
        if (selectedAppId) {
            fetchApplicationDocuments(selectedAppId).then(setDbDocs);
        }
    };

    const retreatLabel = currentStageIndex > 0 ? STAGE_LABEL_MAP[STAGES[currentStageIndex - 1]] : null;
    const advanceLabel = currentStageIndex < STAGES.length - 1 ? STAGE_LABEL_MAP[STAGES[currentStageIndex + 1]] : null;

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col font-sans text-slate-800">
            {/* Header */}
            <AppHeader
                username={loggedInUser.username}
                onGoHome={() => setView('home')}
                onLogout={handleLogout}
            />

            {/* Main Content */}
            <main className="flex-1 container mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col md:flex-row gap-6 md:gap-8 overflow-x-hidden">
                {/* Sidebar / Stepper */}
                <div className="w-full md:w-64 shrink-0 space-y-4">
                    <button
                        onClick={() => setView('history')}
                        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition font-medium"
                    >
                        <span className="text-base leading-none">←</span>
                        返回歷史紀錄
                    </button>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">申請流程</h4>
                        <div className="space-y-1 relative">
                            <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-gray-100 -z-10"></div>
                            {STAGES.map((s, idx) => {
                                const isCurrentTrue = s === stage;
                                const isViewing = s === displayedStage;
                                const isCompleted = idx < currentStageIndex;
                                const isFuture = idx > currentStageIndex;
                                // 受限角色（volunteer / social_worker）不可進入 admin_review / board_review / reimbursement
                                const restrictedForRole =
                                    (restrictAdminReviewStep && s === 'admin_review') ||
                                    (isVolunteerView && (s === 'board_review' || s === 'reimbursement'));
                                const disabled = isFuture || restrictedForRole;
                                return (
                                    <StepItem
                                        key={s}
                                        isCurrentTrue={isCurrentTrue}
                                        isViewing={isViewing}
                                        completed={isCompleted}
                                        isFuture={disabled}
                                        caseClosed={!!isCaseClosed}
                                        label={STAGE_LABEL_MAP[s]}
                                        icon={STAGE_ICON_MAP[s]}
                                        onClick={() => { if (!disabled) setViewedStage(s); }}
                                    />
                                );
                            })}
                        </div>

                        {/* 關懷紀錄按鈕 — 開啟唯讀 modal 顯示此案件的所有來電 / 關懷紀錄 */}
                        <button
                            type="button"
                            onClick={() => setShowCareRecordsModal(true)}
                            className="mt-4 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-sm font-medium rounded-lg transition"
                            title="檢視此案件相關的來電與關懷紀錄（唯讀）"
                        >
                            <Heart className="w-4 h-4" />
                            關懷紀錄
                        </button>

                        {/* 不通過結案按鈕 — 任何進行中階段（status='1' 審核中 + 非結案）皆可觸發 */}
                        {!isCaseClosed && appDetail?.status === '1' && (() => {
                            // 只有 admin / supervisor / 案件 officer 可以結案
                            const canClose = !!loggedInUser && (
                                (loggedInUser.roles as Role[]).includes('admin')
                                || (loggedInUser.roles as Role[]).includes('supervisor')
                                || String(loggedInUser.id) === String(appDetail.officerId ?? '')
                            );
                            if (!canClose) return null;
                            return (
                                <button
                                    type="button"
                                    onClick={() => {
                                        // 行政初審階段且資格判定不符 → 預帶入 reason codes
                                        const isAdminReview = stage === 'admin_review';
                                        const prefillCodes = (isAdminReview && eligibilityCheck.checked && !eligibilityCheck.eligible)
                                            ? eligibilityCheck.reasonCodes.map(rc => ({ code: rc.code as CloseReasonCode, value: rc.value }))
                                            : undefined;
                                        setCloseCaseModalProps({
                                            prefillCodes,
                                            titleSuffix: prefillCodes?.length ? '已自動帶入資格判定結果' : undefined,
                                        });
                                    }}
                                    className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-lg transition"
                                    title="任何階段都可中斷流程結案（不可逆）"
                                >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    不通過結案
                                </button>
                            );
                        })()}
                    </div>

                    {/* 主管雙閘門面板已整併到下方「Flow Controls」中（user feedback）：
                        - officer 在 visit 階段直接按【送主管審核】（取代原本 disabled 的「進入下一階段」）
                        - supervisor 在 visit 階段直接按【通過送董事】或【退件】 */}

                    {/* Notification block */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
                        <button
                            onClick={() => setShowNotifModal(true)}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                        >
                            <Send className="w-4 h-4" />
                            發送通知
                        </button>

                        {/* Notification log */}
                        {notifLogs.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">通知紀錄</p>
                                <div className="space-y-2 max-h-52 overflow-y-auto">
                                    {notifLogs.map(log => (
                                        <div key={log.id} className={clsx(
                                            'rounded-lg px-3 py-2 text-xs border',
                                            log.status === 'sent'
                                                ? 'bg-green-50 border-green-100'
                                                : 'bg-red-50 border-red-100'
                                        )}>
                                            <div className="flex items-center justify-between gap-1 mb-0.5">
                                                <span className={clsx(
                                                    'font-semibold',
                                                    log.status === 'sent' ? 'text-green-700' : 'text-red-700'
                                                )}>
                                                    {log.status === 'sent' ? '✓ 已發送' : '✗ 失敗'}
                                                </span>
                                                <span className="text-slate-400 shrink-0">
                                                    {log.sent_at?.slice(0, 16).replace('T', ' ')}
                                                </span>
                                            </div>
                                            {log.subject && (
                                                <p className="text-slate-600 truncate">{log.subject}</p>
                                            )}
                                            <p className="text-slate-400">
                                                收件人：{log.recipients.map(r => r.name).join('、')}
                                            </p>
                                            {log.sender_name && (
                                                <p className="text-slate-400">發送者：{log.sender_name}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 space-y-6 overflow-hidden">
                    <Dashboard
                        applicantName={personName}
                        applicantIdNumber={appDetail?.applicantIdNumber ?? null}
                        dbAnnualIncome={appDetail?.annualIncome}
                        applyAmount={appDetail?.applyAmount ?? null}
                        approvedAmount={appDetail?.approvedAmount ?? null}
                        applicationType={appDetail?.applicationType}
                        subsidySubtype={appDetail?.subsidySubtype ?? null}
                        totalApprovedAmount={appDetail?.totalApprovedAmount}
                        totalApprovedSubtype1={appDetail?.totalApprovedSubtype1}
                        totalApprovedSubtype2={appDetail?.totalApprovedSubtype2}
                        subtypeMaxAmounts={subtypeMaxAmounts}
                    />

                    {/* 案件來源與轉介單位 */}
                    {appDetail && (() => {
                        const canEditBasics =
                            appDetail.status === '1' &&
                            appDetail.stage === 'admin_review' &&
                            !!loggedInUser &&
                            (
                                String(loggedInUser.id) === String(appDetail.officerId ?? '')
                                || (loggedInUser.roles as Role[]).includes('admin')
                            );
                        return (
                            <div className="bg-white rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 space-y-2">
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                                    <span>
                                        <span className="font-semibold text-slate-600">出生年月日：</span>
                                        {appDetail.applicantDob
                                            ? <span className="text-slate-800">{appDetail.applicantDob}</span>
                                            : <span className="text-slate-400 italic">（未填）</span>}
                                    </span>
                                    <span>
                                        <span className="font-semibold text-slate-600">癌別：</span>
                                        {appDetail.cancerType
                                            ? <span className="text-slate-800">{appDetail.cancerType}</span>
                                            : <span className="text-slate-400 italic">（未填）</span>}
                                    </span>
                                    <span>
                                        <span className="font-semibold text-slate-600">期數：</span>
                                        {appDetail.cancerStage
                                            ? <span className="text-slate-800">{appDetail.cancerStage}</span>
                                            : <span className="text-slate-400 italic">（未填）</span>}
                                    </span>
                                    <span>
                                        <span className="font-semibold text-slate-600">申請形式：</span>
                                        {appDetail.applicationForm === 'P' ? <span className="text-slate-800">紙本</span>
                                            : appDetail.applicationForm === 'E' ? <span className="text-slate-800">電子郵件</span>
                                            : <span className="text-slate-400 italic">（未填）</span>}
                                    </span>
                                    <span>
                                        <span className="font-semibold text-slate-600">治療階段：</span>
                                        {appDetail.treatmentPhase === 'B' ? <span className="text-slate-800">治療前</span>
                                            : appDetail.treatmentPhase === 'A' ? <span className="text-slate-800">治療後</span>
                                            : appDetail.treatmentPhase === 'X' ? <span className="text-slate-800">治療前後</span>
                                            : <span className="text-slate-400 italic">（未填）</span>}
                                    </span>
                                    <span>
                                        <span className="font-semibold text-slate-600">案件來源：</span>
                                        {appDetail.applicationWay === '2' ? '轉介' : '自提'}
                                    </span>
                                    <span>
                                        <span className="font-semibold text-slate-600">聯絡電話：</span>
                                        {appDetail.applicantPhone
                                            ? <a href={`tel:${appDetail.applicantPhone.replace(/[^0-9+]/g, '')}`}
                                                 className="text-blue-600 hover:underline">{appDetail.applicantPhone}</a>
                                            : <span className="text-slate-400 italic">（未填）</span>}
                                    </span>
                                    {appDetail.applicationWay === '2' && (
                                        <span>
                                            <span className="font-semibold text-slate-600">轉介單位：</span>
                                            {appDetail.referralUnitName
                                                ? appDetail.referralUnitName
                                                : <span className="text-slate-400 italic">（未填寫）</span>}
                                        </span>
                                    )}
                                    {canEditBasics && (
                                        <button
                                            type="button"
                                            onClick={() => setShowEditBasicsModal(true)}
                                            className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition cursor-pointer"
                                        >
                                            編輯案件基本資訊
                                        </button>
                                    )}
                                </div>
                                {appDetail.applicationWay === '2' && (
                                    appDetail.referralContactName || appDetail.referralContactTitle || appDetail.referralContactPhone
                                ) && (
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 border-t border-slate-100 pt-2">
                                        <span className="font-semibold text-slate-500">轉介承辦人：</span>
                                        {appDetail.referralContactName && <span>{appDetail.referralContactName}</span>}
                                        {appDetail.referralContactTitle && <span className="text-slate-400">／{appDetail.referralContactTitle}</span>}
                                        {appDetail.referralContactPhone && (
                                            <a href={`tel:${appDetail.referralContactPhone.replace(/[^0-9+]/g, '')}`}
                                                className="text-blue-600 hover:underline">
                                                {appDetail.referralContactPhone}
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {appDetail?.stage === 'visit' && appDetail.supervisorApprovedForBoard === false && (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                <div className="space-y-1">
                                    <p className="font-semibold">主管審閱未通過，請修正後重送主管。</p>
                                    <p>
                                        <span className="font-semibold">不通過原因：</span>
                                        {appDetail.supervisorReviewNote || '（未填寫）'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 結案 banner — 只在「審核未通過結案」時提示；核銷完成屬正常結束，不再贅述 */}
                    {appDetail?.status === '2' && (
                        <div className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium border bg-red-50 border-red-200 text-red-700">
                            <span className="text-base">🔴</span>
                            <span>此案件已結案（審核未通過），不可再繼續流程。</span>
                            {/* 復原結案按鈕 — 僅 admin/supervisor/chairman 可見 */}
                            {loggedInUser && selectedAppId && (
                                userRolesList.includes('admin') ||
                                userRolesList.includes('supervisor') ||
                                userRolesList.includes('chairman' as Role)
                            ) && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!confirm('確定要復原此案件嗎？\n\n復原後案件會回到「審核中」狀態（status=1），停留在目前的階段（通常是董事審核），結案原因紀錄會被清除，可重新處理。')) return;
                                        const res = await reopenRejectedCase(selectedAppId, loggedInUser.id);
                                        if (res.success) {
                                            pushToast({ type: 'success', msg: '已復原結案，案件回到審核中' });
                                            await loadAppDetail(selectedAppId, true);
                                        } else {
                                            pushToast({ type: 'error', msg: res.error ?? '復原失敗' });
                                        }
                                    }}
                                    className="ml-auto inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-red-100 border border-red-300 text-red-700 text-xs font-medium rounded transition"
                                    title="復原結案 → 案件回到「審核中」，可重新處理"
                                >
                                    復原結案
                                </button>
                            )}
                        </div>
                    )}

                    {/* Read-only banner */}
                    {isViewingPastStep && (
                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-700">
                            <Eye className="w-4 h-4 shrink-0" />
                            <span>
                                您正在查看 <strong>{STAGE_LABEL_MAP[displayedStage]}</strong> 的資料（唯讀）。
                                目前實際進度為 <strong>{STAGE_LABEL_MAP[stage]}</strong>。
                            </span>
                            <button
                                onClick={() => setViewedStage(stage)}
                                className="ml-auto text-amber-600 underline hover:text-amber-800 font-medium whitespace-nowrap"
                            >
                                返回目前步驟
                            </button>
                        </div>
                    )}

                    {/* Pending-doc reminder counter + threshold banner */}
                    {reminderStatus && appDetail && appDetail.status !== '2' && appDetail.status !== '4' && (
                        <>
                            <div className="text-xs text-slate-500 px-1">
                                未補件提醒已發送 <strong className="text-slate-700">{reminderStatus.count}</strong> / {reminderStatus.threshold} 次
                                {reminderStatus.lastReminderAt && (
                                    <span className="ml-2 text-slate-400">最近一次：{new Date(reminderStatus.lastReminderAt).toLocaleDateString('zh-TW')}</span>
                                )}
                            </div>
                            {reminderStatus.count >= reminderStatus.threshold && (
                                <div className="flex items-center gap-3 bg-red-50 border border-red-300 rounded-lg px-4 py-3">
                                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                                    <div className="flex-1 text-sm text-red-800">
                                        <strong>建議以不通過結案</strong>
                                        <span className="ml-2 text-red-700">
                                            本案件已發送 {reminderStatus.count} 次未補件提醒（門檻 {reminderStatus.threshold} 次），仍未補齊文件。
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setCloseCaseModalProps({
                                            prefillCodes: [{ code: '98' as CloseReasonCode }],
                                            prefillNote: `已發送 ${reminderStatus?.count ?? 0} 次未補件提醒`,
                                            titleSuffix: '補件超時結案',
                                        })}
                                        className="shrink-0 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition cursor-pointer"
                                    >
                                        立即結案
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {/* 董事審核階段：派組資訊卡片（純顯示） + 重新指派（chairman/admin）。
                        簽章面板移到審核意見表（StageContainer）下方，避免使用者填意見時被簽章區干擾。 */}
                    {!isVolunteerView && appDetail && appDetail.stage === 'board_review' && appDetail.status === '1' && loggedInUser && selectedAppId && (
                        <>
                            {/* #17 案件說明（董事審核階段：所有人皆唯讀，編輯改在家訪階段）
                                user feedback #17：在董事審核頁要視覺強調，董事一進來就看到要參考 */}
                            <OfficerCaseSummaryPanel
                                applicationId={selectedAppId}
                                operatorUserId={loggedInUser.id}
                                initialValue={appDetail.officerCaseSummary ?? null}
                                editable={false}
                                emphasize={true}
                                onSaved={() => loadAppDetail(selectedAppId, true)}
                            />
                            <BoardVoteCard applicationId={selectedAppId} refreshKey={boardRefreshKey} />
                            {isAdminOrChairman && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!showAssignDropdown) {
                                                const res = await fetchActiveBoardGroups();
                                                if (res.success && res.data) setActiveBoardGroups(res.data);
                                            }
                                            setShowAssignDropdown(v => !v);
                                        }}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100 transition cursor-pointer"
                                    >
                                        指派 / 重新指派組別
                                    </button>
                                    {showAssignDropdown && (
                                        <div className="inline-flex items-center gap-2">
                                            <select
                                                onChange={async (e) => {
                                                    const gid = e.target.value;
                                                    if (!gid) return;
                                                    setAssignBusy(true);
                                                    const res = await assignCaseToBoardGroup(selectedAppId, gid, loggedInUser.id, 'manual');
                                                    setAssignBusy(false);
                                                    if (!res.success) {
                                                        pushToast({ type: 'error', msg: res.error ?? '派案失敗' });
                                                        return;
                                                    }
                                                    pushToast({ type: 'success', msg: res.data?.reassigned ? '重新指派成功' : '指派成功' });
                                                    setShowAssignDropdown(false);
                                                    // Refresh group card + signature panel + applicant's own membership check
                                                    setBoardRefreshKey(k => k + 1);
                                                    await Promise.all([
                                                        loadAppDetail(selectedAppId, true),
                                                        loggedInUser ? isUserInAssignedGroupForCase(selectedAppId, loggedInUser.id).then(r => setIsAssignedGroupMember(!!r.data)) : Promise.resolve(),
                                                    ]);
                                                }}
                                                defaultValue=""
                                                disabled={assignBusy}
                                                className="border border-slate-300 rounded-lg px-2 py-1 text-sm"
                                            >
                                                <option value="">── 選擇組別 ──</option>
                                                {activeBoardGroups.map(g => (
                                                    <option key={g.id} value={g.id}>
                                                        {g.name}（目前 {g.openCaseCount} 件，優先序 {g.priority}）
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    <StageContainer stageKey={displayedStage}>
                        {renderStageContent()}
                    </StageContainer>

                    {/* 董事簽章面板：移到審核意見表下方，讓使用者先填完意見/金額再簽章；志工視野隱藏 */}
                    {!isVolunteerView && appDetail && appDetail.stage === 'board_review' && appDetail.status === '1' && loggedInUser && selectedAppId && (
                        <BoardSignaturePanel
                            applicationId={selectedAppId}
                            currentUserId={loggedInUser.id}
                            refreshKey={boardRefreshKey}
                            onChange={handleSignatureStatusChange}
                        />
                    )}

                    {/* Flow Controls */}
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4">
                            {isViewingPastStep && (
                                <p className="text-xs text-amber-500">請先返回目前步驟再操作流程</p>
                            )}
                            <div className="flex gap-2 items-center">
                                {(() => {
                                    const canRetreatBoardToVisit =
                                        stage !== 'board_review'
                                        || hasPermission('board_member')
                                        || hasPermission('executive')
                                        || hasPermission('supervisor')
                                        || hasPermission('chairman');
                                    const retreatDisabled = currentStageIndex === 0 || isViewingPastStep || !!isCaseClosed || !canRetreatBoardToVisit;
                                    const retreatTitle = isCaseClosed ? '此案件已結案，不可退回'
                                        : isViewingPastStep ? '請先返回目前步驟再操作流程'
                                        : !canRetreatBoardToVisit ? '僅董事、執行長、主管或董事長可將董事審核退回家庭訪視'
                                        : currentStageIndex === 0 ? '已是第一個步驟'
                                        : `確認後退回至「${retreatLabel}」`;
                                    return (
                                        <button
                                            onClick={handleRetreatStage}
                                            disabled={retreatDisabled}
                                            title={retreatTitle}
                                            className="flex flex-col items-center bg-white border border-gray-300 text-slate-700 px-4 py-2 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition shadow-sm"
                                        >
                                            <span>退回上一階段</span>
                                            {retreatLabel && !isViewingPastStep && !isCaseClosed && currentStageIndex > 0 && (
                                                <span className="text-xs font-normal text-gray-400">→ {retreatLabel}</span>
                                            )}
                                        </button>
                                    );
                                })()}
                                {(() => {
                                    const isBoardReview  = stage === 'board_review';
                                    const isReimbursement = stage === 'reimbursement';
                                    const isVisit         = stage === 'visit';
                                    // 董事審核「未完成」閘門：
                                    //   - 派組成員本人的視角：必須選審核結果 + 達字數（會即時 disable 自己的「儲存草稿」按鈕）
                                    //   - 非派組成員（supervisor 推進）：字數守門已由 server 端 submitBoardSignature 強制
                                    //     此處只看 signaturesComplete（每位都簽且 hash 有效）；textarea 字數無意義
                                    const boardIncomplete = isBoardReview && isAssignedGroupMember && (
                                        boardApproved === null
                                        || (boardOpinionMinChars > 0 && boardOpinion.length < boardOpinionMinChars)
                                    );
                                    // 派組權限門檻（board_review 階段）：僅 supervisor / admin 可推進到核銷
                                    //   董事 / 董事長僅負責簽章意見，不可推進到核銷階段
                                    const boardPermBlocked = isBoardReview && !canAdvanceFromBoardReview;
                                    // Dirty-state guard: 未儲存的編輯阻擋推進
                                    const boardDirtyBlocked = isBoardReview && boardDirty;
                                    // Signature completeness gate: 全員簽完且 hash 有效才能推進
                                    const boardSignatureBlocked = isBoardReview && !signaturesComplete;
                                    // 核銷階段：必須累積撥款都已回收（canCloseCase）才能按結案
                                    const reimbursementBlocked = isReimbursement && !canCloseCase;
                                    // 家庭訪視階段守門：勾選「免家訪」時免指派、免家訪表；個管師案件說明仍必填
                                    const visitSkipped = !!appDetail?.homeVisitSkipped;
                                    const visitMissingAssignee = isVisit && !visitSkipped && !appDetail?.homeVisitAssigneeId;
                                    const visitMissingForm     = isVisit && !appDetail?.homeVisitSaved; // homeVisitSaved 已涵蓋 visit_skipped 情況
                                    const visitMissingSummary  = isVisit && !(appDetail?.officerCaseSummary && appDetail.officerCaseSummary.trim());
                                    const visitBlocked         = visitMissingAssignee || visitMissingForm || visitMissingSummary;
                                    // 主管審核閘門：只在「下一階段是 board_review」時觸發
                                    // = 當前位於 home_visit/visit 階段；admin_review → home_visit 不卡控
                                    const isAdminReview = stage === 'admin_review';
                                    const needsSupervisorForBoard = isVisit && appDetail?.supervisorApprovedForBoard !== true;
                                    const advanceDisabled = isCaseClosed || isViewingPastStep || boardIncomplete || boardPermBlocked || boardDirtyBlocked || boardSignatureBlocked || reimbursementBlocked || visitBlocked || needsSupervisorForBoard;

                                    // 按鈕文字
                                    const btnLabel =
                                        isReimbursement ? '結案' :
                                        isBoardReview && boardApproved === false ? '結案' :
                                        '進入下一階段';

                                    const btnClass =
                                        (isReimbursement || (isBoardReview && boardApproved === false))
                                            ? 'flex flex-col items-center bg-red-700 text-white px-4 py-2 rounded-md hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition shadow-sm'
                                            : 'flex flex-col items-center bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition shadow-sm';

                                    const visitMissingItems = [
                                        visitMissingAssignee && '尚未指派家訪人員',
                                        visitMissingForm     && '家訪關懷紀錄表尚未儲存或欄位不完整',
                                        visitMissingSummary  && '個管師案件說明尚未填寫',
                                    ].filter(Boolean) as string[];
                                    // 送主管審核閘門（與 server requestSupervisorReviewForBoard 一致）：
                                    //   1) apply phase is_required 文件 status='1'，但只擋 allow_supplement=false
                                    //      可延後補件的文件 (allow_supplement=true) 留到送董事前的 advance 閘門才擋
                                    //   2) 家訪階段：家訪表存 + 個管案件說明
                                    const missingRequiredDocLabels = dbDocs
                                        .filter(d => d.isRequired && !d.allowSupplement && d.phase === 'apply' && d.status !== '1')
                                        .map(d => d.label);
                                    const sendToSupBlockedItems = [
                                        ...(missingRequiredDocLabels.length > 0
                                            ? [`必備文件未上傳或未核過：${missingRequiredDocLabels.join('、')}`]
                                            : []),
                                        ...(isVisit ? visitMissingItems : []),
                                    ];
                                    const sendToSupBlocked = sendToSupBlockedItems.length > 0;
                                    const advanceTitle =
                                        isViewingPastStep ? '請先返回目前步驟再操作流程' :
                                        isCaseClosed ? '此案件已結案' :
                                        visitBlocked ? `家庭訪視階段尚未完成：${visitMissingItems.join('、')}` :
                                        needsSupervisorForBoard ? (
                                            appDetail?.supervisorApprovedForBoard === false
                                                ? `主管已退件：${appDetail.supervisorReviewNote ?? ''}`
                                                : '請先按【送主管審核】等主管通過後才能推進到董事審核'
                                        ) :
                                        boardPermBlocked ? '僅主管或系統管理員可推進到核銷階段' :
                                        boardDirtyBlocked ? '有未儲存的編輯，請先按「儲存」' :
                                        boardSignatureBlocked ? `尚有 ${signaturesMissing} 位組員未簽章（或簽章已因內容變動失效）` :
                                        boardIncomplete ? (boardOpinionMinChars > 0
                                            ? `請選擇審核結果並填寫至少 ${boardOpinionMinChars} 字審核意見`
                                            : '請選擇審核結果') :
                                        reimbursementBlocked ? '尚有撥款未完成回收紙本；累積回收金額需達核定金額才能結案' :
                                        isReimbursement ? '確認核銷完成並結案' :
                                        isBoardReview && boardApproved === false ? '確認董事審核未通過並結案' :
                                        `前進至「${advanceLabel}」`;

                                    // 主管雙閘門：取代「進入下一階段」按鈕，officer 直接按【送主管審核】、supervisor 按【通過/退件】
                                    // 樣式與「進入下一階段」按鈕一致（同高度、同寬度感、深色按鈕）
                                    if (needsSupervisorForBoard && !isVolunteerView && !isCaseClosed && !isViewingPastStep && selectedAppId && appDetail && loggedInUser) {
                                        const supState = appDetail.supervisorApprovedForBoard;
                                        const isOfficerHere = String(loggedInUser.id) === String(appDetail.officerId ?? '');
                                        const userRolesArr = loggedInUser.roles as string[];
                                        const isSupOrAdmin = userRolesArr.includes('admin') || userRolesArr.includes('supervisor');
                                        const sharedBtnClass = 'flex flex-col items-center bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition shadow-sm';
                                        const rejectBtnClass = 'flex flex-col items-center bg-red-700 text-white px-4 py-2 rounded-md hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition shadow-sm';

                                        const sendToSupervisor = async () => {
                                            setSupBusy(true);
                                            const res = await requestSupervisorReviewForBoard(selectedAppId, loggedInUser.id);
                                            setSupBusy(false);
                                            if (res.success) {
                                                pushToast({ type: 'success', msg: '已送主管審核' });
                                                await loadAppDetail(selectedAppId, true);
                                            } else pushToast({ type: 'error', msg: res.error ?? '送主管失敗' });
                                        };
                                        const supApprove = async () => {
                                            setSupBusy(true);
                                            const res = await supervisorReviewForBoard(selectedAppId, true, '', loggedInUser.id);
                                            setSupBusy(false);
                                            if (res.success) {
                                                pushToast({ type: 'success', msg: '主管已通過，案件已推進至董事審核' });
                                                await loadAppDetail(selectedAppId, true);
                                            } else pushToast({ type: 'error', msg: res.error ?? '通過失敗' });
                                        };
                                        // (a) 已退件 + officer → 修正後重送
                                        if (supState === false && isOfficerHere) {
                                            const resendTitle = sendToSupBlocked
                                                ? `尚未滿足送件條件：${sendToSupBlockedItems.join('；')}`
                                                : `主管已退件：${appDetail.supervisorReviewNote ?? ''}`;
                                            return (
                                                <button onClick={sendToSupervisor} disabled={supBusy || sendToSupBlocked} className={sharedBtnClass}
                                                    title={resendTitle}>
                                                    <span>修正後重送主管</span>
                                                    <span className="text-xs font-normal text-slate-400">→ 送主管審核</span>
                                                </button>
                                            );
                                        }
                                        // (b) 待審 + officer → 送主管（或已送主管等待中 → 反灰提示）
                                        if (supState !== true && isOfficerHere) {
                                            // 已送主管 → disabled 反灰按鈕，提示等待主管回覆
                                            if (appDetail.supervisorReviewPending) {
                                                return (
                                                    <button
                                                        disabled
                                                        className="flex flex-col items-center bg-slate-200 text-slate-500 px-4 py-2 rounded-md text-sm font-medium cursor-not-allowed"
                                                        title="案件已送主管審核，等待主管處理中"
                                                    >
                                                        <span>已送主管審核</span>
                                                        <span className="text-xs font-normal text-slate-400">→ 等待主管回覆</span>
                                                    </button>
                                                );
                                            }
                                            const sendTitle = sendToSupBlocked
                                                ? `尚未滿足送件條件：${sendToSupBlockedItems.join('；')}`
                                                : '送主管審核後等主管通過才能推進到董事審核';
                                            return (
                                                <button onClick={sendToSupervisor} disabled={supBusy || sendToSupBlocked} className={sharedBtnClass}
                                                    title={sendTitle}>
                                                    <span>送主管審核</span>
                                                    <span className="text-xs font-normal text-slate-400">
                                                        {sendToSupBlocked ? '→ 條件未滿足' : '→ 待主管通過'}
                                                    </span>
                                                </button>
                                            );
                                        }
                                        // (c) 待審 + supervisor/admin → 在家庭訪視階段內審閱：
                                        //     通過才推進到董事審核；退件則留在家庭訪視，讓 officer 修正後重送。
                                        if (supState !== true && isSupOrAdmin) {
                                            return (
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowSupRejectForm(true)}
                                                        disabled={supBusy}
                                                        className={rejectBtnClass}
                                                        title="填寫不通過原因後退件給個管；案件仍停留在家庭訪視階段"
                                                    >
                                                        <span>退件</span>
                                                        <span className="text-xs font-normal text-rose-100">→ 家庭訪視修正</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={supApprove}
                                                        disabled={supBusy}
                                                        className={sharedBtnClass}
                                                        title="主管確認可送董事審核"
                                                    >
                                                        <span>通過送董事</span>
                                                        <span className="text-xs font-normal text-slate-400">→ 董事審核</span>
                                                    </button>
                                                </div>
                                            );
                                        }
                                        // 其他角色看不到任何主管按鈕，但 needsSupervisorForBoard=true 會讓「進入下一階段」disabled
                                    }
                                    return (
                                        <button
                                            onClick={handleAdvanceStage}
                                            disabled={advanceDisabled}
                                            title={advanceTitle}
                                            className={btnClass}
                                        >
                                            <span>{btnLabel}</span>
                                            {!isCaseClosed && !isViewingPastStep && !isReimbursement && !(isBoardReview && boardApproved === false) && advanceLabel && (
                                                <span className="text-xs font-normal text-slate-400">→ {advanceLabel}</span>
                                            )}
                                        </button>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                </div>
            </main>

            {retreatModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => {
                        if (!retreatBusy) {
                            setRetreatModal(null);
                            setRetreatReason('');
                        }
                    }}
                >
                    <ModalEscapeListener onClose={() => {
                        if (!retreatBusy) {
                            setRetreatModal(null);
                            setRetreatReason('');
                        }
                    }} />
                    <div
                        className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200 overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-900">
                                退回至「{retreatModal.label}」
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                                請填寫退回原因，承辦人會在該階段看到這段說明。
                            </p>
                        </div>
                        <div className="px-5 py-4">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                退回原因 <span className="text-orange-500">*</span>
                            </label>
                            <textarea
                                value={retreatReason}
                                onChange={e => setRetreatReason(e.target.value)}
                                rows={5}
                                maxLength={500}
                                className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                                placeholder="請說明需要修正或補充的內容"
                            />
                            <div className="mt-1 flex justify-between text-xs text-slate-400">
                                <span>至少 3 字</span>
                                <span>{retreatReason.length}/500</span>
                            </div>
                        </div>
                        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setRetreatModal(null);
                                    setRetreatReason('');
                                }}
                                disabled={retreatBusy}
                                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={confirmRetreatStage}
                                disabled={retreatBusy || retreatReason.trim().length < 3}
                                className="px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                確認退回
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSupRejectForm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => {
                        if (!supBusy) {
                            setShowSupRejectForm(false);
                            setSupRejectNote('');
                        }
                    }}
                >
                    <ModalEscapeListener onClose={() => {
                        if (!supBusy) {
                            setShowSupRejectForm(false);
                            setSupRejectNote('');
                        }
                    }} />
                    <div
                        className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200 overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-900">主管審閱不通過</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                案件會停留在家庭訪視階段，officer 可依原因修正後重送主管。
                            </p>
                        </div>
                        <div className="px-5 py-4">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                不通過原因 <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                value={supRejectNote}
                                onChange={e => setSupRejectNote(e.target.value)}
                                rows={5}
                                maxLength={500}
                                className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                                placeholder="請說明需修正的項目，例如家訪資料不足、案件說明需補充..."
                            />
                            <div className="mt-1 flex justify-between text-xs text-slate-400">
                                <span>至少 3 字</span>
                                <span>{supRejectNote.length}/500</span>
                            </div>
                        </div>
                        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowSupRejectForm(false);
                                    setSupRejectNote('');
                                }}
                                disabled={supBusy}
                                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={handleSupervisorRejectForBoard}
                                disabled={supBusy || supRejectNote.trim().length < 3}
                                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                確認退件
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 關懷紀錄唯讀檢視 Modal */}
            {showCareRecordsModal && selectedAppId && loggedInUser && (
                <ApplicationCareRecordsModal
                    applicationId={selectedAppId}
                    applicantUserId={appDetail?.applicantId ?? null}
                    caseNumber={appDetail?.caseNumber ?? null}
                    operatorUserId={loggedInUser.id}
                    onClose={() => setShowCareRecordsModal(false)}
                />
            )}

            {/* Send Notification Modal */}
            {showNotifModal && selectedAppId && (
                <SendNotificationModal
                    applicationId={selectedAppId}
                    placeholderVars={{
                        案號: appDetail?.caseNumber ?? '',
                        申請人: personName,
                        階段: STAGE_LABEL_MAP[stage],
                        申請日期: appDetail?.applyAt ?? '',
                        申請金額: appDetail?.applyAmount != null ? `NT$ ${appDetail.applyAmount.toLocaleString()}` : '—',
                        承辦人: appDetail?.officerName ?? '',
                    }}
                    checklistDocs={dbDocs.map((d): ChecklistDoc => ({ id: d.id, label: d.label }))}
                    senderUserId={loggedInUser?.id ?? ''}
                    onClose={() => setShowNotifModal(false)}
                    onSent={() => {
                        setShowNotifModal(false);
                        loadNotifLogs(selectedAppId);
                        loadReminderStatus(selectedAppId);
                    }}
                />
            )}

            {/* Threshold-close confirmation modal */}
            {/* Edit case basics modal */}
            {showEditBasicsModal && selectedAppId && appDetail && loggedInUser && (
                <EditCaseBasicsModal
                    applicationId={selectedAppId}
                    operatorUserId={loggedInUser.id}
                    initial={{
                        applicantName: appDetail.applicantName ?? '',
                        applicantPhone: appDetail.applicantPhone ?? '',
                        applicantAddress: appDetail.applicantAddress ?? '',
                        applicantDob: appDetail.applicantDob ?? '',
                        cancerType: appDetail.cancerType ?? '',
                        cancerStage: appDetail.cancerStage ?? '',
                        applicationForm: appDetail.applicationForm ?? null,
                        treatmentPhase: appDetail.treatmentPhase ?? null,
                        applicationType: (appDetail.applicationType as 'A' | 'B' | 'C' | 'D') ?? 'A',
                        applicationWay: appDetail.applicationWay ?? '1',
                        referralUnitId: appDetail.referralUnitId ?? null,
                        referralUnitName: appDetail.referralUnitName ?? null,
                        referralContactName: appDetail.referralContactName ?? null,
                        referralContactTitle: appDetail.referralContactTitle ?? null,
                        referralContactPhone: appDetail.referralContactPhone ?? null,
                    }}
                    onClose={() => setShowEditBasicsModal(false)}
                    onSaved={async () => {
                        setShowEditBasicsModal(false);
                        await loadAppDetail(selectedAppId, true);
                    }}
                />
            )}

            {/* 通用「不通過結案」modal — admin/supervisor/officer 觸發；threshold 流程也走這個 */}
            {closeCaseModalProps && selectedAppId && loggedInUser && (
                <CloseCaseModal
                    applicationId={selectedAppId}
                    operatorUserId={loggedInUser.id}
                    stage={appDetail?.stage}
                    prefillReasonCodes={closeCaseModalProps.prefillCodes}
                    prefillNote={closeCaseModalProps.prefillNote}
                    titleSuffix={closeCaseModalProps.titleSuffix}
                    onClose={() => setCloseCaseModalProps(null)}
                    onClosed={async () => {
                        setCloseCaseModalProps(null);
                        await loadAppDetail(selectedAppId, true);
                        if (loggedInUser) await loadPendingAlerts(loggedInUser.id);
                    }}
                />
            )}
        </div>
    );
}

// ── StepItem component ────────────────────────────────────────────────────────

interface StepItemProps {
    isCurrentTrue: boolean;
    isViewing: boolean;
    completed: boolean;
    isFuture: boolean;
    /** 案件是否已結案；結案後當前 stage 視為已完成（不顯示「進行中」） */
    caseClosed?: boolean;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
}

function StepItem({ isCurrentTrue, isViewing, completed, isFuture, caseClosed, label, icon, onClick }: StepItemProps) {
    // 結案後 → 當前 stage 視為已完成
    const effectiveCompleted = completed || (caseClosed && isCurrentTrue);
    const showInProgress = isCurrentTrue && !caseClosed;
    return (
        <button
            onClick={onClick}
            disabled={isFuture}
            title={isFuture ? '尚未到達此步驟' : undefined}
            className={clsx(
                'flex items-center gap-3 w-full p-2 rounded-lg transition-colors text-left',
                isFuture ? 'opacity-40 cursor-not-allowed'
                    : isViewing ? 'bg-blue-50 text-blue-700'
                        : 'hover:bg-gray-50 text-gray-600'
            )}
        >
            <div className={clsx(
                'w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm transition-all',
                isViewing && showInProgress ? 'bg-blue-600 scale-110'
                    : isViewing ? 'bg-amber-500 scale-110'
                        : showInProgress ? 'bg-blue-600'
                            : effectiveCompleted ? 'bg-green-500'
                                : 'bg-gray-300'
            )}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <span className={clsx('text-sm font-medium block', isViewing && 'font-bold')}>{label}</span>
                {showInProgress && <span className="text-xs text-blue-500 font-medium">進行中</span>}
                {!showInProgress && caseClosed && isCurrentTrue && (
                    <span className="text-xs text-green-600 font-medium">已完成</span>
                )}
                {!showInProgress && !isCurrentTrue && isViewing && (
                    <span className="text-xs text-amber-500 font-medium">查看中</span>
                )}
            </div>
        </button>
    );
}

export default App;
