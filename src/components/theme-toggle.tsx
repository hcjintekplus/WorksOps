"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "worksops-theme";

/**
 * 테마는 <html> 의 클래스가 정본이다 — layout.tsx 의 인라인 스크립트가 첫 페인트 전에
 * 박아 두기 때문에 리액트 상태로 들고 있을 수 없다. 그래서 상태를 복제하지 않고
 * DOM 을 외부 저장소로 삼아 구독한다.
 */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

const isDark = () => document.documentElement.classList.contains("dark");
/** 서버에서는 어느 쪽인지 알 수 없다. 수화 직후 실제 값으로 한 번 다시 그려진다. */
const isDarkOnServer = () => false;

/** 라이트/다크 수동 토글 (PRD §8). */
export function ThemeToggle({ className }: { className?: string }) {
  const dark = useSyncExternalStore(subscribe, isDark, isDarkOnServer);
  const { t } = useT();

  function toggle() {
    const next = !dark;
    const root = document.documentElement;
    root.classList.toggle("dark", next);
    root.classList.toggle("light", !next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // 사생활 보호 모드 등으로 저장이 막혀도 이번 세션 동안은 바뀐 채로 둔다.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? t("라이트 모드로 전환") : t("다크 모드로 전환")}
      title={dark ? t("라이트 모드로 전환") : t("다크 모드로 전환")}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-control border border-border bg-card text-muted-foreground transition-colors",
        "hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
        className
      )}
    >
      {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
    </button>
  );
}
