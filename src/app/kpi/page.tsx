"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/workops/overlays";
import { StateGate, type WorkopsCtx } from "@/components/workops/state-gate";
import { Banner, Card, Col, DataTable, Field, Grid, KpiCard, Mono, PageHeader, Section, numCell } from "@/components/workops/ui";
import { asm, assumedKpi } from "@/lib/workops/cost-model";
import { averageEffect, exportEffects } from "@/lib/workops/effects-export";
import { fmtNum, won } from "@/lib/workops/format";
import { cn } from "@/lib/utils";

/** 효과 · KPI — 모두 돈(원). 이슈 1건 단위 2개와 1년 환산 1개 (PRD 11장) */
export default function KpiPage() {
  const router = useRouter();
  const toast = useToast();
  return (
    <StateGate>
      {(ctx) => {
        const { state } = ctx;
        const a = state.assumptions;
        const rate = asm(a, "hourly_rate");
        const k = assumedKpi(a);
        const n = state.effectRecords.length;
        const labor = averageEffect(state, "labor_saving") ?? k.labor;
        const delay = averageEffect(state, "delay_cost_avoided") ?? k.delay;
        const annual = averageEffect(state, "annual_net") ?? k.annual;
        const cons = averageEffect(state, "annual_conservative") ?? k.conservative;
        const basis = n ? `실측 ${n}건 평균` : "가정치";
        const sensitivity = (
          [
            [0.5, 1],
            [1, 1],
            [1.5, 1],
            [1, 0.5],
            [1, 0],
          ] as const
        ).map(([m, ext]) => {
          const daily = asm(a, "headcount") * asm(a, "hours_per_day") * rate * m + asm(a, "external_cost_day") * ext;
          const perIssue = (asm(a, "before_decision_days") - asm(a, "after_decision_days")) * daily;
          return {
            people: Math.round(asm(a, "headcount") * m),
            external: asm(a, "external_cost_day") * ext,
            daily,
            perIssue,
            annual: k.labor * asm(a, "issues_per_year") + perIssue * asm(a, "schedule_issues_per_year") - asm(a, "annual_opex"),
            base: m === 1 && ext === 1,
          };
        });

        return (
          <>
            <PageHeader
              title="효과·KPI"
              description="KPI는 모두 돈(원)으로 표시합니다. 이슈 1건 단위 2개와 1년 환산 1개. 검색 정확도·근거 인용률은 내부 품질 관리용입니다."
              actions={
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
              }
            />
            <Section>
              <Grid>
                <Col span={3}>
                  <KpiCard label="① 이슈 대응 인건비 절감" metric={`${won(labor)}/건`} delta={`목표 ≥ 420만원 · ${basis}`} good={labor >= 4_200_000} spark={[3, 3.5, 4, 4.3, 4.49, 4.49, labor / 1e6]} href="/kpi" />
                </Col>
                <Col span={3}>
                  <KpiCard label="② 출시 지연 비용 회피" metric={`${won(delay)}/건`} delta={`목표 ≥ 2억원 · ${basis}`} good={delay >= 2e8} spark={[0.5, 1, 1.5, 2, 2, 2, delay / 1e8]} href="/kpi" />
                </Col>
                <Col span={3}>
                  <KpiCard label="③ 연간 순절감액" metric={won(annual)} delta={`목표 ≥ 8억원/년 · ${basis}`} good={annual >= 8e8} spark={[3.6, 5, 6, 7, 8, 8.4, annual / 1e8]} href="/kpi" />
                </Col>
                <Col span={3}>
                  <KpiCard label="③ 보수 케이스" metric={won(cons)} delta="외부 비용 0 · 단축 2일만 인정" spark={[2, 2.5, 3, 3.3, 3.6, 3.6, cons / 1e8]} href="/kpi" />
                </Col>
              </Grid>
            </Section>

            <Section title="KPI 정의와 측정 방법">
              <Card flush>
                <DataTable rowCount={3} columns={[{ label: "KPI" }, { label: "계산식" }, { label: "측정 방법" }, { label: "목표", num: true }]}>
                  <tr>
                    <td className="font-medium">① 이슈 대응 인건비 절감<div className="text-caption font-normal text-muted-foreground">원/건</div></td>
                    <td className="whitespace-normal">(Before 인시 − After 인시) × 시간당 {won(rate)} − LLM 비용</td>
                    <td className="text-caption whitespace-normal text-muted-foreground">Before: 120인시 가정 + 1회 수작업 측정 · After: 앱 타이머 실측 · LLM 비용: 실행 로그 실측</td>
                    <td className={numCell}>≥ 420만원/건</td>
                  </tr>
                  <tr>
                    <td className="font-medium">② 출시 지연 비용 회피<div className="text-caption font-normal text-muted-foreground">원/건</div></td>
                    <td className="whitespace-normal">(Before 확정 기간 − After 확정 기간) × 일 지연 비용 {won(asm(a, "daily_delay_cost"))}</td>
                    <td className="text-caption whitespace-normal text-muted-foreground">확정 기간 5일 → 1일 가정 · 분석·작성 시간은 앱 타이머 실측</td>
                    <td className={numCell}>≥ 2억원/건</td>
                  </tr>
                  <tr>
                    <td className="font-medium">③ 연간 순절감액<div className="text-caption font-normal text-muted-foreground">원/년</div></td>
                    <td className="whitespace-normal">
                      ① × 연 주요 이슈 {asm(a, "issues_per_year")}건 + ② × 연 일정 영향 이슈 {asm(a, "schedule_issues_per_year")}건 − 연 운영비 {won(asm(a, "annual_opex"))}
                    </td>
                    <td className="text-caption whitespace-normal text-muted-foreground">①·② 결과 × 연간 건수·운영비 가정으로 계산</td>
                    <td className={numCell}>≥ 8억원/년</td>
                  </tr>
                </DataTable>
              </Card>
            </Section>

            <Section title="KPI 계산 결과 (가정치 기준)" caption="② 는 같은 대응안을 고른다는 전제에서 결정이 빨라진 효과만 계산한 보수적 값">
              <Grid>
                <Col span={8}>
                  <Card flush>
                    <DataTable rowCount={4} columns={[{ label: "KPI" }, { label: "Before", num: true }, { label: "After", num: true }, { label: "효과", num: true }]}>
                      <tr>
                        <td>① 대응 인건비</td>
                        <td className={numCell}>{asm(a, "before_manhours")}인시 = {won(asm(a, "before_manhours") * rate)}</td>
                        <td className={numCell}>
                          {asm(a, "after_manhours")}인시 = {won(asm(a, "after_manhours") * rate)} + LLM {won(asm(a, "llm_cost_per_run"))}
                        </td>
                        <td className={cn(numCell, "font-medium")}>{won(k.labor)}/건</td>
                      </tr>
                      <tr>
                        <td>② 지연 비용 회피</td>
                        <td className={numCell}>확정 {asm(a, "before_decision_days")}영업일</td>
                        <td className={numCell}>확정 {asm(a, "after_decision_days")}영업일</td>
                        <td className={cn(numCell, "font-medium")}>{won(k.delay)}/건</td>
                      </tr>
                      <tr>
                        <td>③ 연간 순절감액</td>
                        <td colSpan={2} className={cn(numCell, "text-caption text-muted-foreground")}>
                          {won(k.labor)} × {asm(a, "issues_per_year")}건 + {won(k.delay)} × {asm(a, "schedule_issues_per_year")}건 − {won(asm(a, "annual_opex"))}
                        </td>
                        <td className={cn(numCell, "font-medium")}>약 {won(k.annual)}/년</td>
                      </tr>
                      <tr>
                        <td>③ 보수 케이스</td>
                        <td colSpan={2} className={cn(numCell, "text-caption text-muted-foreground")}>외부 비용 0, 단축 2일만 인정</td>
                        <td className={cn(numCell, "font-medium")}>약 {won(k.conservative)}/년</td>
                      </tr>
                    </DataTable>
                  </Card>
                </Col>
                <Col span={4}>
                  <Card title="측정 범위 (중간발표 → MVP)">
                    <DataTable compact rowCount={4} columns={[{ label: "항목" }, { label: "중간" }, { label: "MVP" }]}>
                      <tr><td>After 작업 시간</td><td className="text-caption text-muted-foreground">가정</td><td>실측 (앱 타이머)</td></tr>
                      <tr><td>LLM 비용</td><td className="text-caption text-muted-foreground">가정</td><td>실측 (토큰 × 단가)</td></tr>
                      <tr><td>Before 작업 시간</td><td className="text-caption text-muted-foreground">가정</td><td>가정 + 1회 측정</td></tr>
                      <tr><td className="whitespace-normal">참여 인원·일 지연 비용·연간 건수·운영비</td><td className="text-caption text-muted-foreground">가정</td><td>가정 (민감도)</td></tr>
                    </DataTable>
                    <p className="text-caption text-muted-foreground">최종발표에서 &quot;AI 쪽 시간은 실측, 조직 규모와 비용 단가는 가정&quot;이라고 구분해 제시합니다.</p>
                  </Card>
                </Col>
              </Grid>
            </Section>

            <Section title="Before 1회 수작업 측정 (5-1)" caption="팀원 1명이 AI 없이 같은 자료로 SC-01을 처리하며 시간 측정 · 11/15">
              <Grid>
                <Col span={6}>
                  <BeforeMeasureCard key={JSON.stringify(state.beforeMeasure)} ctx={ctx} />
                </Col>
                <Col span={6}>
                  <Card flush title="After 측정 기록 (5-2)" caption={`${n}/3회 목표`}>
                    <DataTable
                      compact
                      rowCount={n}
                      empty="승인·반영이 완료된 이슈의 효과가 여기에 쌓입니다"
                      columns={[{ label: "이슈" }, { label: "확정(일)", num: true }, { label: "인시", num: true }, { label: "LLM", num: true }, { label: "①", num: true }, { label: "②", num: true }, { label: "③", num: true }]}
                    >
                      {state.effectRecords.map((e) => (
                        <tr key={e.issue_id} className="cursor-pointer" onClick={() => router.push(`/issues/${e.issue_id}?step=result`)}>
                          <td><Mono>{e.issue_id}</Mono></td>
                          <td className={numCell}>{e.decision_days_after}</td>
                          <td className={numCell}>{e.manhours_after}</td>
                          <td className={numCell}>{fmtNum(e.llm_cost)}원</td>
                          <td className={numCell}>{won(e.labor_saving)}</td>
                          <td className={numCell}>{won(e.delay_cost_avoided)}</td>
                          <td className={numCell}>{won(e.annual_net)}</td>
                        </tr>
                      ))}
                    </DataTable>
                  </Card>
                </Col>
              </Grid>
            </Section>

            <Section title="민감도 (연간 순절감액)" caption="투입 인원·외부 비용 변화에 따른 ③">
              <Card flush>
                <DataTable compact rowCount={sensitivity.length} columns={[{ label: "투입 인원", num: true }, { label: "외부 비용/일", num: true }, { label: "일 지연 비용", num: true }, { label: "② 건당", num: true }, { label: "③ 연간", num: true }]}>
                  {sensitivity.map((r) => (
                    <tr key={`${r.people}-${r.external}`} className={cn(r.base && "font-medium")}>
                      <td className={numCell}>{r.people}명{r.base && " (기준)"}</td>
                      <td className={numCell}>{won(r.external)}</td>
                      <td className={numCell}>{won(r.daily)}</td>
                      <td className={numCell}>{won(r.perIssue)}</td>
                      <td className={cn(numCell, "font-medium")}>{won(r.annual)}</td>
                    </tr>
                  ))}
                </DataTable>
              </Card>
            </Section>

            <Section title="SC-01 대응안 비용 계산 (시나리오 참고)" caption="확정 기간 1영업일, 출시 버퍼 5영업일, 일 지연 비용 5,000만원 · 단위 억원">
              <Card flush>
                <DataTable rowCount={3} columns={[{ label: "대응안" }, { label: "작업일", num: true }, { label: "지연일", num: true }, { label: "지연 비용", num: true }, { label: "기회손실·후속", num: true }, { label: "재발 기대손실", num: true }, { label: "기대비용", num: true }]}>
                  <tr><td>A. 근본 수정 후 전체 재검증</td><td className={numCell}>11</td><td className={numCell}>7</td><td className={numCell}>3.5</td><td className={numCell}>0</td><td className={numCell}>0.5 <span className="text-caption text-muted-foreground">20%×5일</span></td><td className={cn(numCell, "font-medium")}>4.0</td></tr>
                  <tr><td>B. 기능 끄고 정시 출시 + 4주 후 업데이트</td><td className={numCell}>3</td><td className={numCell}>0</td><td className={numCell}>0</td><td className={numCell}>1.2 <span className="text-caption text-muted-foreground">1.0 + 0.2</span></td><td className={numCell}>0.13 <span className="text-caption text-muted-foreground">5%×5일</span></td><td className={cn(numCell, "font-medium")}>1.33</td></tr>
                  <tr><td>C. 출시 1개월 연기</td><td className={numCell}>20</td><td className={numCell}>20</td><td className={numCell}>10.0</td><td className={numCell}>0</td><td className={numCell}>0</td><td className={cn(numCell, "font-medium")}>10.0</td></tr>
                </DataTable>
              </Card>
              <p className="mt-3 text-caption text-muted-foreground">모든 수치는 합성 가정치이며, 실제 도입 시 해당 조직의 실측 데이터로 대체할 수 있습니다.</p>
            </Section>
          </>
        );
      }}
    </StateGate>
  );
}

