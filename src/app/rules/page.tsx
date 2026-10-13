"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/workops/overlays";
import { StateGate, type WorkopsCtx } from "@/components/workops/state-gate";
import { Banner, Card, CodeBlock, Col, DataTable, Field, Grid, Mono, PageHeader, StatusBadge, UrlTabs, useTab } from "@/components/workops/ui";
import { asm } from "@/lib/workops/cost-model";
import { won } from "@/lib/workops/format";
import { DATA_MODEL, PROMPTS, SCHEMAS } from "@/lib/workops/prd-content";

const TABS = [
  ["rules", "판단 기준 (rules.yaml)"],
  ["assumptions", "비용 가정치 (assumptions.yaml)"],
  ["prompts", "Agent 프롬프트 3종"],
  ["schema", "입출력 스키마"],
] as const;
const KEYS = TABS.map((t) => t[0]);

/** 판단 기준 · 가정치 — 숫자와 허용 여부는 코드가, 근거 해석은 기준표를 받은 LLM 이, 최종 결정은 사람이 */
export default function RulesPage() {
  const tab = useTab(KEYS, "rules");
  return (
    <StateGate>
      {(ctx) => (
        <>
          <PageHeader
            title="판단 기준·가정치"
            description="숫자와 허용 여부는 코드가, 근거 해석은 기준표를 받은 LLM이, 최종 결정은 사람이 맡습니다. 값을 바꾸면 이후 대응안 비용과 기록된 KPI가 다시 계산됩니다."
          />
          <UrlTabs items={TABS.map(([k, l]) => [k, l])} current={tab} />
          {tab === "rules" && <RulesTab key={JSON.stringify(ctx.state.rules)} ctx={ctx} />}
          {tab === "assumptions" && <AssumptionsTab key={JSON.stringify(ctx.state.assumptions)} ctx={ctx} />}
          {tab === "prompts" && (
            <div className="space-y-6">
              {Object.entries(PROMPTS).map(([k, v]) => (
                <Card key={k} title={`prompts/${k}.md`} caption="WP3 · Claude 모드에서 system 프롬프트로 사용">
                  <CodeBlock>{v}</CodeBlock>
                </Card>
              ))}
            </div>
          )}
          {tab === "schema" && (
            <Grid>
              <Col span={6}>
                <Card title="Agent 입출력 스키마">
                  <CodeBlock>{SCHEMAS}</CodeBlock>
                </Card>
              </Col>
              <Col span={6}>
                <Card flush title="데이터 모델">
                  <DataTable compact rowCount={DATA_MODEL.length} columns={[{ label: "엔티티" }, { label: "주요 필드" }, { label: "비고" }]}>
                    {DATA_MODEL.map((d) => (
                      <tr key={d[0]}>
                        <td className="font-medium">{d[0]}</td>
                        <td className="font-mono text-caption whitespace-normal text-muted-foreground">{d[1]}</td>
                        <td className="text-caption text-muted-foreground">{d[2]}</td>
                      </tr>
                    ))}
                  </DataTable>
                </Card>
              </Col>
            </Grid>
          )}
        </>
      )}
    </StateGate>
  );
}

