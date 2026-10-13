import type {
  ActionOption,
  AnalysisResult,
  Assumptions,
  BeforeMeasure,
  CostedOption,
  Effect,
  EffectInput,
  ImpactResult,
  OptionCosts,
  ProjectDb,
  RiskLevel,
  RuledOption,
  Rules,
  Usage,
} from "@/lib/workops/types";
import { won } from "@/lib/workops/format";

/**
 * cost_model + rules — 결정적 계산 (PRD 08장 "판단의 세 층" 중 규칙 층).
 * 지연일 · 비용 · 허용 여부 · 추천 · 에스컬레이션은 여기서만 정한다. LLM 출력의 숫자는 쓰지 않는다.
 */

export function asm(assumptions: Assumptions, key: string): number {
  const a = assumptions[key];
  if (!a) throw new Error(`비용 가정치 ${key} 가 없습니다`);
  return a.value;
}

/** 일 지연 비용 = 인력 × 시간 × 시간당 인건비 + 외부 비용 */
export function dailyDelayCost(a: Assumptions): number {
  return asm(a, "headcount") * asm(a, "hours_per_day") * asm(a, "hourly_rate") + asm(a, "external_cost_day");
}

/**
 * 지연일 = max(0, 확정 기간 + 대응안 작업일 − 출시 버퍼일)  (출시 연기안은 연기 일수)
 * 기대비용 = 지연일 × 일 지연 비용 + 기회손실 + 후속 비용 + 재발확률 × 재발 시 손실
 */
export function costModel(options: ActionOption[], impact: ImpactResult, a: Assumptions, decisionDays: number): CostedOption[] {
  const daily = asm(a, "daily_delay_cost");
  const buffer = impact.baseline.buffer_days;
  const recurLoss = asm(a, "recurrence_loss_days") * daily;
  return options.map((o) => {
    const delay_days = o.type === "delay" ? o.work_days : Math.max(0, decisionDays + o.work_days - buffer);
    const delay_cost = delay_days * daily;
    const opportunity_loss = o.type === "scope_cut" ? asm(a, "scope_cut_opportunity_loss") : 0;
    const follow_up_cost = o.type === "scope_cut" ? asm(a, "scope_cut_follow_up_cost") : 0;
    const recurrence_loss = o.recurrence_prob * recurLoss;
    const expected_cost = delay_cost + opportunity_loss + follow_up_cost + recurrence_loss;
    return { ...o, delay_days, delay_cost, opportunity_loss, follow_up_cost, recurrence_loss, expected_cost };
  });
}

const RISK_RANK: Record<RiskLevel, number> = { Low: 0, Medium: 1, High: 2 };

function ruleParam(rules: Rules, group: "recommend" | "escalate", id: string, fallback: number): number {
  return rules[group].find((r) => r.id === id)?.param ?? fallback;
}

/** gate(허용) → recommend(추천) → escalate(승인 수준) */
export function applyRules(costed: CostedOption[], analysis: AnalysisResult, db: ProjectDb, rules: Rules): OptionCosts {
  const top = analysis.causes[0];
  const escalateAt = ruleParam(rules, "escalate", "E2", 500_000_000);
  const tolerance = ruleParam(rules, "recommend", "R2", 0.1);

  const options: RuledOption[] = costed.map((o) => {
    let allowed = true;
    let blocked_reason: string | null = null;
    if (o.type === "scope_cut") {
      const req = db.requirements.find((r) => r.id === o.scope_cut_req);
      if (!req) {
        allowed = false;
        blocked_reason = "축소 대상 요구사항 없음";
      } else if (req.priority === "P0" || req.contract_required) {
        allowed = false;
        blocked_reason = `G2: ${req.id}는 P0 또는 계약 필수 기능 (CT-001)`;
      }
    }
    if (o.type === "fix" && top?.evidence_strength !== "High") {
      allowed = false;
      blocked_reason = "G3: 1순위 원인이 High가 아님 (PB-001 §1)";
    }
    let escalation: string | null = null;
    if (o.type === "delay") escalation = "사업부장 승인 필요 (CM-001 §4.1 출시 연기)";
    else if (o.expected_cost >= escalateAt) escalation = `사업부장 승인 필요 (CM-001 §4.1 기대비용 ≥ ${won(escalateAt)})`;
    return { ...o, allowed, blocked_reason, escalation };
  });

  const allowed = options.filter((o) => o.allowed).sort((x, y) => x.expected_cost - y.expected_cost);
  let rec = allowed[0] ?? null;
  let reasonRule = "R1 기대비용 최소";
  if (rec) {
    const cheapest = rec;
    const lowRisk = allowed
      .filter((o) => o.expected_cost <= cheapest.expected_cost * (1 + tolerance))
      .sort((x, y) => RISK_RANK[x.risk] - RISK_RANK[y.risk])[0];
    if (lowRisk && lowRisk.option_id !== rec.option_id && RISK_RANK[lowRisk.risk] < RISK_RANK[rec.risk]) {
      rec = lowRisk;
      reasonRule = `R2 차이 ${Math.round(tolerance * 100)}% 이내 → 리스크 낮은 안`;
    }
  }

  const reasons: string[] = [];
  if (rec) {
    reasons.push("QP-001 충족 (Critical 잔존 출시 아님)");
    if (rec.type === "scope_cut") reasons.push(`${rec.scope_cut_req}는 계약상 필수 기능 아님 (CT-001 §2)`);
    reasons.push(`${reasonRule} (${won(rec.expected_cost)})`);
    rec.rationale_docs.filter((d) => d.startsWith("Q-")).forEach((d) => reasons.push(`선례 ${d}`));
  }
  return { options, recommended_option: rec?.option_id ?? null, recommendation_reason: reasons };
}

