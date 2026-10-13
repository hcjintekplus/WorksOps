"use client";

import useSWR from "swr";
import { ApiError, fetcher, withBasePath } from "@/lib/fetcher";
import { WRITE_HEADER } from "@/lib/write-request-header";
import type { WorkOpsState } from "@/lib/workops/types";

export type WorkOpsPayload = { state: WorkOpsState; claudeConfigured: boolean; serverNow: number };

export const STATE_KEY = "/api/workops/state";

/** 화면 전체가 쓰는 WorkOps 상태. 쓰기 뒤에는 send() 가 다시 읽는다. */
export function useWorkops() {
  const { data, error, isLoading, mutate } = useSWR<WorkOpsPayload>(STATE_KEY, fetcher, {
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  /** 쓰기 API 호출 → 상태 다시 읽기. 실패하면 서버 문구로 ApiError 를 던진다. */
  async function send<T = unknown>(path: string, body: unknown = {}): Promise<T> {
    const res = await fetch(withBasePath(path), {
      method: "POST",
      headers: { "Content-Type": "application/json", [WRITE_HEADER]: "1" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    // 실패해도 서버가 일부(오류 · 실행 기록)를 남겼을 수 있어 늘 다시 읽는다.
    await mutate();
    if (!res.ok) throw new ApiError(json.message ?? "요청이 실패했습니다.", res.status);
    return json as T;
  }

  return { data, state: data?.state, error: error as ApiError | undefined, isLoading, mutate, send };
}
