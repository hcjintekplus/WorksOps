import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * 입력 (UI System §5): 36px, 8px 라운드, gray-100 테두리.
 * 포커스 시 테두리 네이비 + 3px 네이비 20% 링, 오류(aria-invalid) 시 테두리 red-600.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-field border border-border bg-card px-3 text-body text-foreground transition-colors duration-[120ms] outline-none",
        "placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20",
        "aria-invalid:border-destructive",
        "disabled:pointer-events-none disabled:opacity-40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
