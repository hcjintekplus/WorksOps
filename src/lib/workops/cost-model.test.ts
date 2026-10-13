import { describe, expect, it } from "vitest";
import { MockAI } from "@/lib/workops/agents";
import { applyRules, assumedKpi, computeEffect, costModel, dailyDelayCost, llmCost } from "@/lib/workops/cost-model";
import { retrieveForIssue } from "@/lib/workops/knowledge";
import { freshState } from "@/lib/workops/state";
import type { AnalysisResult, Issue } from "@/lib/workops/types";

const SC01: Issue = {
  id: "Q-1025",
  title: "여러 기기 연속 연결 시 허브 재부팅 (FW 1.2.3)",
  description: "최종 검증(D-28)에서 IoT 기기 8대 이상을 30초 이내 연속 연결하면 허브가 재부팅됨. 재현율 5/20.",
  severity: "Critical",
  module: "기기 연결",
  status: "접수",
  release_id: "REL-HUB20",
  created_at: "2026-10-13T00:00:00Z",
  approved_at: null,
};

async function sc01() {
  const s = freshState();
  const docs = retrieveForIssue(SC01).map((h) => h.doc);
  const analysis = (await MockAI.analysis(SC01, docs)).result;
  const impact = (await MockAI.impact(SC01, analysis, s.db, s.assumptions)).result;
  const action = (await MockAI.action(SC01, analysis, impact, s.db)).result;
  const costed = costModel(action.options, impact, s.assumptions, 1);
  return { s, analysis, impact, costs: applyRules(costed, analysis, s.db, s.rules) };
}

describe("SC-01 대응안 비용 (PRD 11장 표)", () => {
  it("A 4.0억 · B 1.33억 · C 10억, B 추천", async () => {
    const { costs } = await sc01();
    const byId = Object.fromEntries(costs.options.map((o) => [o.option_id, o]));
    expect(byId.A.delay_days).toBe(7);
    expect(byId.A.expected_cost).toBe(400_000_000);
    expect(byId.B.delay_days).toBe(0);
    expect(byId.B.expected_cost).toBe(132_500_000);
    expect(byId.C.expected_cost).toBe(1_000_000_000);
    expect(costs.recommended_option).toBe("B");
    expect(byId.C.escalation).toMatch(/사업부장/);
    expect(costs.recommendation_reason).toContain("선례 Q-0590");
  }, 10_000);

  it("원인 3개, 1순위 High, 모든 원인에 근거 ≥ 1건", async () => {
    const { analysis } = await sc01();
    expect(analysis.causes).toHaveLength(3);
    expect(analysis.causes[0].evidence_strength).toBe("High");
    for (const c of analysis.causes) {
      expect(c.citations.length).toBeGreaterThan(0);
      for (const ct of c.citations) expect(ct.snippet).not.toBe("");
    }
  }, 10_000);

  it("Critical 이면 출시 차단, 방치 시 20일 지연", async () => {
    const { impact } = await sc01();
    expect(impact.release_blocked).toBe(true);
    expect(impact.baseline).toEqual({ fix_and_verify_days: 11, buffer_days: 5, delay_if_untreated: 20 });
    expect(impact.critical_path_tasks).toEqual(["T-210", "T-215"]);
  }, 10_000);
});

describe("판단 규칙", () => {
  it("G2: 계약 필수 기능이면 기능 축소안 차단 → A 추천 (V-02)", async () => {
    const { s, analysis, impact } = await sc01();
    s.db.requirements.find((r) => r.id === "REQ-045")!.contract_required = true;
    const action = (await MockAI.action(SC01, analysis, impact, s.db)).result;
    const costs = applyRules(costModel(action.options, impact, s.assumptions, 1), analysis, s.db, s.rules);
    expect(costs.options.find((o) => o.option_id === "B")!.allowed).toBe(false);
    expect(costs.recommended_option).toBe("A");
  }, 10_000);

  it("G3: 1순위 원인이 High 가 아니면 근본 수정안 차단", async () => {
    const { s, impact } = await sc01();
    const weak: AnalysisResult = {
      issue_id: SC01.id,
      causes: [{ rank: 1, label: "x", evidence_strength: "Med", citations: [{ doc_id: "TR-REG", section: "2", snippet: "" }] }],
      similar_issues: [],
      insufficient_evidence: false,
    };
    const action = (await MockAI.action(SC01, weak, impact, s.db)).result;
    const costs = applyRules(costModel(action.options, impact, s.assumptions, 1), weak, s.db, s.rules);
    expect(costs.options.find((o) => o.option_id === "A")!.allowed).toBe(false);
  }, 10_000);

  it("근거 부족 시연(V-03)이면 원인 후보가 없다", async () => {
    const docs = retrieveForIssue({ ...SC01, simulate: "insufficient" }).map((h) => h.doc);
    const { result } = await MockAI.analysis(SC01, docs);
    expect(result.insufficient_evidence).toBe(true);
    expect(result.causes).toHaveLength(0);
  }, 10_000);
});

describe("KPI (PRD 11장 가정치 기준)", () => {
  const a = freshState().assumptions;

  it("일 지연 비용 5,000만원", () => {
    expect(dailyDelayCost(a)).toBe(50_000_000);
  });

  it("① 449만원/건 · ② 2억원/건 · ③ 약 8.4억 · 보수 약 3.6억", () => {
    const k = assumedKpi(a);
    expect(k.labor).toBe(4_490_000);
    expect(k.delay).toBe(200_000_000);
    expect(k.annual).toBe(839_800_000);
    expect(k.conservative).toBe(359_800_000);
  });

  it("After 확정 기간은 (타이머 + 검토 2h) ÷ 8h, 최소 1일", () => {
    const e = computeEffect({ a, before: null, timerMs: 30 * 60_000, llmCostKrw: 400 });
    expect(e.decision_days_after).toBe(1);
    expect(e.delay_cost_avoided).toBe(200_000_000);
    expect(e.labor_saving).toBe(6_000_000 - 1_500_000 - 400);
  });

  it("LLM 비용 = 입력 4원/1k + 출력 20원/1k", () => {
    expect(llmCost({ input_tokens: 6400, output_tokens: 620 }, a)).toBe(38);
  });
});
