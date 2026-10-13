import { recordResponse, trackRequest } from "@/lib/freshness";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Next의 basePath는 Link·라우팅·에셋에만 자동 적용되고 fetch에는 붙지 않는다.
 * SWR 키는 "/api/..." 그대로 두고(캐시 키 유지) 실제 요청 경로에만 prefix를 붙인다.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(url: string): string {
  return url.startsWith("/") ? `${BASE_PATH}${url}` : url;
}

/**
 * "새로고침" 을 누른 직후에는 서버 응답 캐시(lib/route-cache.ts)를 건너뛰고 Jira 에서 새로 읽는다.
 * 메인 화면은 새로고침 때 페이지를 다시 불러오므로 표식을 sessionStorage 에도 잠깐 남긴다.
 * 표식은 FRESH_WINDOW_MS 뒤에 저절로 사라진다.
 */
const FRESH_WINDOW_MS = 15_000;
const FRESH_KEY = "worksops-fresh-until";
let freshUntil = 0;

export function requestFresh(): void {
  freshUntil = Date.now() + FRESH_WINDOW_MS;
  try {
    sessionStorage.setItem(FRESH_KEY, String(freshUntil));
  } catch {
    // 저장소를 못 쓰면 이 페이지 안에서만 적용된다.
  }
}

function wantsFresh(): boolean {
  if (Date.now() < freshUntil) return true;
  try {
    return Date.now() < Number(sessionStorage.getItem(FRESH_KEY) ?? 0);
  } catch {
    return false;
  }
}

/** SWR 의 mutate 를 받아 "캐시 건너뛰고 다시 읽기" 로 만든다 (각 훅의 refresh). */
export function refreshFresh<T>(mutate: () => Promise<T>): Promise<T> {
  requestFresh();
  return mutate();
}

export async function fetcher<T>(url: string): Promise<T> {
  let target = withBasePath(url);
  if (url.startsWith("/api/") && wantsFresh()) target += `${target.includes("?") ? "&" : "?"}fresh=1`;
  const res = await trackRequest(() => fetch(target));
  // 컨텍스트 바의 "n분 전 갱신" (lib/freshness.ts)
  if (res.ok && url.startsWith("/api/")) recordResponse(url, res);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "요청이 실패했습니다." }));
    throw new ApiError(body.message ?? "요청이 실패했습니다.", res.status);
  }
  return res.json();
}
