"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart } from "@/components/workops/bar-chart";
import { useToast } from "@/components/workops/overlays";
import { StateGate } from "@/components/workops/state-gate";
import {
  Badge,
  Card,
  Col,
  DataTable,
  Grid,
  KpiCard,
  Mono,
  PageHeader,
  Section,
  StatusBadge,
  numCell,
} from "@/components/workops/ui";
import { asm, assumedKpi } from "@/lib/workops/cost-model";
import { averageEffect, exportEffects } from "@/lib/workops/effects-export";
import { won } from "@/lib/workops/format";
import type { WorkOpsState } from "@/lib/workops/types";

/** SC-01 대응안 기대비용 (PRD 11장, 억원) — 아직 대응안을 만든 이슈가 없을 때 보여 주는 기준값 */
const SC01_REFERENCE = { labels: ["A 근본 수정", "B 기능 축소", "C 1개월 연기"], values: [4.0, 1.33, 10.0] };

function attentionItems(state: WorkOpsState) {
  const items: { text: string; href: string; attn: boolean }[] = [];
  for (const i of state.db.issues.filter((x) => x.status === "승인대기"))
    items.push({ text: `${i.id} 승인 대기 — ${i.title}`, href: `/issues/${i.id}`, attn: true });
  for (const r of state.db.risks.filter((x) => x.likelihood === "H" && x.impact === "H" && x.status === "열림"))
    items.push({ text: `${r.id} 리스크 H/H 열림 — ${r.title}`, href: "/project?tab=risks", attn: true });
  for (const m of state.db.members.filter((x) => x.current_load >= 85))
    items.push({ text: `${m.name} 부하 ${m.current_load}% — 담당자 추천 시 주의`, href: "/project?tab=members", attn: true });
  for (const t of state.db.tasks.filter((x) => x.on_critical_path && x.status !== "완료"))
    items.push({ text: `${t.id} 크리티컬 패스 ${t.status} — ${t.title}`, href: "/project?tab=tasks", attn: false });
  return items;
}