function BeforeMeasureCard({ ctx }: { ctx: WorkopsCtx }) {
  const { state, send } = ctx;
  const toast = useToast();
  const m = state.beforeMeasure;
  const [who, setWho] = useState(m?.who ?? "");
  const [days, setDays] = useState(m ? String(m.days) : "");
  const [mh, setMh] = useState(m ? String(m.manhours) : "");
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
    <Card>
      {m ? (
        <Banner tone="ok">
          측정값 등록됨 · {m.days}영업일 · {m.manhours}인시 ({m.who || "측정자 미기재"}, {m.date})
        </Banner>
      ) : (
        <Banner tone="warn">가정치 사용 중 · 측정값이 등록되면 KPI Before가 실측으로 바뀝니다</Banner>
      )}
      {error && <Banner tone="error">{error}</Banner>}
      <div className="grid grid-cols-12 gap-4">
        <Field label="측정자" className="col-span-12 md:col-span-4">
          <Input value={who} maxLength={40} onChange={(e) => setWho(e.target.value)} />
        </Field>
        <Field label="확정 기간 (영업일)" className="col-span-6 md:col-span-4">
          <Input type="number" min={0} className="tabular-nums" value={days} onChange={(e) => setDays(e.target.value)} />
        </Field>
        <Field label="투입 인시" className="col-span-6 md:col-span-4">
          <Input type="number" min={0} className="tabular-nums" value={mh} onChange={(e) => setMh(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={!m} onClick={() => void call("/api/workops/config/before-measure-clear", {}, "측정값을 삭제했습니다")}>
          측정값 삭제
        </Button>
        <Button
          disabled={!Number(days) || !Number(mh)}
          onClick={() => void call("/api/workops/config/before-measure", { who, days: Number(days), manhours: Number(mh) }, "Before 측정값을 저장했습니다")}
        >
          측정값 저장
        </Button>
      </div>
    </Card>
  );
}
