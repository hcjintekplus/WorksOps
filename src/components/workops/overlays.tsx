"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 떠 있는 요소 — 그림자는 여기에만 쓴다 (디자인 시스템 CP-13 · 모달 · I-07 토스트).
 */

const FLOAT_SHADOW = "shadow-[0_8px_24px_rgba(17,24,39,0.12)]";

/** 사이드 시트: 우측 480px. 상단에 원천 링크 자리(source) */
export function SideSheet({
  open,
  onOpenChange,
  title,
  source,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  source?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(17,24,39,0.32)] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-[min(480px,100vw)] flex-col bg-card outline-none",
            "duration-200 ease-[cubic-bezier(0.2,0,0,1)] data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right motion-reduce:animate-none",
            FLOAT_SHADOW
          )}
        >
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-headline">{title}</DialogPrimitive.Title>
            {source}
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="닫기">
                <X />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">상세</DialogPrimitive.Description>
          <div className="flex flex-1 flex-col gap-4 overflow-auto p-5">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** 확인 다이얼로그 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  children: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(17,24,39,0.32)]" />
        <DialogPrimitive.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-container bg-card p-5 outline-none",
            FLOAT_SHADOW
          )}
        >
          <DialogPrimitive.Title className="text-headline">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description asChild>
            <div className="space-y-3 text-body">{children}</div>
          </DialogPrimitive.Description>
          <div className="flex justify-end gap-2">
            <DialogPrimitive.Close asChild>
              <Button variant="outline">취소</Button>
            </DialogPrimitive.Close>
            <Button onClick={onConfirm} disabled={busy}>
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ---------- 토스트: 저장 · 내보내기 같은 명시적 동작에만 4초 (I-07) ---------- */

const ToastContext = createContext<(message: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string) => {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 4000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed right-6 bottom-6 z-[60] flex items-center gap-3 rounded-control bg-foreground px-4 py-2.5 text-body text-background transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
          FLOAT_SHADOW,
          message ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        )}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-success" />
        {message}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
