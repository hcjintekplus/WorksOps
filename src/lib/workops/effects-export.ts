import { asm, assumedKpi } from "@/lib/workops/cost-model";
import { downloadCsv } from "@/lib/workops/csv";
import type { WorkOpsState } from "@/lib/workops/types";

const KEYS = [
  "issue_id",
  "decision_days_before",
  "decision_days_after",
  "manhours_before",
  "manhours_after",
  "labor_cost_before",
  "labor_cost_after",
  "llm_cost",
  "labor_saving",
  "delay_cost_avoided",
  "annual_net",
  "annual_conservative",
  "recorded_at",
] as const;

/** 효과 리포트 CSV (P1). 기록이 없으면 가정치 한 줄 */
export function exportEffects(state: WorkOpsState) {
  const rows: unknown[][] = [[...KEYS]];
  for (const e of state.effectRecords) rows.push(KEYS.map((k) => e[k]));
  if (rows.length === 1) {
    const a = state.assumptions;
    const k = assumedKpi(a);
    rows.push([
      "(가정치)",
      asm(a, "before_decision_days"),
      asm(a, "after_decision_days"),
      asm(a, "before_manhours"),
      asm(a, "after_manhours"),
      asm(a, "before_manhours") * asm(a, "hourly_rate"),
      asm(a, "after_manhours") * asm(a, "hourly_rate"),
      asm(a, "llm_cost_per_run"),
      k.labor,
      k.delay,
      k.annual,
      k.conservative,
      "",
    ]);
  }
  downloadCsv("workops_effect_report.csv", rows);
}

/** 효과 기록 평균 (없으면 null) */
export function averageEffect(state: WorkOpsState, key: "labor_saving" | "delay_cost_avoided" | "annual_net" | "annual_conservative") {
  const list = state.effectRecords;
  return list.length ? list.reduce((s, e) => s + e[key], 0) / list.length : null;
}
