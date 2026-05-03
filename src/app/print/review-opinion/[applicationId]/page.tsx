import { redirect } from 'next/navigation';
import { fetchReviewOpinionPrintData } from '../../../actions/printDocumentActions';
import { fetchSetting } from '../../../actions/settingsActions';
import { CATEGORY_LABEL, type CaseCategory } from '../../../../lib/caseCategory';
import { numToChinese } from '../../../../lib/numToChinese';
import { formatRocDate } from '../../../../lib/rocDate';
import { PrintButton } from '../../PrintButton';

interface Props {
    params: Promise<{ applicationId: string }>;
    searchParams: Promise<{ userId?: string }>;
}

/** 審核意見表列印頁（server component）。
 *  URL: /print/review-opinion/[applicationId]?userId=<operator>
 *  只有 admin / accountant 可以訪問；未授權 → redirect 回首頁。
 */
export default async function ReviewOpinionPrintPage({ params, searchParams }: Props) {
    const { applicationId } = await params;
    const { userId } = await searchParams;

    if (!userId) {
        redirect('/');
    }

    const res = await fetchReviewOpinionPrintData(applicationId, userId);
    if (!res.success) {
        // 權限不足或案件不存在
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
    const minCharsRaw = await fetchSetting('board_opinion_min_chars', '50');
    const minChars = Number(minCharsRaw);
    const minCharsValid = Number.isFinite(minChars) && minChars > 0 ? minChars : 0;

    return (
        <main className="mx-auto max-w-[210mm] p-8 text-slate-900 bg-white">
            <PrintButton />

            <article className="border-2 border-slate-900 p-0 text-[14px] leading-relaxed">
                {/* Header */}
                <header className="text-center py-4 border-b-2 border-slate-900">
                    <h1 className="text-2xl font-bold">財團法人萬美基金會</h1>
                    <h2 className="text-xl font-bold mt-1">補助案審核意見表</h2>
                </header>

                <table className="w-full border-collapse">
                    <tbody>
                        {/* 案件類別 */}
                        <tr className="border-b border-slate-900">
                            <th className="w-32 border-r border-slate-900 p-3 text-left align-middle font-bold bg-slate-50">
                                案件類別
                            </th>
                            <td className="p-3">
                                <div className="grid grid-cols-2 gap-y-2 gap-x-6">
                                    {(Object.keys(CATEGORY_LABEL) as CaseCategory[]).map((code) => (
                                        <label key={code} className="flex items-center gap-2">
                                            <span className="inline-block w-4 h-4 border border-slate-900 text-center leading-none">
                                                {d.category === code ? '✓' : ''}
                                            </span>
                                            <span>
                                                {CATEGORY_LABEL[code]}（{code}）
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </td>
                        </tr>

                        {/* 案件編號 */}
                        <tr className="border-b border-slate-900">
                            <th className="w-32 border-r border-slate-900 p-3 text-left align-middle font-bold bg-slate-50">
                                案件編號
                            </th>
                            <td className="p-3 font-mono">{d.caseNumber}</td>
                        </tr>

                        {/* 申請人 */}
                        <tr className="border-b border-slate-900">
                            <th className="w-32 border-r border-slate-900 p-3 text-left align-middle font-bold bg-slate-50">
                                申請人
                            </th>
                            <td className="p-3">{d.applicantName}</td>
                        </tr>

                        {/* 案件說明 */}
                        <tr className="border-b border-slate-900">
                            <th className="w-32 border-r border-slate-900 p-3 text-left align-top font-bold bg-slate-50">
                                案件說明
                            </th>
                            <td className="p-3 whitespace-pre-wrap min-h-[3rem]">
                                {d.caseDescription
                                    ? d.caseDescription
                                    : <span className="text-slate-400">（個管師尚未填寫案件說明）</span>}
                            </td>
                        </tr>

                        {/* 審核委員簽章 */}
                        <tr className="border-b border-slate-900">
                            <th className="w-32 border-r border-slate-900 p-3 text-left align-middle font-bold bg-slate-50">
                                審核委員<br />
                                <span className="text-xs font-normal">（電子簽章）</span>
                            </th>
                            <td className="p-3">
                                {d.signatures.length === 0 ? (
                                    <span className="text-slate-400">（尚無簽章）</span>
                                ) : (
                                    <div className="flex flex-wrap gap-4">
                                        {d.signatures.map((s, i) => (
                                            <div key={i} className="flex flex-col items-center">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={s.signatureDataUrl}
                                                    alt={`${s.signerName} 的簽章`}
                                                    className="h-16 max-w-[120px] object-contain border border-slate-200"
                                                />
                                                <span className="mt-1 text-xs">{s.signerName}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </td>
                        </tr>

                        {/* 審核意見 header */}
                        <tr className="border-b border-slate-900">
                            <td colSpan={2} className="text-center p-3 font-bold bg-slate-100">
                                審核意見
                            </td>
                        </tr>
                        <tr className="border-b border-slate-900">
                            <td colSpan={2} className="p-3">
                                {minCharsValid > 0 && (
                                    <p className="text-xs text-slate-500 pb-2 border-b border-slate-300">
                                        敬請委員敘明 {minCharsValid} 個字以上之意見，以利了解本案通過與否之考量，感謝您。
                                    </p>
                                )}
                                <div className="min-h-[10rem] whitespace-pre-wrap pt-3">
                                    {d.boardComments
                                        ? d.boardComments
                                        : <span className="text-slate-400">（未保存審核意見）</span>}
                                </div>
                            </td>
                        </tr>

                        {/* 審核結果 */}
                        <tr className="border-b border-slate-900">
                            <th className="w-32 border-r border-slate-900 p-3 text-left align-middle font-bold bg-slate-50">
                                審核結果
                            </th>
                            <td className="p-3 space-y-1">
                                <label className="flex items-center gap-2">
                                    <span className="inline-block w-4 h-4 border border-slate-900 text-center leading-none">
                                        {d.isApproved === true ? '✓' : ''}
                                    </span>
                                    <span>
                                        准予補助，新台幣
                                        <span className="mx-2 inline-block min-w-[8rem] border-b border-slate-900 text-center">
                                            {d.approvedAmount != null && d.approvedAmount > 0
                                                ? d.approvedAmount.toLocaleString('zh-TW')
                                                : '\u00A0'}
                                        </span>
                                        元
                                    </span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <span className="inline-block w-4 h-4 border border-slate-900 text-center leading-none">
                                        {d.isApproved === false ? '✓' : ''}
                                    </span>
                                    <span>不准予補助</span>
                                </label>
                            </td>
                        </tr>

                        {/* 審核日期 */}
                        <tr>
                            <th className="w-32 border-r border-slate-900 p-3 text-left align-middle font-bold bg-slate-50">
                                審核日期
                            </th>
                            <td className="p-3">
                                {d.reviewDate ? formatRocDate(d.reviewDate) : (
                                    <span>
                                        民國
                                        <span className="mx-2 inline-block min-w-[3rem] border-b border-slate-900">&nbsp;</span>
                                        年
                                        <span className="mx-2 inline-block min-w-[2rem] border-b border-slate-900">&nbsp;</span>
                                        月
                                        <span className="mx-2 inline-block min-w-[2rem] border-b border-slate-900">&nbsp;</span>
                                        日
                                    </span>
                                )}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* 大寫金額備註（若有核准金額） */}
                {d.isApproved === true && d.approvedAmount != null && d.approvedAmount > 0 && (
                    <p className="p-3 text-sm text-slate-600 border-t border-slate-300">
                        新台幣大寫：{numToChinese(d.approvedAmount)} 元整
                    </p>
                )}
            </article>

            {/* 列印樣式：@page margin:0 讓瀏覽器不畫 header/footer/page number；
                內容用 padding 補視覺邊距；A4 紙張大小由 @page size 指定。 */}
            <style>{`
                @page { size: A4; margin: 0; }
                @media print {
                    html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
                    main { padding: 1.5cm !important; }
                    .no-print { display: none !important; }
                }
            `}</style>
        </main>
    );
}
