import { useState } from 'react';
import { ShieldCheck, Lock, User, AlertCircle } from 'lucide-react';
import { Role } from '../types';
import { loginAction } from '../app/actions/userActions';

interface LoginUser {
    id: string;      // The users table ID
    account: string; // The username for login
    username: string; // the decrypted real name or admin name
    roles: Role[];
}

interface LoginPageProps {
    onLogin: (user: LoginUser) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
    const [account, setAccount] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isShaking, setIsShaking] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        
        try {
            const result = await loginAction(account, password);
            
            if (result.success && result.user) {
                onLogin({ 
                    id: result.user.id,
                    account: result.user.account,
                    username: result.user.username, 
                    roles: result.user.roles 
                });
            } else {
                setError(result.error || '登入失敗，請再試一次');
                setIsShaking(true);
                setTimeout(() => setIsShaking(false), 500);
            }
        } catch (err) {
            setError('系統連線錯誤');
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 500);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex items-center justify-center p-4">
            {/* Background decorative elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500 opacity-10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500 opacity-10 rounded-full blur-3xl" />
            </div>

            <div
                className={`relative w-full max-w-md ${isShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}
                style={isShaking ? { animation: 'shake 0.4s ease-in-out' } : {}}
            >
                {/* Card */}
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8">
                    {/* Logo & Title */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
                            <ShieldCheck className="w-9 h-9 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">萬美基金會</h1>
                        <p className="text-slate-400 text-sm mt-1">補助管理系統</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Username */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">帳號</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={account}
                                    onChange={(e) => { setAccount(e.target.value); setError(''); }}
                                    placeholder="請輸入帳號"
                                    className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                    autoComplete="username"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">密碼</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                    placeholder="請輸入密碼"
                                    className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                    autoComplete="current-password"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-all duration-150 shadow-lg shadow-blue-900/30 mt-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {isLoading ? '登入中...' : '登入'}
                        </button>
                    </form>
                </div>
            </div>

            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    20% { transform: translateX(-8px); }
                    40% { transform: translateX(8px); }
                    60% { transform: translateX(-6px); }
                    80% { transform: translateX(6px); }
                }
            `}</style>
        </div>
    );
}
