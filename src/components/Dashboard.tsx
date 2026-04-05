import { useMemo } from 'react';
import {
    Activity,
    FileText,
    CheckCircle,
    User,
} from 'lucide-react';
import { AppState } from '../utils/storage';

interface DashboardProps {
    state: AppState;
    applicantName: string;
}

export function Dashboard({ state, applicantName }: DashboardProps) {
    const stats = useMemo(() => {
        const verifiedDocs = state.documents.filter(d => d.status === 'verified').length;
        const totalDocs = state.documents.length;
        const completionRate = Math.round((verifiedDocs / totalDocs) * 100);

        return {
            verifiedDocs,
            totalDocs,
            completionRate,
            applicantIncome: state.applicant.annualIncome,
            stageName: (() => {
                switch (state.stage) {
                    case 'application': return '申請收件';
                    case 'admin_review': return '行政初審';
                    case 'visit': return '家庭訪視';
                    case 'board_review': return '董事審核';
                    case 'reimbursement': return '核銷撥款';
                    default: return state.stage;
                }
            })()
        };
    }, [state]);

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

            {/* Completion Card */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center gap-4">
                <div className="p-3 bg-green-50 rounded-full text-green-600">
                    <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-sm text-gray-500">文件完成度</p>
                    <p className="text-lg font-bold text-gray-900">{stats.completionRate}%</p>
                    <p className="text-xs text-gray-400">{stats.verifiedDocs}/{stats.totalDocs} 已審核</p>
                </div>
            </div>

            {/* Income Card */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center gap-4">
                <div className="p-3 bg-purple-50 rounded-full text-purple-600">
                    <FileText className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-sm text-gray-500">申請年收</p>
                    <p className="text-lg font-bold text-gray-900">{stats.applicantIncome} 萬</p>
                </div>
            </div>
        </div>
    );
}
