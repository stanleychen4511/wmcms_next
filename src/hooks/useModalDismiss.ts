'use client';

/**
 * useModalDismiss — 統一 modal 行為的小 hook
 *
 * 任何 modal 元件呼叫一次 `useModalDismiss(onClose)` 即可獲得：
 *   1. ESC 鍵關閉（堆疊式：巢狀 modal 只關最上層那一個）
 *   2. 背景捲動鎖（unmount 時還原原本的 body.overflow）
 *
 * 使用方式：
 *   ```tsx
 *   export function MyModal({ onClose }: Props) {
 *       useModalDismiss(onClose);
 *       return (
 *           <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
 *               <div onClick={e => e.stopPropagation()}>...</div>
 *           </div>
 *       );
 *   }
 *   ```
 *
 * 設計筆記：
 * - 採模組層 stack 而非個別 window listener，可正確處理巢狀 modal：
 *   按 ESC 只會觸發 stack 頂端那筆 onClose，不會把所有 modal 一起關掉。
 * - 用 ref 鎖住 onClose，呼叫端不必特別 useCallback；refresh 不會 re-bind listener。
 */

import { useEffect, useRef } from 'react';

type CloseHandler = () => void;
const stack: CloseHandler[] = [];
let listenerInstalled = false;

function ensureListener() {
    if (listenerInstalled || typeof window === 'undefined') return;
    listenerInstalled = true;
    window.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || stack.length === 0) return;
        // 只觸發最上層 modal；不 stopPropagation，畫面上的 input 仍可正常處理 ESC
        const top = stack[stack.length - 1];
        try { top(); } catch { /* swallow — modal 自己負責錯誤處理 */ }
    });
}

export function useModalDismiss(onClose: CloseHandler, options: {
    /** 設為 false 時不鎖背景捲動（少數情境用，例如 toast / 浮動面板） */
    lockBodyScroll?: boolean;
} = {}) {
    const { lockBodyScroll = true } = options;
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; });

    useEffect(() => {
        ensureListener();
        const handler: CloseHandler = () => onCloseRef.current();
        stack.push(handler);

        let prevOverflow = '';
        if (lockBodyScroll && typeof document !== 'undefined') {
            prevOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }

        return () => {
            const i = stack.lastIndexOf(handler);
            if (i >= 0) stack.splice(i, 1);
            if (lockBodyScroll && typeof document !== 'undefined') {
                document.body.style.overflow = prevOverflow;
            }
        };
    }, [lockBodyScroll]);
}

/**
 * 給 inline modal 用的零畫面元件 — 內部呼叫 useModalDismiss。
 *
 * 適用場景：modal JSX 寫在某個大型元件內 (`{open && <div className="fixed ...">...</div>}`)
 * 不便抽出成獨立 component 時，直接：
 *
 *   {open && (
 *     <div className="fixed inset-0 ..." onClick={() => setOpen(false)}>
 *       <ModalEscapeListener onClose={() => setOpen(false)} />
 *       ...
 *     </div>
 *   )}
 */
export function ModalEscapeListener({ onClose }: { onClose: CloseHandler }): null {
    useModalDismiss(onClose);
    return null;
}
