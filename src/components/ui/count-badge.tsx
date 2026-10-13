import { cn } from "@/lib/utils";

/**
 * 건수 캡슐 (PRD §4). 상태 배지와 달리 색을 지지 않는다 — 회색 하나뿐이다.
 * 한 자리 수에서도 캡슐이 찌그러지지 않도록 최소 폭을 준다.
 */
export function CountBadge({
  value,
  className,
}: {
  value: number | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-muted px-1.5 text-caption tabular-nums text-muted-foreground",
        className
      )}
    >
      {typeof value === "number" ? value.toLocaleString() : value}
    </span>
  );
}
