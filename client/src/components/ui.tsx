import { QRCodeCanvas } from "qrcode.react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Tone = "primary" | "neutral" | "success" | "warning" | "danger";

const toneClasses: Record<Tone, string> = {
    primary: "bg-sky-600 text-white shadow-sky-900/15 hover:bg-sky-700",
    neutral: "border border-slate-200 bg-white text-slate-800 shadow-slate-900/5 hover:bg-slate-50",
    success: "bg-emerald-600 text-white shadow-emerald-900/15 hover:bg-emerald-700",
    warning: "bg-amber-500 text-white shadow-amber-900/15 hover:bg-amber-600",
    danger: "bg-rose-600 text-white shadow-rose-900/15 hover:bg-rose-700",
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
        <section className={cn("rounded-2xl border border-slate-200/80 bg-white/88 p-5 shadow-sm shadow-slate-900/5", className)}>
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
        neutral: "bg-slate-100 text-slate-700",
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
        <div className={cn("h-2.5 overflow-hidden rounded-full bg-slate-200", className)}>
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
                <h2 className="text-xl font-black text-slate-950">{title}</h2>
                <div className="mt-2 text-sm leading-6 text-slate-600">{children}</div>
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
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <QRCodeCanvas value={value || "https://example.com"} size={188} />
            </div>
            <div className="text-center">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
                <div className="mt-1 font-mono text-5xl font-black tracking-[0.16em] text-slate-950">{code || "----"}</div>
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
        neutral: "border-slate-200 bg-white text-slate-600",
        danger: "border-rose-200 bg-rose-50 text-rose-800",
        success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };

    return <div className={cn("rounded-xl border px-4 py-3 text-sm font-semibold", styles[tone])}>{children}</div>;
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
