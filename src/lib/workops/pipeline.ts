import "server-only";
import { MockAI, type AgentOutput } from "@/lib/workops/agents";
import { applyDecision } from "@/lib/workops/apply-decision";
import { ClaudeAI } from "@/lib/workops/claude-ai";
import { applyRules, asm, computeEffect, costModel, llmCost } from "@/lib/workops/cost-model";
import { retrieveForIssue } from "@/lib/workops/knowledge";
import { mutateState, readState } from "@/lib/workops/store";
import type {
  AgentName,
  AgentRun,
  ChangeRequestDraft,
  EffectInput,
  Issue,
  IssueRun,
  Severity,
  WorkOpsState,
} from "@/lib/workops/types";

/**
 * 이슈 대응 파이프라인 — Agent 를 순차 호출한다 (별도 Orchestrator 없음, PRD P2).
 *
 * Agent 호출은 저장소 잠금 밖에서 하고, 결과만 mutateState 로 한 번에 넣는다.
 * 그래서 LLM 이 느려도 다른 화면의 조회 · 저장이 막히지 않는다.
 */
export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

/** 같은 이슈의 Agent 가 동시에 두 번 돌지 않게 (프로세스는 하나다) */
const running = new Set<string>();

function getRun(state: WorkOpsState, id: string): IssueRun {
  return (state.runs[id] ??= { issue_id: id, timer_start: null, timer_ms: 0 });
}

function issueOf(state: WorkOpsState, id: string): Issue {
  const issue = state.db.issues.find((i) => i.id === id);
  if (!issue) throw new PipelineError(`이슈 ${id} 를 찾을 수 없습니다`, 404);
  return issue;
}

function llmCostOfIssue(state: WorkOpsState, id: string): number {
  return state.agentRuns.filter((r) => r.issue_id === id).reduce((s, r) => s + (r.llm_cost_krw ?? 0), 0);
}

type Recorded = Omit<AgentRun, "id">;

