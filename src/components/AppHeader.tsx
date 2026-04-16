import { UserCircle, LogOut } from 'lucide-react';

interface AppHeaderProps {
    /** Display name shown in the user chip. Omit to hide the chip. */
    username?: string;
    /** Called when the logo / title is clicked. Omit to make the title non-clickable. */
    onGoHome?: () => void;
    /** Called when the logout button is clicked. Omit to hide the button. */
    onLogout?: () => void;
    /** Optional extra content rendered between the user chip and the logout button (e.g. RoleSwitcher). */
    extra?: React.ReactNode;
}

/**
 * Shared top navigation bar used across all internal pages.
 * Matches the design established in HomePage.
 */
export function AppHeader({ username, onGoHome, onLogout, extra }: AppHeaderProps) {
    return (
        <header className="bg-slate-900 text-white shadow-md sticky top-0 z-50">
            <div className="container mx-auto px-4 sm:px-6 py-4 flex justify-between items-center gap-4">
                {/* Left: Logo + Title */}
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white shrink-0">
                        W
                    </div>
                    <h1
                        className={[
                            'text-lg sm:text-xl font-bold tracking-tight truncate',
                            onGoHome ? 'cursor-pointer hover:text-blue-300 transition-colors' : '',
                        ].join(' ')}
                        onClick={onGoHome}
                        title={onGoHome ? '返回首頁' : undefined}
                    >
                        萬美基金會補助管理系統
                    </h1>
                </div>

                {/* Right: user chip + extras + logout */}
                {(username || extra || onLogout) && (
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {username && (
                            <div className="flex items-center gap-2 bg-slate-800 text-slate-200 px-2 sm:px-3 py-1.5 rounded-lg border border-slate-700">
                                <UserCircle className="w-4 h-4 text-slate-400" />
                                <span className="text-xs sm:text-sm font-medium truncate max-w-[80px] sm:max-w-none">
                                    {username}
                                </span>
                            </div>
                        )}
                        {extra}
                        {onLogout && (
                            <button
                                onClick={onLogout}
                                className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-300 hover:text-red-400 transition px-1 sm:px-2 py-1.5"
                                title="登出"
                            >
                                <LogOut className="w-4 h-4" />
                                <span className="hidden sm:inline">登出</span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </header>
    );
}
