import { asm } from "@/lib/workops/cost-model";
import { findDoc, sectionText } from "@/lib/workops/knowledge";
import type {
  ActionResult,
  AnalysisResult,
  Assumptions,
  Cause,
  ImpactResult,
  Issue,
  KnowledgeDoc,
  ProjectDb,
  Usage,
} from "@/lib/workops/types";

/**
 * Agent 3종의 공통 계약과 재생 모드(MockAI).
 *
 * 엔진(재생 · Claude)이 무엇이든 결과는 finalize* 를 거친다. 여기서 코드가
 * - 인용을 검색된 문서로만 제한하고 발췌를 원문에서 다시 채우며 (근거 ≥ 1건 보장)
 * - 영향 범위의 크리티컬 패스 · 계약 조항 · 출시 차단 · 방치 시 지연일을 DB 와 가정치로 계산한다.
 * LLM 이 쓴 숫자나 없는 ID 가 화면 · 비용 계산에 새어 들지 않게 하는 경계다.
 */
export type AgentOutput<T> = { result: T; usage: Usage };

export type AnalysisDraft = Omit<AnalysisResult, "issue_id" | "insufficient_evidence">;
export type ImpactDraft = {
  affected_requirements: string[];
  affected_tasks: string[];
  affected_risks: string[];
  fix_and_verify_days: number;
};
export type ActionDraft = Omit<ActionResult, "issue_id">;

export function finalizeAnalysis(issueId: string, draft: AnalysisDraft, retrieved: KnowledgeDoc[]): AnalysisResult {
  const allowed = new Set(retrieved.map((d) => d.doc_id));
  const causes: Cause[] = draft.causes
    .map((c) => ({
      ...c,
      citations: c.citations
        .filter((ct) => allowed.has(ct.doc_id) && findDoc(ct.doc_id)?.sections[ct.section] !== undefined)
        .map((ct) => ({ ...ct, snippet: sectionText(ct.doc_id, ct.section) })),
    }))
    .filter((c) => c.citations.length > 0)
    .slice(0, 3)
    .map((c, i) => ({ ...c, rank: i + 1 }));
  return {
    issue_id: issueId,
    causes,
    similar_issues: draft.similar_issues.filter((s) => findDoc(s.issue_id)),
    insufficient_evidence: causes.length === 0,
  };
}

export function finalizeImpact(issue: Issue, draft: ImpactDraft, db: ProjectDb, a: Assumptions): ImpactResult {
  const has = <T extends { id: string }>(list: T[]) => (id: string) => list.some((x) => x.id === id);
  const tasks = draft.affected_tasks.filter(has(db.tasks));
  const release = db.releases.find((r) => r.id === issue.release_id) ?? db.releases[0];
  const contract = db.contracts.find((c) => c.id === release?.contract_id);
  return {
    issue_id: issue.id,
    affected_requirements: draft.affected_requirements.filter(has(db.requirements)),
    affected_tasks: tasks,
    critical_path_tasks: tasks.filter((id) => db.tasks.find((t) => t.id === id)?.on_critical_path),
    affected_risks: draft.affected_risks.filter(has(db.risks)),
    contract_terms: contract
      ? [{ clause: `${contract.id} §1 납기 페널티`, penalty: contract.penalty_per_day, required_features: contract.required_features }]
      : [],
    // QP-001 §3.1: Critical 이 1건이라도 남으면 출시할 수 없다.
    release_blocked: issue.severity === "Critical",
    baseline: {
      fix_and_verify_days: Math.max(0, Math.round(draft.fix_and_verify_days)),
      buffer_days: release?.buffer_days ?? asm(a, "buffer_days"),
      delay_if_untreated: asm(a, "days_per_month"),
    },
  };
}

export function finalizeAction(issueId: string, draft: ActionDraft, db: ProjectDb): ActionResult {
  return {
    issue_id: issueId,
    options: draft.options.map((o) => ({
      ...o,
      work_days: Math.max(0, Math.round(o.work_days)),
      recurrence_prob: Math.min(1, Math.max(0, o.recurrence_prob)),
      scope_cut_req: o.type === "scope_cut" ? o.scope_cut_req : null,
    })),
    change_request_draft: draft.change_request_draft,
    suggested_owners: draft.suggested_owners.filter((s) => db.members.some((m) => m.id === s.member_id)),
  };
}

/* ===================== 재생 모드 (SC-01 저장 결과) ===================== */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cite = (doc_id: string, section: string) => ({ doc_id, section, snippet: "" });

