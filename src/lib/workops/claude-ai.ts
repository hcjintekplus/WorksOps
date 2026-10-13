import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  finalizeAction,
  finalizeAnalysis,
  finalizeImpact,
  type AgentOutput,
} from "@/lib/workops/agents";
import { PROMPTS } from "@/lib/workops/prd-content";
import type {
  ActionResult,
  AnalysisResult,
  Assumptions,
  ImpactResult,
  Issue,
  KnowledgeDoc,
  ProjectDb,
  Settings,
  Usage,
} from "@/lib/workops/types";

/**
 * Claude API 엔진. 서버에서만 호출한다 — API 키는 ANTHROPIC_API_KEY 환경변수로만 받고 화면 · DB 에 두지 않는다.
 *
 * Agent 마다 prompts/*.md 를 system 으로, 입력 JSON 을 user 로 보내고 구조화 출력(zod 스키마)으로 받는다.
 * 비용 · 허용 여부 · 추천은 스키마에 아예 없다 — cost_model + rules 가 계산한다.
 */
export function claudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!claudeConfigured()) throw new Error("ANTHROPIC_API_KEY 가 설정되지 않았습니다. 서버 환경변수를 확인하세요.");
  client ??= new Anthropic();
  return client;
}

const citationSchema = z.object({ doc_id: z.string(), section: z.string() });

const analysisSchema = z.object({
  causes: z
    .array(
      z.object({
        label: z.string(),
        evidence_strength: z.enum(["High", "Med", "Low"]),
        citations: z.array(citationSchema),
      })
    )
    .describe("원인 후보 최대 3개, 가능성 높은 순"),
  similar_issues: z.array(z.object({ issue_id: z.string(), summary: z.string(), resolution: z.string() })),
});

const impactSchema = z.object({
  affected_requirements: z.array(z.string()),
  affected_tasks: z.array(z.string()),
  affected_risks: z.array(z.string()),
  fix_and_verify_days: z.number().describe("근본 수정 + 재검증에 드는 작업일 추정"),
});

const actionSchema = z.object({
  options: z.array(
    z.object({
      option_id: z.enum(["A", "B", "C"]),
      type: z.enum(["fix", "scope_cut", "delay"]),
      title: z.string(),
      description: z.string(),
      work_days: z.number(),
      scope_cut_req: z.string().nullable(),
      recurrence_prob: z.number().describe("0~1"),
      risk: z.enum(["Low", "Medium", "High"]),
      rationale_docs: z.array(z.string()),
    })
  ),
  change_request_draft: z.object({
    title: z.string(),
    reason: z.string(),
    impact: z.string(),
    approval_request: z.string(),
  }),
  suggested_owners: z.array(z.object({ task: z.string(), member_id: z.string(), reason: z.string() })),
});

async function callAgent<S extends z.ZodType>(
  settings: Settings,
  agent: keyof typeof PROMPTS,
  input: unknown,
  schema: S
): Promise<{ parsed: z.infer<S>; usage: Usage }> {
  const response = await getClient().beta.messages.parse({
    model: settings.claude.model,
    max_tokens: settings.claude.maxTokens,
    // 정책 거절 시 서버가 같은 요청을 대체 모델로 다시 돌린다.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: `${PROMPTS[agent]}\n\n숫자 비용 · 허용 여부 · 추천은 만들지 않는다. 입력에 없는 문서 ID · 엔티티 ID 를 만들지 않는다.`,
    messages: [{ role: "user", content: JSON.stringify(input) }],
    output_config: { format: betaZodOutputFormat(schema) },
  });
  if (response.stop_reason === "refusal") throw new Error(`${agent} Agent 가 요청을 거절했습니다`);
  if (response.stop_reason === "max_tokens") throw new Error(`${agent} Agent 출력이 max_tokens 에서 잘렸습니다`);
  if (!response.parsed_output) throw new Error(`${agent} Agent 응답을 스키마로 읽지 못했습니다`);
  return {
    parsed: response.parsed_output as z.infer<S>,
    usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
  };
}

const docForPrompt = (d: KnowledgeDoc) => ({ doc_id: d.doc_id, doc_type: d.doc_type, title: d.title, sections: d.sections });

export const ClaudeAI = {
  async analysis(settings: Settings, issue: Issue, docs: KnowledgeDoc[]): Promise<AgentOutput<AnalysisResult>> {
    const { parsed, usage } = await callAgent(settings, "analysis", { issue, docs: docs.map(docForPrompt) }, analysisSchema);
    const draft = {
      causes: parsed.causes.map((c, i) => ({ ...c, rank: i + 1, citations: c.citations.map((ct) => ({ ...ct, snippet: "" })) })),
      similar_issues: parsed.similar_issues,
    };
    return { result: finalizeAnalysis(issue.id, draft, docs), usage };
  },

  async impact(
    settings: Settings,
    issue: Issue,
    analysis: AnalysisResult,
    db: ProjectDb,
    a: Assumptions
  ): Promise<AgentOutput<ImpactResult>> {
    // 다른 이슈 목록은 영향 평가에 필요 없다.
    const entities = { ...db, issues: undefined };
    const { parsed, usage } = await callAgent(settings, "impact", { issue, analysis, db: entities }, impactSchema);
    return { result: finalizeImpact(issue, parsed, db, a), usage };
  },

  async action(
    settings: Settings,
    issue: Issue,
    analysis: AnalysisResult,
    impact: ImpactResult,
    db: ProjectDb,
    comment?: string
  ): Promise<AgentOutput<ActionResult>> {
    const input = { issue, analysis, impact, members: db.members, requirements: db.requirements, pm_comment: comment ?? null };
    const { parsed, usage } = await callAgent(settings, "action", input, actionSchema);
    return { result: finalizeAction(issue.id, parsed, db), usage };
  },
};
