import {
    FileText,
    DollarSign,
    User,
    Tag,
    TrendingUp,
    MinusCircle,
} from 'lucide-react';

const APPLICATION_TYPE_MAP: Record<string, { label: string; color: string }> = {
    A: { label: 'A類－自費醫療補助',         color: 'bg-blue-50 text-blue-600' },
    B: { label: 'B類－臨終安寧自費醫療補助', color: 'bg-purple-50 text-purple-600' },
    C: { label: 'C類－預立醫療照護諮商補助', color: 'bg-teal-50 text-teal-600' },
    D: { label: 'D類－醫事人員進修補助',     color: 'bg-orange-50 text-orange-600' },
};

interface DashboardProps {
    applicantName: string;
    /** DB-driven: annual income from applications table */
    dbAnnualIncome?: number | null;
    /** 申請金額 */
    applyAmount?: number | null;
    /** 通過金額（本案） */
    approvedAmount?: number | null;
    /** 申請類別代碼 A/B/C/D */
    applicationType?: string | null;
    /** 累積核准補助金額（所有已結案案件加總；不分子類型） */
    totalApprovedAmount?: number;
    /** 累積核准補助金額 — 經濟弱勢（subtype='1'）案件 */
    totalApprovedSubtype1?: number;
    /** 累積核准補助金額 — 小康家庭（subtype='2'）案件 */
    totalApprovedSubtype2?: number;
    /** 後台動態管理的子類型上限：subtypeMaxAmounts['1'] = 經濟弱勢上限, ['2'] = 小康家庭上限 */
    subtypeMaxAmounts?: Record<'1' | '2', number>;
}

export function Dashboard({
    applicantName, dbAnnualIncome, applyAmount, approvedAmount, applicationType,
    totalApprovedAmount,
    totalApprovedSubtype1, totalApprovedSubtype2,
    subtypeMaxAmounts,
}: DashboardProps) {
    const typeInfo = applicationType ? APPLICATION_TYPE_MAP[applicationType.toUpperCase()] : null;
    const cumulativeTotal = totalApprovedAmount ?? 0;

    // 每個子類型的累積金額（從 DB 查得），若沒給就退回 0
    const cumA = totalApprovedSubtype1 ?? 0;     // 經濟弱勢
    const cumB = totalApprovedSubtype2 ?? 0;     // 小康家庭
    // 後台管理的上限；沒設定（或為 0）時用 fallback 350000 避免顯示異常
    const FALLBACK_LIMIT = 350_000;
    const maxA = subtypeMaxAmounts?.['1'] && subtypeMaxAmounts['1'] > 0 ? subtypeMaxAmounts['1'] : FALLBACK_LIMIT;
    const maxB = subtypeMaxAmounts?.['2'] && subtypeMaxAmounts['2'] > 0 ? subtypeMaxAmounts['2'] : FALLBACK_LIMIT;
    const remainA = Math.max(0, maxA - cumA);
    const remainB = Math.max(0, maxB - cumB);
    const cumulativeAtLimit = (remainA <= 0) && (remainB <= 0);

    const fmt = (n: number) => `NT$ ${n.toLocaleString()}`;

    interface CardDef {
        label: string;
        icon: React.ReactNode;
        iconBg: string;
        value: React.ReactNode;
        /** flex 權重；不填預設 1。需要顯示更多內容（如多列、長文字）的卡用 2 */
        flex?: number;
        /** 對應的 min-width Tailwind class；不填使用預設 110px */
        minWidth?: string;
        /** 內容多列時必須拿掉 truncate */
        noTruncate?: boolean;
    }

    const cards: CardDef[] = [
        {
            label: '申請人',
            icon: <User className="w-4 h-4" />,
            iconBg: 'bg-slate-100 text-slate-600',
            value: <span className="truncate">{applicantName}</span>,
        },
        {
            label: '申請類別',
            icon: <Tag className="w-4 h-4" />,
            iconBg: typeInfo?.color ?? 'bg-slate-100 text-slate-600',
            value: <span className="leading-tight">{typeInfo ? typeInfo.label : '—'}</span>,
            flex: 2,
            minWidth: 'min-w-[160px]',
        },
        {
            label: '累積申請金額',
            icon: <TrendingUp className="w-4 h-4" />,
            iconBg: 'bg-amber-50 text-amber-600',
            value: (
                <span className={cumulativeAtLimit ? 'text-red-600' : ''}>
                    {cumulativeTotal > 0 ? fmt(cumulativeTotal) : '—'}
                </span>
            ),
        },
        {
            label: '申請金額',
            icon: <DollarSign className="w-4 h-4" />,
            iconBg: 'bg-green-50 text-green-600',
            value: <span>{applyAmount != null ? fmt(applyAmount) : '—'}</span>,
        },
        {
            // 「可申請餘額」拆成兩列：經濟弱勢 vs 小康家庭，上限由後台 subsidy_amount_limits 動態決定
            // 多列內容需 flex=2 並 noTruncate，否則 NT$ 30,000 等金額會被截斷
            label: '可申請餘額',
            icon: <MinusCircle className="w-4 h-4" />,
            iconBg: cumulativeAtLimit ? 'bg-red-50 text-red-500' : 'bg-sky-50 text-sky-600',
            value: (
                <span className="leading-tight block">
                    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                        <span className="text-[10px] text-slate-400 shrink-0">經濟弱勢</span>
                        <span className={remainA <= 0 ? 'text-red-600' : ''}>
                            {remainA <= 0 ? '已達上限' : fmt(remainA)}
                        </span>
                    </span>
                    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                        <span className="text-[10px] text-slate-400 shrink-0">小康家庭</span>
                        <span className={remainB <= 0 ? 'text-red-600' : ''}>
                            {remainB <= 0 ? '已達上限' : fmt(remainB)}
                        </span>
                    </span>
                </span>
            ),
            flex: 2,
            minWidth: 'min-w-[180px]',
            noTruncate: true,
        },
        {
            label: '通過金額',
            icon: <FileText className="w-4 h-4" />,
            iconBg: 'bg-purple-50 text-purple-600',
            value: <span>{approvedAmount != null && approvedAmount > 0 ? fmt(approvedAmount) : '—'}</span>,
        },
    ];

    return (
        <div className="flex flex-wrap lg:flex-nowrap gap-2 mb-4">
            {cards.map(card => {
                const flexClass = card.flex === 2 ? 'flex-[2]' : 'flex-1';
                const minWidthClass = card.minWidth ?? 'min-w-[110px]';
                return (
                    <div
                        key={card.label}
                        className={[
                            'bg-white px-3 py-2.5 rounded-lg shadow-sm border border-gray-200 flex items-center gap-2 min-w-0',
                            flexClass,
                            minWidthClass,
                        ].join(' ')}
                    >
                        <div className={`p-1.5 rounded-full shrink-0 ${card.iconBg}`}>
                            {card.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-400 whitespace-nowrap">{card.label}</p>
                            <p className={`text-sm font-bold text-gray-900 ${card.noTruncate ? '' : 'truncate'}`}>
                                {card.value}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
