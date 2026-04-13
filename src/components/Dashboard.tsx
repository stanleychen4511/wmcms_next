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
    /** 累積核准補助金額（所有已結案案件加總） */
    totalApprovedAmount?: number;
}

const AMOUNT_LIMIT = 350_000;

export function Dashboard({ applicantName, dbAnnualIncome, applyAmount, approvedAmount, applicationType, totalApprovedAmount }: DashboardProps) {
    const typeInfo = applicationType ? APPLICATION_TYPE_MAP[applicationType.toUpperCase()] : null;
    const cumulative = totalApprovedAmount ?? 0;
    const remaining = Math.max(0, AMOUNT_LIMIT - cumulative);
    const isAtLimit = cumulative >= AMOUNT_LIMIT;

    const cards = [
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
        },
        {
            label: '累積申請金額',
            icon: <TrendingUp className="w-4 h-4" />,
            iconBg: 'bg-amber-50 text-amber-600',
            value: <span className={isAtLimit ? 'text-red-600' : ''}>{cumulative > 0 ? `NT$\u00a0${cumulative.toLocaleString()}` : '—'}</span>,
        },
        {
            label: '申請金額',
            icon: <DollarSign className="w-4 h-4" />,
            iconBg: 'bg-green-50 text-green-600',
            value: <span>{applyAmount != null ? `NT$\u00a0${applyAmount.toLocaleString()}` : '—'}</span>,
        },
        {
            label: '可申請餘額',
            icon: <MinusCircle className="w-4 h-4" />,
            iconBg: isAtLimit ? 'bg-red-50 text-red-500' : 'bg-sky-50 text-sky-600',
            value: <span className={isAtLimit ? 'text-red-600' : ''}>{isAtLimit ? '已達上限' : `NT$\u00a0${remaining.toLocaleString()}`}</span>,
        },
        {
            label: '通過金額',
            icon: <FileText className="w-4 h-4" />,
            iconBg: 'bg-purple-50 text-purple-600',
            value: <span>{approvedAmount != null && approvedAmount > 0 ? `NT$\u00a0${approvedAmount.toLocaleString()}` : '—'}</span>,
        },
    ];

    return (
        <div className="flex flex-wrap lg:flex-nowrap gap-2 mb-4">
            {cards.map((card, i) => (
                <div
                    key={card.label}
                    className={[
                        'bg-white px-3 py-2.5 rounded-lg shadow-sm border border-gray-200 flex items-center gap-2 min-w-0',
                        i === 1 ? 'flex-[2] min-w-[160px]' : 'flex-1 min-w-[110px]',
                    ].join(' ')}
                >
                    <div className={`p-1.5 rounded-full shrink-0 ${card.iconBg}`}>
                        {card.icon}
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-gray-400 whitespace-nowrap">{card.label}</p>
                        <p className="text-sm font-bold text-gray-900 truncate">{card.value}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}
