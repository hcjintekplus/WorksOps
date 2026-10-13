"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSWRConfig } from "swr";
import { ChevronRight, PanelLeftClose, PanelLeftOpen, RefreshCw } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { useT } from "@/i18n/provider";
import { requestFresh } from "@/lib/fetcher";
import { resetFreshness, useFreshness } from "@/lib/freshness";
import { NAV_LINKS, navItemOf } from "@/lib/nav";
import { cn } from "@/lib/utils";

const SIDEBAR_KEY = "worksops-sidebar";
/** 이보다 오래된 데이터면 갱신 표시를 오렌지로 (UI System §5) */
const STALE_AFTER_MS = 10 * 60 * 1000;

/**
 * 앱 셸 (UI System §2): 좌측 사이드바 232px(접으면 64px, 1024px 이하는 늘 접힘) +
 * 상단 컨텍스트 바 56px(브레드크럼 · 데이터 갱신 상태 · 새로고침 · 언어 · 테마) + 콘텐츠(최대 1440px).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const pathname = usePathname();
  const current = navItemOf(pathname);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      // 저장된 접힘 상태를 수화 뒤 한 번 읽는다 (서버는 알 수 없다).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "collapsed");
    } catch {
      // 저장소를 못 쓰면 펼친 채로 둔다.
    }
  }, []);

  // 화면을 옮기면 "n분 전 갱신" 을 새 화면 데이터로 다시 모은다.
  useEffect(() => resetFreshness(), [pathname]);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "expanded");
    } catch {
      // 이번 세션 동안만 바뀐다.
    }
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          "sticky top-0 flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
          collapsed ? "w-16" : "w-16 lg:w-[232px]"
        )}
      >
        <div className={cn("flex h-14 shrink-0 items-center px-4", !collapsed && "lg:px-5")}>
          <Link href="/" className="flex items-baseline gap-2" aria-label="WorksOps">
            {/* 로고는 사용자 지정 크기 · 굵기(36px · bold)를 유지한다. 접히면 머리글자만. */}
            <span className={cn("text-[22px] leading-none font-bold text-sidebar-foreground", !collapsed && "lg:hidden")}>
              W
            </span>
            <span className={cn("hidden text-[36px] leading-none font-bold text-sidebar-foreground", !collapsed && "lg:inline")}>
              WorksOps
            </span>
          </Link>
        </div>

        <nav aria-label={t("화면 이동")} className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = current?.href === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                title={t(label)}
                className={cn(
                  "flex min-h-9 items-center gap-2.5 rounded-control px-2.5 py-1.5 text-body transition-colors duration-[120ms] ease-out",
                  "focus-visible:ring-[3px] focus-visible:ring-ring/20 focus-visible:outline-none",
                  active
                    ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-background"
                )}
              >
                <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
                {/* 베트남어처럼 길면 두 줄로 넘긴다 (자르지 않는다) */}
                <span className={cn("hidden min-w-0 leading-snug", !collapsed && "lg:inline")}>{t(label)}</span>
              </Link>
            );
          })}
        </nav>

        <div className={cn("hidden shrink-0 items-center justify-between gap-2 border-t border-sidebar-border px-3 py-2 lg:flex")}>
          {!collapsed && (
            <span className="truncate pl-2 text-caption text-muted-foreground">
              PUSH {process.env.NEXT_PUBLIC_BUILD_TIME}
            </span>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? t("사이드바 펼치기") : t("사이드바 접기")}
            title={collapsed ? t("사이드바 펼치기") : t("사이드바 접기")}
            className="inline-flex size-8 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <ContextBar title={current ? t(current.label) : "WorksOps"} />
        <main
          className={cn(
            "mx-auto w-full min-w-0 flex-1 px-6 py-8 xl:px-8",
            current?.wide ? "max-w-none" : "max-w-[1440px]"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

/** 상단 컨텍스트 바: 브레드크럼 · 데이터 갱신 상태 · 새로고침 · 언어 · 테마 */
function ContextBar({ title }: { title: string }) {
  const { t } = useT();
  const { mutate } = useSWRConfig();
  const { oldest, loading, sources } = useFreshness();

  function refreshAll() {
    // 서버 캐시를 건너뛰고 지금 화면의 데이터를 모두 Jira 에서 다시 읽는다. 기존 데이터는 그대로 둔다.
    requestFresh();
    void mutate(() => true);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className="flex h-14 items-center gap-3 px-6 xl:px-8">
        <nav aria-label={t("현재 위치")} className="flex min-w-0 items-center gap-1.5 text-body">
          <Link href="/" className="text-muted-foreground transition-colors hover:text-foreground">
            WorksOps
          </Link>
          <ChevronRight className="size-3.5 shrink-0 text-label-3" aria-hidden />
          <span className="truncate font-medium">{title}</span>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <FreshnessLabel generatedAt={oldest?.generatedAt ?? null} sources={sources} />
          <button
            type="button"
            onClick={refreshAll}
            disabled={loading}
            aria-label={t("새로고침")}
            title={t("새로고침")}
            className="inline-flex size-8 items-center justify-center rounded-control text-muted-foreground transition-colors duration-[120ms] hover:bg-background hover:text-foreground disabled:opacity-60"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin motion-reduce:animate-none")} />
          </button>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
      {/* 갱신 중: 기존 데이터를 그대로 둔 채 2px 진행 바만 */}
      <div className="relative h-0.5 overflow-hidden" aria-hidden>
        {loading && <div className="absolute inset-y-0 w-1/3 animate-[worksops-progress_1.2s_ease-in-out_infinite] bg-primary motion-reduce:hidden" />}
      </div>
    </header>
  );
}

function FreshnessLabel({ generatedAt, sources }: { generatedAt: number | null; sources: Set<string> }) {
  const { t, locale } = useT();
  // 30초마다 "n분 전" 을 다시 센다.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (generatedAt === null) return null;
  const minutes = Math.max(0, Math.floor((now - generatedAt) / 60_000));
  const stale = now - generatedAt > STALE_AFTER_MS;
  const exact = new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(generatedAt));
  const source = sources.has("cache") ? t("캐시") : t("실시간");

  return (
    <span
      title={t("{time} 기준 · 출처 {source}", { time: exact, source })}
      className={cn(
        "inline-flex items-center gap-1.5 text-caption tabular-nums",
        stale ? "text-[color:var(--badge-orange-fg)]" : "text-muted-foreground"
      )}
    >
      {stale && <span aria-hidden className="size-1.5 rounded-full bg-warning" />}
      {minutes === 0 ? t("방금 갱신") : t("{n}분 전 갱신", { n: minutes })}
    </span>
  );
}
