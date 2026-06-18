'use client';

import { Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import { useEffect, useRef, useState } from 'react';

export function formatDateDigits(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}/${digits.slice(4)}`;
    return `${digits.slice(0, 4)}/${digits.slice(4, 6)}/${digits.slice(6)}`;
}

export function isoDateToText(value: string): string {
    if (!value) return '';
    return formatDateDigits(value);
}

export function dateTextToIso(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 8) return '';
    const yyyy = digits.slice(0, 4);
    const mm = digits.slice(4, 6);
    const dd = digits.slice(6, 8);
    const date = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    if (
        Number.isNaN(date.getTime()) ||
        date.getFullYear() !== Number(yyyy) ||
        date.getMonth() + 1 !== Number(mm) ||
        date.getDate() !== Number(dd)
    ) {
        return '';
    }
    return `${yyyy}-${mm}-${dd}`;
}

interface DateInputProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    disabled?: boolean;
    required?: boolean;
    placeholder?: string;
    title?: string;
}

export function DateInput({
    value,
    onChange,
    className,
    disabled,
    required,
    placeholder = 'YYYY/MM/DD',
    title,
}: DateInputProps) {
    const [textValue, setTextValue] = useState(isoDateToText(value));
    const pickerRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        setTextValue(isoDateToText(value));
    }, [value]);

    const openPicker = () => {
        const picker = pickerRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
        if (!picker || disabled) return;
        if (picker.showPicker) {
            try {
                picker.showPicker();
            } catch {
                // Some browsers only allow showPicker during direct user activation.
            }
            return;
        }
        picker.focus();
        picker.click();
    };

    return (
        <div className="relative min-w-0 w-full">
            <input
                type="text"
                value={textValue}
                onChange={e => {
                    const next = formatDateDigits(e.target.value);
                    setTextValue(next);
                    if (!next) {
                        onChange('');
                        return;
                    }
                    const iso = dateTextToIso(next);
                    if (iso) onChange(iso);
                }}
                onBlur={() => {
                    if (textValue && !dateTextToIso(textValue)) {
                        setTextValue(isoDateToText(value));
                    }
                }}
                onFocus={openPicker}
                inputMode="numeric"
                maxLength={10}
                placeholder={placeholder}
                title={title ?? '請輸入西元日期，格式 YYYY/MM/DD'}
                disabled={disabled}
                required={required}
                className={clsx('w-full pr-10', className)}
            />
            <input
                ref={pickerRef}
                type="date"
                value={value}
                onChange={e => onChange(e.target.value)}
                disabled={disabled}
                aria-label="開啟日期選擇器"
                tabIndex={-1}
                className="absolute right-0 top-0 h-full w-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
            <button
                type="button"
                aria-label="開啟日期選擇器"
                onClick={openPicker}
                disabled={disabled}
                className="absolute right-0 top-0 h-full w-10 cursor-pointer disabled:cursor-not-allowed"
            >
                <span className="sr-only">開啟日期選擇器</span>
            </button>
            <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </div>
    );
}
