import { redirect } from 'next/navigation';
import { existsSync } from 'fs';
import path from 'path';
import { fetchPaymentReceiptPrintData } from '../../../actions/printDocumentActions';
import { CATEGORY_LABEL, type CaseCategory } from '../../../../lib/caseCategory';
import { numToChinese } from '../../../../lib/numToChinese';
import { toRocDate } from '../../../../lib/rocDate';
import { PrintButton } from '../../PrintButton';

interface Props {
    params: Promise<{ applicationId: string }>;
    searchParams: Promise<{ userId?: string }>;
}

/** 將金額 slot 圖案「仟佰拾萬仟佰拾元整」依國字大寫填入，無金額時留空 slots。 */
function AmountSlots({ amount }: { amount: number | null }) {
    // 格式：每一位一個格子，欄位固定七位 + 元整
    // 依 paper template 分段：仟佰拾 | 萬 | 仟佰拾元整
    const chinese = amount != null && amount > 0 ? numToChinese(amount) : '';
    if (chinese) {
        return (
            <span className="font-mono tracking-widest">
                新臺幣（大寫）{chinese} 元整
            </span>
        );
    }
    return (
        <span className="font-mono tracking-widest text-slate-500">
            新臺幣（大寫）仟 佰 拾 萬 仟 佰 拾 元整
        </span>
    );
}

