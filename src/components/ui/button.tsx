import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * 버튼 (UI System §5): 36px(표 안 compact 32px), 8px 라운드, 좌우 14px, Body strong.
 * - Primary(default): 네이비 채움 — 한 화면에 하나만
 * - Secondary(outline): 흰 배경 + gray-100 테두리
 * - Ghost: 배경 · 테두리 없음 (툴바 · 카드 안 보조 동작)
 * hover 는 배경만 한 단계(gray-0 → gray-25), active 는 조금 더 어둡게. 위치 · 크기는 바꾸지 않는다.
 * 키보드 포커스 링은 늘 보인다.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-control border border-transparent text-body font-medium whitespace-nowrap transition-colors duration-[120ms] ease-out outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/85",
        outline:
          "border-border bg-card text-foreground hover:bg-background active:bg-muted aria-expanded:bg-background",
        secondary: "bg-muted text-foreground hover:brightness-95 aria-expanded:brightness-95",
        ghost: "text-foreground hover:bg-background active:bg-muted aria-expanded:bg-background",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-[14px] [&_svg:not([class*='size-'])]:size-4",
        xs: "h-6 gap-1 px-2 text-caption [&_svg:not([class*='size-'])]:size-3",
        // compact (표 · 도구 줄)
        sm: "h-8 gap-1.5 px-3 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 px-4",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
