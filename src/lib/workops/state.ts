import { TODOS_SEED } from "@/lib/workops/prd-content";
import { DEFAULT_ASSUMPTIONS, DEFAULT_RULES, SEED } from "@/lib/workops/seed";
import type { WorkOpsState } from "@/lib/workops/types";

/** Claude 기본 모델 (설정 화면에서 바꿀 수 있다) */
export const DEFAULT_CLAUDE_MODEL = "claude-opus-5-5";

/** 시드로 만든 새 상태 */
export function freshState(): WorkOpsState {
  return {
    db: structuredClone(SEED),
    assumptions: structuredClone(DEFAULT_ASSUMPTIONS),
    rules: structuredClone(DEFAULT_RULES),
    runs: {},
    changeRequests: [],
    decisionLogs: [],
    effectRecords: [],
    agentRuns: [],
    todos: TODOS_SEED.map((t) => ({ ...t, owner: "", status: "예정" })),
    beforeMeasure: null,
    settings: {
      ai: "mock",
      claude: { model: DEFAULT_CLAUDE_MODEL, maxTokens: 16000 },
      globalRelease: SEED.releases[0].id,
      simulateApplyFail: false,
    },
    seq: 1024,
  };
}

/** 저장된 상태에 새 버전에서 늘어난 키(가정치 등)를 채운다 */
export function upgradeState(stored: Partial<WorkOpsState>): WorkOpsState {
  const fresh = freshState();
  return {
    ...fresh,
    ...stored,
    assumptions: { ...fresh.assumptions, ...stored.assumptions },
    settings: {
      ...fresh.settings,
      ...stored.settings,
      claude: { ...fresh.settings.claude, ...stored.settings?.claude },
    },
  };
}

/** 이슈의 처리 시간(ms). 타이머가 돌고 있으면 지금까지 */
export function elapsedMs(run: { timer_ms: number; timer_start: number | null } | undefined, now = Date.now()): number {
  if (!run) return 0;
  return run.timer_ms + (run.timer_start ? now - run.timer_start : 0);
}

/** 이슈 상세의 현재 단계 (1 접수 · 2 분석 · 3 대응안 · 4 반영) */
export function stepOf(run: WorkOpsState["runs"][string] | undefined): 1 | 2 | 3 | 4 {
  if (run?.decision) return 4;
  if (run?.costs) return 3;
  if (run?.analysis) return 2;
  return 1;
}
