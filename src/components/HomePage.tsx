import { useState, useEffect, useCallback } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    FileText,
    ClipboardList,
    FilePlus,
    Bell,
    ClipboardCheck,
    Info,
    Calendar,
    Settings,
    Inbox,
    AlertTriangle,
    X,
    UserCog,
    BarChart3,
    Phone,
    FileSpreadsheet,
} from 'lucide-react';
import { PendingDocAlert, PendingDocThresholdAlert } from '../app/actions/pendingDocAlertActions';
import { fetchActiveBanners, Banner } from '../app/actions/bannerActions';
import { Announcement } from '../app/actions/announcementActions';
import ReactMarkdown from 'react-markdown';
import { clsx } from 'clsx';
import { Role } from '../types';
import { AppHeader } from './AppHeader';
import { ModalEscapeListener } from '../hooks/useModalDismiss';
import { ContactSearchModal } from './ContactSearchModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HomePageProps {
    username: string;
    userId: string;
    userRoles: Role[];
    /** 當前操作角色（多角色帳號切換用）；未提供時 fallback 到 userRoles 第一個 */
    activeRole?: Role;
    pendingAlerts?: PendingDocAlert[];
    thresholdAlerts?: PendingDocThresholdAlert[];
    unassignedCount?: number;
    onSelectCase?: (applicationId: string) => void;
    banners?: Banner[];
    announcements?: Announcement[];
    newDays?: number;
    onGoAnnouncements?: () => void;
    onNavigateToCases: () => void;
    onGoAudit: () => void;
    onGoAdmin: () => void;
    onNewApplication: () => void;
    onGoTemplates: () => void;
    onGoNotifications: () => void;
    onGoUserSettings?: () => void;
    onGoStats?: () => void;
    onGoReports?: () => void;
    onLogout: () => void;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const QUICK_LINKS = [
    {
        icon: <FilePlus className="w-5 h-5" />,
        label: '新增申請案件',
        desc: '為申請人建立新的補助申請',
        color: 'bg-green-50 text-green-600 border-green-100',
        action: 'new_application',
    },
    {
        icon: <ClipboardList className="w-5 h-5" />,
        label: '申請案件管理',
        desc: '查詢與管理補助申請案件',
        color: 'bg-blue-50 text-blue-600 border-blue-100',
        action: 'cases',
    },
    {
        icon: <FileText className="w-5 h-5" />,
        label: '表單下載',
        desc: '下載申請所需相關表單',
        color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        action: 'templates',
    },
    {
        icon: <Bell className="w-5 h-5" />,
        label: '通知管理',
        desc: '設定與發送申請通知',
        color: 'bg-amber-50 text-amber-600 border-amber-100',
        action: 'notifications',
    },
    {
        icon: <Settings className="w-4 h-4" />,
        label: '後台管理工具',
        desc: '帳號管理與系統設定',
        color: 'bg-slate-800 text-slate-300 border-slate-700',
        action: 'admin',
    },
    {
        icon: <Inbox className="w-4 h-4" />,
        label: '外部收件',
        desc: '開啟線上補助申請收件頁面',
        color: 'bg-teal-50 text-teal-600 border-teal-100',
        action: 'external_intake',
    },
    {
        icon: <UserCog className="w-4 h-4" />,
        label: '個人設定',
        desc: 'LINE 綁定等個人化設定',
        color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        action: 'user_settings',
    },
    {
        icon: <BarChart3 className="w-4 h-4" />,
        label: '案件統計',
        desc: '日期區間內通過/不通過案件分布',
        color: 'bg-purple-50 text-purple-600 border-purple-100',
        action: 'stats',
    },
    {
        icon: <Phone className="w-4 h-4" />,
        label: '聯絡紀錄',
        desc: '查詢、新增來電與關懷紀錄',
        color: 'bg-rose-50 text-rose-600 border-rose-100',
        action: 'contact_records',
    },
    {
        icon: <FileSpreadsheet className="w-4 h-4" />,
        label: '報表查詢',
        desc: '匯出三張顧客報表（自費醫療系列）',
        color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        action: 'reports',
    },
];

