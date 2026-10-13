import { describe, expect, it } from "vitest";
import { applyDecision } from "@/lib/workops/apply-decision";
import { freshState } from "@/lib/workops/state";
import type { ActionResult, Issue, RuledOption } from "@/lib/workops/types";

const issue: Issue = {
  id: "Q-1025",
  title: "허브 재부팅",
  description: "-",
  severity: "Critical",
  module: "기기 연결",
  status: "승인대기",
  release_id: "REL-HUB20",
  created_at: "2026-10-13T00:00:00Z",
  approved_at: null,
};

const option = (o: Partial<RuledOption>): RuledOption => ({
  option_id: "B",
  type: "scope_cut",
  title: "",
  description: "",
  work_days: 3,
  scope_cut_req: "REQ-045",
  recurrence_prob: 0.05,
  risk: "Low",
  rationale_docs: [],
  delay_days: 0,
  delay_cost: 0,
  opportunity_loss: 0,
  follow_up_cost: 0,
  recurrence_loss: 0,
  expected_cost: 0,
  allowed: true,
  blocked_reason: null,
  escalation: null,
  ...o,
});

const action: ActionResult = {
  issue_id: issue.id,
  options: [],
  change_request_draft: { title: "CR", reason: "r", impact: "i", approval_request: "a" },
  suggested_owners: [],
};

function stateWithIssue() {
  const s = freshState();
  s.db.issues.unshift({ ...issue });
  return s;
}

describe("승인 반영 (SC-01 7단계)", () => {
  it("기능 축소: REQ-045 이월, T-301~303 신규, 출시일 유지, R-07 갱신, CR 생성", () => {
    const s = stateWithIssue();
    const due = s.db.releases[0].due_date;
    const changes = applyDecision(s, issue.id, option({}), action);
    expect(s.db.requirements.find((r) => r.id === "REQ-045")!.status).toBe("이월");
    expect(s.db.tasks.map((t) => t.id).filter((id) => id.startsWith("T-3"))).toEqual(["T-301", "T-302", "T-303"]);
    expect(s.db.releases[0].due_date).toBe(due);
    expect(s.db.risks.find((r) => r.id === "R-07")!.likelihood).toBe("M");
    expect(s.changeRequests).toHaveLength(1);
    expect(s.db.issues[0].status).toBe("대응중");
    expect(changes.filter((c) => c.entity === "Task")).toHaveLength(3);
  });

  it("출시 연기: 출시일이 연기 일수만큼 밀린다", () => {
    const s = stateWithIssue();
    applyDecision(s, issue.id, option({ option_id: "C", type: "delay", scope_cut_req: null, delay_days: 20 }), action);
    expect(s.db.releases[0].due_date).toBe("2026-11-29");
  });

  it("실패 시뮬레이션이면 예외 — 호출 쪽 원본은 그대로 (롤백)", () => {
    const original = stateWithIssue();
    const draft = structuredClone(original);
    expect(() => applyDecision(draft, issue.id, option({}), action, { simulateFail: true })).toThrow(/시뮬레이션/);
    expect(original.db.requirements.find((r) => r.id === "REQ-045")!.status).toBe("정상");
    expect(original.changeRequests).toHaveLength(0);
  });
});