/** 檢查 org_line_qr_url 是否是 public/ 內的相對路徑且檔案存在。 */
function qrExists(qrUrl: string): boolean {
    if (!qrUrl) return false;
    // 外部 URL（http/https）：相信它存在
    if (/^https?:\/\//i.test(qrUrl)) return true;
    // 相對路徑：對應 public/ 內的實體檔案
    try {
        const rel = qrUrl.startsWith('/') ? qrUrl.slice(1) : qrUrl;
        return existsSync(path.join(process.cwd(), 'public', rel));
    } catch {
        return false;
    }
}

export default async function PaymentReceiptPrintPage({ params, searchParams }: Props) {
    const { applicationId } = await params;
    const { userId } = await searchParams;

    if (!userId) {
        redirect('/');
    }

    const res = await fetchPaymentReceiptPrintData(applicationId, userId);
    if (!res.success) {
        if (res.error === '權限不足') {
            redirect('/');
        }
        return (
            <main className="p-8 text-center text-red-600">
                <h1 className="text-xl font-bold mb-2">無法載入列印資料</h1>
                <p>{res.error}</p>
            </main>
        );
    }

    const d = res.data;
    const showQr = qrExists(d.org.line_qr_url);
    // 列印當下的民國日期（render time = print time）
    const today = toRocDate(new Date());

    return (
        <main className="mx-auto max-w-[210mm] p-8 text-slate-900 bg-white">
            <PrintButton />

            <article className="text-[13px] leading-relaxed">
                {/* 大標題 */}
                <h1 className="text-2xl font-bold text-center mb-6">領款收據</h1>

                {/* Header：基金會資料 + QR */}
                <div className="flex justify-between gap-6 mb-4">
                    <div className="flex-1">
                        <p className="font-bold text-base mb-1">{d.org.full_name}</p>
                        <p><span className="font-semibold">核准立案字號：</span>{d.org.license_no}</p>
                        <p><span className="font-semibold">法人登記證：</span>{d.org.registration_no}</p>
                        <p><span className="font-semibold">統一編號：</span>{d.org.uniform_no}</p>
                        <p>{d.org.address}</p>
                        <p>
                            電話：{d.org.phone}　　傳真：{d.org.fax}
                        </p>
                    </div>

                    {/* QR area：存在 → <img>；不存在 → 空白邊框方塊（不顯示破圖） */}
                    <div className="w-[120px] h-[120px] flex flex-col items-center justify-center border border-slate-300 flex-shrink-0">
                        {showQr ? (
                            <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={d.org.line_qr_url}
                                    alt="LINE 加入志工 QR"
                                    className="w-full h-full object-contain"
                                />
                            </>
                        ) : (
                            <span className="text-xs text-slate-400">（LINE QR 未設定）</span>
                        )}
                    </div>
                </div>

                <table className="w-full border-collapse border-2 border-slate-900 text-[13px]">
                    <tbody>
                        {/* 此欄由基金會填寫 — 日期自動帶入列印當下的民國年月日 */}
                        <tr className="border-b border-slate-900">
                            <td colSpan={4} className="p-2 bg-slate-50">
                                <span className="font-semibold">此欄由基金會填寫：</span>
                                中華民國
                                <span className="mx-2 inline-block min-w-[2.5rem] border-b border-slate-900 text-center">{today?.year ?? ''}</span>
                                年
                                <span className="mx-2 inline-block min-w-[2rem] border-b border-slate-900 text-center">{today?.month ?? ''}</span>
                                月
                                <span className="mx-2 inline-block min-w-[2rem] border-b border-slate-900 text-center">{today?.day ?? ''}</span>
                                日
                                <span className="ml-6 font-semibold">收據編號：</span>
                                <span className="mx-2 inline-block min-w-[8rem] border-b border-slate-900">&nbsp;</span>
                            </td>
                        </tr>

                        {/* 申請人姓名 + 案號 */}
                        <tr className="border-b border-slate-900">
                            <th className="border-r border-slate-900 w-32 p-2 text-left align-middle font-bold bg-slate-50">
                                申請人<br />姓名（單位名稱）
                            </th>
                            <td className="border-r border-slate-900 p-2 w-48">{d.applicantName}</td>
                            <th className="border-r border-slate-900 w-28 p-2 text-left align-middle font-bold bg-slate-50">
                                申請案號
                            </th>
                            <td className="p-2 font-mono">{d.caseNumber}</td>
                        </tr>

                        {/* 統編/身分證 + 電話 */}
                        <tr className="border-b border-slate-900">
                            <th className="border-r border-slate-900 p-2 text-left align-middle font-bold bg-slate-50">
                                統一編號（單位）<br />身分證字號（個人）
                            </th>
                            <td className="border-r border-slate-900 p-2">{d.applicantIdNumber ?? '\u00A0'}</td>
                            <th className="border-r border-slate-900 p-2 text-left align-middle font-bold bg-slate-50">
                                電話
                            </th>
                            <td className="p-2">&nbsp;</td>
                        </tr>

                        {/* (空欄為手寫) 電郵 */}
                        <tr className="border-b border-slate-900">
                            <th className="border-r border-slate-900 p-2 text-left align-middle font-bold bg-slate-50">&nbsp;</th>
                            <td className="border-r border-slate-900 p-2">&nbsp;</td>
                            <th className="border-r border-slate-900 p-2 text-left align-middle font-bold bg-slate-50">
                                電郵
                            </th>
                            <td className="p-2">&nbsp;</td>
                        </tr>

                        {/* 地址 */}
                        <tr className="border-b border-slate-900">
                            <th className="border-r border-slate-900 p-2 text-left align-middle font-bold bg-slate-50">
                                地址
                            </th>
                            <td colSpan={3} className="p-2 min-h-[1.5rem]">&nbsp;</td>
                        </tr>

                        {/* 補助類別 */}
                        <tr className="border-b border-slate-900">
                            <th className="border-r border-slate-900 p-2 text-left align-middle font-bold bg-slate-50">
                                申請補助類別
                            </th>
                            <td colSpan={3} className="p-2">
                                <div className="flex gap-6 flex-wrap">
                                    {(Object.keys(CATEGORY_LABEL) as CaseCategory[]).map((code) => (
                                        <label key={code} className="flex items-center gap-2">
                                            <span className="inline-block w-4 h-4 border border-slate-900 text-center leading-none">
                                                {d.category === code ? '✓' : ''}
                                            </span>
                                            <span>
                                                {CATEGORY_LABEL[code].replace('補助', '')}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </td>
                        </tr>

                        {/* 領款金額（國字大寫） */}
                        <tr className="border-b border-slate-900">
                            <th className="border-r border-slate-900 p-2 text-left align-middle font-bold bg-slate-50">
                                領款金額
                            </th>
                            <td colSpan={3} className="p-2">
                                <AmountSlots amount={d.approvedAmount} />
                            </td>
                        </tr>

                        {/* 領款方式 */}
                        <tr className="border-b border-slate-900">
                            <th className="border-r border-slate-900 p-2 text-left align-top font-bold bg-slate-50">
                                領款方式
                            </th>
                            <td colSpan={3} className="p-2 space-y-1">
                                <p>
                                    <span className="inline-block w-4 h-4 border border-slate-900 mr-2"></span>
                                    <strong>匯款</strong>（檢附存摺封面影本）
                                </p>
                                <p className="pl-6">
                                    金融機構名稱：
                                    <span className="mx-2 inline-block min-w-[6rem] border-b border-slate-900">&nbsp;</span>
                                    銀行
                                    <span className="mx-2 inline-block min-w-[5rem] border-b border-slate-900">&nbsp;</span>
                                    分行
                                </p>
                                <p className="pl-6">帳號：<span className="mx-2 inline-block min-w-[14rem] border-b border-slate-900">&nbsp;</span></p>
                                <p>
                                    <span className="inline-block w-4 h-4 border border-slate-900 mr-2"></span>
                                    萬美基金會代為支付醫療費用予醫院
                                </p>
                            </td>
                        </tr>

                        {/* 具領人資料 + 簽名 */}
                        <tr className="border-b border-slate-900">
                            <td colSpan={2} className="border-r border-slate-900 p-2 align-top">
                                <p className="font-bold">具領人與申請人之關係：</p>
                                <p className="pl-4 mt-1">
                                    <span className="inline-block w-4 h-4 border border-slate-900 mr-2 align-middle"></span>
                                    本人，以下無需填寫
                                </p>
                                <p className="pl-4 mt-1">
                                    <span className="inline-block w-4 h-4 border border-slate-900 mr-2 align-middle"></span>
                                    非本人，與申請人關係
                                    <span className="mx-2 inline-block min-w-[5rem] border-b border-slate-900">&nbsp;</span>
                                    請填具領人資料
                                </p>
                                <div className="mt-3 space-y-2">
                                    <p><strong>具領人姓名：</strong><span className="ml-2 inline-block min-w-[12rem] border-b border-slate-900">&nbsp;</span></p>
                                    <p><strong>具領人身分證字號：</strong><span className="ml-2 inline-block min-w-[12rem] border-b border-slate-900">&nbsp;</span></p>
                                    <p><strong>具領人電話：</strong><span className="ml-2 inline-block min-w-[12rem] border-b border-slate-900">&nbsp;</span></p>
                                    <p>具領人戶籍住址：<span className="ml-2 inline-block min-w-[14rem] border-b border-slate-900">&nbsp;</span></p>
                                </div>
                            </td>
                            <td colSpan={2} className="p-2 align-top">
                                <p className="font-bold">具領人簽名（親筆簽名）：</p>
                                <div className="h-24"></div>
                                <p className="text-right mt-4">
                                    中華民國
                                    <span className="mx-2 inline-block min-w-[2.5rem] border-b border-slate-900">&nbsp;</span>
                                    年
                                    <span className="mx-2 inline-block min-w-[2rem] border-b border-slate-900">&nbsp;</span>
                                    月
                                    <span className="mx-2 inline-block min-w-[2rem] border-b border-slate-900">&nbsp;</span>
                                    日
                                </p>
                                <p className="text-right mt-2 text-xs">◎補助金額需列入當年度之所得申報</p>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* 承辦人 / 主管 / 會計 / 執行長 簽核列 */}
                <div className="mt-6 grid grid-cols-4 gap-6">
                    <div>
                        <span className="font-bold">承辦人：</span>
                        <span className="inline-block min-w-[5rem] border-b border-slate-900">&nbsp;</span>
                    </div>
                    <div>
                        <span className="font-bold">主管：</span>
                        <span className="inline-block min-w-[5rem] border-b border-slate-900">&nbsp;</span>
                    </div>
                    <div>
                        <span className="font-bold">會計：</span>
                        <span className="inline-block min-w-[5rem] border-b border-slate-900">&nbsp;</span>
                    </div>
                    <div>
                        <span className="font-bold">執行長：</span>
                        <span className="inline-block min-w-[5rem] border-b border-slate-900">&nbsp;</span>
                    </div>
                </div>
            </article>

            {/* 列印樣式：@page margin:0 讓瀏覽器不畫 header/footer/page number；
                內容用 padding 補視覺邊距；A4 紙張大小由 @page size 指定。 */}
            <style>{`
                @page { size: A4; margin: 0; }
                @media print {
                    html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
                    main { padding: 1.2cm !important; }
                    .no-print { display: none !important; }
                }
            `}</style>
        </main>
    );
}