/** 가장 최근에 대응안 비용을 계산한 이슈 (없으면 SC-01 기준값) */
function latestCosts(state: WorkOpsState) {
  const issue = state.db.issues.find((i) => state.runs[i.id]?.costs);
  const costs = issue && state.runs[issue.id]?.costs;
  if (!issue || !costs) return { title: "SC-01 대응안 기대비용 비교", caption: "PRD 11장 기준값", ...SC01_REFERENCE };
  return {
    title: `${issue.id} 대응안 기대비용 비교`,
    caption: `cost_model 계산값 · 추천 ${costs.recommended_option ?? "-"}`,
    labels: costs.options.map((o) => `${o.option_id} ${o.type === "fix" ? "근본 수정" : o.type === "scope_cut" ? "기능 축소" : "출시 연기"}`),
    values: costs.options.map((o) => o.expected_cost / 1e8),
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();

  return (
    <StateGate>
      {({ state }) => {
        const k = assumedKpi(state.assumptions);
        const n = state.effectRecords.length;
        const measured = n ? `실측 ${n}건 평균` : "가정치 기준";
        const annual = averageEffect(state, "annual_net") ?? k.annual;
        const labor = averageEffect(state, "labor_saving") ?? k.labor;
        const delay = averageEffect(state, "delay_cost_avoided") ?? k.delay;
        const open = state.db.issues.filter((i) => i.status !== "종료");
        const pending = state.db.issues.filter((i) => i.status === "승인대기");
        const attention = attentionItems(state);
        const chart = latestCosts(state);
        const escalateAt = (state.rules.escalate.find((e) => e.id === "E2")?.param ?? 5e8) / 1e8;

        return (
          <>
            <PageHeader
              title="대시보드"
              description="출시 임박 이슈 대응 현황과 돈으로 환산한 효과. 모든 수치는 합성 가정치이며 실측값이 쌓이면 대체됩니다."
              actions={
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      exportEffects(state);
                      toast("효과 리포트를 내려받았습니다");
                    }}
                  >
                    <Download />
                    효과 리포트 CSV
                  </Button>
                  <Button onClick={() => router.push("/issues/new")}>
                    <Plus />새 이슈 접수
                  </Button>
                </>
              }
            />

            <Section>
              <Grid>
                <Col span={3}>
                  <KpiCard
                    label="연간 순절감액 (KPI ③)"
                    metric={won(annual)}
                    delta={`${measured} · 목표 ≥ 8억원`}
                    good={annual >= 8e8}
                    spark={[3.6, 5, 6.2, 7.4, 8, 8.4, annual / 1e8]}
                    href="/kpi"
                  />
                </Col>
                <Col span={3}>
                  <KpiCard
                    label="이슈 대응 인건비 절감 (KPI ①)"
                    metric={`${won(labor)}/건`}
                    delta={`${measured} · 목표 ≥ 420만원`}
                    good={labor >= 4_200_000}
                    spark={[3, 3.8, 4.2, 4.4, 4.49, 4.49, labor / 1e6]}
                    href="/kpi"
                  />
                </Col>
                <Col span={3}>
                  <KpiCard
                    label="출시 지연 비용 회피 (KPI ②)"
                    metric={`${won(delay)}/건`}
                    delta={`${measured} · 목표 ≥ 2억원`}
                    good={delay >= 2e8}
                    spark={[0, 0.5, 1, 1.5, 2, 2, delay / 1e8]}
                    href="/kpi"
                  />
                </Col>
                <Col span={3}>
                  <KpiCard
                    label="진행 중 이슈"
                    metric={`${open.length}건`}
                    delta={`승인 대기 ${pending.length}건`}
                    over={pending.length > 0}
                    spark={[1, 1, 2, 1, 1, 1, open.length]}
                    href="/issues"
                  />
                </Col>
              </Grid>
            </Section>

            <Section>
              <Grid>
                <Col span={8}>
                  <Card title={chart.title} caption={`단위 억원 · 일 지연 비용 ${won(asm(state.assumptions, "daily_delay_cost"))} · ${chart.caption}`}>
                    <BarChart
                      values={chart.values}
                      labels={chart.labels}
                      threshold={escalateAt}
                      ariaLabel="대응안별 기대비용 막대 차트"
                    />
                    <div className="flex gap-4 text-caption text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <i className="size-2.5 rounded-[2px] bg-primary" />
                        기대비용
                      </span>
                      <span className="flex items-center gap-1.5">
                        <i className="size-2.5 rounded-[2px] bg-warning" />
                        사업부장 승인 기준 {escalateAt}억 초과
                      </span>
                    </div>
                  </Card>
                </Col>
                <Col span={4}>
                  <Card title="주의 필요" caption={`${attention.length}건`} className="h-full">
                    {attention.length ? (
                      <ul className="divide-y divide-border">
                        {attention.slice(0, 7).map((a) => (
                          <li key={a.text} className="flex items-center gap-3 py-2.5">
                            <Badge tone={a.attn ? "orange" : "blue"}>{a.attn ? "주의" : "진행"}</Badge>
                            <Link href={a.href} className="min-w-0 flex-1 truncate font-medium hover:underline">
                              {a.text}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-body text-muted-foreground">주의가 필요한 항목이 없습니다</p>
                    )}
                  </Card>
                </Col>
              </Grid>
            </Section>

            <Section title="최근 이슈" caption="행을 누르면 최신 단계 화면으로 이동">
              <Card flush>
                <DataTable
                  rowCount={Math.min(8, state.db.issues.length)}
                  empty="등록된 이슈가 없습니다. 새 이슈를 등록하세요"
                  columns={[
                    { label: "이슈" },
                    { label: "제목" },
                    { label: "심각도" },
                    { label: "모듈" },
                    { label: "상태" },
                    { label: "선택안" },
                    { label: "접수", num: true },
                  ]}
                >
                  {state.db.issues.slice(0, 8).map((i) => (
                    <tr key={i.id} className="cursor-pointer" onClick={() => router.push(`/issues/${i.id}`)}>
                      <td>
                        <Link href={`/issues/${i.id}`} onClick={(e) => e.stopPropagation()}>
                          <Mono>{i.id}</Mono>
                        </Link>
                      </td>
                      <td>{i.title}</td>
                      <td>
                        <StatusBadge status={i.severity} />
                      </td>
                      <td>{i.module}</td>
                      <td>
                        <StatusBadge status={i.status} />
                      </td>
                      <td>
                        {i.selected_option
                          ? `${i.selected_option} ${i.selected_option === i.ai_recommended ? "(AI 추천)" : "(PM 변경)"}`
                          : "-"}
                      </td>
                      <td className={`${numCell} text-caption text-muted-foreground`}>{i.created_at.slice(0, 10)}</td>
                    </tr>
                  ))}
                </DataTable>
              </Card>
            </Section>
          </>
        );
      }}
    </StateGate>
  );
}
