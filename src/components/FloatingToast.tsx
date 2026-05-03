'use client';

/**
 * FloatingToast — 全域浮動提示元件（#共用元件）
 *
 * 設計準則：
 *  - Provider 模式：在 App 根掛一次 `<FloatingToastProvider>`，所有後代用 `useToast()` push
 *  - `position: fixed` 右下角，**不影響 document flow**（避免儲存後頁面捲動）
 *  - 自動消失（預設 2.5 秒）；可設 0 不自動消失
 *  - 多筆同時垂直堆疊
 *  - z-50 + drop-shadow，可覆蓋 modal
 *
 * 用法：
 * 1. 在 App 根組件 wrap：
 *    <FloatingToastProvider>{children}</FloatingToastProvider>
 * 2. 任何後代元件：
 *    const { push } = useToast();
 *    push({ type: 'success', msg: '已儲存' });
 *
 * 不需要再個別放 <FloatingToastStack>。
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastInput {
    type: ToastType;
    msg: string;
    /** 自動消失毫秒數；0 = 不自動消失。預設 2500 */
    durationMs?: number;
}

interface ToastMessage extends ToastInput {
    id: number;
}

interface ToastContextValue {
    push: (t: ToastInput) => void;
    dismiss: (id: number) => void;
    clear: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        // Fallback：未在 Provider 包裹下使用時不報錯，但 console.warn 一次提醒
        if (typeof window !== 'undefined') {
            console.warn('[useToast] 必須在 <FloatingToastProvider> 之內使用；目前 push 將無作用。');
        }
        return {
            push: () => {},
            dismiss: () => {},
            clear: () => {},
        };
    }
    return ctx;
}

export function FloatingToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const push = useCallback((t: ToastInput) => {
        setToasts(prev => [...prev, { ...t, id: Date.now() + Math.random() }]);
    }, []);

    const dismiss = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const clear = useCallback(() => setToasts([]), []);

    return (
        <ToastContext.Provider value={{ push, dismiss, clear }}>
            {children}
            <FloatingToastStack toasts={toasts} onDismiss={dismiss} />
        </ToastContext.Provider>
    );
}

// ─── 渲染元件（Provider 內部使用，外部不需直接呼叫） ─────────

function FloatingToastStack({
    toasts, onDismiss,
}: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
    return (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
            {toasts.map(t => (
                <FloatingToastItem key={t.id} toast={t} onDismiss={onDismiss} />
            ))}
        </div>
    );
}

function FloatingToastItem({
    toast, onDismiss,
}: { toast: ToastMessage; onDismiss: (id: number) => void }) {
    useEffect(() => {
        const ms = toast.durationMs ?? 2500;
        if (ms <= 0) return;
        const timer = setTimeout(() => onDismiss(toast.id), ms);
        return () => clearTimeout(timer);
    }, [toast, onDismiss]);

    const colorClass =
        toast.type === 'success' ? 'bg-emerald-600 text-white'
        : toast.type === 'error' ? 'bg-red-600 text-white'
        : 'bg-slate-700 text-white';

    return (
        <div className={`pointer-events-auto inline-flex items-start gap-2 px-4 py-3 rounded-lg shadow-xl min-w-[220px] max-w-[400px] ${colorClass}`}>
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            {toast.type === 'error'   && <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
            <span className="text-sm flex-1 whitespace-pre-wrap break-words">{toast.msg}</span>
            <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="text-white/70 hover:text-white shrink-0"
                title="關閉"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}
