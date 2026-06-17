'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Loader2, Mail, ShieldCheck } from 'lucide-react';
import {
    confirmEmailVerificationCode,
    requestEmailVerificationCode,
    type EmailVerificationPurpose,
} from '../app/actions/emailVerificationActions';
import { clsx } from 'clsx';

interface Props {
    email: string;
    purpose: EmailVerificationPurpose;
    verifiedToken: string;
    onVerified: (token: string) => void;
    onReset: () => void;
    label?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailVerificationControl({
    email,
    purpose,
    verifiedToken,
    onVerified,
    onReset,
    label = 'Email',
}: Props) {
    const [lastEmail, setLastEmail] = useState(email.trim().toLowerCase());
    const [code, setCode] = useState('');
    const [sent, setSent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const normalizedEmail = email.trim().toLowerCase();
    const emailValid = EMAIL_RE.test(normalizedEmail);
    const verified = !!verifiedToken && normalizedEmail === lastEmail;

    useEffect(() => {
        if (normalizedEmail !== lastEmail) {
            setLastEmail(normalizedEmail);
            setSent(false);
            setCode('');
            setMessage('');
            setError('');
            onReset();
        }
    }, [lastEmail, normalizedEmail, onReset]);

    const sendCode = async () => {
        if (!emailValid || busy) return;
        setBusy(true);
        setError('');
        setMessage('');
        const res = await requestEmailVerificationCode(normalizedEmail, purpose);
        setBusy(false);
        if (res.success) {
            setSent(true);
            setCode('');
            setMessage('驗證碼已寄出，請至信箱收信');
        } else {
            setError(res.error);
        }
    };

    const verifyCode = async () => {
        if (!emailValid || busy) return;
        setBusy(true);
        setError('');
        setMessage('');
        const res = await confirmEmailVerificationCode(normalizedEmail, purpose, code);
        setBusy(false);
        if (res.success) {
            onVerified(res.data.token);
            setMessage(`${label} 已完成驗證`);
        } else {
            setError(res.error);
        }
    };

    return (
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                {verified ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <CheckCircle className="w-3.5 h-3.5" />
                        已驗證
                    </span>
                ) : (
                    <button
                        type="button"
                        onClick={sendCode}
                        disabled={!emailValid || busy}
                        className="inline-flex items-center gap-1.5 rounded border border-blue-300 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                        {sent ? '重新寄送驗證碼' : '寄送驗證碼'}
                    </button>
                )}
                <span className="text-xs text-slate-500">送出前需完成信箱驗證</span>
            </div>

            {!verified && sent && (
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="text"
                        inputMode="numeric"
                        value={code}
                        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6 位數驗證碼"
                        className="w-32 rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                        type="button"
                        onClick={verifyCode}
                        disabled={code.length !== 6 || busy}
                        className={clsx(
                            'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50',
                            'bg-emerald-600 hover:bg-emerald-700',
                        )}
                    >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        確認驗證
                    </button>
                </div>
            )}

            {message && <p className="text-xs text-emerald-700">{message}</p>}
            {error && <p className="text-xs text-rose-600">{error}</p>}
            {!emailValid && email.trim() && <p className="text-xs text-rose-600">請先輸入有效的 Email 格式</p>}
        </div>
    );
}
