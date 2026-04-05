import { Role } from '../types';
import { UserCog } from 'lucide-react';

interface RoleSwitcherProps {
    currentRole: Role;
    availableRoles: Role[];
    onChange: (role: Role) => void;
}

export function RoleSwitcher({ currentRole, availableRoles, onChange }: RoleSwitcherProps) {
    // If user is admin, allow switching to any role (optional, but requested by logic usually)
    // Here we'll stick to what's in availableRoles.
    
    return (
        <div className="flex items-center gap-2 bg-slate-800 text-white px-3 py-1.5 rounded-lg border border-slate-700">
            <UserCog className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-300">當前身份:</span>
            <select
                value={currentRole}
                onChange={(e) => onChange(e.target.value as Role)}
                className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer"
            >
                {availableRoles.includes('admin') && <option value="admin" className="text-black">系統管理員 (Admin)</option>}
                {availableRoles.includes('case_officer') && <option value="case_officer" className="text-black">承辦人員 (Officer)</option>}
                {availableRoles.includes('board_member') && <option value="board_member" className="text-black">董事/審核委員 (Board Member)</option>}
                {availableRoles.includes('accountant') && <option value="accountant" className="text-black">會計 (Accountant)</option>}
                {availableRoles.includes('applicant') && <option value="applicant" className="text-black">申請人 (Applicant)</option>}
                {availableRoles.includes('social_worker') && <option value="social_worker" className="text-black">志工/社工 (Social Worker)</option>}
                {availableRoles.includes('supervisor') && <option value="supervisor" className="text-black">主管 (Supervisor)</option>}
            </select>
        </div>
    );
}
