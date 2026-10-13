import { addDays, todayIso } from "@/lib/workops/format";
import type { ActionResult, Change, ChangeRequest, Issue, RuledOption, Task, WorkOpsState } from "@/lib/workops/types";

/**
 * 승인 결과를 Mock Project System 에 반영한다 (S-004).
 *
 * 넘겨받은 state 를 그 자리에서 고친다. 호출하는 쪽은 복사본을 넘기고 성공했을 때만 저장한다 —
 * 그래서 중간에 실패하면 원본은 그대로이고, 이것이 롤백이다 (PRD: 반영 실패 시 롤백).
 */
export function applyDecision(
  state: WorkOpsState,
  issueId: string,
  option: RuledOption,
  action: ActionResult,
  options: { now?: Date; simulateFail?: boolean } = {}
): Change[] {
  const now = options.now ?? new Date();
  const db = state.db;
  const changes: Change[] = [];

  const issue = db.issues.find((i) => i.id === issueId);
  if (!issue) throw new Error(`이슈 ${issueId} 가 없습니다`);
  const release = db.releases.find((r) => r.id === issue.release_id);
  if (!release) throw new Error(`릴리스 ${issue.release_id} 가 없습니다`);

  const prevStatus = issue.status;
  Object.assign(issue, {
    status: "대응중",
    approved_at: now.toISOString(),
    selected_option: option.option_id,
  } satisfies Partial<Issue>);
  changes.push({ entity: "Issue", id: issue.id, change: `상태 ${prevStatus} → 대응중, 선택안 ${option.option_id}`, kind: "변경" });

  const cr: ChangeRequest = {
    id: `CR-${String(state.changeRequests.length + 1).padStart(3, "0")}`,
    issue_id: issue.id,
    option_id: option.option_id,
    ...action.change_request_draft,
    status: "승인",
  };
  state.changeRequests.push(cr);
  changes.push({ entity: "ChangeRequest", id: cr.id, change: "변경요청서 생성 (승인)", kind: "신규" });

  // 신규 Task 번호: T-301, T-302, … (이미 있는 T-3xx 다음부터)
  const nextTaskId = () => {
    const used = db.tasks.map((t) => /^T-3(\d\d)$/.exec(t.id)?.[1]).filter(Boolean).map(Number);
    return `T-${301 + (used.length ? Math.max(...used) : 0)}`;
  };
  const addTask = (title: string, owner: string, days: number, critical: boolean, req: string | null) => {
    const task: Task = {
      id: nextTaskId(),
      title,
      owner_id: owner,
      start: todayIso(0),
      end: todayIso(days),
      status: "예정",
      on_critical_path: critical,
      requirement_id: req,
    };
    db.tasks.push(task);
    changes.push({ entity: "Task", id: task.id, change: title, kind: "신규" });
  };

  if (option.type === "scope_cut") {
    const req = db.requirements.find((r) => r.id === option.scope_cut_req);
    if (req) {
      req.status = "이월";
      changes.push({ entity: "Requirement", id: req.id, change: "차기 업데이트로 이월", kind: "변경" });
    }
    const reqTitle = req ? `${req.id} ${req.title}` : option.scope_cut_req ?? "대상 기능";
    addTask(`${reqTitle} 비활성화`, "M-02", 3, true, option.scope_cut_req);
    addTask("4주 후 업데이트(FW 1.2.4) 배포", "M-04", 20, false, option.scope_cut_req);
    addTask("다중 연결 회귀 테스트 보강", "M-03", 10, false, option.scope_cut_req);
    changes.push({ entity: "Release", id: release.id, change: `출시일 유지 ${release.due_date}`, kind: "유지" });
  } else if (option.type === "fix") {
    addTask("근본 수정: 연결 대기열 비동기 처리 수정", "M-04", 5, true, "REQ-045");
    addTask("영향 모듈 전체 회귀 검증", "M-03", 6, true, "REQ-045");
    if (option.delay_days > 0) {
      release.due_date = addDays(release.due_date, option.delay_days);
      changes.push({ entity: "Release", id: release.id, change: `출시일 +${option.delay_days}일 → ${release.due_date}`, kind: "변경" });
    } else {
      changes.push({ entity: "Release", id: release.id, change: "출시일 유지", kind: "유지" });
    }
  } else {
    release.due_date = addDays(release.due_date, option.delay_days);
    changes.push({ entity: "Release", id: release.id, change: `출시 ${option.delay_days}일 연기 → ${release.due_date}`, kind: "변경" });
    addTask("출시 연기 공지·유통사 재협의", "M-07", 5, true, null);
  }

  const risk = db.risks.find((r) => r.id === "R-07");
  if (risk) {
    const prev = risk.likelihood;
    risk.likelihood = option.type === "delay" ? "L" : "M";
    risk.status = "대응중";
    changes.push({ entity: "Risk", id: risk.id, change: `발생 가능성 ${prev} → ${risk.likelihood}, 상태 대응중`, kind: "변경" });
  }

  if (options.simulateFail) throw new Error("Mock System 반영 실패 (시뮬레이션)");
  return changes;
}