function RulesTab({ ctx }: { ctx: WorkopsCtx }) {
  const { state, send } = ctx;
  const toast = useToast();
  const rules = state.rules;
  const [params, setParams] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (["recommend", "escalate"] as const).flatMap((g) => rules[g].filter((r) => r.param !== undefined).map((r) => [`${g}:${r.id}`, String(r.param)]))
    )
  );
  const [threshold, setThreshold] = useState(String(rules.similarity_threshold));
  const [error, setError] = useState<string | null>(null);
  const tolerance = Number(params["recommend:R2"] ?? 0.1);
  const escalateAt = Number(params["escalate:E2"] ?? 5e8);

  async function save() {
    setError(null);
    try {
      await send("/api/workops/config/rules", {
        params: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Number(v)])),
        similarity_threshold: Number(threshold),
      });
      toast("판단 기준을 저장했습니다");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const paramInput = (key: string, width: string) => (
    <Input
      type="number"
      step="any"
      min={0}
      className={`h-8 ${width} text-right tabular-nums`}
      value={params[key] ?? ""}
      onChange={(e) => setParams({ ...params, [key]: e.target.value })}
    />
  );

  return (
    <div className="space-y-6">
      <Card flush title="판단의 세 층">
        <DataTable compact rowCount={3} columns={[{ label: "층" }, { label: "판단 주체" }, { label: "대상" }]}>
          <tr><td>규칙</td><td>rules.yaml + 코드</td><td className="whitespace-normal">지연일·비용 계산, 대응안 허용 여부, 추천, 에스컬레이션</td></tr>
          <tr><td>기준표</td><td>LLM (프롬프트에 기준 명시)</td><td className="whitespace-normal">근거 강도, 원인 후보 순위, 유사 이슈 선정</td></tr>
          <tr><td>최종 결정</td><td>PM</td><td className="whitespace-normal">대응안 선택, 변경요청서 수정, 추천과 다른 선택 시 사유</td></tr>
        </DataTable>
      </Card>
      {error && <Banner tone="error">{error}</Banner>}
      <Grid>
        <Col span={6}>
          <Card flush title="근거 강도 기준 (Analysis)">
            <DataTable compact rowCount={rules.evidence.length} columns={[{ label: "강도" }, { label: "기준" }]}>
              {rules.evidence.map((e) => (
                <tr key={e.level}>
                  <td><StatusBadge status={e.level} /></td>
                  <td className="whitespace-normal">{e.rule}</td>
                </tr>
              ))}
            </DataTable>
          </Card>
        </Col>
        <Col span={6}>
          <Card title="대응안 판단 규칙 (Action)">
            <div className="text-label text-muted-foreground">gate — 1단계 허용 여부</div>
            <DataTable compact rowCount={rules.gate.length} columns={[{ label: "ID" }, { label: "규칙" }, { label: "근거" }]}>
              {rules.gate.map((g) => (
                <tr key={g.id}>
                  <td><Mono className="text-foreground">{g.id}</Mono></td>
                  <td className="whitespace-normal">{g.rule}</td>
                  <td className="font-mono text-caption text-muted-foreground">{g.ref}</td>
                </tr>
              ))}
            </DataTable>
            <div className="text-label text-muted-foreground">recommend — 2단계 추천</div>
            <DataTable compact rowCount={rules.recommend.length} columns={[{ label: "ID" }, { label: "규칙" }, { label: "파라미터", num: true }]}>
              {rules.recommend.map((g) => (
                <tr key={g.id}>
                  <td><Mono className="text-foreground">{g.id}</Mono></td>
                  <td className="whitespace-normal">{g.rule}</td>
                  <td className="text-right">{g.param !== undefined ? paramInput(`recommend:${g.id}`, "w-20") : "-"}</td>
                </tr>
              ))}
            </DataTable>
            <div className="text-label text-muted-foreground">escalate — 3단계 승인 수준</div>
            <DataTable compact rowCount={rules.escalate.length} columns={[{ label: "ID" }, { label: "규칙" }, { label: "파라미터 (원)", num: true }]}>
              {rules.escalate.map((g) => (
                <tr key={g.id}>
                  <td><Mono className="text-foreground">{g.id}</Mono></td>
                  <td className="whitespace-normal">{g.rule}</td>
                  <td className="text-right">{g.param !== undefined ? paramInput(`escalate:${g.id}`, "w-36") : "-"}</td>
                </tr>
              ))}
            </DataTable>
            <Field label="검색 유사도 임계값" hint="0 ~ 1">
              <Input type="number" step="0.01" min={0} max={1} className="w-32 tabular-nums" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </Field>
            <div className="flex justify-end">
              <Button onClick={() => void save()}>판단 기준 저장</Button>
            </div>
          </Card>
        </Col>
      </Grid>
      <Card title="rules.yaml 미리보기">
        <CodeBlock>{`gate:            # 1단계 허용 여부
  - Critical이 남은 채 출시하는 안 금지 (QP-001)
  - 기능 축소: 대상 REQ가 P0가 아니고
    고객사 계약 필수 기능이 아닐 때만 (CT-001)
  - 근본 수정 추천: 1순위 원인 High일 때만
recommend:       # 2단계 추천
  - 허용된 안 중 기대비용 최소
  - 차이 ${Math.round(tolerance * 100)}% 이내면 리스크 낮은 안
escalate:        # 3단계 승인 수준
  - 출시 연기 또는 기대비용 ≥ ${won(escalateAt)}
    → 사업부장 승인 필요 (CM-001)`}</CodeBlock>
      </Card>
    </div>
  );
}

