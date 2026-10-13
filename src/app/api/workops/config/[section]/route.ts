import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { dailyDelayCost } from "@/lib/workops/cost-model";
import { recomputeEffects } from "@/lib/workops/pipeline";
import { handleWrite } from "@/lib/workops/route-helpers";
import { DEFAULT_ASSUMPTIONS } from "@/lib/workops/seed";
import { mutateState, resetState } from "@/lib/workops/store";

/**
 * 판단 기준 · 비용 가정치 · Before 측정값 · 설정 · 할 일 저장.
 * 값이 바뀌면 이미 기록된 효과(KPI)를 다시 계산한다.
 */
const SECTIONS = {
  rules: z.object({
    params: z.record(z.string(), z.number().min(0)),
    similarity_threshold: z.number().min(0).max(1),
  }),
  assumptions: z.object({ values: z.record(z.string(), z.number().min(0)) }),
  "assumptions-reset": z.object({}),
  "before-measure": z.object({
    who: z.string().max(40),
    days: z.number().positive().max(365),
    manhours: z.number().positive().max(100_000),
  }),
  "before-measure-clear": z.object({}),
  settings: z.object({
    ai: z.enum(["mock", "claude"]).optional(),
    model: z.string().regex(/^claude-[a-z0-9-]+$/).max(60).optional(),
    maxTokens: z.number().int().min(1000).max(64_000).optional(),
    globalRelease: z.string().max(40).optional(),
    simulateApplyFail: z.boolean().optional(),
  }),
  todo: z.object({
    no: z.string().max(10),
    owner: z.string().max(40).optional(),
    status: z.enum(["예정", "진행", "완료"]).optional(),
  }),
  reset: z.object({}),
} as const;

type Section = keyof typeof SECTIONS;

export async function POST(request: NextRequest, ctx: { params: Promise<{ section: string }> }) {
  const { section } = await ctx.params;
  if (!(section in SECTIONS)) return NextResponse.json({ message: "요청 경로를 찾을 수 없습니다." }, { status: 404 });
  const name = section as Section;

  return handleWrite(request, SECTIONS[name] as z.ZodType<Record<string, unknown>>, async (raw, actor) => {
    if (name === "reset") return resetState(actor);
    return mutateState(actor, (state) => {
      switch (name) {
        case "rules": {
          const body = raw as z.infer<(typeof SECTIONS)["rules"]>;
          for (const group of ["recommend", "escalate"] as const) {
            for (const rule of state.rules[group]) {
              const key = `${group}:${rule.id}`;
              if (rule.param !== undefined && key in body.params) rule.param = body.params[key];
            }
          }
          state.rules.similarity_threshold = body.similarity_threshold;
          break;
        }
        case "assumptions": {
          const body = raw as z.infer<(typeof SECTIONS)["assumptions"]>;
          for (const [key, value] of Object.entries(body.values)) if (state.assumptions[key]) state.assumptions[key].value = value;
          // 일 지연 비용은 구성 요소에서 다시 계산한다 (CG-001 §1)
          state.assumptions.daily_delay_cost.value = dailyDelayCost(state.assumptions);
          recomputeEffects(state);
          break;
        }
        case "assumptions-reset":
          state.assumptions = structuredClone(DEFAULT_ASSUMPTIONS);
          recomputeEffects(state);
          break;
        case "before-measure": {
          const body = raw as z.infer<(typeof SECTIONS)["before-measure"]>;
          state.beforeMeasure = { ...body, date: new Date().toISOString().slice(0, 10) };
          recomputeEffects(state);
          break;
        }
        case "before-measure-clear":
          state.beforeMeasure = null;
          recomputeEffects(state);
          break;
        case "settings": {
          const body = raw as z.infer<(typeof SECTIONS)["settings"]>;
          const s = state.settings;
          if (body.ai) s.ai = body.ai;
          if (body.model) s.claude.model = body.model;
          if (body.maxTokens) s.claude.maxTokens = body.maxTokens;
          if (body.globalRelease && state.db.releases.some((r) => r.id === body.globalRelease)) s.globalRelease = body.globalRelease;
          if (body.simulateApplyFail !== undefined) s.simulateApplyFail = body.simulateApplyFail;
          break;
        }
        case "todo": {
          const body = raw as z.infer<(typeof SECTIONS)["todo"]>;
          const todo = state.todos.find((t) => t.no === body.no);
          if (todo) {
            if (body.owner !== undefined) todo.owner = body.owner;
            if (body.status) todo.status = body.status;
          }
          break;
        }
      }
    });
  });
}
