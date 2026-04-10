import { useMemo } from 'react';
import {
    Activity,
    FileText,
    DollarSign,
    User,
} from 'lucide-react';
import { AppState } from '../utils/storage';

interface DashboardProps {
    state: AppState;
    applicantName: string;
    /** DB-driven: annual income from applications table */
    dbAnnualIncome?: number | null;
    /** 申請金額 */
    applyAmount?: number | null;
    /** 通過金額 */
    approvedAmount?: number | null;
}

export function Dashboard({ state, applicantName, dbAnnualIncome, applyAmount, approvedAmount }: DashboardProps) {
    const stats = useMemo(() => {
        return {
            applicantIncome: dbAnnualIncome !== undefined && dbAnnualIncome !== null
                ? dbAnnualIncome
                : state.applicant.annualIncome,
            stageName: (() => {
                switch (state.stage) {
                    case 'admin_review': return '行政初審';
                    case 'visit': return '家庭訪視';
                    case 'board_review': return '董事審核';
                    case 'reimbursement': return '核銷撥款';
                    default: return state.stage;
                }
            })()
        };
    }, [state, dbAnnualIncome]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Applicant Card */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center gap-4">
                <div className="p-3 bg-slate-50 rounded-full text-slate-600">
                    <User className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-sm text-gray-500">申請人</p>
                    <p className="text-lg font-bold text-gray-900">{applicantName}</p>
                </div>
            </div>

            {/* Stage Card */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-full text-blue-600">
                    <Activity className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-sm text-gray-500">目前階段</p>
                    <p className="text-lg font-bold text-gray-900">{stats.stageName}</p>
                </div>
            </div>

            {/* Apply Amount Card */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center gap-4">
                <div className="p-3 bg-green-50 rounded-full text-green-600">
                    <DollarSign className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-sm text-gray-500">申請金額</p>
                    <p className="text-lg font-bold text-gray-900">
                        {applyAmount != null ? `NT$ ${applyAmount.toLocaleString()}` : '—'}
                    </p>
                </div>
            </div>

            {/* Approved Amount Card */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center gap-4">
                <div className="p-3 bg-purple-50 rounded-full text-purple-600">
                    <FileText className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-sm text-gray-500">通過金額</p>
                    <p className="text-lg font-bold text-gray-900">
                        {approvedAmount != null && approvedAmount > 0 ? `NT$ ${approvedAmount.toLocaleString()}` : '—'}
                    </p>
                </div>
            </div>
        </div>
    );
}
