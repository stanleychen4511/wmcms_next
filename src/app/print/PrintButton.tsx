'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * 列印按鈕 + autoPrint 自動觸發。
 *
 * 兩種使用情境：
 * - 直接訪問 URL（無 autoPrint 參數）：顯示按鈕，使用者按下才列印
 * - 由 hidden iframe 載入（?autoPrint=1）：頁面 mount 後自動 window.print()，
 *   且按鈕區塊不顯示（避免在 iframe 中佔位置雖然反正會被列印 CSS 隱藏）
 */
export function PrintButton() {
    const params = useSearchParams();
    const autoPrint = params.get('autoPrint') === '1';

    useEffect(() => {
        if (!autoPrint) return;
        // 等 layout 完成 + fonts/images 載完一個 tick
        const t = setTimeout(() => {
            try {
                window.focus();
                window.print();
            } catch (e) {
                console.error('[autoPrint] failed', e);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [autoPrint]);

    if (autoPrint) return null;

    return (
        <div className="no-print mb-4 flex gap-3 justify-end">
            <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition cursor-pointer"
            >
                列印 / 存為 PDF
            </button>
            <button
                type="button"
                onClick={() => window.close()}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition cursor-pointer"
            >
                關閉視窗
            </button>
        </div>
    );
}
