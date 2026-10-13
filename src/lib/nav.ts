import {
  BookOpen,
  ChartColumn,
  Database,
  FileText,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

/**
 * 사이드바 메뉴 (위에서부터 순서대로). label 은 한국어 원문이고 화면에서 t() 로 번역한다.
 * wide: 열이 많은 표 화면이라 본문 최대 폭(1440px)을 풀고 화면 폭을 다 쓴다.
 * group: 같은 값끼리 묶고, 값이 바뀌는 곳에 구분선을 긋는다.
 */
export const NAV_LINKS: { href: string; label: string; icon: LucideIcon; wide?: boolean; group?: number }[] = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/issues", label: "이슈 대응", icon: TriangleAlert },
  { href: "/project", label: "프로젝트 데이터", icon: Database },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/rules", label: "판단 기준·가정치", icon: ShieldCheck },
  { href: "/kpi", label: "효과·KPI", icon: ChartColumn },
  { href: "/prd", label: "PRD·일정", icon: FileText },
  { href: "/settings", label: "설정·연동", icon: Settings, group: 1 },
];

/** 지금 경로의 메뉴 항목 (하위 경로는 앞부분이 같은 항목) */
export function navItemOf(pathname: string) {
  return (
    NAV_LINKS.find((item) => item.href === pathname) ??
    NAV_LINKS.filter((item) => item.href !== "/" && pathname.startsWith(`${item.href}/`)).at(0) ??
    null
  );
}
