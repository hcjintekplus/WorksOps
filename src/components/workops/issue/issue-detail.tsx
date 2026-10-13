"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentRunList } from "@/components/workops/issue/agent-runs";
import { IssueTimer } from "@/components/workops/issue/issue-timer";
import { StepAnalyze } from "@/components/workops/issue/step-analyze";
import { StepOptions } from "@/components/workops/issue/step-options";
import { StepResult } from "@/components/workops/issue/step-result";
import type { WorkopsCtx } from "@/components/workops/state-gate";
import { Card, Col, Grid, KeyValues, Mono, PageHeader, StatusBadge } from "@/components/workops/ui";
import { fmtDateTime } from "@/lib/workops/format";
import { stepOf } from "@/lib/workops/state";
import type { Issue } from "@/lib/workops/types";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "intake", title: "접수", sub: "S-001" },
  { key: "analyze", title: "AI 분석 결과", sub: "S-002 원인·영향" },
  { key: "options", title: "대응안 비교·승인", sub: "S-003" },
  { key: "result", title: "반영 결과·효과", sub: "S-004" },
] as const;

export type StepProps = { issue: Issue; ctx: WorkopsCtx };

export function IssueDetail({ issue, ctx }: StepProps) {
  const router = useRouter();
  const search = useSearchParams();
  const { state, send } = ctx;
  const run = state.runs[issue.id] ?? { issue_id: issue.id, timer_start: null, timer_ms: 0 };
  const current = stepOf(run);
  const maxStep = run.decision ? 4 : run.analysis ? 3 : 2;
  const wanted = STEPS.findIndex((s) => s.key === search.get("step")) + 1 || current;
  const step = Math.min(wanted, maxStep);
  const release = state.db.releases.find((r) => r.id === issue.release_id);
  const agentRuns = state.agentRuns.filter((r) => r.issue_id === issue.id);

  // 분석 · 대응안 생성은 그 단계에 들어오면 자동으로 한 번 돈다 (실패하면 재시도 버튼으로만 다시).
  const [pending, setPending] = useState<"analyze" | "options" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const started = useRef<string | null>(null);

  async function runPipeline(kind: "analyze" | "options", body: object = {}) {
    setPending(kind);
    setActionError(null);
    try {
      await send(`/api/workops/issues/${issue.id}/${kind}`, body);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setPending(null);
    }
  }

  const needsAnalysis = step === 2 && !run.analysis && !run.error && !run.decision;
  const needsOptions = step === 3 && run.analysis && !run.costs && !run.decision && run.analysis.causes.length > 0;
  useEffect(() => {
    const key = needsAnalysis ? `analyze:${issue.id}` : needsOptions ? `options:${issue.id}` : null;
    if (!key || started.current === key) return;
    started.current = key;
    void runPipeline(needsAnalysis ? "analyze" : "options");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsAnalysis, needsOptions, issue.id]);

  const go = (key: (typeof STEPS)[number]["key"]) => router.push(`/issues/${issue.id}?step=${key}`, { scroll: false });

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Mono>{issue.id}</Mono>
            <StatusBadge status={issue.severity} />
            <span>
              {release?.name} D-{release?.d_minus ?? "-"}
            </span>
            <StatusBadge status={issue.status} />
          </>
        }
        title={issue.title}
        description={issue.description}
        actions={
          <div className="flex items-center gap-3 rounded-container border border-border bg-card px-3.5 py-2">
            <span className="text-label text-muted-foreground">처리 타이머</span>
            <IssueTimer run={run} />
          </div>
        }
      />

      <ol className="mb-6 flex overflow-hidden rounded-container border border-border bg-card">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const disabled = n > maxStep;
          return (
            <li key={s.key} className="flex-1 border-r border-border last:border-r-0">
              <button
                type="button"
                disabled={disabled}
                aria-current={n === step ? "step" : undefined}
                onClick={() => go(s.key)}
                className={cn(
                  "flex h-full w-full items-center gap-3 px-3 py-3 text-left text-muted-foreground transition-colors duration-[120ms] hover:bg-background disabled:cursor-not-allowed disabled:opacity-60 md:px-5",
                  "focus-visible:ring-[3px] focus-visible:ring-ring/20 focus-visible:outline-none",
                  n === step && "bg-muted font-semibold text-primary"
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-label",
                    n === step && "border-primary bg-primary text-primary-foreground",
                    n < current && n !== step && "border-transparent bg-[var(--badge-green-bg)] text-[color:var(--badge-green-fg)]"
                  )}
                >
                  {n < current && n !== step ? <Check className="size-3.5" /> : n}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{s.title}</span>
                  <span className="hidden text-caption font-normal text-muted-foreground md:block">{s.sub}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <Grid>
          <Col span={8}>
            <Card title="접수 정보">
              <KeyValues
                items={[
                  ["이슈 ID", <Mono key="id">{issue.id}</Mono>],
                  ["제목", issue.title],
                  ["증상", issue.description],
                  ["심각도", <StatusBadge key="s" status={issue.severity} />],
                  ["모듈", issue.module],
                  ["릴리스", release?.name ?? "-"],
                  ["접수", fmtDateTime(issue.created_at)],
                  ...(issue.simulate ? ([["시연 옵션", "변형 V-03: 근거 부족"]] as [string, string][]) : []),
                ]}
              />
              {!run.analysis && (
                <div>
                  <Button onClick={() => go("analyze")}>AI 분석 시작</Button>
                </div>
              )}
            </Card>
          </Col>
          <Col span={4}>
            <Card title="Agent 실행 로그">
              <AgentRunList runs={agentRuns} />
            </Card>
          </Col>
        </Grid>
      )}
      {step === 2 && (
        <StepAnalyze
          issue={issue}
          ctx={ctx}
          pending={pending === "analyze"}
          error={run.error ?? (pending ? null : actionError)}
          onRetry={() => void runPipeline("analyze")}
          onNext={() => go("options")}
        />
      )}
      {step === 3 && (
        <StepOptions
          issue={issue}
          ctx={ctx}
          pending={pending === "options"}
          error={actionError}
          onRegenerate={(comment) => void runPipeline("options", { comment })}
          onRetry={() => void runPipeline("options")}
          onApproved={() => go("result")}
          onBack={() => go("analyze")}
        />
      )}
      {step === 4 && <StepResult issue={issue} ctx={ctx} />}

      {step !== 1 && (
        <p className="mt-6 text-caption text-muted-foreground">
          모든 데이터는 합성 가정치입니다 · <Link href="/rules" className="text-primary hover:underline">판단 기준·가정치</Link>
        </p>
      )}
    </>
  );
}
