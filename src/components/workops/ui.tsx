"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Inbox, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * WorkOps 화면 공통 조각 — 서비스 웹 디자인 시스템 규격을 한 곳에 둔다.
 * 카드 CP-07 · KPI CP-08 · 표 CP-09 · 배지 CP-10 · 빈 상태 CP-14 · 배너 I-08.
 */

/* ---------- 레이아웃 ---------- */

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-start gap-6">
      <div className="min-w-0 flex-1 space-y-1">
        {eyebrow && <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">{eyebrow}</div>}
        <h1 className="text-title">{title}</h1>
        {description && <p className="max-w-[88ch] text-body text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  caption,
  children,
  className,
}: {
  title?: React.ReactNode;
  caption?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-12", className)}>
      {title && (
        <div className="mb-4 flex flex-wrap items-baseline gap-3">
          <h2 className="text-display">{title}</h2>
          {caption && <span className="ml-auto text-caption text-muted-foreground">{caption}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/** 12컬럼 그리드, 거터 24px. 좁은 화면에서는 한 줄씩 */
export function Grid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-12 gap-6", className)}>{children}</div>;
}

const SPAN = {
  3: "col-span-12 sm:col-span-6 xl:col-span-3",
  4: "col-span-12 xl:col-span-4",
  6: "col-span-12 lg:col-span-6",
  8: "col-span-12 xl:col-span-8",
  12: "col-span-12",
} as const;

export function Col({ span, children, className }: { span: keyof typeof SPAN; children: React.ReactNode; className?: string }) {
  return <div className={cn(SPAN[span], "flex min-w-0 flex-col gap-6", className)}>{children}</div>;
}

/** 카드: 흰 배경 · 1px 테두리 · 12px 라운드 · 패딩 20px · 그림자 없음. flush 면 패딩 없이 머리글만 구분선 */
export function Card({
  title,
  caption,
  actions,
  children,
  flush,
  className,
}: {
  title?: React.ReactNode;
  caption?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  flush?: boolean;
  className?: string;
}) {
  const head = (title || caption || actions) && (
    <div className={cn("flex flex-wrap items-baseline gap-3", flush && "border-b border-border px-5 py-4")}>
      {title && <h3 className="text-headline">{title}</h3>}
      {caption && <span className="ml-auto text-caption text-muted-foreground">{caption}</span>}
      {actions && <div className={cn("flex items-center gap-2", !caption && "ml-auto")}>{actions}</div>}
    </div>
  );
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-container border border-border bg-card",
        flush ? "gap-0" : "gap-4 p-5",
        className
      )}
    >
      {head}
      {children}
    </div>
  );
}

/* ---------- 상태 배지 (CP-10) ---------- */

type Tone = "gray" | "blue" | "orange" | "green" | "red";

const TONE: Record<Tone, string> = {
  gray: "bg-[var(--badge-gray-bg)] text-[color:var(--badge-gray-fg)]",
  blue: "bg-[var(--badge-blue-bg)] text-[color:var(--badge-blue-fg)]",
  orange: "bg-[var(--badge-orange-bg)] text-[color:var(--badge-orange-fg)]",
  green: "bg-[var(--badge-green-bg)] text-[color:var(--badge-green-fg)]",
  red: "bg-[var(--badge-red-bg)] text-[color:var(--badge-red-fg)]",
};

/** 원천 상태값 → 진행(파랑) · 주의(오렌지) · 완료(초록) · 차단(빨강) · 기본(회색) */
const STATUS_TONE: Record<string, Tone> = {
  접수: "blue",
  분석중: "blue",
  승인대기: "orange",
  대응중: "blue",
  종료: "green",
  진행: "blue",
  완료: "green",
  열림: "orange",
  변경: "orange",
  이월: "orange",
  승인: "green",
  실행: "blue",
  실패: "red",
  신규: "green",
  Critical: "red",
  Major: "orange",
  High: "green",
  Med: "orange",
  H: "red",
  M: "orange",
};

export function Badge({ children, tone = "gray", className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-[6px] px-2 text-caption font-medium whitespace-nowrap",
        "before:size-1.5 before:shrink-0 before:rounded-full before:bg-current before:content-['']",
        TONE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "gray"}>{status}</Badge>;
}

/* ---------- KPI 카드 (CP-08) ---------- */

export function KpiCard({
  label,
  metric,
  delta,
  good,
  over,
  spark,
  href,
}: {
  label: string;
  metric: string;
  delta: string;
  good?: boolean;
  over?: boolean;
  spark: number[];
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex h-full flex-col gap-2 rounded-container border border-border bg-card p-5 transition-colors duration-[120ms] hover:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/20 focus-visible:outline-none"
    >
      <span className="text-label text-muted-foreground">{label}</span>
      <span className="text-metric tabular-nums">{metric}</span>
      <span
        className={cn(
          "flex flex-wrap items-center gap-1.5 text-caption",
          good ? "text-[color:var(--badge-green-fg)]" : "text-muted-foreground"
        )}
      >
        {good && <CheckCircle2 className="size-3.5" aria-hidden />}
        {delta}
        {over && <Badge tone="orange">기준 초과</Badge>}
      </span>
      <Sparkline values={spark} over={over} />
    </Link>
  );
}

export function Sparkline({ values, over }: { values: number[]; over?: boolean }) {
  const w = 120;
  const h = 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * w, h - 2 - ((v - min) / (max - min || 1)) * (h - 4)]);
  const last = pts.at(-1)!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-auto h-7 w-full" aria-hidden>
      <polyline
        points={pts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ")}
        fill="none"
        stroke="var(--label-3)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      {over && <circle cx={last[0]} cy={last[1]} r={3} fill="var(--warning)" />}
    </svg>
  );
}

