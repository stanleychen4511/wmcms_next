import { useState, useEffect, useCallback } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    FileText,
    ClipboardList,
    FilePlus,
    BarChart2,
    Bell,
    BookOpen,
    HelpCircle,
    HeartHandshake,
    ClipboardCheck,
    Megaphone,
    Info,
    Calendar,
    UserCircle,
    LogOut,
    Settings,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Role } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HomePageProps {
    username: string;
    userRoles: Role[];
    onNavigateToCases: () => void;
    onGoAudit: () => void;
    onGoAdmin: () => void;
    onNewApplication: () => void;
    onLogout: () => void;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const BANNERS = [
    {
        src: '/banner1.png',
        title: '攜手關懷，傳遞溫暖',
        subtitle: '萬美基金會致力於為需要幫助的家庭提供全面支持',
    },
    {
        src: '/banner2.png',
        title: '深入社區，用心訪視',
        subtitle: '專業社工團隊定期入戶訪視，確保每一份關愛落到實處',
    },
    {
        src: '/banner3.png',
        title: '智慧管理，效率服務',
        subtitle: '數位化補助管理系統，讓行政作業更便捷、更透明',
    },
];

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
        action: null,
    },
    {
        icon: <BarChart2 className="w-5 h-5" />,
        label: '統計報表',
        desc: '查看補助業務統計數據',
        color: 'bg-purple-50 text-purple-600 border-purple-100',
        action: null,
    },
    {
        icon: <Bell className="w-5 h-5" />,
        label: '通知管理',
        desc: '設定與發送申請通知',
        color: 'bg-amber-50 text-amber-600 border-amber-100',
        action: null,
    },
    {
        icon: <BookOpen className="w-5 h-5" />,
        label: '作業手冊',
        desc: '查閱系統操作說明文件',
        color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        action: null,
    },
    {
        icon: <HelpCircle className="w-5 h-5" />,
        label: '常見問題',
        desc: '快速找到常見問題解答',
        color: 'bg-rose-50 text-rose-600 border-rose-100',
        action: null,
    },
    {
        icon: <HeartHandshake className="w-4 h-4" />,
        label: '追蹤關懷記錄',
        desc: '查看與新增關懷追蹤紀錄',
        color: 'bg-pink-50 text-pink-600 border-pink-100',
        action: null,
    },
    {
        icon: <ClipboardCheck className="w-4 h-4" />,
        label: '系統操作紀錄',
        desc: '檢視所有系統稽核操作日誌',
        color: 'bg-slate-50 text-slate-600 border-slate-200',
        action: 'audit',
    },
    {
        icon: <Settings className="w-4 h-4" />,
        label: '後台管理工具',
        desc: '帳號管理與系統設定',
        color: 'bg-slate-800 text-slate-300 border-slate-700',
        action: 'admin',
    },
];

const ANNOUNCEMENTS = [
    {
        id: 1,
        type: 'important',
        icon: <Megaphone className="w-4 h-4" />,
        tag: '重要公告',
        tagColor: 'bg-red-100 text-red-700',
        title: '114年度補助申請截止日期公告',
        content:
            '本年度低收入戶生活補助申請截止日期為 114 年 6 月 30 日，請各承辦人員注意受理期限，逾期恕不受理。',
        date: '2026-03-01',
        isNew: true,
    },
    {
        id: 2,
        type: 'info',
        icon: <Info className="w-4 h-4" />,
        tag: '系統公告',
        tagColor: 'bg-blue-100 text-blue-700',
        title: '系統維護通知 — 3/10 凌晨 02:00～04:00',
        content:
            '本系統將於 3 月 10 日（週一）凌晨 02:00 至 04:00 進行例行性維護，維護期間系統暫停服務，請事先安排業務。',
        date: '2026-02-28',
        isNew: true,
    },
    {
        id: 3,
        type: 'info',
        icon: <Calendar className="w-4 h-4" />,
        tag: '活動公告',
        tagColor: 'bg-emerald-100 text-emerald-700',
        title: '114年度社工教育訓練課程報名開始',
        content:
            '本基金會辦理 114 年度社工專業能力培訓課程，歡迎各單位社工人員踴躍報名參加，名額有限，報名從速。',
        date: '2026-02-25',
        isNew: false,
    },
    {
        id: 4,
        type: 'info',
        icon: <Info className="w-4 h-4" />,
        tag: '系統公告',
        tagColor: 'bg-blue-100 text-blue-700',
        title: '新增「家訪排程」功能上線說明',
        content:
            '系統已新增家訪排程功能，支援線上預約及提醒通知，詳細操作說明請參閱作業手冊第五章。',
        date: '2026-02-20',
        isNew: false,
    },
    {
        id: 5,
        type: 'info',
        icon: <Info className="w-4 h-4" />,
        tag: '法規公告',
        tagColor: 'bg-purple-100 text-purple-700',
        title: '社會救助法修正條文發布',
        content:
            '內政部已發布社會救助法最新修正條文，相關補助標準與資格認定將於 114 年 7 月 1 日起適用，請各承辦人員詳閱。',
        date: '2026-02-15',
        isNew: false,
    },
];

// ─── Banner Carousel ───────────────────────────────────────────────────────────

