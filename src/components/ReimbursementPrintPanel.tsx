'use client';

import { useState, useRef } from 'react';
import { Printer, FileText, Receipt, CreditCard, Layers, Loader2 } from 'lucide-react';
import { fetchMedicalReceipts } from '../app/actions/printDocumentActions';

interface Props {
    applicationId: string;
    operatorUserId: string;
}

/** 從 URL 推測副檔名（小寫不含點） */
function getFileExt(url: string): string {
    try {
        const u = new URL(url, window.location.origin);
        const path = u.pathname;
        const m = path.match(/\.([a-zA-Z0-9]+)$/);
        return m ? m[1].toLowerCase() : '';
    } catch {
        const m = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
        return m ? m[1].toLowerCase() : '';
    }
}

/**
 * 醫療收據列印 URL：
 * - PDF / 圖片 → 直接 iframe 載入原檔（瀏覽器原生渲染後可印）
 * - DOCX / DOC → 走 /print/docx 用 docx-preview 渲染成 HTML 再印
 * - 其他（不認得的副檔名）→ 直接開原檔（瀏覽器自行決定要顯示或下載）
 */
function buildMedicalReceiptPrintUrl(fileUrl: string): string {
    const ext = getFileExt(fileUrl);
    if (ext === 'docx' || ext === 'doc') {
        return `/print/docx?fileUrl=${encodeURIComponent(fileUrl)}&autoPrint=1`;
    }
    return fileUrl;
}

/**
 * 將 URL 載入隱藏 iframe，等載完後自動觸發瀏覽器列印對話框。
 * autoPrint=1 query param 由列印頁的 PrintButton 元件偵測並呼叫 window.print()。
 *
 * 回傳的 Promise 在使用者關閉列印對話框（無論列印或取消）後 1.2 秒 resolve，
 * 讓「一鍵列印全部」可以序列等待下一份。
 */
function printInHiddenIframe(url: string): Promise<void> {
    return new Promise((resolve) => {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:-99999px;bottom:-99999px;width:0;height:0;border:0;visibility:hidden;';
        iframe.src = url;
        let settled = false;
        const cleanup = () => {
            if (settled) return;
            settled = true;
            try { iframe.remove(); } catch { /* noop */ }
            resolve();
        };
        iframe.onload = () => {
            // PrintButton 內 autoPrint useEffect 會自己 window.print()。
            // 我們等 print dialog 關閉（modal blocking ends）後再清掉 iframe。
            // setTimeout 給 print dialog 出現時間 + 用戶決定時間 buffer。
            setTimeout(cleanup, 1500);
        };
        iframe.onerror = cleanup;
        // safety net：8 秒後一定 cleanup
        setTimeout(cleanup, 8000);
        document.body.appendChild(iframe);
    });
}

export function ReimbursementPrintPanel({ applicationId, operatorUserId }: Props) {
    const [busy, setBusy] = useState<string | null>(null);
    const printingAllRef = useRef(false);

    const reviewOpinionUrl = `/print/review-opinion/${applicationId}?userId=${encodeURIComponent(operatorUserId)}&autoPrint=1`;
    const paymentReceiptUrl = `/print/payment-receipt/${applicationId}?userId=${encodeURIComponent(operatorUserId)}&autoPrint=1`;

    async function printOne(label: string, url: string) {
        if (busy) return;
        setBusy(label);
        try {
            await printInHiddenIframe(url);
        } finally {
            setBusy(null);
        }
    }

    async function printMedicalReceipt() {
        if (busy) return;
        setBusy('醫療收據');
        try {
            const res = await fetchMedicalReceipts(applicationId, operatorUserId);
            if (!res.success) {
                alert(res.error || '查詢失敗');
                return;
            }
            const files = res.data;
            if (files.length === 0) {
                alert('該案尚未上傳醫療收據');
                return;
            }
            for (const f of files) {
                await printInHiddenIframe(buildMedicalReceiptPrintUrl(f.fileUrl));
            }
        } finally {
            setBusy(null);
        }
    }

    /**
     * 一鍵列印全部：序列觸發三份的列印對話框（用戶逐個確認）。
     * 醫療收據未上傳則跳過。
     */
    async function printAll() {
        if (busy || printingAllRef.current) return;
        printingAllRef.current = true;
        try {
            setBusy('審核意見表');
            await printInHiddenIframe(reviewOpinionUrl);

            setBusy('領款收據');
            await printInHiddenIframe(paymentReceiptUrl);

            setBusy('醫療收據');
            const res = await fetchMedicalReceipts(applicationId, operatorUserId);
            if (res.success && res.data.length > 0) {
                for (const f of res.data) {
                    await printInHiddenIframe(buildMedicalReceiptPrintUrl(f.fileUrl));
                }
            }
            // 若未上傳，靜默跳過（依需求）
        } finally {
            setBusy(null);
            printingAllRef.current = false;
        }
    }

    const Spinner = busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-600" />
                文件列印
                {busy && (
                    <span className="ml-2 text-xs font-normal text-slate-500 inline-flex items-center gap-1">
                        {Spinner}
                        列印中：{busy}
                    </span>
                )}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
                按下任一按鈕後瀏覽器列印對話框會直接出現（不會開新視窗）。對話框中可選擇實體印表機或「另存為 PDF」。
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                    type="button"
                    onClick={() => printOne('審核意見表', reviewOpinionUrl)}
                    disabled={!!busy}
                    className="flex items-center gap-3 px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 rounded-lg transition text-sm font-medium disabled:opacity-50"
                >
                    <FileText className="w-5 h-5 flex-shrink-0" />
                    <div className="text-left">
                        <div>審核意見表</div>
                        <div className="text-[11px] text-blue-600 font-normal">含董事簽章</div>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={printMedicalReceipt}
                    disabled={!!busy}
                    className="flex items-center gap-3 px-4 py-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg transition text-sm font-medium disabled:opacity-50"
                >
                    <Receipt className="w-5 h-5 flex-shrink-0" />
                    <div className="text-left">
                        <div>醫療收據</div>
                        <div className="text-[11px] text-emerald-600 font-normal">已上傳檔案</div>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => printOne('領款收據', paymentReceiptUrl)}
                    disabled={!!busy}
                    className="flex items-center gap-3 px-4 py-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg transition text-sm font-medium disabled:opacity-50"
                >
                    <CreditCard className="w-5 h-5 flex-shrink-0" />
                    <div className="text-left">
                        <div>領款收據</div>
                        <div className="text-[11px] text-amber-600 font-normal">供具領人簽收</div>
                    </div>
                </button>
            </div>

            <div className="mt-3">
                <button
                    type="button"
                    onClick={printAll}
                    disabled={!!busy}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition text-sm font-semibold disabled:opacity-50"
                >
                    <Layers className="w-5 h-5" />
                    一鍵列印全部（含醫療收據；未上傳則跳過）
                </button>
            </div>
        </div>
    );
}
