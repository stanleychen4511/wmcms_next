import { Lock } from 'lucide-react';
import { AppState } from '../utils/storage';
import { encryptData } from '../utils/crypto';

interface DataExportProps {
    state: AppState;
    onLog: (action: string) => void;
}

export function DataExport({ state, onLog }: DataExportProps) {
    const handleDownload = () => {

        try {
            const jsonString = JSON.stringify(state, null, 2);
            // Simulate encryption with a key (in real app, user might provide a key or system uses a secure one)
            const secretKey = prompt('請輸入加密金鑰 (用於解密):', 'default-secret-key');

            if (!secretKey) return;

            const encrypted = encryptData(jsonString, secretKey);

            // Create blob and download
            const blob = new Blob([encrypted], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `wmcms_export_${new Date().toISOString().split('T')[0]}.wmc`; // Custom extension
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            onLog('匯出加密備份資料');
            alert('資料已加密並匯出成功！');
        } catch (e) {
            console.error('Export failed', e);
            alert('匯出失敗');
        }
    };


    return (
        <button
            onClick={handleDownload}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition"
            title="匯出加密資料"
        >
            <Lock className="w-4 h-4" />
            <span className="hidden sm:inline">加密匯出</span>
        </button>
    );
}