function BannerCarousel() {
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

    const prev = () => goTo((current - 1 + BANNERS.length) % BANNERS.length);
    const next = useCallback(() => goTo((current + 1) % BANNERS.length), [current, goTo]);

    useEffect(() => {
        const timer = setInterval(next, 4500);
        return () => clearInterval(timer);
    }, [next]);

    return (
        <div className="relative w-full overflow-hidden rounded-xl shadow-lg h-40 sm:h-56 md:h-64 lg:h-[260px]">
            {BANNERS.map((banner, idx) => (
                <div
                    key={idx}
                    className={clsx(
                        'absolute inset-0 transition-opacity duration-500',
                        idx === current ? 'opacity-100 z-10' : 'opacity-0 z-0'
                    )}
                >
                    <img
                        src={banner.src}
                        alt={banner.title}
                        className="w-full h-full object-cover"
                    />
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-900/70 via-slate-900/40 to-transparent" />
                    {/* Caption */}
                    <div className="absolute bottom-0 left-0 p-4 sm:p-6 text-white w-full sm:w-2/3">
                        <h2 className="text-xl sm:text-2xl font-bold drop-shadow-md leading-tight">{banner.title}</h2>
                        <p className="text-sm text-white/80 mt-1 drop-shadow">{banner.subtitle}</p>
                    </div>
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
                {BANNERS.map((_, idx) => (
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

export function HomePage({ username, userRoles, onNavigateToCases, onGoAudit, onGoAdmin, onNewApplication, onLogout }: HomePageProps) {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
            {/* Header */}
            <header className="bg-slate-900 text-white shadow-md sticky top-0 z-50">
                <div className="container mx-auto px-4 sm:px-6 py-4 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white shrink-0">
                            W
                        </div>
                        <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">萬美基金會補助管理系統</h1>
                        <div className="hidden lg:flex items-center gap-1.5 text-xs text-green-400 bg-slate-800 px-2.5 py-1 rounded-full border border-slate-600 ml-2 shrink-0">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                            <span>連線正常</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <div className="flex items-center gap-2 bg-slate-800 text-slate-200 px-2 sm:px-3 py-1.5 rounded-lg border border-slate-700">
                            <UserCircle className="w-4 h-4 text-slate-400" />
                            <span className="text-xs sm:text-sm font-medium truncate max-w-[80px] sm:max-w-none">{username}</span>
                        </div>
                        <button
                            onClick={onLogout}
                            className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-300 hover:text-red-400 transition px-1 sm:px-2 py-1.5"
                            title="登出"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">登出</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Page Content */}
            <main className="flex-1 container mx-auto px-4 sm:px-6 py-6 space-y-6 overflow-x-hidden">
                {/* Banner */}
                <BannerCarousel />

                {/* Welcome bar */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">
                            歡迎回來，<span className="text-blue-600">{username}</span>
                        </h2>
                        <p className="text-sm text-slate-500 mt-0.5">
                            今日 {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                        </p>
                    </div>
                </div>

                {/* Two-column layout */}
                <div className="flex flex-col lg:flex-row gap-8 items-start">
                    {/* ── Left: Quick Functions ── */}
                    <div className="w-full lg:w-72 shrink-0 space-y-4">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">快速功能</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-1 gap-2 sm:gap-3">
                            {QUICK_LINKS.map((link, idx) => {
                                const hasAccess = 
                                    link.action === 'new_application' ? (userRoles.includes('case_officer') || userRoles.includes('admin')) :
                                    link.action === 'admin' ? userRoles.includes('admin') :
                                    link.action === 'audit' ? userRoles.includes('admin') :
                                    true; // Default links are public or common

                                const handleClick =
                                    (link.action === 'new_application' && hasAccess) ? onNewApplication :
                                        (link.action === 'cases' && hasAccess) ? onNavigateToCases :
                                            (link.action === 'audit' && hasAccess) ? onGoAudit :
                                                (link.action === 'admin' && hasAccess) ? onGoAdmin :
                                                    undefined;
                                return (
                                    <button
                                        key={idx}
                                        onClick={handleClick}
                                        className={clsx(
                                            'flex items-center gap-3 w-full px-3 py-2 rounded-lg border bg-white shadow-sm transition-all duration-150 text-left hover:shadow-md hover:bg-slate-50 active:scale-95',
                                            handleClick ? 'cursor-pointer' : 'cursor-default opacity-70'
                                        )}
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
                            {ANNOUNCEMENTS.map((ann) => (
                                <div
                                    key={ann.id}
                                    className="flex gap-4 p-4 hover:bg-slate-50 transition-colors group cursor-pointer"
                                >
                                    <div className="shrink-0 mt-0.5">
                                        <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', ann.tagColor)}>
                                            {ann.icon}
                                            {ann.tag}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors truncate">
                                                {ann.isNew && (
                                                    <span className="inline-block mr-1.5 text-xs font-bold text-red-500 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">NEW</span>
                                                )}
                                                {ann.title}
                                            </p>
                                            <span className="text-xs text-slate-400 shrink-0">{ann.date}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{ann.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-slate-400 text-right">共 {ANNOUNCEMENTS.length} 則公告</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