/** 토큰 사용량 → 원 */
export function llmCost(usage: Usage | undefined, a: Assumptions): number {
  if (!usage) return 0;
  return Math.round(
    (usage.input_tokens / 1000) * asm(a, "llm_krw_per_1k_input") +
      (usage.output_tokens / 1000) * asm(a, "llm_krw_per_1k_output")
  );
}

/**
 * 이슈 한 건의 효과 (KPI ①②③). Before 는 1회 수작업 측정값이 있으면 그것, 없으면 가정치.
 * After 확정 기간은 입력값이 없으면 (타이머 + 검토 회의 시간) ÷ 하루 근무시간, 최소 1일.
 */
export function computeEffect(params: {
  a: Assumptions;
  before: BeforeMeasure | null;
  timerMs: number;
  llmCostKrw: number;
  input?: EffectInput;
}): Effect {
  const { a, before, timerMs, llmCostKrw, input } = params;
  const rate = asm(a, "hourly_rate");
  const beforeMH = before?.manhours ?? asm(a, "before_manhours");
  const beforeDays = before?.days ?? asm(a, "before_decision_days");
  const afterMH = input?.manhours ?? asm(a, "after_manhours");
  const reviewHours = input?.review_hours ?? 2;
  const afterDays = input?.days ?? Math.max(1, Math.ceil((timerMs / 3_600_000 + reviewHours) / asm(a, "hours_per_day")));
  const labor_cost_before = beforeMH * rate;
  const labor_cost_after = afterMH * rate;
  const labor_saving = labor_cost_before - labor_cost_after - llmCostKrw;
  const delay_cost_avoided = Math.max(0, beforeDays - afterDays) * asm(a, "daily_delay_cost");
  const annual_net =
    labor_saving * asm(a, "issues_per_year") + delay_cost_avoided * asm(a, "schedule_issues_per_year") - asm(a, "annual_opex");
  const annual_conservative =
    labor_saving * asm(a, "issues_per_year") +
    2 * asm(a, "headcount") * asm(a, "hours_per_day") * rate * asm(a, "schedule_issues_per_year") -
    asm(a, "annual_opex");
  return {
    decision_days_before: beforeDays,
    decision_days_after: afterDays,
    manhours_before: beforeMH,
    manhours_after: afterMH,
    labor_cost_before,
    labor_cost_after,
    llm_cost: llmCostKrw,
    labor_saving,
    delay_cost_avoided,
    annual_net,
    annual_conservative,
  };
}

/** 가정치만으로 계산한 KPI (중간발표 수치) */
export function assumedKpi(a: Assumptions) {
  const rate = asm(a, "hourly_rate");
  const labor = asm(a, "before_manhours") * rate - asm(a, "after_manhours") * rate - asm(a, "llm_cost_per_run");
  const delay = (asm(a, "before_decision_days") - asm(a, "after_decision_days")) * asm(a, "daily_delay_cost");
  const annual = labor * asm(a, "issues_per_year") + delay * asm(a, "schedule_issues_per_year") - asm(a, "annual_opex");
  const conservative =
    labor * asm(a, "issues_per_year") +
    2 * asm(a, "headcount") * asm(a, "hours_per_day") * rate * asm(a, "schedule_issues_per_year") -
    asm(a, "annual_opex");
  return { labor, delay, annual, conservative };
}
