import { useState, useEffect } from 'react';
import { 
    Users, 
    History, 
    UserPlus, 
    Shield, 
    Trash2, 
    Key,
    Search,
    Check
} from 'lucide-react';
import { Role } from '../types';
import { getCaseSummaries, getActiveApplication } from '../store/appStore';
import { AuditLogViewer } from './AuditLogViewer';
import { clsx } from 'clsx';
import { getUsers, createUser, updateUserRoles, resetUserPassword, deleteUserAccount, fetchRoles, AdminUserView, RoleOption } from '../app/actions/userActions';

interface AdminPanelProps {
    userRoles: Role[];
    onBack: () => void;
}

export function AdminPanel({ userRoles, onBack }: AdminPanelProps) {
    const [activeTab, setActiveTab] = useState<'accounts' | 'logs'>('accounts');
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Dynamic roles from DB
    const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);

    // Filter accounts based on search
    const [accounts, setAccounts] = useState<AdminUserView[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(true);

    // Form fields
    const [newAccountName, setNewAccountName] = useState(''); // account e.g. a001
    const [newRealName, setNewRealName] = useState(''); // encrypted name
    const [newIdNumber, setNewIdNumber] = useState(''); // encrypted ID
    const [newPassword, setNewPassword] = useState('');
    const [newRoles, setNewRoles] = useState<Role[]>(['case_officer']);

    const fetchAccounts = async () => {
        setLoadingAccounts(true);
        try {
            const data = await getUsers();
            setAccounts(data);
        } catch (e) {
            console.error('Failed to fetch accounts', e);
        } finally {
            setLoadingAccounts(false);
        }
    };

    useEffect(() => {
        fetchAccounts();
        fetchRoles().then(setRoleOptions);
    }, []);

    const filteredAccounts = accounts.filter(acc => 
        acc.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
        acc.account.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Collect all audit logs
    const allLogs = getCaseSummaries().flatMap(cs => {
        const active = getActiveApplication(cs.id);
        return active?.workflow?.auditLog ?? [];
    });

    const handleAddAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAccountName.trim() || !newPassword.trim() || !newRealName.trim() || !newIdNumber.trim() || newRoles.length === 0) {
            alert('請填寫完整資料並至少選擇一個角色');
            return;
        }
        setIsLoading(true);
        const res = await createUser({
            account: newAccountName,
            plainName: newRealName,
            plainId: newIdNumber,
            plainPass: newPassword,
            roles: newRoles
        });
        
        setIsLoading(false);
        
        if (res.success) {
            setNewAccountName('');
            setNewRealName('');
            setNewIdNumber('');
            setNewPassword('');
            setNewRoles(['case_officer']);
            setShowAddForm(false);
            fetchAccounts();
        } else {
            alert('新增失敗: ' + res.error);
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
                alert('密碼重設成功');
            } else {
                alert('重設失敗: ' + res.error);
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
            fetchAccounts();
        } else {
            alert('權限更新失敗: ' + res.error);
        }
    };

    const handleDeleteAccount = async (id: string, name: string) => {
        if (confirm(`確定要刪除帳號 ${name} 嗎？此操作無法恢復。`)) {
            const res = await deleteUserAccount(id);
            if (res.success) {
                fetchAccounts();
            } else {
                alert('刪除失敗: ' + res.error);
            }
        }
    };

    const isAdmin = userRoles.includes('admin');

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
            {/* Header */}
            <header className="bg-slate-900 text-white shadow-md sticky top-0 z-50">
                <div className="container mx-auto px-4 sm:px-6 py-4 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white shrink-0">W</div>
                        <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">後台管理工具</h1>
                    </div>
                    <button 
                        onClick={onBack} 
                        className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-300 hover:text-blue-400 transition px-1 sm:px-2 py-1.5 shrink-0"
                    >
                        <span className="text-base leading-none">←</span><span className="hidden sm:inline">返回首頁</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 container mx-auto px-4 sm:px-6 py-6 sm:py-8 overflow-x-hidden">
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                    {/* Sidebar Tabs */}
                    <div className="w-full lg:w-64 shrink-0 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
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
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        {activeTab === 'accounts' ? (
                            <div className="p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <Users className="w-6 h-6 text-blue-600" />
                                        帳號權限管理 (資料庫連線中)
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
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">身分證字號 (加密儲存)</label>
                                                <input 
                                                    type="text" 
                                                    value={newIdNumber}
                                                    onChange={(e) => setNewIdNumber(e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="輸入身份證..."
                                                    required
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
                                                                <p className="text-xs text-slate-400 mt-0.5">建立日期: {acc.created_at}</p>
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
                                                                        {r.code}
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
                        ) : (
                            <div className="flex-1 flex flex-col min-h-0">
                                <div className="p-6 border-b border-slate-200">
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <History className="w-6 h-6 text-blue-600" />
                                        系統操作紀錄
                                    </h2>
                                </div>
                                <div className="flex-1 p-6 overflow-hidden">
                                    <AuditLogViewer logs={allLogs} className="h-full" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

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
