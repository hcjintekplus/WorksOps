import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * 요청 단위 성능 계측 (성능 개선 PRD FR-0).
 *
 * 한 요청(또는 캐시 갱신 한 번) 안에서 일어난 Jira 호출 수와 시간을 모은다. 결과는 응답의
 * Server-Timing 헤더와 한 줄 JSON 로그로 남긴다. 토큰·Authorization 헤더·쿠키는 기록하지 않는다 —
 * Jira 호출은 경로(쿼리스트링 제외)·상태코드·소요시간만 남긴다.
 */
type Meter = { jiraCalls: number; jiraMs: number; retries: number };

const storage = new AsyncLocalStorage<Meter>();

/** 개별 Jira 호출 로그. 기본은 끄고, 느리거나 실패한 호출만 남긴다. */
const LOG_EVERY_JIRA_CALL = process.env.PERF_LOG_JIRA === "1";
const SLOW_JIRA_MS = 3000;

export function newMeter(): Meter {
  return { jiraCalls: 0, jiraMs: 0, retries: 0 };
}

export function withMeter<T>(meter: Meter, run: () => Promise<T>): Promise<T> {
  return storage.run(meter, run);
}

/** jiraFetch 가 호출마다 부른다. */
export function recordJiraCall(path: string, status: number, ms: number): void {
  const meter = storage.getStore();
  if (meter) {
    meter.jiraCalls += 1;
    meter.jiraMs += ms;
  }
  if (LOG_EVERY_JIRA_CALL || ms >= SLOW_JIRA_MS || status >= 400) {
    console.log(
      JSON.stringify({
        evt: "jira_call",
        path: path.split("?")[0],
        status,
        ms: Math.round(ms),
      })
    );
  }
}

export function recordJiraRetry(): void {
  const meter = storage.getStore();
  if (meter) meter.retries += 1;
}

export type CacheState = "hit" | "stale" | "miss" | "bypass" | "off";

/** 라우트 응답에 Server-Timing 을 달고 한 줄 로그를 남긴다. */
export function finishTiming(
  response: Response,
  route: string,
  totalMs: number,
  meter: Meter,
  cache: CacheState
): Response {
  const timing = [
    `total;dur=${totalMs.toFixed(1)}`,
    `jira;dur=${meter.jiraMs.toFixed(1)};desc="${meter.jiraCalls} calls"`,
    `cache;desc="${cache}"`,
  ].join(", ");
  response.headers.set("Server-Timing", timing);
  console.log(
    JSON.stringify({
      evt: "api",
      route,
      status: response.status,
      ms: Math.round(totalMs),
      jiraCalls: meter.jiraCalls,
      jiraMs: Math.round(meter.jiraMs),
      retries: meter.retries,
      cache,
    })
  );
  return response;
}