const STATS_ROLES: Role[] = ['admin', 'supervisor', 'chairman' as Role, 'board_member'];

// ─── Banner Carousel ───────────────────────────────────────────────────────────

function BannerCarousel({ banners }: { banners: Banner[] }) {
    const [current, setCurrent] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    const goTo = useCallback(
        (index: number) => {
            if (isAnimating) return;
            setIsAnimating(true);
            setTimeout(() => {
                setCurrent(index);
                setIsAnimating(false);
            }, 300);
        },
        [isAnimating]
    );

    const prev = () => goTo((current - 1 + banners.length) % banners.length);
    const next = useCallback(() => goTo((current + 1) % banners.length), [current, goTo, banners.length]);

    useEffect(() => {
        const timer = setInterval(next, 4500);
        return () => clearInterval(timer);
    }, [next]);

    if (banners.length === 0) return null;

    return (
        <div className="relative w-full overflow-hidden rounded-xl shadow-lg h-40 sm:h-56 md:h-64 lg:h-[260px]">
            {banners.map((banner, idx) => (
                <div
                    key={idx}
                    className={clsx(
                        'absolute inset-0 transition-opacity duration-500',
                        idx === current ? 'opacity-100 z-10' : 'opacity-0 z-0'
                    )}
                >
                    {banner.link_url ? (
                        <a href={banner.link_url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                            <img
                                src={banner.image_url}
                                alt={banner.title ?? ''}
                                className="w-full h-full object-cover"
                            />
                            {/* Overlay gradient */}
                            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/70 via-slate-900/40 to-transparent" />
                            {/* Caption */}
                            <div className="absolute bottom-0 left-0 p-4 sm:p-6 text-white w-full sm:w-2/3">
                                <h2 className="text-xl sm:text-2xl font-bold drop-shadow-md leading-tight">{banner.title}</h2>
                                <p className="text-sm text-white/80 mt-1 drop-shadow">{banner.subtitle}</p>
                            </div>
                        </a>
                    ) : (
                        <>
                            <img
                                src={banner.image_url}
                                alt={banner.title ?? ''}
                                className="w-full h-full object-cover"
                            />
                            {/* Overlay gradient */}
                            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/70 via-slate-900/40 to-transparent" />
                            {/* Caption */}
                            <div className="absolute bottom-0 left-0 p-4 sm:p-6 text-white w-full sm:w-2/3">
                                <h2 className="text-xl sm:text-2xl font-bold drop-shadow-md leading-tight">{banner.title}</h2>
                                <p className="text-sm text-white/80 mt-1 drop-shadow">{banner.subtitle}</p>
                            </div>
                        </>
                    )}
                </div>
            ))}

            {/* Arrow buttons */}
            <button
                onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm flex items-center justify-center text-white transition"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>
            <button
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm flex items-center justify-center text-white transition"
            >
                <ChevronRight className="w-5 h-5" />
            </button>

            {/* Dots */}
            <div className="absolute bottom-3 right-4 z-20 flex gap-1.5">
                {banners.map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => goTo(idx)}
                        className={clsx(
                            'rounded-full transition-all duration-300',
                            idx === current
                                ? 'w-6 h-2 bg-white'
                                : 'w-2 h-2 bg-white/50 hover:bg-white/80'
                        )}
                    />
                ))}
            </div>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────

const ASSIGN_ROLES: Role[] = ['supervisor', 'board_member', 'admin'];