/** Agent 하나를 실행하고 실행 기록(AgentRun)을 남길 거리를 만든다 */
async function timed<T>(
  issueId: string,
  agent: AgentName,
  engine: AgentRun["engine"],
  state: WorkOpsState,
  log: Recorded[],
  run: () => Promise<AgentOutput<T>>
): Promise<T> {
  const started_at = new Date().toISOString();
  try {
    const { result, usage } = await run();
    log.push({
      issue_id: issueId,
      agent,
      engine,
      started_at,
      ended_at: new Date().toISOString(),
      tokens: usage.input_tokens + usage.output_tokens,
      llm_cost_krw: llmCost(usage, state.assumptions),
      status: "완료",
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.push({ issue_id: issueId, agent, engine, started_at, ended_at: new Date().toISOString(), status: "실패", error: message });
    throw error;
  }
}

function appendRuns(state: WorkOpsState, log: Recorded[]) {
  for (const r of log) state.agentRuns.push({ ...r, id: `AR-${state.agentRuns.length + 1}` });
}

async function exclusive<T>(id: string, task: () => Promise<T>): Promise<T> {
  if (running.has(id)) throw new PipelineError("이미 Agent 가 실행 중입니다. 잠시 후 다시 시도하세요.", 409);
  running.add(id);
  try {
    return await task();
  } finally {
    running.delete(id);
  }
}

/* ---------- S-001 이슈 접수 ---------- */

export type NewIssue = {
  title: string;
  description: string;
  severity: Severity;
  module: string;
  release_id: string;
  simulate?: "insufficient";
};

export function createIssue(actor: string | null, input: NewIssue): Promise<string> {
  return mutateState(actor, (state) => {
    if (!state.db.releases.some((r) => r.id === input.release_id)) throw new PipelineError("릴리스를 찾을 수 없습니다");
    state.seq += 1;
    const issue: Issue = {
      id: `Q-${state.seq}`,
      ...input,
      status: "접수",
      created_at: new Date().toISOString(),
      approved_at: null,
    };
    state.db.issues.unshift(issue);
    // 처리 타이머는 접수와 동시에 시작한다 (KPI ① After 실측)
    state.runs[issue.id] = { issue_id: issue.id, timer_start: Date.now(), timer_ms: 0 };
    return issue.id;
  });
}

/* ---------- S-002 원인 · 영향 분석 ---------- */

export function analyze(actor: string | null, id: string): Promise<void> {
  return exclusive(id, async () => {
    const state = await readState();
    const issue = issueOf(state, id);
    if (state.runs[id]?.decision) throw new PipelineError("이미 승인된 이슈입니다", 409);
    const engine = state.settings.ai;
    const log: Recorded[] = [];
    const hits = retrieveForIssue(issue);
    const docs = hits.map((h) => h.doc);

    await mutateState(actor, (s) => {
      issueOf(s, id).status = "분석중";
      const run = getRun(s, id);
      delete run.error;
      run.timer_start ??= Date.now();
    });

    try {
      const analysis = await timed(id, "Analysis", engine, state, log, () =>
        engine === "claude" ? ClaudeAI.analysis(state.settings, issue, docs) : MockAI.analysis(issue, docs)
      );
      const impact = await timed(id, "Impact", engine, state, log, () =>
        engine === "claude"
          ? ClaudeAI.impact(state.settings, issue, analysis, state.db, state.assumptions)
          : MockAI.impact(issue, analysis, state.db, state.assumptions)
      );
      await mutateState(actor, (s) => {
        const run = getRun(s, id);
        Object.assign(run, { retrieved: hits.map((h) => ({ doc_id: h.doc.doc_id, score: h.score })), analysis, impact });
        delete run.action;
        delete run.costs;
        issueOf(s, id).status = analysis.insufficient_evidence ? "분석중" : "승인대기";
        appendRuns(s, log);
      });
    } catch (error) {
      await mutateState(actor, (s) => {
        getRun(s, id).error = `분석 실패: ${error instanceof Error ? error.message : String(error)}`;
        appendRuns(s, log);
      });
      throw new PipelineError(getRunErrorMessage(error), 502);
    }
  });
}

function getRunErrorMessage(error: unknown) {
  return `Agent 호출 실패: ${error instanceof Error ? error.message : String(error)}`;
}

/** PM 이 원인 후보를 제외하거나 직접 입력한다 */
export function editCauses(actor: string | null, id: string, edit: { exclude?: number; add?: string }): Promise<void> {
  return mutateState(actor, (state) => {
    const run = getRun(state, id);
    if (!run.analysis) throw new PipelineError("분석 결과가 없습니다");
    const causes = run.analysis.causes;
    if (edit.exclude !== undefined) causes.splice(edit.exclude, 1);
    if (edit.add?.trim()) {
      causes.push({
        rank: 0,
        label: edit.add.trim(),
        evidence_strength: "Low",
        citations: [{ doc_id: "PM 입력", section: "-", snippet: "사람이 직접 입력한 원인 후보" }],
      });
    }
    causes.forEach((c, i) => (c.rank = i + 1));
    run.analysis.insufficient_evidence = causes.length === 0;
    issueOf(state, id).status = causes.length ? "승인대기" : "분석중";
    // 원인이 바뀌면 이전 대응안은 더 이상 맞지 않는다.
    delete run.action;
    delete run.costs;
  });
}

/* ---------- S-003 대응안 생성 · 비용 계산 ---------- */

export function generateOptions(actor: string | null, id: string, comment?: string): Promise<void> {
  return exclusive(id, async () => {
    const state = await readState();
    const issue = issueOf(state, id);
    const run = getRun(state, id);
    if (run.decision) throw new PipelineError("이미 승인된 이슈입니다", 409);
    const { analysis, impact } = run;
    if (!analysis || !impact) throw new PipelineError("분석 결과 화면에서 원인 분석을 먼저 실행하세요");
    if (!analysis.causes.length) throw new PipelineError("원인 후보가 없습니다. 원인 후보를 입력한 뒤 대응안을 생성하세요");
    const engine = state.settings.ai;
    const log: Recorded[] = [];
    try {
      const action = await timed(id, "Action", engine, state, log, () =>
        engine === "claude"
          ? ClaudeAI.action(state.settings, issue, analysis, impact, state.db, comment)
          : MockAI.action(issue, analysis, impact, state.db, comment)
      );
      await mutateState(actor, (s) => {
        const costed = costModel(action.options, impact, s.assumptions, asm(s.assumptions, "after_decision_days"));
        const target = getRun(s, id);
        Object.assign(target, { action, costs: applyRules(costed, analysis, s.db, s.rules), comment: comment || undefined });
        delete target.error;
        appendRuns(s, log);
      });
    } catch (error) {
      await mutateState(actor, (s) => appendRuns(s, log));
      throw new PipelineError(getRunErrorMessage(error), 502);
    }
  });
}

/* ---------- S-003 → S-004 승인 · 반영 ---------- */

export type Approval = { selected: string; override_reason?: string; cr: ChangeRequestDraft };

export function approve(actor: string | null, id: string, approval: Approval): Promise<void> {
  return mutateState(actor, (state) => {
    const issue = issueOf(state, id);
    const run = getRun(state, id);
    if (run.decision) throw new PipelineError("이미 승인된 이슈입니다", 409);
    if (!run.costs || !run.action) throw new PipelineError("분석 결과 화면에서 대응안을 먼저 생성하세요");
    const option = run.costs.options.find((o) => o.option_id === approval.selected);
    if (!option) throw new PipelineError("대응안을 선택하세요");
    if (!option.allowed) throw new PipelineError(`차단된 대응안입니다 — ${option.blocked_reason}`);
    const recommended = run.costs.recommended_option;
    const reason = approval.override_reason?.trim() || null;
    if (option.option_id !== recommended && !reason) throw new PipelineError("추천과 다른 안을 선택한 사유를 입력하세요");

    // 예외가 나면 mutateState 가 저장하지 않는다 → 롤백
    let changes;
    try {
      changes = applyDecision(
        state,
        id,
        option,
        { ...run.action, change_request_draft: approval.cr },
        { simulateFail: state.settings.simulateApplyFail }
      );
    } catch (error) {
      throw new PipelineError(error instanceof Error ? error.message : String(error), 500);
    }

    issue.ai_recommended = recommended ?? undefined;
    const decision = {
      id: `DL-${state.decisionLogs.length + 1}`,
      issue_id: id,
      ai_recommended: recommended,
      pm_selected: option.option_id,
      override_reason: reason,
      decided_at: new Date().toISOString(),
    };
    state.decisionLogs.push(decision);
    if (run.timer_start) {
      run.timer_ms += Date.now() - run.timer_start;
      run.timer_start = null;
    }
    const effect = computeEffect({
      a: state.assumptions,
      before: state.beforeMeasure,
      timerMs: run.timer_ms,
      llmCostKrw: llmCostOfIssue(state, id),
    });
    Object.assign(run, { decision, changes, effect });
    state.effectRecords.push({ issue_id: id, ...effect, recorded_at: decision.decided_at });
  });
}

/* ---------- S-004 효과 ---------- */

/** 효과를 다시 계산한다 (After 측정값 입력 · Before 측정값 변경 · 가정치 변경 뒤) */
export function recomputeEffects(state: WorkOpsState, onlyIssue?: string) {
  for (const record of state.effectRecords) {
    if (onlyIssue && record.issue_id !== onlyIssue) continue;
    const run = state.runs[record.issue_id];
    if (!run?.decision) continue;
    run.effect = computeEffect({
      a: state.assumptions,
      before: state.beforeMeasure,
      timerMs: run.timer_ms,
      llmCostKrw: llmCostOfIssue(state, record.issue_id),
      input: run.effectInput,
    });
    Object.assign(record, run.effect);
  }
}

export function updateEffect(actor: string | null, id: string, input: EffectInput): Promise<void> {
  return mutateState(actor, (state) => {
    const run = getRun(state, id);
    if (!run.decision) throw new PipelineError("승인된 이슈가 없습니다");
    run.effectInput = input;
    recomputeEffects(state, id);
  });
}

export function closeIssue(actor: string | null, id: string): Promise<void> {
  return mutateState(actor, (state) => {
    const issue = issueOf(state, id);
    if (!state.runs[id]?.decision) throw new PipelineError("승인·반영 전에는 종료할 수 없습니다");
    issue.status = "종료";
  });
}
