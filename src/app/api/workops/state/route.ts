import { NextResponse } from "next/server";
import { claudeConfigured } from "@/lib/workops/claude-ai";
import { readState } from "@/lib/workops/store";

export const dynamic = "force-dynamic";

/** 화면 전체가 쓰는 WorkOps 상태 한 벌 + Claude 키 설정 여부(값은 내보내지 않는다) */
export async function GET() {
  try {
    const state = await readState();
    return NextResponse.json(
      { state, claudeConfigured: claudeConfigured(), serverNow: Date.now() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error(JSON.stringify({ evt: "workops_state_error", message: String(error) }));
    return NextResponse.json({ message: "요청을 처리하지 못했습니다." }, { status: 500 });
  }
}
