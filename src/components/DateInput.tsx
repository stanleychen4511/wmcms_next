'use client';

import { DayPicker } from '@daypicker/react';
import { zhTW } from '@daypicker/react/locale';
import { Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

const ROC_MONTH_FORMATTER = new Intl.DateTimeFormat('zh-TW-u-ca-roc', {
    year: 'numeric',
    month: 'long',
});
const ROC_YEAR_FORMATTER = new Intl.DateTimeFormat('zh-TW-u-ca-roc', { year: 'numeric' });
const ROC_DAY_FORMATTER = new Intl.DateTimeFormat('zh-TW-u-ca-roc', { dateStyle: 'full' });

const CALENDAR_STYLE = {
    '--rdp-accent-color': '#2563eb',
    '--rdp-accent-background-color': '#dbeafe',
    '--rdp-day-height': '36px',
    '--rdp-day-width': '36px',
    '--rdp-day_button-height': '34px',
    '--rdp-day_button-width': '34px',
} as CSSProperties;

export function formatDateDigits(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 7);
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}/${digits.slice(3)}`;
    return `${digits.slice(0, 3)}/${digits.slice(3, 5)}/${digits.slice(5)}`;
}

export function isoDateToText(value: string): string {
    if (!value) return '';
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return '';
    return `${String(Number(match[1]) - 1911).padStart(3, '0')}/${match[2]}/${match[3]}`;
}

export function dateTextToIso(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 7) return '';
    const yyyy = String(Number(digits.slice(0, 3)) + 1911);
    const mm = digits.slice(3, 5);
    const dd = digits.slice(5, 7);
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

export function isoDateToLocalDate(value: string): Date | undefined {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return undefined;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? undefined : date;
}

export function localDateToIso(date: Date): string {
    const yyyy = String(date.getFullYear()).padStart(4, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

export function formatRocMonth(date: Date): string {
    return ROC_MONTH_FORMATTER.format(date);
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
    placeholder = '民國YYY/MM/DD',
    title,
}: DateInputProps) {
    const [textDraft, setTextDraft] = useState({ sourceValue: value, text: isoDateToText(value) });
    const [isOpen, setIsOpen] = useState(false);
    const [month, setMonth] = useState(() => isoDateToLocalDate(value) ?? new Date());
    const [calendarPosition, setCalendarPosition] = useState({ top: 0, left: 0 });
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const calendarRef = useRef<HTMLDivElement | null>(null);
    const calendarId = useId();
    const selectedDate = isoDateToLocalDate(value);
    const textValue = textDraft.sourceValue === value ? textDraft.text : isoDateToText(value);

    useEffect(() => {
        if (!isOpen) return;

        const closeOnOutsidePointer = (event: PointerEvent) => {
            const target = event.target as Node;
            if (!wrapperRef.current?.contains(target) && !calendarRef.current?.contains(target)) {
                setIsOpen(false);
            }
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        const closeOnViewportChange = () => setIsOpen(false);

        document.addEventListener('pointerdown', closeOnOutsidePointer);
        document.addEventListener('keydown', closeOnEscape);
        window.addEventListener('resize', closeOnViewportChange);
        window.addEventListener('scroll', closeOnViewportChange, true);
        return () => {
            document.removeEventListener('pointerdown', closeOnOutsidePointer);
            document.removeEventListener('keydown', closeOnEscape);
            window.removeEventListener('resize', closeOnViewportChange);
            window.removeEventListener('scroll', closeOnViewportChange, true);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !calendarRef.current || !wrapperRef.current) return;
        const trigger = wrapperRef.current.getBoundingClientRect();
        const calendar = calendarRef.current.getBoundingClientRect();
        const gap = 4;
        const left = Math.min(Math.max(8, trigger.left), window.innerWidth - calendar.width - 8);
        const fitsBelow = trigger.bottom + gap + calendar.height <= window.innerHeight;
        const top = fitsBelow ? trigger.bottom + gap : Math.max(8, trigger.top - calendar.height - gap);
        setCalendarPosition({ top, left });
    }, [isOpen, month]);

    const openPicker = () => {
        if (disabled) return;
        const trigger = wrapperRef.current?.getBoundingClientRect();
        if (trigger) {
            setCalendarPosition({
                top: trigger.bottom + 4,
                left: Math.min(Math.max(8, trigger.left), window.innerWidth - 296),
            });
        }
        setMonth(selectedDate ?? new Date());
        setIsOpen(true);
    };

    return (
        <div ref={wrapperRef} className="relative min-w-0 w-full">
            <input
                type="text"
                value={textValue}
                onChange={e => {
                    const next = formatDateDigits(e.target.value);
                    setTextDraft({ sourceValue: value, text: next });
                    if (!next) {
                        onChange('');
                        return;
                    }
                    const iso = dateTextToIso(next);
                    if (iso) onChange(iso);
                }}
                onBlur={() => {
                    if (textValue && !dateTextToIso(textValue)) {
                        setTextDraft({ sourceValue: value, text: isoDateToText(value) });
                    }
                }}
                onFocus={openPicker}
                inputMode="numeric"
                maxLength={9}
                placeholder={placeholder}
                title={title ?? '請輸入民國日期，格式 YYY/MM/DD'}
                disabled={disabled}
                required={required}
                aria-haspopup="dialog"
                className={clsx('w-full pr-10', className)}
            />
            <button
                type="button"
                aria-label="開啟日期選擇器"
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                aria-controls={isOpen ? calendarId : undefined}
                onClick={() => isOpen ? setIsOpen(false) : openPicker()}
                disabled={disabled}
                className="absolute right-0 top-0 h-full w-10 cursor-pointer disabled:cursor-not-allowed"
            >
                <span className="sr-only">開啟日期選擇器</span>
            </button>
            <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            {isOpen && createPortal(
                <div
                    ref={calendarRef}
                    id={calendarId}
                    role="dialog"
                    aria-label="選擇民國日期"
                    className="fixed z-[100] max-h-[calc(100vh-1rem)] overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800 shadow-xl"
                    style={calendarPosition}
                >
                    <DayPicker
                        mode="single"
                        locale={zhTW}
                        selected={selectedDate}
                        month={month}
                        onMonthChange={setMonth}
                        onSelect={date => {
                            if (!date) return;
                            onChange(localDateToIso(date));
                            setIsOpen(false);
                        }}
                        captionLayout="dropdown"
                        navLayout="around"
                        startMonth={new Date(1912, 0)}
                        endMonth={new Date(2111, 11)}
                        showOutsideDays
                        fixedWeeks
                        formatters={{
                            formatCaption: formatRocMonth,
                            formatMonthDropdown: date => `${date.getMonth() + 1}月`,
                            formatYearDropdown: date => ROC_YEAR_FORMATTER.format(date),
                        }}
                        labels={{
                            labelDayButton: date => ROC_DAY_FORMATTER.format(date),
                            labelGrid: formatRocMonth,
                            labelMonthDropdown: () => '選擇月份',
                            labelYearDropdown: () => '選擇民國年份',
                            labelNext: () => '下一個月',
                            labelPrevious: () => '上一個月',
                        }}
                        style={CALENDAR_STYLE}
                    />
                    <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                onChange('');
                                setIsOpen(false);
                            }}
                            className="rounded px-2 py-1 text-blue-600 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            清除
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onChange(localDateToIso(new Date()));
                                setIsOpen(false);
                            }}
                            className="rounded px-2 py-1 text-blue-600 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            今天
                        </button>
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
}
