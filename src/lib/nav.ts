import { LayoutDashboard, type LucideIcon } from "lucide-react";

/**
 * 사이드바 메뉴 (위에서부터 순서대로). label 은 한국어 원문이고 화면에서 t() 로 번역한다.
 * wide: 열이 많은 표 화면이라 본문 최대 폭(1440px)을 풀고 화면 폭을 다 쓴다.
 */
export const NAV_LINKS: { href: string; label: string; icon: LucideIcon; wide?: boolean }[] = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
];

/** 지금 경로의 메뉴 항목 (하위 경로는 앞부분이 같은 항목) */
export function navItemOf(pathname: string) {
  return (
    NAV_LINKS.find((item) => item.href === pathname) ??
    NAV_LINKS.filter((item) => item.href !== "/" && pathname.startsWith(`${item.href}/`)).at(0) ??
    null
  );
}