export const MockAI = {
  async analysis(issue: Issue, docs: KnowledgeDoc[]): Promise<AgentOutput<AnalysisResult>> {
    await sleep(900);
    const ids = new Set(docs.map((d) => d.doc_id));
    const causes: Cause[] = [];
    if (ids.has("CHG-123") && ids.has("TR-0921"))
      causes.push({
        rank: 1,
        label: "FW 1.2.3의 통신 라이브러리 업데이트로 연결 대기열이 넘침",
        evidence_strength: "High",
        citations: [cite("CHG-123", "1"), cite("TR-0921", "4.3"), cite("SDD-HUB", "3.2")],
      });
    if (ids.has("SRS-HUB20"))
      causes.push({
        rank: 0,
        label: "동시 연결 대수 요구사항 변경(5→10대)이 FW 설정에 반영되지 않음",
        evidence_strength: "Med",
        citations: [cite("SRS-HUB20", "변경이력 v1.3"), cite("Q-0901", "요약")],
      });
    if (ids.has("TR-REG"))
      causes.push({ rank: 0, label: "다중 연결 회귀 테스트 누락", evidence_strength: "Med", citations: [cite("TR-REG", "2")] });
    const similar = ids.has("Q-0812")
      ? [{ issue_id: "Q-0812", summary: "통신 설정값 오류로 간헐 연결 끊김", resolution: "설정값 롤백으로 해결" }]
      : [];
    return {
      result: finalizeAnalysis(issue.id, { causes, similar_issues: similar }, docs),
      usage: causes.length ? { input_tokens: 6400, output_tokens: 620 } : { input_tokens: 2100, output_tokens: 90 },
    };
  },

  async impact(issue: Issue, _analysis: AnalysisResult, db: ProjectDb, a: Assumptions): Promise<AgentOutput<ImpactResult>> {
    await sleep(600);
    const draft: ImpactDraft = {
      affected_requirements: ["REQ-045"],
      affected_tasks: ["T-210", "T-215"],
      affected_risks: ["R-07"],
      fix_and_verify_days: 11,
    };
    return { result: finalizeImpact(issue, draft, db, a), usage: { input_tokens: 3100, output_tokens: 260 } };
  },

  async action(
    issue: Issue,
    analysis: AnalysisResult,
    _impact: ImpactResult,
    db: ProjectDb,
    comment?: string
  ): Promise<AgentOutput<ActionResult>> {
    await sleep(1100);
    const top = analysis.causes[0];
    const draft: ActionDraft = {
      options: [
        {
          option_id: "A",
          type: "fix",
          title: "근본 수정 후 전체 재검증",
          description: `연결 대기열 비동기 처리 결함을 수정(5일)하고 영향 모듈 전체 회귀 검증(6일) 후 출시. 1순위 원인 ${top?.evidence_strength ?? "-"}.`,
          work_days: 11,
          scope_cut_req: null,
          recurrence_prob: 0.2,
          risk: "Medium",
          rationale_docs: ["QP-001 §4.2", "Q-0655"],
        },
        {
          option_id: "B",
          type: "scope_cut",
          title: "자동 다중 연결 기능을 끄고 정시 출시, 4주 후 업데이트 배포",
          description: `REQ-045를 비활성화(3일)하고 출시일 유지. FW 1.2.4 업데이트로 4주 후 복구.${comment ? ` PM 코멘트 반영: ${comment}` : ""}`,
          work_days: 3,
          scope_cut_req: "REQ-045",
          recurrence_prob: 0.05,
          risk: "Low",
          rationale_docs: ["CT-001 §2", "PB-001 §2", "Q-0590"],
        },
        {
          option_id: "C",
          type: "delay",
          title: "출시 1개월 연기",
          description: "근본 수정·전체 재검증을 마치고 출시. 유통사 입고일 재협의.",
          work_days: 20,
          scope_cut_req: null,
          recurrence_prob: 0,
          risk: "Low",
          rationale_docs: ["CM-001 §4.1", "Q-0703"],
        },
      ],
      change_request_draft: {
        title: `CR: ${issue.id} 다중 연결 결함 대응 — REQ-045 비활성화 후 정시 출시`,
        reason:
          "FW 1.2.3 통신 라이브러리 업데이트로 연결 대기열 초과 시 재부팅(TR-0921 §4.3). 근본 수정+재검증은 11일로 버퍼(5일) 초과.",
        impact: "REQ-045 차기 업데이트로 이월(계약 필수 기능 아님, CT-001 §2). 출시일·입고일 유지. T-301~303 신규.",
        approval_request: "PM 승인 (CM-001 §3.3 기능 축소·이월). 사업부장 승인 불필요.",
      },
      suggested_owners: [
        { task: "기능 비활성화", member_id: "M-02", reason: "ORG-001 §1 기기 연결·FW 담당 리드" },
        { task: "회귀 테스트 보강", member_id: "M-03", reason: "ORG-001 §1 시스템 테스트·회귀 담당" },
        { task: "FW 1.2.4 업데이트", member_id: "M-04", reason: "통신 스택 담당, 부하 90% 주의" },
      ],
    };
    return { result: finalizeAction(issue.id, draft, db), usage: { input_tokens: 7800, output_tokens: 1150 } };
  },
};
