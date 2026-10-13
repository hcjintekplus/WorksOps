import "server-only";
import { finishTiming, newMeter, withMeter, type CacheState } from "@/lib/perf";

/**
 * Jira 를 읽는 API 라우트의 공통 래퍼 — 계측 + 응답 캐시 (성능 개선 PRD FR-0 · FR-2 · FR-3).
 *
 * - 캐시는 서버 프로세스 메모리에 둔다. 모든 사용자가 같은 봇 토큰으로 같은 Jira 데이터를 보므로
 *   (PRD 7장) 사용자 구분 없이 공용으로 써도 권한이 새지 않는다.
 * - 200 응답 본문만 담는다. 오류는 담지 않아 다음 요청이 다시 시도한다.
 * - FRESH 안이면 그대로, STALE 안이면 묵은 값을 바로 주고 뒤에서 한 번 다시 계산한다(SWR).
 *   그보다 오래됐거나 처음이면 계산을 기다린다. 같은 키의 동시 계산은 하나로 합친다(single-flight).
 * - `?fresh=1` 은 캐시를 건너뛰고 새로 계산해 담는다 — 화면의 "새로고침" 버튼이 쓴다.
 * - RESPONSE_CACHE_ENABLED=false 면 캐시를 끄고 예전처럼 매번 Jira 를 읽는다(즉시 원복용).
 */
const ENABLED = process.env.RESPONSE_CACHE_ENABLED !== "false";
/** 응답 데이터의 생성 시각 헤더 (lib/freshness.ts 가 읽는다) */
export const GENERATED_AT_HEADER = "X-WorksOps-Generated-At";
const FRESH_MS = Number(process.env.RESPONSE_CACHE_FRESH_MS) || 3 * 60 * 1000;
const STALE_MS = Number(process.env.RESPONSE_CACHE_STALE_MS) || 30 * 60 * 1000;
/** 키는 라우트 × 연도 · 모델 같은 몇 가지 파라미터라 많지 않다. 넘치면 오래 안 쓴 것부터 버린다. */
const MAX_ENTRIES = 100;

type Stored = { body: string; contentType: string; at: number };
type Entry = { stored?: Stored; inflight?: Promise<Stored | null> };

const entries = new Map<string, Entry>();

function touch(key: string, entry: Entry) {
  entries.delete(key);
  entries.set(key, entry);
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value as string;
    entries.delete(oldest);
  }
}

/** 요청 → 캐시 키. fresh 표식은 빼고, 파라미터 순서는 정렬한다. */
function cacheKey(route: string, request: Request, extra: string): string {
  const url = new URL(request.url);
  url.searchParams.delete("fresh");
  url.searchParams.sort();
  return `${route}|${extra}|${url.searchParams.toString()}`;
}

function respond(stored: Stored): Response {
  return new Response(stored.body, {
    status: 200,
    headers: {
      "Content-Type": stored.contentType,
      "Cache-Control": "no-store",
      // 이 데이터를 Jira 에서 읽은 시각. 화면의 "n분 전 갱신" 이 이 값을 쓴다.
      [GENERATED_AT_HEADER]: new Date(stored.at).toISOString(),
    },
  });
}

/**
 * 핸들러를 한 번 돌려 200 이면 담는다. 같은 키로 이미 도는 계산이 있으면 그것을 기다린다.
 * 200 이 아니면 null — 호출한 쪽이 그 응답을 그대로 돌려준다.
 */
function compute(
  key: string,
  entry: Entry,
  run: () => Promise<Response>
): { promise: Promise<Stored | null>; response: Promise<Response> } {
  if (entry.inflight) {
    const promise = entry.inflight;
    return {
      promise,
      response: promise.then((stored) =>
        stored ? respond(stored) : run() // 앞선 계산이 실패했으면 이 요청도 직접 시도해 그 응답을 준다.
      ),
    };
  }
  let resolveResponse!: (r: Response) => void;
  const response = new Promise<Response>((resolve) => (resolveResponse = resolve));
  const promise = (async () => {
    try {
      const res = await run();
      if (res.status !== 200) {
        resolveResponse(res);
        return null;
      }
      const stored: Stored = {
        body: await res.text(),
        contentType: res.headers.get("content-type") ?? "application/json",
        at: Date.now(),
      };
      entry.stored = stored;
      touch(key, entry);
      resolveResponse(respond(stored));
      return stored;
    } catch (error) {
      resolveResponse(Response.json({ message: "요청을 처리하지 못했습니다." }, { status: 500 }));
      console.error(JSON.stringify({ evt: "route_cache_error", key, message: String(error) }));
      return null;
    } finally {
      entry.inflight = undefined;
    }
  })();
  entry.inflight = promise;
  return { promise, response };
}

export function jiraRoute<R extends Request, C>(
  route: string,
  handler: (request: R, ctx: C) => Promise<Response>,
  options: { key?: (ctx: C) => Promise<string> } = {}
): (request: R, ctx: C) => Promise<Response> {
  return async (request, ctx) => {
    const started = performance.now();
    const meter = newMeter();
    const run = () => withMeter(meter, () => handler(request, ctx));
    const done = (res: Response, state: CacheState) => {
      // 캐시를 거치지 않은 응답(끔 · 오류)은 지금 읽은 것이다.
      if (!res.headers.has(GENERATED_AT_HEADER)) res.headers.set(GENERATED_AT_HEADER, new Date().toISOString());
      return finishTiming(res, route, performance.now() - started, meter, state);
    };

    if (!ENABLED) return done(await run(), "off");

    const key = cacheKey(route, request, options.key ? await options.key(ctx) : "");
    const entry = entries.get(key) ?? {};
    if (!entries.has(key)) touch(key, entry);
    const bypass = new URL(request.url).searchParams.get("fresh") === "1";
    const age = entry.stored ? Date.now() - entry.stored.at : Infinity;

    if (!bypass && entry.stored && age < FRESH_MS) {
      touch(key, entry);
      return done(respond(entry.stored), "hit");
    }
    if (!bypass && entry.stored && age < STALE_MS) {
      touch(key, entry);
      // 묵은 값을 바로 주고, 뒤에서 한 번만 다시 계산한다. 실패하면 묵은 값을 그대로 둔다.
      if (!entry.inflight) {
        const background = newMeter();
        compute(key, entry, () => withMeter(background, () => handler(request, ctx))).promise.catch(
          () => undefined
        );
      }
      return done(respond(entry.stored), "stale");
    }
    const { response } = compute(key, entry, run);
    return done(await response, bypass ? "bypass" : "miss");
  };
}
