"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Banner } from "@/components/workops/ui";
import { useWorkops, type WorkOpsPayload } from "@/hooks/use-workops";

export type WorkopsCtx = ReturnType<typeof useWorkops> & { data: WorkOpsPayload; state: WorkOpsPayload["state"] };

/**
 * 상태를 읽은 뒤에만 화면을 그린다. 처음에는 최종 레이아웃 모양의 스켈레톤(I-05),
 * 읽기 실패는 인라인 배너 + 재시도(I-08). 이미 받은 데이터가 있으면 갱신 중에도 그대로 둔다(I-06).
 */
export function StateGate({ children }: { children: (ctx: WorkopsCtx) => React.ReactNode }) {
  const ctx = useWorkops();
  if (ctx.data) return <>{children(ctx as WorkopsCtx)}</>;
  if (ctx.error) {
    return (
      <Banner tone="error" onRetry={() => void ctx.mutate()}>
        연결 실패 — 데이터를 불러오지 못했습니다. {ctx.error.message}
      </Banner>
    );
  }
  return (
    <div className="space-y-8" aria-busy>
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-[420px] max-w-full" />
      </div>
      <div className="grid grid-cols-12 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="col-span-12 h-[148px] rounded-container sm:col-span-6 xl:col-span-3" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-container" />
    </div>
  );
}