export function HomePage({ username, userId, userRoles, activeRole, pendingAlerts = [], thresholdAlerts = [], unassignedCount = 0, banners = [], announcements = [], newDays = 7, onGoAnnouncements, onNavigateToCases, onGoAudit, onGoAdmin, onNewApplication, onGoTemplates, onGoNotifications, onGoUserSettings, onGoStats, onGoReports, onLogout, onSelectCase }: HomePageProps) {
    const canAssign = userRoles.some(r => ASSIGN_ROLES.includes(r));
    const canViewStats = userRoles.some(r => STATS_ROLES.includes(r));
    const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null);
    const [contactSearchOpen, setContactSearchOpen] = useState(false);

    /** 聯絡紀錄功能可見角色 — 與 contactRecordActions ALLOWED_ROLES 一致 */
    const CONTACT_ROLES = ['supervisor', 'case_officer', 'volunteer', 'admin'];
    const canUseContactRecords = userRoles.some(r => CONTACT_ROLES.includes(r));

    function isNew(publishDate: string, days: number) {
        return (Date.now() - new Date(publishDate).getTime()) / 86400000 <= days;
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
            {/* Header */}
            <AppHeader username={username} onLogout={onLogout} />

            {/* Page Content */}
            <main className="flex-1 container mx-auto px-4 sm:px-6 py-6 space-y-6 overflow-x-hidden">
                {/* Banner */}
                <BannerCarousel banners={banners} />

                {/* Alert banners */}
                {(
                    (userRoles.includes('case_officer') && pendingAlerts.length > 0) ||
                    (canAssign && unassignedCount > 0)
                ) && (
                    <div className="flex flex-col sm:flex-row gap-2">
                        {/* Pending doc alert — only for case_officer */}
                        {userRoles.includes('case_officer') && pendingAlerts.length > 0 && (
                            <div className="w-full sm:w-1/2 flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-5 py-4">
                                <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold text-orange-800">
                                        當前有 {pendingAlerts.length} 筆案件未補件
                                    </p>
                                </div>
                            </div>
                        )}
                        {/* Unassigned case alert — only for assign-capable roles */}
                        {canAssign && unassignedCount > 0 && (
                            <div className="w-full sm:w-1/2 flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-5 py-4">
                                <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold text-orange-800">
                                        當前有 {unassignedCount} 筆案件尚未派案
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Threshold-reached cases — only for case_officer */}
                {userRoles.includes('case_officer') && thresholdAlerts.length > 0 && (
                    <div className="bg-red-50 border border-red-300 rounded-xl px-5 py-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            <p className="text-sm font-semibold text-red-800">
                                達補件提醒門檻案件
                            </p>
                            <span className="ml-1 inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-red-600 text-white text-xs font-bold">
                                {thresholdAlerts.length}
                            </span>
                        </div>
                        <p className="text-xs text-red-700">
                            以下案件已多次發送未補件提醒，建議於案件詳情頁以「不通過結案」收尾。
                        </p>
                        <ul className="space-y-1.5">
                            {thresholdAlerts.map(a => (
                                <li key={a.applicationId}>
                                    <button
                                        type="button"
                                        onClick={() => onSelectCase?.(a.applicationId)}
                                        className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg bg-white border border-red-200 hover:bg-red-100 transition cursor-pointer"
                                    >
                                        <span className="text-sm font-mono text-slate-700">{a.caseNumber}</span>
                                        <span className="text-sm text-slate-800">{a.applicantName}</span>
                                        <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                                            已提醒 {a.reminderCount} 次
                                        </span>
                                        {a.missingCount > 0 && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs">
                                                缺 {a.missingCount} 件
                                            </span>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Two-column layout */}
                <div className="flex flex-col lg:flex-row gap-8 items-start">
                    {/* ── Left: Quick Functions ── */}
                    <div className="w-full lg:w-72 shrink-0 space-y-4">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">快速功能</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-1 gap-2 sm:gap-3">
                            {QUICK_LINKS.map((link, idx) => {
                                // 當前操作角色為 volunteer 時隱藏：
                                //   - 通知管理（notifications）
                                //   - 外部收件（external_intake）
                                // 判定用「目前正在操作的角色」，多角色帳號切到 volunteer 視野時也會生效
                                const isActingAsVolunteer = (activeRole ?? userRoles[0]) === 'volunteer';

                                const hasAccess =
                                    link.action === 'new_application' ? (userRoles.includes('case_officer') || userRoles.includes('admin')) :
                                    link.action === 'admin' ? (userRoles.includes('admin') || userRoles.includes('chairman' as Role)) :
                                    link.action === 'stats' ? canViewStats :
                                    link.action === 'notifications' ? !isActingAsVolunteer :
                                    link.action === 'external_intake' ? !isActingAsVolunteer :
                                    link.action === 'contact_records' ? canUseContactRecords :
                                    link.action === 'reports' ? (
                                        userRoles.includes('admin')
                                        || userRoles.includes('supervisor')
                                        || userRoles.includes('board_member' as Role)
                                        || userRoles.includes('executive' as Role)
                                        || userRoles.includes('chairman' as Role)
                                    ) :
                                    true;

                                if (!hasAccess) return null;

                                const handleClick =
                                    link.action === 'new_application' ? onNewApplication :
                                    link.action === 'cases' ? onNavigateToCases :
                                    link.action === 'admin' ? onGoAdmin :
                                    link.action === 'templates' ? onGoTemplates :
                                    link.action === 'notifications' ? onGoNotifications :
                                    link.action === 'announcements' ? onGoAnnouncements :
                                    link.action === 'external_intake' ? () => window.open('/apply', '_blank') :
                                    link.action === 'user_settings' ? onGoUserSettings :
                                    link.action === 'stats' ? onGoStats :
                                    link.action === 'contact_records' ? () => setContactSearchOpen(true) :
                                    link.action === 'reports' ? onGoReports :
                                    undefined;

                                return (
                                    <button
                                        key={idx}
                                        onClick={handleClick}
                                        className="flex items-center gap-3 w-full px-3 py-2 rounded-lg border bg-white shadow-sm transition-all duration-150 text-left hover:shadow-md hover:bg-slate-50 active:scale-95 cursor-pointer"
                                    >
                                        <span className={clsx('p-1.5 rounded-md border shrink-0', link.color)}>
                                            {link.icon}
                                        </span>
                                        <span className="text-sm font-medium text-slate-700 leading-tight">{link.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Right: Announcements (2/3) ── */}
                    <div className="flex-1 min-w-0 space-y-3">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">最新公告</h3>
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
                            {announcements.map((a) => (
                                <div
                                    key={a.id}
                                    onClick={() => setSelectedAnn(a)}
                                    className="flex gap-4 p-4 hover:bg-slate-50 transition-colors group cursor-pointer"
                                >
                                    <div className="shrink-0 mt-0.5">
                                        <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', a.category_color ?? 'bg-gray-100 text-gray-600')}>
                                            {a.category_name}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors truncate">
                                                {isNew(a.publish_date, newDays) && (
                                                    <span className="inline-block mr-1.5 text-xs font-bold text-red-500 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">NEW</span>
                                                )}
                                                {a.title}
                                            </p>
                                            <span className="text-xs text-slate-400 shrink-0">{a.publish_date}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{a.content.slice(0, 100)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="text-right mt-2">
                            <button onClick={onGoAnnouncements} className="text-xs text-blue-600 hover:text-blue-800 transition font-medium">
                                查看全部公告 →
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 text-right">共 {announcements.length} 則公告</p>
                    </div>
                </div>
            </main>

            {/* 聯絡紀錄 modal — 內含查詢 + 新增來電 + 新增關懷 */}
            {contactSearchOpen && (
                <ContactSearchModal
                    operatorUserId={userId}
                    onClose={() => setContactSearchOpen(false)}
                />
            )}

            {selectedAnn && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedAnn(null)}>
                    <ModalEscapeListener onClose={() => setSelectedAnn(null)} />
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
                            <div>
                                {selectedAnn.category_name && (
                                    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mb-2', selectedAnn.category_color ?? 'bg-gray-100 text-gray-600')}>
                                        {selectedAnn.category_name}
                                    </span>
                                )}
                                <h3 className="text-lg font-bold text-slate-800 leading-snug">{selectedAnn.title}</h3>
                                <p className="text-xs text-slate-400 mt-1">{selectedAnn.publish_date}</p>
                            </div>
                            <button onClick={() => setSelectedAnn(null)} className="text-slate-400 hover:text-slate-600 transition shrink-0">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5">
                            <div className="prose prose-sm max-w-none text-slate-700">
                                <ReactMarkdown components={{ img: () => null }}>
                                    {selectedAnn.content}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