/* ---------- 표 (CP-09) ---------- */

export type Column = { label: React.ReactNode; num?: boolean; className?: string };

export function DataTable({
  columns,
  children,
  empty = "조건에 맞는 데이터가 없습니다",
  compact,
  footer,
  rowCount,
}: {
  columns: Column[];
  children: React.ReactNode;
  empty?: string;
  compact?: boolean;
  footer?: React.ReactNode;
  rowCount: number;
}) {
  return (
    <div className="max-w-full min-w-0 overflow-x-auto">
      <table className={cn("w-full border-collapse text-body", compact && "[&_td]:h-9")}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={i}
                className={cn(
                  "sticky top-0 h-9 border-b border-border bg-card px-3 text-left text-label whitespace-nowrap text-muted-foreground",
                  c.num && "text-right",
                  c.className
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:h-11 [&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-1 [&_tr:last-child_td]:border-b-0 [&_tr]:transition-colors [&_tr]:duration-[120ms] [&_tr:hover]:bg-background">
          {rowCount ? (
            children
          ) : (
            <tr>
              <td colSpan={columns.length} className="p-0!">
                <EmptyState>{empty}</EmptyState>
              </td>
            </tr>
          )}
        </tbody>
        {footer && <tfoot className="bg-background font-medium [&_td]:h-9 [&_td]:px-3">{footer}</tfoot>}
      </table>
    </div>
  );
}

/** 식별자: 모노 + 네이비 */
export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[13px] whitespace-nowrap text-primary", className)}>{children}</span>;
}

export const numCell = "text-right tabular-nums whitespace-nowrap";

/* ---------- 상태 ---------- */

export function EmptyState({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-body text-muted-foreground">
      <Inbox className="size-8 text-label-3" strokeWidth={1.5} aria-hidden />
      <div>{children}</div>
      {action}
    </div>
  );
}

export function Banner({
  tone,
  children,
  onRetry,
  className,
}: {
  tone: "error" | "warn" | "ok";
  children: React.ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  const Icon = tone === "ok" ? CheckCircle2 : AlertTriangle;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-center gap-3 rounded-control px-3.5 py-2.5 text-body font-medium",
        tone === "error" && TONE.red,
        tone === "warn" && TONE.orange,
        tone === "ok" && TONE.green,
        className
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw />
          재시도
        </Button>
      )}
    </div>
  );
}

/** 막대 (부하 · 점수). attn 이면 오렌지 */
export function Meter({ value, attn, className, title }: { value: number; attn?: boolean; className?: string; title?: string }) {
  return (
    <div title={title} className={cn("h-2 w-14 shrink-0 overflow-hidden rounded bg-muted", className)}>
      <div className={cn("h-full", attn ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

/** 정의 목록 (라벨 120px + 값) */
export function KeyValues({ items, labelWidth = 120 }: { items: [React.ReactNode, React.ReactNode][]; labelWidth?: number }) {
  return (
    <dl className="grid gap-x-3 gap-y-1.5 text-[13px]" style={{ gridTemplateColumns: `${labelWidth}px minmax(0,1fr)` }}>
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- 입력 ---------- */

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="flex gap-1.5 text-label text-muted-foreground">
        {label}
        {hint && <span className="font-normal">{hint}</span>}
      </label>
      {children}
      {error && <span className="text-caption text-destructive">{error}</span>}
    </div>
  );
}

const control =
  "w-full min-w-0 rounded-field border border-border bg-card px-3 text-body text-foreground transition-colors duration-[120ms] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 aria-invalid:border-destructive disabled:opacity-40";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-[88px] resize-y py-2", className)} {...props} />;
}

export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(control, "h-9", className)} {...props} />;
}

/* ---------- URL 탭 (필터 상태를 URL 에 둔다, I-09) ---------- */

export function useTab<T extends string>(keys: readonly T[], fallback: T, param = "tab"): T {
  const value = useSearchParams().get(param);
  return (keys as readonly string[]).includes(value ?? "") ? (value as T) : fallback;
}

export function UrlTabs({ items, current, param = "tab" }: { items: [string, React.ReactNode][]; current: string; param?: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-border" aria-label="탭">
      {items.map(([key, label]) => {
        const params = new URLSearchParams(search);
        params.set(param, key);
        const active = key === current;
        return (
          <Link
            key={key}
            href={`${pathname}?${params}`}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex h-10 items-center border-b-2 px-3.5 text-body font-medium whitespace-nowrap transition-colors duration-[120ms]",
              active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** 코드 · YAML 미리보기 */
export function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-control border border-border bg-background px-4 py-3.5 font-mono text-[12.5px] leading-5 whitespace-pre">
      {children}
    </pre>
  );
}
