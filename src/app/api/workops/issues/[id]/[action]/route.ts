import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  analyze,
  approve,
  closeIssue,
  editCauses,
  generateOptions,
  updateEffect,
} from "@/lib/workops/pipeline";
import { handleWrite } from "@/lib/workops/route-helpers";

/** Agent 호출(Claude)은 수십 초 걸릴 수 있다 */
export const maxDuration = 300;

const text = (max: number) => z.string().max(max);

const ACTIONS = {
  /** S-002 원인 · 영향 분석 (Analysis → Impact) */
  analyze: { schema: z.object({}), run: (id: string, _b: object, actor: string | null) => analyze(actor, id) },
  /** S-002 원인 후보 제외 · 직접 입력 */
  causes: {
    schema: z.object({ exclude: z.number().int().min(0).max(10).optional(), add: text(200).optional() }),
    run: (id: string, b: { exclude?: number; add?: string }, actor: string | null) => editCauses(actor, id, b),
  },
  /** S-003 대응안 생성 · 재생성 (Action → cost_model → rules) */
  options: {
    schema: z.object({ comment: text(500).optional() }),
    run: (id: string, b: { comment?: string }, actor: string | null) => generateOptions(actor, id, b.comment),
  },
  /** S-003 선택안 승인 및 반영 */
  approve: {
    schema: z.object({
      selected: z.string().min(1).max(4),
      override_reason: text(500).optional(),
      cr: z.object({ title: text(200), reason: text(2000), impact: text(2000), approval_request: text(500) }),
    }),
    run: (id: string, b: Parameters<typeof approve>[2], actor: string | null) => approve(actor, id, b),
  },
  /** S-004 After 측정값 입력 → KPI 재계산 */
  effect: {
    schema: z.object({
      manhours: z.number().min(0).max(10_000).optional(),
      review_hours: z.number().min(0).max(1_000).optional(),
      days: z.number().min(0).max(365).optional(),
    }),
    run: (id: string, b: Parameters<typeof updateEffect>[2], actor: string | null) => updateEffect(actor, id, b),
  },
  /** 이슈 종료 */
  close: { schema: z.object({}), run: (id: string, _b: object, actor: string | null) => closeIssue(actor, id) },
} as const;

type ActionName = keyof typeof ACTIONS;

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await ctx.params;
  if (!/^Q-\d{1,6}$/.test(id) || !(action in ACTIONS)) {
    return NextResponse.json({ message: "요청 경로를 찾을 수 없습니다." }, { status: 404 });
  }
  const { schema, run } = ACTIONS[action as ActionName];
  return handleWrite(request, schema as z.ZodType<object>, (body, actor) =>
    (run as (id: string, b: object, actor: string | null) => Promise<void>)(id, body, actor)
  );
}
