import { useState } from 'react';
import { Mail, MessageSquare, Smartphone, Send, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface NotificationPanelProps {
    onSend: (channels: string[], message: string) => void;
    disabled?: boolean;
    applicantName: string;
    stageName: string;
}

export function NotificationPanel({ onSend, disabled = false, applicantName, stageName }: NotificationPanelProps) {
    const [selected, setSelected] = useState<string[]>(['mail']);
    const [message, setMessage] = useState('');

    const toggleChannel = (channel: string) => {
        setSelected(prev =>
            prev.includes(channel)
                ? prev.filter(c => c !== channel)
                : [...prev, channel]
        );
    };

    const fillTemplate = () => {
        setMessage(`申請人「${applicantName}」，目前階段「${stageName}」，請補件或後續追蹤`);
    };

    const handleSend = () => {
        if (selected.length > 0) {
            onSend(selected, message);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">通知發送</h3>

            <div className="flex flex-wrap gap-4 mb-5">
                <label className={twMerge(
                    "flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all",
                    selected.includes('mail') ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                )}>
                    <input
                        type="checkbox"
                        className="hidden"
                        checked={selected.includes('mail')}
                        onChange={() => toggleChannel('mail')}
                        disabled={disabled}
                    />
                    <Mail className={selected.includes('mail') ? "text-blue-600" : "text-gray-400"} />
                    <span className={clsx("font-medium", selected.includes('mail') ? "text-blue-900" : "text-gray-600")}>Email</span>
                </label>

                <label className={twMerge(
                    "flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all",
                    selected.includes('line') ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"
                )}>
                    <input
                        type="checkbox"
                        className="hidden"
                        checked={selected.includes('line')}
                        onChange={() => toggleChannel('line')}
                        disabled={disabled}
                    />
                    <MessageSquare className={selected.includes('line') ? "text-green-600" : "text-gray-400"} />
                    <span className={clsx("font-medium", selected.includes('line') ? "text-green-900" : "text-gray-600")}>LINE</span>
                </label>

                <label className={twMerge(
                    "flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all",
                    selected.includes('sms') ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"
                )}>
                    <input
                        type="checkbox"
                        className="hidden"
                        checked={selected.includes('sms')}
                        onChange={() => toggleChannel('sms')}
                        disabled={disabled}
                    />
                    <Smartphone className={selected.includes('sms') ? "text-orange-600" : "text-gray-400"} />
                    <span className={clsx("font-medium", selected.includes('sms') ? "text-orange-900" : "text-gray-600")}>SMS</span>
                </label>
            </div>

            {/* Message area */}
            <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">通知內容</label>
                    <button
                        type="button"
                        onClick={fillTemplate}
                        disabled={disabled}
                        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition disabled:opacity-40"
                    >
                        <FileText className="w-3 h-3" />
                        套用預設文字
                    </button>
                </div>
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={disabled}
                    placeholder="請輸入通知內容，或點選「套用預設文字」..."
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-50 disabled:text-gray-400"
                />
            </div>

            <button
                onClick={handleSend}
                disabled={disabled || selected.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-2.5 px-4 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <Send className="w-4 h-4" />
                發送通知 ({selected.length})
            </button>
        </div>
    );
}
