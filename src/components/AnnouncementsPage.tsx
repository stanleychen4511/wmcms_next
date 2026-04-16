import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Megaphone, X, ChevronRight, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { fetchAllAnnouncements, Announcement } from '../app/actions/announcementActions';
import { AppHeader } from './AppHeader';

interface AnnouncementsPageProps {
    username?: string;
    onBack: () => void;
    onGoHome: () => void;
    onLogout?: () => void;
}

function isNew(publishDate: string, newDays: number): boolean {
    const diff = (Date.now() - new Date(publishDate).getTime()) / 86400000;
    return diff <= newDays;
}

export function AnnouncementsPage({ username, onBack, onGoHome, onLogout }: AnnouncementsPageProps) {
    const [items, setItems] = useState<Announcement[]>([]);
    const [newDays, setNewDays] = useState(7);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Announcement | null>(null);

    useEffect(() => {
        fetchAllAnnouncements().then(({ items, newDays }) => {
            setItems(items);
            setNewDays(newDays);
            setLoading(false);
        });
    }, []);

    const filtered = items.filter(a =>
        !search || a.title.includes(search) || (a.category_name ?? '').includes(search)
    );

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
            <AppHeader username={username} onGoHome={onGoHome} onLogout={onLogout} />

            <main className="flex-1 container mx-auto px-4 sm:px-6 py-8 space-y-6 max-w-3xl">
                <div>
                    <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition font-medium mb-4">
                        <span className="text-base leading-none">←</span>
                        返回首頁
                    </button>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Megaphone className="w-6 h-6 text-blue-600" />
                        全部公告
                    </h2>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="搜尋公告標題或分類..."
                        className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <Megaphone className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p>目前沒有公告</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
                        {filtered.map(a => (
                            <button
                                key={a.id}
                                onClick={() => setSelected(a)}
                                className="w-full flex gap-4 p-4 hover:bg-slate-50 transition-colors text-left group"
                            >
                                <div className="shrink-0 mt-0.5">
                                    {a.category_name && (
                                        <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', a.category_color ?? 'bg-gray-100 text-gray-600')}>
                                            {a.category_name}
                                        </span>
                                    )}
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
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition shrink-0 mt-0.5" />
                            </button>
                        ))}
                    </div>
                )}
                <p className="text-xs text-slate-400 text-right">共 {filtered.length} 則公告</p>
            </main>

            {/* Detail Modal */}
            {selected && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
                            <div>
                                {selected.category_name && (
                                    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mb-2', selected.category_color ?? 'bg-gray-100 text-gray-600')}>
                                        {selected.category_name}
                                    </span>
                                )}
                                <h3 className="text-lg font-bold text-slate-800 leading-snug">{selected.title}</h3>
                                <p className="text-xs text-slate-400 mt-1">{selected.publish_date}</p>
                            </div>
                            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 transition shrink-0 mt-0.5">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5">
                            <div className="prose prose-sm max-w-none text-slate-700">
                                <ReactMarkdown components={{ img: () => null }}>
                                    {selected.content}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
