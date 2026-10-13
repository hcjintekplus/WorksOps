"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentRunList } from "@/components/workops/issue/agent-runs";
import type { StepProps } from "@/components/workops/issue/issue-detail";
import { ConfirmDialog, useToast } from "@/components/workops/overlays";
import { Badge, Banner, Card, Col, EmptyState, Field, Grid, Meter, Mono, Textarea } from "@/components/workops/ui";
import { asm } from "@/lib/workops/cost-model";
import { won } from "@/lib/workops/format";
import type { ChangeRequestDraft, RuledOption } from "@/lib/workops/types";
import { cn } from "@/lib/utils";

/** S-003 대응안 비교 · 승인 — 숫자는 cost_model, 허용 · 추천은 rules 가 정한 값을 그대로 보여 준다 */
export function StepOptions({
  issue,
  ctx,
  pending,
  error,
  onRegenerate,
  onRetry,
  onApproved,
  onBack,
}: StepProps & {
  pending: boolean;
  error: string | null;
  onRegenerate: (comment: string) => void;
  onRetry: () => void;
  onApproved: () => void;
  onBack: () => void;
}) {
  const { state } = ctx;
  const run = state.runs[issue.id];
  const agentRuns = state.agentRuns.filter((r) => r.issue_id === issue.id);

  if (!run?.analysis) {
    return (
      <Card>
        <EmptyState action={<Button variant="outline" onClick={onBack}>분석 결과로</Button>}>
          분석 결과 화면에서 대응안을 먼저 생성하세요
        </EmptyState>
      </Card>
    );
  }

  if (!run.costs || !run.action || pending) {
    return (
      <div className="space-y-6">
        {error && !pending && (
          <Banner tone="error" onRetry={onRetry}>
            {error}
          </Banner>
        )}
        <Grid>
          <Col span={8}>
            <Card title="대응안 생성 (Action Agent + cost_model)" caption={pending ? "실행 중" : "대기"}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </Card>
          </Col>
          <Col span={4}>
            <Card title="Agent 실행 로그">
              <AgentRunList runs={agentRuns} />
            </Card>
          </Col>
        </Grid>
      </div>
    );
  }

  // 대응안이 바뀌면(재생성) 선택 · 초안을 새로 잡도록 key 로 다시 그린다.
  return (
    <OptionsForm
      key={`${run.action.change_request_draft.title}|${run.costs.options.map((o) => o.expected_cost).join(",")}`}
      issue={issue}
      ctx={ctx}
      error={error}
      onRegenerate={onRegenerate}
      onApproved={onApproved}
      onBack={onBack}
    />
  );
}

