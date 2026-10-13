import "server-only";
import { persist, selectRows, serialized } from "@/lib/db";
import { freshState, upgradeState } from "@/lib/workops/state";
import type { WorkOpsState } from "@/lib/workops/types";

/**
 * WorkOps 상태 저장소 — SQLite(workops_state) 의 JSON 문서 한 벌.
 *
 * 쓰기는 mutateState 하나로만 한다. 복사본에 작업하고 성공했을 때만 저장하므로,
 * 작업 중 예외가 나면 저장된 상태는 그대로다 (승인 반영 롤백이 이 성질에 기댄다).
 * DB 접근은 serialized 로 한 줄로 세운다. LLM 호출처럼 오래 걸리는 일은 이 안에서 하지 않는다.
 */
function load(db: Parameters<Parameters<typeof serialized>[0]>[0]): WorkOpsState {
  const row = selectRows(db, "SELECT json FROM workops_state WHERE id = 1")[0];
  return row ? upgradeState(JSON.parse(String(row.json))) : freshState();
}

export function readState(): Promise<WorkOpsState> {
  return serialized((db) => load(db));
}

export function mutateState<T>(actor: string | null, task: (state: WorkOpsState) => T): Promise<T> {
  return serialized(async (db) => {
    const draft = structuredClone(load(db));
    const result = task(draft);
    db.run(
      `INSERT INTO workops_state (id, json, updated_by, updated_at) VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      [JSON.stringify(draft), actor, new Date().toISOString()]
    );
    await persist(db);
    return result;
  });
}

export function resetState(actor: string | null): Promise<void> {
  return mutateState(actor, (state) => {
    const keepUi = { ai: state.settings.ai, claude: state.settings.claude };
    Object.assign(state, freshState());
    Object.assign(state.settings, keepUi);
  });
}
