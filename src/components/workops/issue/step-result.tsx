"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IssueTimer } from "@/components/workops/issue/issue-timer";
import type { StepProps } from "@/components/workops/issue/issue-detail";
import { useToast } from "@/components/workops/overlays";
import { Banner, Card, Col, DataTable, EmptyState, Field, Grid, KeyValues, Mono, Section, StatusBadge, numCell } from "@/components/workops/ui";
import { asm } from "@/lib/workops/cost-model";
import { exportEffects } from "@/lib/workops/effects-export";
import { fmtDateTime, fmtNum, won } from "@/lib/workops/format";
import type { Change } from "@/lib/workops/types";
import { cn } from "@/lib/utils";

const ENTITIES: Change["entity"][] = ["Issue", "ChangeRequest", "Requirement", "Task", "Release", "Risk"];

/** S-004 반영 결과 · 효과 기록 */
export function StepResult({ issue, ctx }: StepProps) {
  const { state, send } = ctx;
  const toast = useToast();
  const run = state.runs[issue.id];
  const [tab, setTab] = useState<Change["entity"]>("Task");
  const [mh, setMh] = useState(String(run?.effect?.manhours_after ?? ""));
  const [review, setReview] = useState(String(run?.effectInput?.review_hours ?? 2));
  const [days, setDays] = useState(run?.effectInput?.days !== undefined ? String(run.effectInput.days) : "");
  const [error, setError] = useState<string | null>(null);

  if (!run?.decision || !run.effect || !run.costs) {
    return (
      <Card>
        <EmptyState>승인된 이슈가 없습니다</EmptyState>
      </Card>
    );
  }

  const e = run.effect;
  const decision = run.decision;
  const selected = run.costs.options.find((o) => o.option_id === decision.pm_selected);
  const byEntity = (en: Change["entity"]) => (run.changes ?? []).filter((c) => c.entity === en);
  const a = state.assumptions;

  async function call(path: string, body: object, done: string) {
    setError(null);
    try {
      await send(`/api/workops/issues/${issue.id}/${path}`, body);
      toast(done);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <Banner tone="ok" className="mb-6">
        승인 완료 · 선택안 {decision.pm_selected}{" "}
        {decision.pm_selected === decision.ai_recommended ? "(AI 추천)" : "(PM 변경 · 사유 기록됨)"} · {fmtDateTime(decision.decided_at)}
      </Banner>
      {error && <Banner tone="error" className="mb-6">{error}</Banner>}

      <Section>
        <Grid>
          <Col span={8}>
            <Card flush title="Mock System 반영 결과" caption={`${run.changes?.length ?? 0}건 변경`}>
              <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border px-3">
                {ENTITIES.map((en) => (
                  <button
                    key={en}
                    type="button"
                    role="tab"
                    aria-selected={tab === en}
                    onClick={() => setTab(en)}
                    className={cn(
                      "-mb-px flex h-10 items-center gap-1.5 border-b-2 px-3 text-body font-medium whitespace-nowrap transition-colors duration-[120ms]",
                      tab === en ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {en} <span className="text-caption tabular-nums">{byEntity(en).length}</span>
                  </button>
                ))}
              </div>
              <DataTable
                compact
                rowCount={byEntity(tab).length}
                empty="이 엔티티에는 변경이 없습니다"
                columns={[{ label: "ID" }, { label: "변경 내용" }, { label: "구분" }]}
              >
                {byEntity(tab).map((c) => (
                  <tr key={`${c.id}-${c.change}`}>
                    <td>
                      <Mono>{c.id}</Mono>
                    </td>
                    <td className="whitespace-normal">{c.change}</td>
                    <td>
                      <StatusBadge status={c.kind} />
                    </td>
                  </tr>
                ))}
              </DataTable>
            </Card>
          </Col>
          <Col span={4}>
            <Card title="결정 이력">
              <KeyValues
                labelWidth={88}
                items={[
                  ["AI 추천", decision.ai_recommended ?? "-"],
                  ["PM 선택", decision.pm_selected],
                  ["변경 사유", decision.override_reason ?? "-"],
                  ["기대비용", <span key="c" className="tabular-nums">{won(selected?.expected_cost)}</span>],
                  ["처리 시간", <IssueTimer key="t" run={run} />],
                  ["LLM 비용", <span key="l" className="tabular-nums">{fmtNum(e.llm_cost)}원</span>],
                ]}
              />
            </Card>
          </Col>
        </Grid>
      </Section>

      <Section
        title="효과 (KPI)"
        caption={`After는 타이머·실행 로그·참여자 입력 인시·산식으로 계산 · Before는 ${state.beforeMeasure ? "1회 수작업 측정값" : "가정치"}`}
      >
        <Grid>
          <Col span={8}>
            <Card flush title="Before / After">
              <DataTable
                rowCount={6}
                columns={[
                  { label: "항목" },
                  { label: state.beforeMeasure ? "Before (실측)" : "Before (가정)", num: true },
                  { label: "After (실측)", num: true },
                  { label: "효과", num: true },
                ]}
              >
                <tr>
                  <td>대응안 확정 기간</td>
                  <td className={numCell}>{e.decision_days_before}영업일</td>
                  <td className={numCell}>{e.decision_days_after}영업일</td>
                  <td className={numCell}>{e.decision_days_before - e.decision_days_after}일 단축</td>
                </tr>
                <tr>
                  <td>투입 인시</td>
                  <td className={numCell}>{e.manhours_before}인시</td>
                  <td className={numCell}>{e.manhours_after}인시</td>
                  <td className={numCell}>{e.manhours_before - e.manhours_after}인시</td>
                </tr>
                <tr>
                  <td>① 대응 인건비</td>
                  <td className={numCell}>{won(e.labor_cost_before)}</td>
                  <td className={numCell}>
                    {won(e.labor_cost_after)} + LLM {fmtNum(e.llm_cost)}원
                  </td>
                  <td className={cn(numCell, "font-medium")}>{won(e.labor_saving)}/건</td>
                </tr>
                <tr>
                  <td>② 지연 비용 회피</td>
                  <td className={numCell}>-</td>
                  <td className={numCell}>
                    {e.decision_days_before - e.decision_days_after}일 × {won(asm(a, "daily_delay_cost"))}
                  </td>
                  <td className={cn(numCell, "font-medium")}>{won(e.delay_cost_avoided)}/건</td>
                </tr>
                <tr>
                  <td>③ 연간 순절감액 (이 결과로 환산)</td>
                  <td className={numCell}>-</td>
                  <td className={cn(numCell, "text-caption text-muted-foreground")}>
                    ① × {asm(a, "issues_per_year")}건 + ② × {asm(a, "schedule_issues_per_year")}건 − 운영비
                  </td>
                  <td className={cn(numCell, "font-medium")}>{won(e.annual_net)}/년</td>
                </tr>
                <tr>
                  <td className="text-caption text-muted-foreground">③ 보수 케이스 (외부 비용 0, 단축 2일만)</td>
                  <td className={numCell}>-</td>
                  <td className={numCell}>-</td>
                  <td className={numCell}>{won(e.annual_conservative)}/년</td>
                </tr>
              </DataTable>
            </Card>
          </Col>
          <Col span={4}>
            <Card title="After 측정값 입력">
              <p className="text-caption text-muted-foreground">참여자 인시와 검토·승인 회의 시간을 입력하면 KPI가 다시 계산됩니다.</p>
              <Field label="After 투입 인시">
                <Input type="number" min={0} className="tabular-nums" value={mh} onChange={(ev) => setMh(ev.target.value)} />
              </Field>
              <Field label="검토·승인 회의 시간 (h)">
                <Input type="number" min={0} className="tabular-nums" value={review} onChange={(ev) => setReview(ev.target.value)} />
              </Field>
              <Field label="After 확정 기간 (영업일)" hint="비우면 자동">
                <Input
                  type="number"
                  min={0}
                  className="tabular-nums"
                  value={days}
                  onChange={(ev) => setDays(ev.target.value)}
                  placeholder="자동: (타이머 + 회의) ÷ 8h"
                />
              </Field>
              <div>
                <Button
                  onClick={() =>
                    void call(
                      "effect",
                      {
                        manhours: mh === "" ? undefined : Number(mh),
                        review_hours: review === "" ? undefined : Number(review),
                        days: days === "" ? undefined : Number(days),
                      },
                      "KPI를 다시 계산했습니다"
                    )
                  }
                >
                  KPI 다시 계산
                </Button>
              </div>
            </Card>
          </Col>
        </Grid>
      </Section>

      <div className="flex justify-end gap-2">
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
        <Button variant="outline" disabled={issue.status === "종료"} onClick={() => void call("close", {}, "이슈를 종료했습니다")}>
          이슈 종료
        </Button>
      </div>
    </>
  );
}