function OptionsForm({
  issue,
  ctx,
  error,
  onRegenerate,
  onApproved,
  onBack,
}: StepProps & { error: string | null; onRegenerate: (comment: string) => void; onApproved: () => void; onBack: () => void }) {
  const { state, send } = ctx;
  const toast = useToast();
  const run = state.runs[issue.id]!;
  const costs = run.costs!;
  const action = run.action!;
  const agentRuns = state.agentRuns.filter((r) => r.issue_id === issue.id);
  const rec = costs.recommended_option;
  const daily = asm(state.assumptions, "daily_delay_cost");
  const recurDays = asm(state.assumptions, "recurrence_loss_days");

  const [selected, setSelected] = useState<string | null>(rec);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [cr, setCr] = useState<ChangeRequestDraft>(action.change_request_draft);
  const [comment, setComment] = useState(run.comment ?? "");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const chosen = costs.options.find((o) => o.option_id === selected);
  const overriding = Boolean(selected && selected !== rec);

  function requestApprove() {
    if (overriding && !reason.trim()) {
      setReasonError(true);
      document.getElementById("override-reason")?.focus();
      return;
    }
    setConfirming(true);
  }

  async function approve() {
    setBusy(true);
    setApplyError(null);
    try {
      await send(`/api/workops/issues/${issue.id}/approve`, { selected, override_reason: reason.trim() || undefined, cr });
      setConfirming(false);
      toast("승인 결과를 반영했습니다");
      onApproved();
    } catch (e) {
      setConfirming(false);
      setApplyError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {applyError && (
        <Banner tone="error" onRetry={requestApprove}>
          반영 실패 · 프로젝트 데이터 변경을 롤백했습니다 — {applyError}
        </Banner>
      )}
      {error && <Banner tone="error">{error}</Banner>}
      <Grid>
        <Col span={8}>
          <Card
            title="대응안 비교"
            caption={`일 지연 비용 ${won(daily)} 가정 · 확정 기간 ${asm(state.assumptions, "after_decision_days")}영업일`}
          >
            <div role="radiogroup" aria-label="대응안" className="space-y-2">
              {costs.options.map((o) => (
                <OptionRow
                  key={o.option_id}
                  option={o}
                  recommended={o.option_id === rec}
                  selected={o.option_id === selected}
                  expanded={open.has(o.option_id)}
                  daily={daily}
                  recurDays={recurDays}
                  onSelect={() => {
                    if (!o.allowed) return;
                    setSelected(o.option_id);
                    setReasonError(false);
                  }}
                  onToggle={() =>
                    setOpen((prev) => {
                      const next = new Set(prev);
                      if (next.has(o.option_id)) next.delete(o.option_id);
                      else next.add(o.option_id);
                      return next;
                    })
                  }
                />
              ))}
            </div>
            <p className="text-caption text-muted-foreground">
              추천 근거: {costs.recommendation_reason.join(" · ") || "허용된 대응안이 없습니다"}
            </p>
            {overriding && (
              <Field label="추천과 다른 안을 선택한 사유" hint="필수 · DecisionLog에 기록" error={reasonError ? "사유를 입력하세요" : null}>
                <Input
                  id="override-reason"
                  value={reason}
                  maxLength={500}
                  aria-invalid={reasonError}
                  onChange={(e) => setReason(e.target.value)}
                  onBlur={() => reason.trim() && setReasonError(false)}
                  placeholder="예) 고객사와 기능 제공 협의 완료"
                />
              </Field>
            )}
          </Card>

          <Card title="변경요청서 초안" caption="편집 가능 · CM-001 §2.1 필수 항목">
            <div className="grid gap-4">
              <Field label="CR 제목">
                <Input value={cr.title} maxLength={200} onChange={(e) => setCr({ ...cr, title: e.target.value })} />
              </Field>
              <Field label="사유">
                <Textarea value={cr.reason} maxLength={2000} onChange={(e) => setCr({ ...cr, reason: e.target.value })} />
              </Field>
              <Field label="영향 범위">
                <Textarea value={cr.impact} maxLength={2000} onChange={(e) => setCr({ ...cr, impact: e.target.value })} />
              </Field>
              <Field label="승인 요청">
                <Input value={cr.approval_request} maxLength={500} onChange={(e) => setCr({ ...cr, approval_request: e.target.value })} />
              </Field>
            </div>
          </Card>

          <Card title="대응안 재생성" caption="P1 · Action Agent 재실행">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="PM 코멘트" className="min-w-[240px] flex-1">
                <Input
                  value={comment}
                  maxLength={500}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="예) 업데이트 배포를 3주로 당길 수 있는지 반영"
                />
              </Field>
              <Button variant="outline" onClick={() => onRegenerate(comment.trim())}>
                코멘트 반영해 재생성
              </Button>
            </div>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onBack}>
              분석 결과로
            </Button>
            <Button onClick={requestApprove} disabled={!chosen?.allowed}>
              선택안 승인 및 반영
            </Button>
          </div>
        </Col>

        <Col span={4}>
          <Card title="담당자 추천" caption="ORG-001 · 부하 기준">
            <ul className="divide-y divide-border">
              {action.suggested_owners.map((o) => {
                const m = state.db.members.find((x) => x.id === o.member_id);
                return (
                  <li key={`${o.task}-${o.member_id}`} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {m?.name ?? o.member_id} <span className="text-caption font-normal text-muted-foreground">{m?.role}</span>
                      </div>
                      <div className="text-caption text-muted-foreground">
                        {o.task} · {o.reason}
                      </div>
                    </div>
                    {m && <Meter value={m.current_load} attn={m.current_load >= 85} title={`현재 부하 ${m.current_load}%`} />}
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card title="Agent 실행 로그">
            <AgentRunList runs={agentRuns} />
          </Card>
        </Col>
      </Grid>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="선택안 승인 및 반영"
        confirmLabel="승인 및 반영"
        onConfirm={() => void approve()}
        busy={busy}
      >
        {chosen && (
          <>
            <p>
              대응안{" "}
              <b>
                {chosen.option_id}. {chosen.title}
              </b>{" "}
              (기대비용 {won(chosen.expected_cost)})을 승인하고 Mock Project System에 반영합니다.
            </p>
            {chosen.escalation && <Banner tone="warn">{chosen.escalation}</Banner>}
            <p className="text-caption text-muted-foreground">반영 중 오류가 나면 모든 변경을 롤백합니다.</p>
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}

function OptionRow({
  option: o,
  recommended,
  selected,
  expanded,
  daily,
  recurDays,
  onSelect,
  onToggle,
}: {
  option: RuledOption;
  recommended: boolean;
  selected: boolean;
  expanded: boolean;
  daily: number;
  recurDays: number;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-control border border-border transition-colors duration-[120ms]",
        selected && "border-primary shadow-[inset_0_0_0_1px_var(--primary)]",
        o.allowed ? "hover:bg-background" : "opacity-60"
      )}
    >
      <label className={cn("flex flex-col gap-3 px-4 py-3.5", o.allowed ? "cursor-pointer" : "cursor-not-allowed")}>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="radio"
            name="option"
            className="size-4 accent-primary"
            checked={selected}
            disabled={!o.allowed}
            onChange={onSelect}
            aria-label={`대응안 ${o.option_id}`}
          />
          <span className="min-w-0 flex-1 font-semibold">
            {o.option_id}. {o.title}
          </span>
          {recommended && <Badge tone="green">추천</Badge>}
          {o.escalation && <Badge tone="orange">승인↑</Badge>}
          {!o.allowed && <Badge tone="red">차단</Badge>}
          <span className="text-display tabular-nums">{won(o.expected_cost)}</span>
        </div>
        <p className="text-caption text-muted-foreground">{o.description}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
          <span>
            지연{" "}
            <b className="text-foreground tabular-nums">
              {o.delay_days > 0 ? "+" : ""}
              {o.delay_days}일
            </b>
          </span>
          <span>
            작업 <b className="text-foreground tabular-nums">{o.work_days}일</b>
          </span>
          <span>
            리스크 <b className="text-foreground">{o.risk}</b>
          </span>
          <span>
            재발 확률 <b className="text-foreground tabular-nums">{Math.round(o.recurrence_prob * 100)}%</b>
          </span>
          {o.escalation && <span className="text-[color:var(--badge-orange-fg)]">{o.escalation}</span>}
          {o.blocked_reason && <span className="text-destructive">{o.blocked_reason}</span>}
        </div>
      </label>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-1.5 border-t border-border px-4 py-2 text-caption text-muted-foreground transition-colors duration-[120ms] hover:text-foreground"
      >
        <ChevronDown className={cn("size-3.5 transition-transform motion-reduce:transition-none", expanded && "rotate-180")} />
        비용 구성
      </button>
      {expanded && (
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 pb-3.5 text-[13px]">
          <dt>
            지연 비용 ({o.delay_days}일 × {won(daily)})
          </dt>
          <dd className="text-right tabular-nums">{won(o.delay_cost)}</dd>
          <dt>기회손실</dt>
          <dd className="text-right tabular-nums">{won(o.opportunity_loss)}</dd>
          <dt>후속 비용</dt>
          <dd className="text-right tabular-nums">{won(o.follow_up_cost)}</dd>
          <dt>
            재발 기대손실 ({Math.round(o.recurrence_prob * 100)}% × {recurDays}일)
          </dt>
          <dd className="text-right tabular-nums">{won(o.recurrence_loss)}</dd>
          <dt className="font-medium">기대비용</dt>
          <dd className="text-right font-medium tabular-nums">{won(o.expected_cost)}</dd>
          <dt>근거 문서</dt>
          <dd className="flex flex-wrap justify-end gap-x-2">
            {o.rationale_docs.map((d) => (
              <Mono key={d} className="text-foreground">
                {d}
              </Mono>
            ))}
          </dd>
        </dl>
      )}
    </div>
  );
}
