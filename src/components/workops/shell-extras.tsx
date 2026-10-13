"use client";

import Link from "next/link";
import { useWorkops } from "@/hooks/use-workops";
import { cn } from "@/lib/utils";

/** 사이드바 "이슈 대응" 옆 진행 중 이슈 수 */
export function NavCount({ className }: { className?: string }) {
  const { state } = useWorkops();
  if (!state) return null;
  const open = state.db.issues.filter((i) => i.status !== "종료").length;
  return (
    <span className={cn("rounded-[6px] bg-muted px-1.5 py-0.5 text-caption text-muted-foreground tabular-nums", className)}>
      {open}
    </span>
  );
}

/**
 * 컨텍스트 바의 글로벌 필터 · 1급 요소 칩: 릴리스(D-) · 데이터 출처 · AI 엔진.
 * 점 색: 초록 = 정상, 오렌지 = 주의 (Claude 를 골랐는데 키가 없음).
 */
export function ContextChips() {
  const { data } = useWorkops();
  if (!data) return null;
  const { state, claudeConfigured } = data;
  const release = state.db.releases.find((r) => r.id === state.settings.globalRelease) ?? state.db.releases[0];
  const claude = state.settings.ai === "claude";
  const aiWarn = claude && !claudeConfigured;

  return (
    <div className="hidden items-center gap-2 lg:flex">
      {release && (
        <Chip href="/settings" title="글로벌 필터: 릴리스">
          릴리스: {release.name} <span className="text-muted-foreground">D-{release.d_minus}</span>
        </Chip>
      )}
      <Chip href="/project" dot="ok" title="프로젝트 데이터 출처">
        Mock System
      </Chip>
      <Chip href="/settings" dot={aiWarn ? "warn" : "ok"} title="AI 엔진">
        {claude ? (aiWarn ? "Claude API (키 없음)" : "Claude API") : "AI 재생 모드"}
      </Chip>
    </div>
  );
}

function Chip({ href, title, dot, children }: { href: string; title: string; dot?: "ok" | "warn"; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      title={title}
      className="inline-flex h-7 items-center gap-1.5 rounded-control border border-border bg-card px-2.5 text-caption whitespace-nowrap transition-colors duration-[120ms] hover:bg-background"
    >
      {dot && <span aria-hidden className={cn("size-1.5 rounded-full", dot === "ok" ? "bg-success" : "bg-warning")} />}
      {children}
    </Link>
  );
}
