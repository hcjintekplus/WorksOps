"use client";

import { useSyncExternalStore } from "react";

/**
 * 데이터 신선도 — 지금 화면이 받은 데이터가 언제 기준인가 (UI System §5 Freshness Indicator).
 *
 * fetcher 가 /api 응답마다 서버가 붙인 생성 시각(X-WorksOps-Generated-At)과 출처(캐시 / 실시간)를
 * 여기 적는다. 컨텍스트 바는 이번 화면에서 받은 것 중 가장 오래된 시각을 "n분 전 갱신" 으로 보인다.
 * 화면을 옮기면 비우고 새로 모은다.
 */
export type FreshnessEntry = { url: string; generatedAt: number; source: "cache" | "live" };

type State = { entries: Map<string, FreshnessEntry>; inflight: number; version: number };

const state: State = { entries: new Map(), inflight: 0, version: 0 };
const listeners = new Set<() => void>();

function emit() {
  state.version += 1;
  for (const listener of listeners) listener();
}

export const GENERATED_AT_HEADER = "x-worksops-generated-at";

/** fetcher 가 요청을 시작 · 끝낼 때 (컨텍스트 바의 2px 진행 바) */
export function trackRequest<T>(run: () => Promise<T>): Promise<T> {
  state.inflight += 1;
  emit();
  return run().finally(() => {
    state.inflight -= 1;
    emit();
  });
}

/** 성공한 /api 응답의 생성 시각과 출처를 적는다. 헤더가 없으면(DB 처럼 늘 실시간) 지금으로 본다. */
export function recordResponse(url: string, res: Response) {
  const header = res.headers.get(GENERATED_AT_HEADER);
  const generatedAt = header ? Date.parse(header) : Date.now();
  const cache = /cache;desc="(\w+)"/.exec(res.headers.get("server-timing") ?? "")?.[1];
  const source: FreshnessEntry["source"] = cache === "hit" || cache === "stale" ? "cache" : "live";
  // 같은 데이터는 쿼리 순서만 달라도 같은 것으로 본다.
  const key = url.split("?")[0];
  state.entries.set(key, { url: key, generatedAt: Number.isFinite(generatedAt) ? generatedAt : Date.now(), source });
  emit();
}

/** 화면을 옮겼을 때 */
export function resetFreshness() {
  if (state.entries.size === 0) return;
  state.entries = new Map();
  emit();
}

export type FreshnessSnapshot = { oldest: FreshnessEntry | null; loading: boolean; sources: Set<string> };

let cached: { version: number; snapshot: FreshnessSnapshot } | null = null;

function snapshot(): FreshnessSnapshot {
  if (cached?.version === state.version) return cached.snapshot;
  let oldest: FreshnessEntry | null = null;
  for (const entry of state.entries.values()) if (!oldest || entry.generatedAt < oldest.generatedAt) oldest = entry;
  const result = {
    oldest,
    loading: state.inflight > 0,
    sources: new Set([...state.entries.values()].map((e) => e.source)),
  };
  cached = { version: state.version, snapshot: result };
  return result;
}

const SERVER: FreshnessSnapshot = { oldest: null, loading: false, sources: new Set() };

export function useFreshness(): FreshnessSnapshot {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot,
    () => SERVER
  );
}
