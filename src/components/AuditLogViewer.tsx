import { useState } from 'react';
import { Search, Filter, Clock } from 'lucide-react';
import { Role } from '../types';

interface AuditLogViewerProps {
    logs: string[];
    className?: string;
}

export function AuditLogViewer({ logs, className = '' }: AuditLogViewerProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');

    const filteredLogs = logs.filter(log => {
        const matchesSearch = log.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'all' || log.includes(`[${roleFilter}]`);
        return matchesSearch && matchesRole;
    });

    return (
        <div className={`bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-96 ${className}`}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2 text-gray-800">
                    <Clock className="w-5 h-5 text-gray-500" />
                    系統稽核紀錄
                </h3>
                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                    共 {logs.length} 筆
                </span>
            </div>

            {/* Toolbar */}
            <div className="p-3 bg-gray-50 border-b border-gray-100 flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="搜尋操作紀錄..."
                        className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="relative shrink-0">
                    <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <select
                        className="w-full sm:w-auto pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value as Role | 'all')}
                    >
                        <option value="all">所有角色</option>
                        <option value="officer">社工 (Officer)</option>
                        <option value="director">董事 (Director)</option>
                        <option value="admin">管理員 (Admin)</option>
                        <option value="accounting">會計 (Accounting)</option>
                    </select>
                </div>
            </div>

            {/* Log List */}
            <div className="flex-1 overflow-auto p-0 overflow-x-auto">
                <table className="w-full text-sm text-left min-w-[500px] sm:min-w-0">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-4 py-2 w-48">時間</th>
                            <th className="px-4 py-2 w-24">角色</th>
                            <th className="px-4 py-2">操作內容</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLogs.length > 0 ? (
                            filteredLogs.map((log, index) => {
                                // Parse log format: [timestamp] [role] action
                                const match = log.match(/^\[(.*?)\] \[(.*?)\] (.*)$/);
                                if (match) {
                                    const [_, timestamp, role, action] = match;
                                    return (
                                        <tr key={index} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-2 text-gray-500 font-mono text-xs">{timestamp}</td>
                                            <td className="px-4 py-2">
                                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium 
                          ${role === 'admin' ? 'bg-red-100 text-red-800' :
                                                        role === 'director' ? 'bg-purple-100 text-purple-800' :
                                                            role === 'officer' ? 'bg-blue-100 text-blue-800' :
                                                                'bg-gray-100 text-gray-800'}`}>
                                                    {role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-gray-800">{action}</td>
                                        </tr>
                                    );
                                }
                                return (
                                    <tr key={index} className="border-b border-gray-100">
                                        <td colSpan={3} className="px-4 py-2 text-gray-600">{log}</td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={3} className="px-4 py-12 text-center text-gray-500">
                                    沒有找到符合的紀錄
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
