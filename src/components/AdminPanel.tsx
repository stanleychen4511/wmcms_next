import { useState, useEffect } from 'react';
import {
    Users,
    History,
    UserPlus,
    Shield,
    Trash2,
    Key,
    Search,
    Check,
    MapPin,
    FileText,
    SlidersHorizontal,
    Image,
    Megaphone,
    Building2,
    Users2,
} from 'lucide-react';
import { Role } from '../types';
import { AuditLogViewer } from './AuditLogViewer';
import { ModalEscapeListener } from '../hooks/useModalDismiss';
import { StorageLocationManager } from './StorageLocationManager';
import { TemplateFileManager } from './TemplateFileManager';
import { SettingsPanel } from './SettingsPanel';
import { EligibilityRulesPanel } from './EligibilityRulesPanel';
import { DocumentTypeManager } from './DocumentTypeManager';
import { BannerManager } from './BannerManager';
import { AnnouncementManager } from './AnnouncementManager';
import { ReferralUnitManager } from './ReferralUnitManager';
import { BoardGroupManager } from './BoardGroupManager';
import { clsx } from 'clsx';
import { getUsers, createUser, updateUserRoles, resetUserPassword, updateUserEmail, deleteUserAccount, fetchRoles, toggleUserActive, reassignOfficer, fetchCaseOfficersWithId, AdminUserView, RoleOption } from '../app/actions/userActions';
import { formatRocDateOnly } from '../lib/rocDate';
import { twIdError } from '../lib/validateTwId';
import { AppHeader } from './AppHeader';
import { useToast } from './FloatingToast';

interface AdminPanelProps {
    userRoles: Role[];
    userId: string;
    onBack: () => void;
    username?: string;
    onLogout?: () => void;
}

