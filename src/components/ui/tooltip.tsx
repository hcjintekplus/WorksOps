"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * macOS 도움말 풍선 (PRD §2.4 도형, §6 모션).
 *
 * Provider 를 컴포넌트 안에 두어 쓰는 쪽이 감싸는 것을 잊어도 동작하게 한다 —
 * 화면에 툴팁이 몇 개 없어 Provider 가 하나씩 생기는 비용이 의미가 없다.
 * 포털로 띄우므로 overflow-hidden 인 행 안에서도 잘리지 않는다.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  delayDuration = 150,
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delayDuration?: number;
  /** 배경·글자색을 바꿀 때만 쓴다. 도형과 모션은 여기서 정한 것을 지킨다. */
  className?: string;
}) {
  return (
    /*
     * disableHoverableContent: 기본값은 트리거를 벗어나도 풍선 쪽으로 커서를 옮길 수 있게
     * 열어 두는 동작이다. 풍선 안에 누를 것이 없는 도움말에서는 "마우스를 떼도 안 사라진다"로만
     * 보인다(실측: 커서를 멀리 옮겨도 열린 채 유지). 트리거에서 벗어나면 바로 닫는다.
     */
    <TooltipPrimitive.Provider delayDuration={delayDuration} disableHoverableContent>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            className={cn(
              "z-50 rounded-field bg-popover px-2 py-1 text-caption text-popover-foreground",
              "ring-1 ring-foreground/10 shadow-[0_4px_16px_rgba(0,0,0,.12)]",
              "origin-(--radix-tooltip-content-transform-origin) duration-150 ease-out",
              "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
              className
            )}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
