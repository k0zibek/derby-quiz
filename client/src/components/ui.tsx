import { QRCodeCanvas } from "qrcode.react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import type { Locale, Theme } from "../preferences";

type Tone = "primary" | "neutral" | "success" | "warning" | "danger";

const toneClasses: Record<Tone, string> = {
    primary: "button-primary",
    neutral: "button-neutral",
    success: "button-success",
    warning: "button-warning",
    danger: "button-danger",
};

function cn(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ");
}

export function Button({
    tone = "primary",
    className,
    children,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
    return (
        <button
            className={cn(
                "inline-flex min-h-12 items-center justify-center rounded-xl px-5 py-3 text-sm font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45",
                toneClasses[tone],
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}

export function Panel({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={cn("rounded-2xl border border-(--border) bg-(--surface) p-5 shadow-sm shadow-slate-900/5", className)}>
            {children}
        </section>
    );
}

export function StatusPill({
    children,
    tone = "neutral",
    className,
}: {
    children: ReactNode;
    tone?: "neutral" | "blue" | "green" | "amber" | "red";
    className?: string;
}) {
    const styles = {
        neutral: "bg-(--surface-soft) text-(--text-muted)",
        blue: "bg-sky-100 text-sky-800",
        green: "bg-emerald-100 text-emerald-800",
        amber: "bg-amber-100 text-amber-800",
        red: "bg-rose-100 text-rose-800",
    };

    return (
        <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-bold", styles[tone], className)}>
            {children}
        </span>
    );
}

export function Progress({
    value,
    color = "#0284c7",
    className,
}: {
    value: number;
    color?: string;
    className?: string;
}) {
    return (
        <div className={cn("h-2.5 overflow-hidden rounded-full bg-(--progress-track)", className)}>
            <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
            />
        </div>
    );
}

export function Modal({
    open,
    title,
    children,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
}: {
    open: boolean;
    title: string;
    children: ReactNode;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-(--surface) p-5 shadow-2xl">
                <h2 className="text-xl font-black text-(--text)">{title}</h2>
                <div className="mt-2 text-sm leading-6 text-(--text-muted)">{children}</div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                    <Button tone="neutral" onClick={onCancel}>
                        {cancelLabel}
                    </Button>
                    <Button tone="danger" onClick={onConfirm}>
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export function QrBlock({
    value,
    code,
    label,
}: {
    value: string;
    code: string;
    label: string;
}) {
    return (
        <div className="grid justify-items-center gap-3">
            <div className="rounded-2xl border border-(--border) bg-white p-4 shadow-sm">
                <QRCodeCanvas value={value || "https://example.com"} size={188} />
            </div>
            <div className="text-center">
                <div className="text-xs font-bold uppercase tracking-wide text-(--text-muted)">{label}</div>
                <div className="mt-1 font-mono text-5xl font-black tracking-[0.16em] text-(--text)">{code || "----"}</div>
            </div>
        </div>
    );
}

export function InlineNotice({
    children,
    tone = "neutral",
}: {
    children: ReactNode;
    tone?: "neutral" | "danger" | "success";
}) {
    const styles = {
        neutral: "border-(--border) bg-(--surface) text-(--text-muted)",
        danger: "border-rose-200 bg-rose-50 text-rose-800",
        success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };

    return <div className={cn("rounded-xl border px-4 py-3 text-sm font-semibold", styles[tone])}>{children}</div>;
}

export function AppShell({
    children,
    className,
    variant = "app",
}: {
    children: ReactNode;
    className?: string;
    variant?: "app" | "screen" | "player";
}) {
    return (
        <main className={cn("min-h-screen text-(--text)", variant === "screen" ? "bg-(--screen-bg) p-5" : "bg-(--background)", variant === "player" ? "p-4" : "", className)}>
            {children}
        </main>
    );
}

export function TopBar({
    children,
    controls,
    className,
}: {
    children: ReactNode;
    controls?: ReactNode;
    className?: string;
}) {
    return (
        <header className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
            <div className="min-w-0">{children}</div>
            {controls ? <div className="flex flex-wrap items-center justify-end gap-2">{controls}</div> : null}
        </header>
    );
}

export function SegmentedTabs<T extends string>({
    items,
    value,
    onChange,
    ariaLabel,
}: {
    items: Array<{ value: T; label: string; disabled?: boolean }>;
    value: T;
    onChange: (value: T) => void;
    ariaLabel?: string;
}) {
    return (
        <div
            aria-label={ariaLabel}
            className="inline-flex rounded-xl border border-(--border) bg-(--surface-soft) p-1"
            role="group"
        >
            {items.map((item) => (
                <button
                    key={item.value}
                    aria-pressed={value === item.value}
                    className={cn(
                        "min-h-10 rounded-lg px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40",
                        value === item.value
                            ? "bg-(--surface) text-(--text) shadow-sm"
                            : "text-(--text-muted) hover:text-(--text)"
                    )}
                    disabled={item.disabled}
                    onClick={() => onChange(item.value)}
                    type="button"
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
}

export function LanguageToggle({
    locale,
    onChange,
}: {
    locale: Locale;
    onChange: (locale: Locale) => void;
}) {
    return (
        <SegmentedTabs
            items={[
                { value: "kk", label: "Қаз" },
                { value: "ru", label: "Рус" },
            ]}
            ariaLabel="Language"
            value={locale}
            onChange={onChange}
        />
    );
}

export function ThemeToggle({
    theme,
    onChange,
}: {
    theme: Theme;
    onChange: (theme: Theme) => void;
}) {
    return (
        <SegmentedTabs
            items={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
            ]}
            ariaLabel="Theme"
            value={theme}
            onChange={onChange}
        />
    );
}

export function AnswerTile({
    children,
    disabled,
    onClick,
    colorClass,
}: {
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    colorClass: string;
}) {
    return (
        <button
            className={cn(
                "min-h-24 rounded-2xl border-2 p-4 text-left shadow-sm transition active:scale-[0.99] disabled:opacity-55",
                colorClass
            )}
            disabled={disabled}
            onClick={onClick}
        >
            {children}
        </button>
    );
}
