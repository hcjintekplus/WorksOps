import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { PipelineError } from "@/lib/workops/pipeline";
import { actorOf, readJsonBody, rejectUnsafeWrite } from "@/lib/write-request";

/**
 * WorkOps 쓰기 API 공통 처리: 쓰기 가드 → 본문 검증 → 실행 → 오류 응답.
 * PipelineError 는 사용자에게 보여 줄 문구라 그대로 내보내고, 그 밖의 오류는 로그만 남긴다.
 */
export async function handleWrite<S extends z.ZodType>(
  request: NextRequest,
  schema: S,
  run: (body: z.infer<S>, actor: string | null) => Promise<unknown>,
  maxBytes = 64 * 1024
): Promise<NextResponse> {
  const rejected = rejectUnsafeWrite(request, maxBytes);
  if (rejected) return rejected;

  const parsed = schema.safeParse((await readJsonBody(request, maxBytes)) ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { message: "입력값을 확인하세요.", errors: parsed.error.issues.map((i) => i.path.join(".") || i.message) },
      { status: 400 }
    );
  }

  try {
    const result = await run(parsed.data, actorOf(request));
    return NextResponse.json(result ?? { ok: true });
  } catch (error) {
    if (error instanceof PipelineError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error(JSON.stringify({ evt: "workops_write_error", path: new URL(request.url).pathname, message: String(error) }));
    return NextResponse.json({ message: "요청을 처리하지 못했습니다." }, { status: 500 });
  }
}