export function AdminPanel({ userRoles, userId, onBack, username, onLogout }: AdminPanelProps) {
    const { push: pushToast } = useToast();
    // Default tab: admin → accounts; chairman-only → board_groups; otherwise first allowed tab
    const initialTab: 'accounts' | 'locations' | 'doctypes' | 'templates' | 'banners' | 'announcements' | 'referral_units' | 'board_groups' | 'logs' | 'settings' | 'eligibility' =
        userRoles.includes('admin') ? 'accounts'
        : userRoles.includes('chairman' as Role) ? 'board_groups'
        : 'logs';
    const [activeTab, setActiveTab] = useState<'accounts' | 'locations' | 'doctypes' | 'templates' | 'banners' | 'announcements' | 'referral_units' | 'board_groups' | 'logs' | 'settings' | 'eligibility'>(initialTab);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Dynamic roles from DB
    const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);

    // Filter accounts based on search
    const [accounts, setAccounts] = useState<AdminUserView[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(true);

    // Officers list for reassignment dropdown
    const [officersWithId, setOfficersWithId] = useState<{ id: string; name: string }[]>([]);

    // Deactivation flow state
    const [deactivateModal, setDeactivateModal] = useState<{
        userId: string;
        userName: string;
        activeCases: { caseNumber: string; applicantName: string; applicationId?: string }[];
    } | null>(null);
    const [caseReassignments, setCaseReassignments] = useState<Record<string, string>>({});
    const [deactivating, setDeactivating] = useState(false);
    const [deactivateError, setDeactivateError] = useState('');

    // Form fields
    const [newAccountName, setNewAccountName] = useState(''); // account e.g. a001
    const [newRealName, setNewRealName] = useState(''); // encrypted name
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRoles, setNewRoles] = useState<Role[]>(['case_officer']);

    /**
     * 載入帳號清單。silent=true 時不切換 loading 狀態，避免列表被替換為
     * 「載入中…」單列導致畫面高度劇烈變動、瀏覽器自動 scroll to top。
     * 異動權限／停用啟用等場景應傳 silent=true。
     */
    const fetchAccounts = async (silent: boolean = false) => {
        if (!silent) setLoadingAccounts(true);
        try {
            const data = await getUsers();
            setAccounts(data);
        } catch (e) {
            console.error('Failed to fetch accounts', e);
        } finally {
            if (!silent) setLoadingAccounts(false);
        }
    };

    useEffect(() => {
        fetchAccounts();
        fetchRoles().then(setRoleOptions);
        fetchCaseOfficersWithId().then(setOfficersWithId);
    }, []);

    const filteredAccounts = accounts.filter(acc => 
        acc.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
        acc.account.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAddAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAccountName.trim() || !newPassword.trim() || !newRealName.trim() || newRoles.length === 0) {
            pushToast({ type: 'error', msg: '請填寫完整資料並至少選擇一個角色' });
            return;
        }
        const trimmedEmail = newEmail.trim();
        if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            pushToast({ type: 'error', msg: 'Email 格式不正確' });
            return;
        }
        setIsLoading(true);
        const res = await createUser({
            account: newAccountName,
            plainName: newRealName,
            // 後台帳號不需身分證；申請人帳號透過收件流程建立、會自帶身分證
            plainPass: newPassword,
            roles: newRoles,
            email: trimmedEmail || undefined,
        });

        setIsLoading(false);

        if (res.success) {
            setNewAccountName('');
            setNewRealName('');
            setNewEmail('');
            setNewPassword('');
            setNewRoles(['case_officer']);
            setShowAddForm(false);
            fetchAccounts(true);
        } else {
            pushToast({ type: 'error', msg: '新增失敗: ' + res.error });
        }
    };

    const handleEditEmail = async (id: string, currentEmail: string | null, username: string) => {
        const next = window.prompt(`請輸入 ${username} 的 Email（留空可清除）：`, currentEmail ?? '');
        if (next === null) return;   // 取消
        const res = await updateUserEmail(id, next);
        if (res.success) {
            await fetchAccounts(true);
        } else {
            pushToast({ type: 'error', msg: '更新失敗：' + res.error });
        }
    };

    const toggleRole = (role: Role) => {
        if (newRoles.includes(role)) {
            setNewRoles(newRoles.filter(r => r !== role));
        } else {
            setNewRoles([...newRoles, role]);
        }
    };

    const handleResetPassword = async (id: string, username: string) => {
        const password = window.prompt(`請輸入 ${username} 的新密碼：`);
        if (password !== null && password.trim() !== '') {
            const res = await resetUserPassword(id, password.trim());
            if (res.success) {
                pushToast({ type: 'success', msg: '密碼重設成功' });
            } else {
                pushToast({ type: 'error', msg: '重設失敗: ' + res.error });
            }
        }
    };

    const handleToggleAccountRole = async (id: string, roles: Role[], role: Role) => {
        let nextRoles: Role[];
        if (roles.includes(role)) {
            if (roles.length === 1) return; // Don't allow removing the last role
            nextRoles = roles.filter(r => r !== role);
        } else {
            nextRoles = [...roles, role];
        }
        
        // Optimistic UI could go here
        const res = await updateUserRoles(id, nextRoles);
        if (res.success) {
            fetchAccounts(true);
        } else {
            pushToast({ type: 'error', msg: '權限更新失敗: ' + res.error });
        }
    };

    const handleDeleteAccount = async (id: string, name: string) => {
        if (confirm(`確定要刪除帳號 ${name} 嗎？此操作無法恢復。`)) {
            const res = await deleteUserAccount(id);
            if (res.success) {
                fetchAccounts(true);
            } else {
                pushToast({ type: 'error', msg: '刪除失敗: ' + res.error });
            }
        }
    };

    const handleDeactivate = async (accountUserId: string, userName: string) => {
        setDeactivateError('');
        const res = await toggleUserActive(accountUserId, false);
        if (res.blocked && res.activeCases) {
            const client_cases = res.activeCases;
            const { fetchApplicationIdsByCaseNumbers } = await import('../app/actions/applicationActions');
            const caseNumbers = client_cases.map(c => c.caseNumber);
            const idMap = await fetchApplicationIdsByCaseNumbers(caseNumbers);
            const casesWithIds = client_cases.map(c => ({
                ...c,
                applicationId: idMap[c.caseNumber],
            }));
            setDeactivateModal({ userId: accountUserId, userName, activeCases: casesWithIds });
            setCaseReassignments({});
        } else if (res.success) {
            await fetchAccounts(true);
        } else {
            pushToast({ type: 'error', msg: res.error || '停用失敗' });
        }
    };

    const handleConfirmDeactivate = async () => {
        if (!deactivateModal) return;
        const allAssigned = deactivateModal.activeCases.every(c => caseReassignments[c.caseNumber]);
        if (!allAssigned) {
            setDeactivateError('請為所有進行中案件指派新承辦人');
            return;
        }
        setDeactivating(true);
        setDeactivateError('');
        try {
            for (const c of deactivateModal.activeCases) {
                if (c.applicationId) {
                    await reassignOfficer(c.applicationId, caseReassignments[c.caseNumber]);
                }
            }
            const res = await toggleUserActive(deactivateModal.userId, false);
            if (res.success) {
                setDeactivateModal(null);
                await fetchAccounts(true);
            } else {
                setDeactivateError(res.error || '停用失敗');
            }
        } finally {
            setDeactivating(false);
        }
    };

    const handleActivate = async (accountUserId: string) => {
        const res = await toggleUserActive(accountUserId, true);
        if (res.success) {
            await fetchAccounts(true);
        } else {
            pushToast({ type: 'error', msg: res.error || '啟用失敗' });
        }
    };

    const isAdmin = userRoles.includes('admin');
    const isChairman = userRoles.includes('chairman' as Role);
    const canManageLocations = userRoles.some(r => ['admin', 'supervisor', 'board_member'].includes(r));
    const canManageTemplates = userRoles.some(r => ['admin', 'supervisor'].includes(r));

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
            <AppHeader username={username} onGoHome={onBack} onLogout={onLogout} />

            <main className="flex-1 container mx-auto px-4 sm:px-6 py-6 sm:py-8 overflow-x-hidden">
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                    {/* Sidebar Tabs */}
                    <div className="w-full lg:w-64 shrink-0 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('accounts')}
                                className={clsx(
                                    "whitespace-nowrap lg:whitespace-normal flex-1 lg:flex-none flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left font-medium",
                                    activeTab === 'accounts'
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                                )}
                            >
                                <Users className="w-5 h-5 shrink-0" />
                                <span>帳號權限管理</span>
                            </button>
                        )}
                        {canManageLocations && (
                            <button
                                onClick={() => setActiveTab('locations')}
                                className={clsx(
                                    "whitespace-nowrap lg:whitespace-normal flex-1 lg:flex-none flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left font-medium",
                                    activeTab === 'locations'
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                                )}
                            >
                                <MapPin className="w-5 h-5 shrink-0" />
                                <span>檔案實體位置</span>
                            </button>
                        )}
                        {canManageLocations && (
                            <button
                                onClick={() => setActiveTab('doctypes')}
                                className={clsx(
                                    "whitespace-nowrap lg:whitespace-normal flex-1 lg:flex-none flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left font-medium",
                                    activeTab === 'doctypes'
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                                )}
                            >
                                <FileText className="w-5 h-5 shrink-0" />
                                <span>文件類型管理</span>
                            </button>
                        )}
                        {canManageTemplates && (
                            <button
                                onClick={() => setActiveTab('templates')}
                                className={clsx(
                                    "whitespace-nowrap lg:whitespace-normal flex-1 lg:flex-none flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left font-medium",
                                    activeTab === 'templates'
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                                )}
                            >
                                <FileText className="w-5 h-5 shrink-0" />
                                <span>範本檔案</span>
                            </button>
                        )}
                        {canManageTemplates && (
                            <button
                                onClick={() => setActiveTab('banners')}
                                className={clsx(
                                    "whitespace-nowrap lg:whitespace-normal flex-1 lg:flex-none flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left font-medium",
                                    activeTab === 'banners'
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                                )}
                            >
                                <Image className="w-5 h-5 shrink-0" />
                                <span>Banner 管理</span>
                            </button>
                        )}
                        {canManageTemplates && (
                            <button
                                onClick={() => setActiveTab('announcements')}
                                className={clsx(
                                    "whitespace-nowrap lg:whitespace-normal flex-1 lg:flex-none flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left font-medium",
                                    activeTab === 'announcements'
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                                )}
                            >
                                <Megaphone className="w-5 h-5 shrink-0" />
                                <span>公告管理</span>
                            </button>
                        )}
                        {(isChairman || isAdmin) && (
                            <button
                                onClick={() => setActiveTab('board_groups')}
                                className={clsx(
                                    "whitespace-nowrap lg:whitespace-normal flex-1 lg:flex-none flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left font-medium",
                                    activeTab === 'board_groups'
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                                )}
                            >
                                <Users2 className="w-5 h-5 shrink-0" />
                                <span>董事組別管理</span>
                            </button>
                        )}
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('referral_units')}
                                className={clsx(
                                    "whitespace-nowrap lg:whitespace-normal flex-1 lg:flex-none flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left font-medium",
                                    activeTab === 'referral_units'
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                                )}
                            >
                                <Building2 className="w-5 h-5 shrink-0" />
                                <span>轉介單位管理</span>
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('logs')}
                            className={clsx(
                                "whitespace-nowrap lg:whitespace-normal flex-1 lg:flex-none flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left font-medium",
                                activeTab === 'logs'
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                            )}
                        >
                            <History className="w-5 h-5 shrink-0" />
                            <span>系統操作紀錄</span>
                        </button>
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('settings')}
                                className={clsx(
                                    "whitespace-nowrap lg:whitespace-normal flex-1 lg:flex-none flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left font-medium",
                                    activeTab === 'settings'
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                                )}
                            >
                                <SlidersHorizontal className="w-5 h-5 shrink-0" />
                                <span>參數設定</span>
                            </button>
                        )}
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('eligibility')}
                                className={clsx(
                                    "whitespace-nowrap lg:whitespace-normal flex-1 lg:flex-none flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left font-medium",
                                    activeTab === 'eligibility'
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                                )}
                            >
                                <SlidersHorizontal className="w-5 h-5 shrink-0" />
                                <span>申請規則設定</span>
                            </button>
                        )}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        {activeTab === 'accounts' ? (
                            <div className="p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <Users className="w-6 h-6 text-blue-600" />
                                        帳號權限管理
                                    </h2>
                                    {isAdmin && (
                                        <button 
                                            onClick={() => setShowAddForm(!showAddForm)}
                                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 shadow-sm"
                                        >
                                            <UserPlus className="w-4 h-4" />
                                            {showAddForm ? '取消新增' : '新增帳號'}
                                        </button>
                                    )}
                                </div>

                                {showAddForm && (
                                    <form onSubmit={handleAddAccount} className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4 animate-in fade-in slide-in-from-top-2">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">登入帳號 (Account)</label>
                                                <input 
                                                    type="text" 
                                                    value={newAccountName}
                                                    onChange={(e) => setNewAccountName(e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="輸入英數字..."
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">登入密碼 (Password)</label>
                                                <input 
                                                    type="password" 
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="輸入密碼..."
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">真實姓名 (加密儲存)</label>
                                                <input
                                                    type="text"
                                                    value={newRealName}
                                                    onChange={(e) => setNewRealName(e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="如: 王小明"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email（系統通知用）</label>
                                                <input
                                                    type="email"
                                                    value={newEmail}
                                                    onChange={(e) => setNewEmail(e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="user@example.com（可留空）"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">配置角色權限 (多選)</label>
                                            <div className="flex flex-wrap gap-2">
                                                {roleOptions.map(role => (
                                                    <button
                                                        key={role.code}
                                                        type="button"
                                                        onClick={() => toggleRole(role.code as Role)}
                                                        className={clsx(
                                                            "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5",
                                                            newRoles.includes(role.code as Role)
                                                                ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm"
                                                                : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                                                        )}
                                                    >
                                                        {newRoles.includes(role.code as Role) && <Check className="w-3 h-3" />}
                                                        {role.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <button 
                                                type="submit" 
                                                disabled={isLoading}
                                                className="bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition shadow-sm disabled:opacity-50"
                                            >
                                                {isLoading ? '處理中...' : '資料加密並儲存'}
                                            </button>
                                            <button type="button" onClick={() => setShowAddForm(false)} className="bg-white text-slate-600 border border-slate-200 px-6 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition">取消</button>
                                        </div>
                                    </form>
                                )}

                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input 
                                        type="text" 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="搜尋姓名或帳號..."
                                        className="w-full max-w-md bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>

                                <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
                                    <table className="w-full text-sm text-left min-w-[800px] lg:min-w-0">
                                        <thead className="bg-slate-50 text-slate-500 font-bold border-bottom border-slate-200 uppercase tracking-wider">
                                            <tr>
                                                <th className="px-6 py-3">使用者資訊</th>
                                                <th className="px-6 py-3">所屬角色</th>
                                                <th className="px-6 py-3 text-center">狀態</th>
                                                <th className="px-6 py-3 text-right">操作管理</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {loadingAccounts ? (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                                        <div className="animate-pulse">正在從資料庫載入並解密資料...</div>
                                                    </td>
                                                </tr>
                                            ) : filteredAccounts.map((acc) => (
                                                <tr key={acc.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold shrink-0">
                                                                {acc.username.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <span className="font-bold text-slate-800 text-base">{acc.username}</span>
                                                                <span className="ml-2 text-xs text-slate-500">(@{acc.account})</span>
                                                                <p className="text-xs text-slate-400 mt-0.5">
                                                                    建立日期: {formatRocDateOnly(acc.created_at)}
                                                                </p>
                                                                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                                                                    <span className="text-slate-400">Email:</span>
                                                                    <span className={acc.email ? 'text-slate-700' : 'text-slate-300 italic'}>
                                                                        {acc.email ?? '（未設定）'}
                                                                    </span>
                                                                    {isAdmin && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleEditEmail(acc.id, acc.email, acc.username)}
                                                                            className="text-blue-600 hover:text-blue-800 text-[10px] underline ml-1"
                                                                            title="修改 Email"
                                                                        >
                                                                            修改
                                                                        </button>
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-wrap gap-1.5 max-w-[260px]">
                                                            {roleOptions.map(r => {
                                                                const isAssigned = acc.roles.includes(r.code as Role);
                                                                return (
                                                                    <button
                                                                        key={r.code}
                                                                        disabled={!isAdmin}
                                                                        onClick={() => handleToggleAccountRole(acc.id, acc.roles, r.code as Role)}
                                                                        className={clsx(
                                                                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight transition-all",
                                                                            isAssigned
                                                                                ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200"
                                                                                : "bg-slate-50 text-slate-300 ring-1 ring-slate-100 opacity-40 hover:opacity-100 hover:text-slate-500"
                                                                        )}
                                                                        title={isAdmin ? (isAssigned ? "移除此角色" : "授權此角色") : undefined}
                                                                    >
                                                                        {r.name}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {acc.is_active ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-[11px] font-bold">
                                                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                                                ACTIVE
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-[11px] font-bold">
                                                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                                                DISABLED
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {isAdmin && (
                                                                <button 
                                                                    onClick={() => handleResetPassword(acc.id, acc.username)}
                                                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                                    title="重設密碼"
                                                                >
                                                                    <Key className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {isAdmin && acc.account !== 'admin_01' && acc.id !== userId && acc.is_active && (
                                                                <button
                                                                    onClick={() => handleDeactivate(acc.id, acc.username)}
                                                                    className="px-2 py-1 text-xs font-medium text-orange-600 hover:text-white hover:bg-orange-500 border border-orange-300 hover:border-orange-500 rounded-lg transition-all"
                                                                    title="停用帳號"
                                                                >
                                                                    停用
                                                                </button>
                                                            )}
                                                            {isAdmin && acc.account !== 'admin_01' && !acc.is_active && (
                                                                <button
                                                                    onClick={() => handleActivate(acc.id)}
                                                                    className="px-2 py-1 text-xs font-medium text-green-600 hover:text-white hover:bg-green-500 border border-green-300 hover:border-green-500 rounded-lg transition-all"
                                                                    title="啟用帳號"
                                                                >
                                                                    啟用
                                                                </button>
                                                            )}
                                                            {isAdmin && acc.account !== 'admin_01' && (
                                                                <button
                                                                    onClick={() => handleDeleteAccount(acc.id, acc.username)}
                                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                    title="刪除帳號"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {!loadingAccounts && filteredAccounts.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                                                        找不到符合條件的帳號
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : activeTab === 'locations' ? (
                            <StorageLocationManager />
                        ) : activeTab === 'doctypes' ? (
                            <DocumentTypeManager />
                        ) : activeTab === 'templates' ? (
                            <TemplateFileManager userId={userId} />
                        ) : activeTab === 'banners' ? (
                            <BannerManager userId={userId} />
                        ) : activeTab === 'announcements' ? (
                            <AnnouncementManager userId={userId} />
                        ) : activeTab === 'referral_units' ? (
                            <div className="flex-1 p-6 overflow-y-auto">
                                <ReferralUnitManager operatorUserId={userId} />
                            </div>
                        ) : activeTab === 'board_groups' ? (
                            <div className="flex-1 p-6 overflow-y-auto">
                                <BoardGroupManager operatorUserId={userId} />
                            </div>
                        ) : activeTab === 'settings' ? (
                            <div className="flex-1 flex flex-col min-h-0">
                                <div className="p-6 border-b border-slate-200">
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <SlidersHorizontal className="w-6 h-6 text-blue-600" />
                                        參數設定
                                    </h2>
                                </div>
                                <div className="flex-1 p-6 overflow-y-auto">
                                    <SettingsPanel userId={userId} />
                                </div>
                            </div>
                        ) : activeTab === 'eligibility' ? (
                            <div className="flex-1 flex flex-col min-h-0">
                                <div className="p-6 border-b border-slate-200">
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <SlidersHorizontal className="w-6 h-6 text-blue-600" />
                                        申請規則設定（115 年辦法）
                                    </h2>
                                </div>
                                <div className="flex-1 p-6 overflow-y-auto">
                                    <EligibilityRulesPanel operatorUserId={userId} />
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col min-h-0">
                                <div className="p-6 border-b border-slate-200">
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <History className="w-6 h-6 text-blue-600" />
                                        系統操作紀錄
                                    </h2>
                                </div>
                                <div className="flex-1 p-6 overflow-y-auto">
                                    <AuditLogViewer />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Deactivation / Reassignment Modal */}
            {deactivateModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    onClick={() => setDeactivateModal(null)}
                >
                    <ModalEscapeListener onClose={() => setDeactivateModal(null)} />
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-200">
                            <h3 className="text-lg font-bold text-slate-800">停用帳號：{deactivateModal.userName}</h3>
                            <p className="text-sm text-slate-500 mt-1">該帳號仍有進行中案件，請先指派新承辦人後才可停用。</p>
                        </div>
                        <div className="p-6 space-y-3 max-h-80 overflow-y-auto">
                            {deactivateModal.activeCases.map(c => (
                                <div key={c.caseNumber} className="flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-700">{c.caseNumber}</p>
                                        <p className="text-xs text-slate-400">{c.applicantName}</p>
                                    </div>
                                    <select
                                        value={caseReassignments[c.caseNumber] ?? ''}
                                        onChange={e => setCaseReassignments(prev => ({ ...prev, [c.caseNumber]: e.target.value }))}
                                        className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm min-w-[140px]"
                                    >
                                        <option value="">── 選擇承辦人 ──</option>
                                        {officersWithId.filter(o => o.id !== deactivateModal.userId).map(o => (
                                            <option key={o.id} value={o.id}>{o.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                        {deactivateError && <p className="px-6 text-sm text-red-500">{deactivateError}</p>}
                        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                            <button onClick={() => setDeactivateModal(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">取消</button>
                            <button
                                onClick={handleConfirmDeactivate}
                                disabled={deactivating}
                                className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                {deactivating ? '處理中…' : '確認停用'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!isAdmin && (
                <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:right-6 sm:bottom-6 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                    <Shield className="w-5 h-5 text-amber-600" />
                    <div>
                        <p className="text-sm font-bold">權限不足</p>
                        <p className="text-xs">您目前的角色權限僅供查看，無法進行修改作業或重設密碼。</p>
                    </div>
                </div>
            )}
        </div>
    );
}
