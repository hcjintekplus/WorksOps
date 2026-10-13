"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type SegmentedItem<T extends string> = {
  value: T;
  label: string;
  /** 라벨 뒤에 흐리게 붙는 건수. 없으면 생략한다. */
  count?: number;
};

/**
 * macOS 세그먼트 컨트롤 (PRD §3.B, §3.F, §4).
 *
 * 상호배타 선택이 2~5개일 때 쓴다. 6개 이상이면 캡슐 필터 칩이다.
 *
 * 선택 조각은 버튼마다 배경을 칠하는 대신 하나의 인디케이터를 옮긴다 — 그래야 PRD §6 의
 * "조각 이동 180ms" 가 실제 이동으로 보인다. 라벨 폭이 제각각이라 위치·폭은 렌더 후
 * 실측해야 하고, 재는 동안(첫 프레임·SSR)에는 인디케이터를 숨겨 둔다.
 */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  items: SegmentedItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.value === value)
  );

  useLayoutEffect(() => {
    function measure() {
      const button = buttonsRef.current[selectedIndex];
      if (!button) return;
      setIndicator({ left: button.offsetLeft, width: button.offsetWidth });
    }

    measure();

    // 건수가 나중에 채워지면 라벨 폭이 바뀐다. 컨테이너 크기 변화도 같이 본다.
    const observer = new ResizeObserver(measure);
    if (listRef.current) observer.observe(listRef.current);
    for (const button of buttonsRef.current) if (button) observer.observe(button);
    return () => observer.disconnect();
  }, [selectedIndex, items]);

  // 라벨(건수)이 바뀌면 다시 잰다.
  const labelKey = items.map((item) => `${item.label}${item.count ?? ""}`).join("|");
  useEffect(() => {
    const button = buttonsRef.current[selectedIndex];
    if (button) setIndicator({ left: button.offsetLeft, width: button.offsetWidth });
  }, [labelKey, selectedIndex]);

  function onKeyDown(event: React.KeyboardEvent) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = (selectedIndex + delta + items.length) % items.length;
    onChange(items[next].value);
    buttonsRef.current[next]?.focus();
  }

  return (
    <div
      ref={listRef}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn("relative inline-flex rounded-field bg-muted p-0.5", className)}
    >
      {indicator && (
        <span
          aria-hidden
          className="absolute top-0.5 bottom-0.5 rounded-[6px] bg-card ring-1 ring-border transition-[transform,width] duration-[200ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none dark:bg-muted-foreground/25"
          style={{ width: indicator.width, transform: `translateX(${indicator.left - 2}px)` }}
        />
      )}

      {items.map((item, index) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(node) => {
              buttonsRef.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative z-10 inline-flex h-8 items-center gap-1.5 rounded-[6px] px-3 text-body font-medium whitespace-nowrap transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none",
              selected ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={cn("tabular-nums", selected ? "text-muted-foreground" : "text-label-3")}>
                {item.count.toLocaleString()}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
