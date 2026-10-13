import "server-only";
import { NextResponse, type NextRequest } from "next/server";

/**
 * 쓰기 API 공통 가드.
 *
 * - CSRF: 다른 사이트의 폼·이미지 요청은 임의 헤더를 붙일 수 없으므로(붙이면 CORS 사전 요청이
 *   나가고 이 서버는 허용하지 않는다) 이 헤더가 있는 요청만 받는다. 프록시가 Host 를 바꿔도
 *   영향이 없어 Origin 비교보다 단단하다.
 * - 크기: 계획 한 건은 1KB 안팎이라 기본 16KB 를 넘으면 거절한다. 절차가 긴 테스트 케이스처럼
 *   큰 본문을 받는 라우트는 maxBytes 를 넘긴다.
 */
export const WRITE_HEADER = "x-worksops-request";
const MAX_BODY_BYTES = 16 * 1024;

export function rejectUnsafeWrite(request: NextRequest, maxBytes = MAX_BODY_BYTES): NextResponse | null {
  if (request.headers.get(WRITE_HEADER) !== "1") {
    return NextResponse.json({ message: "허용되지 않은 요청입니다." }, { status: 403 });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBytes) {
    return NextResponse.json({ message: "요청이 너무 큽니다." }, { status: 413 });
  }
  return null;
}

/** 인증 게이트가 붙여 주는 로그인 사용자 이메일. 게이트가 없는 로컬 개발에서는 null */
export function actorOf(request: NextRequest): string | null {
  return request.headers.get("x-auth-email")?.trim() || null;
}

/** JSON 본문. 깨졌거나 너무 크면 null */
export async function readJsonBody(request: NextRequest, maxBytes = MAX_BODY_BYTES): Promise<unknown | null> {
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > maxBytes) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
