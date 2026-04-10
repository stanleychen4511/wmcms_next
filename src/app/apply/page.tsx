import { ExternalIntake } from '../../components/ExternalIntake';

export const metadata = {
    title: '線上補助申請 — 萬美基金會',
};

export default function ApplyPage() {
    return (
        <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
            {/* Header */}
            <header className="bg-slate-900 text-white shadow-md">
                <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white shrink-0">
                        W
                    </div>
                    <h1 className="text-lg font-bold tracking-tight">萬美基金會補助管理系統</h1>
                </div>
            </header>

            {/* Content */}
            <main className="container mx-auto px-4 sm:px-6 py-8 max-w-3xl">
                <ExternalIntake />
            </main>

            {/* Footer */}
            <footer className="text-center text-xs text-gray-400 py-6 mt-8 border-t border-gray-200">
                © 萬美基金會　如有問題請聯繫承辦人員
            </footer>
        </div>
    );
}