function AssumptionsTab({ ctx }: { ctx: WorkopsCtx }) {
  const { state, send } = ctx;
  const toast = useToast();
  const a = state.assumptions;
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, String(v.value)])));
  const [error, setError] = useState<string | null>(null);

  async function call(path: string, body: object, done: string) {
    setError(null);
    try {
      await send(path, body);
      toast(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-6">
      {error && <Banner tone="error">{error}</Banner>}
      <Card flush title="비용 가정치" caption="값을 바꾸면 대응안 비용·KPI가 다시 계산됩니다 · 현업 인터뷰(WP2)로 보정">
        <DataTable compact rowCount={Object.keys(a).length} columns={[{ label: "key" }, { label: "설명" }, { label: "값", num: true }, { label: "단위" }]}>
          {Object.entries(a).map(([k, v]) => (
            <tr key={k}>
              <td><Mono className="text-foreground">{k}</Mono></td>
              <td className="whitespace-normal">{v.note}</td>
              <td className="text-right">
                <Input
                  type="number"
                  step="any"
                  min={0}
                  className="ml-auto h-8 w-40 text-right tabular-nums"
                  value={values[k] ?? ""}
                  readOnly={k === "daily_delay_cost"}
                  title={k === "daily_delay_cost" ? "인력 × 시간 × 시간당 인건비 + 외부 비용으로 자동 계산" : undefined}
                  onChange={(e) => setValues({ ...values, [k]: e.target.value })}
                />
              </td>
              <td className="text-caption text-muted-foreground">{v.unit}</td>
            </tr>
          ))}
        </DataTable>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" onClick={() => void call("/api/workops/config/assumptions-reset", {}, "기본값으로 복원했습니다")}>
            기본값 복원
          </Button>
          <Button
            onClick={() =>
              void call(
                "/api/workops/config/assumptions",
                { values: Object.fromEntries(Object.entries(values).filter(([k]) => k !== "daily_delay_cost").map(([k, v]) => [k, Number(v)])) },
                "가정치를 저장했습니다"
              )
            }
          >
            가정치 저장
          </Button>
        </div>
      </Card>
      <Card title="산식">
        <CodeBlock>{`지연일          = max(0, 확정 기간 + 대응안 작업일 − 출시 버퍼일)   (출시 연기안은 연기 일수)
대응안 기대비용 = 지연일 × 일 지연 비용 + 기회손실 + 후속 비용 + 재발확률 × 재발 시 손실
일 지연 비용    = 인력 ${asm(a, "headcount")}명 × ${asm(a, "hours_per_day")}시간 × ${won(asm(a, "hourly_rate"))} (${won(
          asm(a, "headcount") * asm(a, "hours_per_day") * asm(a, "hourly_rate")
        )}) + 외부 비용 ${won(asm(a, "external_cost_day"))}
기회손실·후속   = 기능 축소안만: ${won(asm(a, "scope_cut_opportunity_loss"))} + ${won(asm(a, "scope_cut_follow_up_cost"))} (CG-001 §2)
LLM 비용        = 입력 ${asm(a, "llm_krw_per_1k_input")}원/1k 토큰 + 출력 ${asm(a, "llm_krw_per_1k_output")}원/1k 토큰`}</CodeBlock>
      </Card>
    </div>
  );
}
