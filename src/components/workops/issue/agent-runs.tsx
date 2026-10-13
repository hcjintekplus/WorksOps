import { StatusBadge } from "@/components/workops/ui";
import { fmtNum } from "@/lib/workops/format";
import type { AgentRun } from "@/lib/workops/types";

/** 이슈 하나의 Agent 실행 로그 (토큰 · LLM 비용 → KPI ①) */
export function AgentRunList({ runs }: { runs: AgentRun[] }) {
  if (!runs.length) return <p className="text-caption text-muted-foreground">아직 실행된 Agent가 없습니다</p>;
  return (
    <ul className="divide-y divide-border">
      {runs.map((r) => (
        <li key={r.id} className="flex items-center gap-3 py-2.5">
          <span className="w-[72px] font-mono text-[13px]">{r.agent}</span>
          <StatusBadge status={r.status} />
          <span className="min-w-0 flex-1 truncate text-right text-caption text-muted-foreground tabular-nums" title={r.error}>
            {r.tokens ? `${fmtNum(r.tokens)} tok · ${fmtNum(r.llm_cost_krw)}원 · ${r.engine === "claude" ? "Claude" : "재생"}` : r.error}
          </span>
        </li>
      ))}
    </ul>
  );
}
