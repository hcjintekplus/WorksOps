"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentRunList } from "@/components/workops/issue/agent-runs";
import type { StepProps } from "@/components/workops/issue/issue-detail";
import { Badge, Banner, Card, Col, Field, Grid, KeyValues, Meter, Mono, StatusBadge } from "@/components/workops/ui";
import { findDoc } from "@/lib/workops/knowledge";
import { won } from "@/lib/workops/format";

/** S-002 AI 분석 결과 — 원인 후보 · 근거 문서 · 일정/Task/계약 영향을 한 화면에서 검증한다 */
export function StepAnalyze({
  issue,
  ctx,
  pending,
  error,
  onRetry,
  onNext,
}: StepProps & { pending: boolean; error: string | null; onRetry: () => void; onNext: () => void }) {
  const { state, send } = ctx;
  const run = state.runs[issue.id];
  const agentRuns = state.agentRuns.filter((r) => r.issue_id === issue.id);
  const [manual, setManual] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  async function editCauses(body: { exclude?: number; add?: string }) {
    setEditError(null);
    try {
      await send(`/api/workops/issues/${issue.id}/causes`, body);
      setManual("");
    } catch (e) {
      setEditError(e instanceof Error ? e.message : String(e));
    }
  }

  const analysis = run?.analysis;
  const impact = run?.impact;

  if (!analysis || !impact || pending) {
    return (
      <div className="space-y-6">
        {error && !pending && (
          <Banner tone="error" onRetry={onRetry}>
            {error}
          </Banner>
        )}
        <Grid>
          <Col span={8}>
            <Card title="1. 원인 분석 (Analysis Agent)" caption={pending ? "실행 중" : error ? "실패" : "대기"}>
              {[70, 55, 62].map((w) => (
                <Skeleton key={w} className="h-[22px]" style={{ width: `${w}%` }} />
              ))}
            </Card>
            <Card title="2. 영향 평가 (Impact Agent)" caption={pending ? "실행 중" : ""}>
              {[40, 66].map((w) => (
                <Skeleton key={w} className="h-[22px]" style={{ width: `${w}%` }} />
              ))}
            </Card>
          </Col>
          <Col span={4}>
            <Card title="Knowledge 검색">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[22px]" />
              ))}
            </Card>
            <Card title="Agent 실행 로그">
              <AgentRunList runs={agentRuns} />
            </Card>
          </Col>
        </Grid>
      </div>
    );
  }

  const decided = Boolean(run.decision);
  const reqs = impact.affected_requirements.map((id) => state.db.requirements.find((r) => r.id === id)).filter(Boolean);
  const tasks = impact.affected_tasks.map((id) => state.db.tasks.find((t) => t.id === id)).filter(Boolean);
  const risks = impact.affected_risks.map((id) => state.db.risks.find((r) => r.id === id)).filter(Boolean);

  return (
    <div className="space-y-6">
      {error && (
        <Banner tone="error" onRetry={onRetry}>
          {error} · 이전 단계 결과는 유지합니다
        </Banner>
      )}
      <Grid>
        <Col span={8}>
          <Card title="1. 원인 분석 (Analysis Agent)" caption="원인 후보 ≤ 3 · 근거 강도는 판단 기준표 적용">
            {analysis.insufficient_evidence && (
              <>
                <Banner tone="warn">
                  근거 부족 · 확인 필요 — 검색 유사도가 임계값 미만이거나 인용할 근거가 없습니다. 원인 후보를 직접 입력하세요.
                </Banner>
                {!decided && (
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="원인 후보 (수동 입력)" className="min-w-[240px] flex-1">
                      <Input value={manual} maxLength={200} onChange={(e) => setManual(e.target.value)} placeholder="예) FW 1.2.3 통신 라이브러리 변경" />
                    </Field>
                    <Button variant="outline" disabled={!manual.trim()} onClick={() => void editCauses({ add: manual })}>
                      원인 후보 추가 (근거 강도 Low)
                    </Button>
                  </div>
                )}
              </>
            )}
            {editError && <Banner tone="error">{editError}</Banner>}
            <div className="space-y-2">
              {analysis.causes.map((c, i) => (
                <details key={`${c.rank}-${c.label}`} open={i === 0} className="group overflow-hidden rounded-control border border-border">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-2.5 font-medium transition-colors duration-[120ms] hover:bg-background [&::-webkit-details-marker]:hidden">
                    <span className="font-mono text-[13px]">{c.rank})</span>
                    <span className="min-w-0 flex-1">{c.label}</span>
                    <StatusBadge status={c.evidence_strength} />
                    <span className="text-caption whitespace-nowrap text-muted-foreground">[근거 {c.citations.length}]</span>
                    {!decided && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={(e) => {
                          e.preventDefault();
                          void editCauses({ exclude: i });
                        }}
                      >
                        제외
                      </Button>
                    )}
                    <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                  </summary>
                  <div className="space-y-3 px-3.5 pb-3.5">
                    {c.citations.map((ct) => (
                      <div key={`${ct.doc_id}-${ct.section}`} className="space-y-1">
                        <div className="flex flex-wrap items-center gap-3">
                          {findDoc(ct.doc_id) ? (
                            <Link href={`/knowledge?tab=docs&doc=${ct.doc_id}`}>
                              <Mono>{ct.doc_id}</Mono>
                            </Link>
                          ) : (
                            <Mono className="text-foreground">{ct.doc_id}</Mono>
                          )}
                          <span className="text-caption text-muted-foreground">§{ct.section}</span>
                        </div>
                        <blockquote className="rounded-r-[6px] border-l-2 border-label-3 bg-background px-3 py-2.5">{ct.snippet || "(발췌 없음)"}</blockquote>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
            <p className="text-caption text-muted-foreground">
              유사 이슈:{" "}
              {analysis.similar_issues.length
                ? analysis.similar_issues.map((s, i) => (
                    <span key={s.issue_id}>
                      {i > 0 && ", "}
                      <Link href={`/knowledge?tab=docs&doc=${s.issue_id}`}>
                        <Mono>{s.issue_id}</Mono>
                      </Link>{" "}
                      ({s.resolution})
                    </span>
                  ))
                : "없음"}
            </p>
          </Card>

          <Card title="2. 영향 평가 (Impact Agent)" caption="Mock DB 조회 · 숫자는 산식">
            <KeyValues
              items={[
                [
                  "Requirement",
                  reqs.length
                    ? reqs.map((r) => (
                        <div key={r!.id}>
                          <Mono className="text-foreground">{r!.id}</Mono> {r!.title} ({r!.priority}, {r!.contract_required ? "계약 필수" : "계약 필수 아님"})
                        </div>
                      ))
                    : "-",
                ],
                [
                  "Task",
                  tasks.length
                    ? tasks.map((t) => (
                        <div key={t!.id} className="flex flex-wrap items-center gap-2">
                          <Mono className="text-foreground">{t!.id}</Mono> {t!.title}
                          {t!.on_critical_path && <Badge tone="orange">크리티컬 패스</Badge>}
                        </div>
                      ))
                    : "-",
                ],
                [
                  "Risk",
                  risks.length
                    ? risks.map((r) => (
                        <div key={r!.id}>
                          <Mono className="text-foreground">{r!.id}</Mono> {r!.title}
                        </div>
                      ))
                    : "-",
                ],
                [
                  "계약 조항",
                  impact.contract_terms.map((c) => (
                    <div key={c.clause}>
                      {c.clause} · 일 {won(c.penalty)} · 필수 기능 {c.required_features.join(", ")}
                    </div>
                  )),
                ],
                [
                  "출시 차단",
                  impact.release_blocked ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone="red">차단</Badge> QP-001: Critical 0건 기준 미충족
                    </span>
                  ) : (
                    "아니오"
                  ),
                ],
                [
                  "기준선",
                  <span key="b" className="tabular-nums">
                    근본 수정+재검증 {impact.baseline.fix_and_verify_days}일 · 버퍼 {impact.baseline.buffer_days}영업일 · 방치 시 출시{" "}
                    {impact.baseline.delay_if_untreated}일 지연, 계약 페널티 발생
                  </span>,
                ],
              ]}
            />
          </Card>

          {!decided && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onRetry}>
                분석 재실행
              </Button>
              <Button onClick={onNext} disabled={!analysis.causes.length}>
                대응안 생성
              </Button>
            </div>
          )}
        </Col>

        <Col span={4}>
          <Card title="Knowledge 검색 결과" caption={`${run.retrieved?.length ?? 0}건`}>
            <ul className="divide-y divide-border">
              {(run.retrieved ?? []).slice(0, 10).map((h) => (
                <li key={h.doc_id} className="flex items-center gap-3 py-2">
                  <Link href={`/knowledge?tab=docs&doc=${h.doc_id}`}>
                    <Mono>{h.doc_id}</Mono>
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-caption text-muted-foreground">{findDoc(h.doc_id)?.title}</span>
                  <Meter value={h.score * 100} className="w-12" title={`검색 점수 ${h.score.toFixed(2)}`} />
                </li>
              ))}
            </ul>
            {!run.retrieved?.length && <p className="text-caption text-muted-foreground">검색 결과 없음</p>}
          </Card>
          <Card title="Agent 실행 로그">
            <AgentRunList runs={agentRuns} />
          </Card>
        </Col>
      </Grid>
    </div>
  );
}
