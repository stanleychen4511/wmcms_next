import { Loader2 } from 'lucide-react';

export function LoadingSpinner() {
    return (
        <div className="flex flex-col items-center justify-center p-8 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <p className="text-sm">載入中...</p>
        </div>
    );
}

export function OverlaySpinner() {
    return (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
    );
}
