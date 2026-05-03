import { useState } from 'react';
import { Mail, MessageSquare, Smartphone, Send, FileText, X, Bell } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface NotificationModalProps {
    applicantName: string;
    stageName: string;
    onSend: (channels: string[], message: string) => void;
}

interface NotificationModalTriggerProps extends NotificationModalProps {
    disabled?: boolean;
}

export function NotificationModalTrigger({
    applicantName,
    stageName,
    onSend,
    disabled = false,
}: NotificationModalTriggerProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                disabled={disabled}
                className="flex items-center gap-2 px-4 py-2 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition text-sm font-medium disabled:opacity-50"
            >
                <Bell className="w-4 h-4" />
                發送通知
            </button>

            {open && (
                <NotificationModal
                    applicantName={applicantName}
                    stageName={stageName}
                    onSend={(channels, message) => {
                        onSend(channels, message);
                        setOpen(false);
                    }}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
}

interface ModalProps extends NotificationModalProps {
    onClose: () => void;
}

function NotificationModal({ applicantName, stageName, onSend, onClose }: ModalProps) {
    useModalDismiss(onClose);
    const [selected, setSelected] = useState<string[]>(['mail']);
    const [message, setMessage] = useState('');

    const toggleChannel = (channel: string) => {
        setSelected(prev =>
            prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]
        );
    };

    const fillTemplate = () => {
        setMessage(`申請人「${applicantName}」，目前階段「${stageName}」，請補件或後續追蹤。`);
    };

    const handleSend = () => {
        if (selected.length > 0) onSend(selected, message);
    };

    const channels = [
        { id: 'mail',  label: 'Email', icon: Mail,         active: 'border-blue-500 bg-blue-50',   icon_active: 'text-blue-600',   text_active: 'text-blue-900' },
        { id: 'line',  label: 'LINE',  icon: MessageSquare, active: 'border-green-500 bg-green-50', icon_active: 'text-green-600',  text_active: 'text-green-900' },
        { id: 'sms',   label: 'SMS',   icon: Smartphone,    active: 'border-orange-500 bg-orange-50', icon_active: 'text-orange-600', text_active: 'text-orange-900' },
    ];

    return (
        /* Backdrop */
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            {/* Panel */}
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-slate-700" />
                        <h2 className="text-lg font-semibold text-slate-800">發送通知</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition rounded-md p-1 hover:bg-gray-100"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Stage info */}
                <p className="text-sm text-gray-500 mb-4">
                    申請人：<span className="font-medium text-gray-800">{applicantName}</span>
                    　階段：<span className="font-medium text-gray-800">{stageName}</span>
                </p>

                {/* Channel selection */}
                <div className="flex flex-wrap gap-3 mb-5">
                    {channels.map(({ id, label, icon: Icon, active, icon_active, text_active }) => (
                        <label
                            key={id}
                            className={twMerge(
                                "flex items-center gap-2.5 px-4 py-2.5 rounded-lg border-2 cursor-pointer transition-all select-none",
                                selected.includes(id) ? active : "border-gray-200 hover:border-gray-300"
                            )}
                        >
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={selected.includes(id)}
                                onChange={() => toggleChannel(id)}
                            />
                            <Icon className={clsx("w-4 h-4", selected.includes(id) ? icon_active : "text-gray-400")} />
                            <span className={clsx("text-sm font-medium", selected.includes(id) ? text_active : "text-gray-600")}>
                                {label}
                            </span>
                        </label>
                    ))}
                </div>

                {/* Message area */}
                <div className="mb-5 space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">通知內容</label>
                        <button
                            type="button"
                            onClick={fillTemplate}
                            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition"
                        >
                            <FileText className="w-3 h-3" />
                            套用預設文字
                        </button>
                    </div>
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="請輸入通知內容，或點選「套用預設文字」..."
                        rows={4}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                </div>

                {/* Footer buttons */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 px-4 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
                    >
                        取消
                    </button>
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={selected.length === 0}
                        className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white py-2.5 px-4 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
                    >
                        <Send className="w-4 h-4" />
                        發送 ({selected.length})
                    </button>
                </div>
            </div>
        </div>
    );
}
