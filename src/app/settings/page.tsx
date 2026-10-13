"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, useToast } from "@/components/workops/overlays";
import { StateGate, type WorkopsCtx } from "@/components/workops/state-gate";
import { Badge, Banner, Card, Col, DataTable, Field, Grid, Mono, NativeSelect, PageHeader } from "@/components/workops/ui";
import { downloadJson } from "@/lib/workops/csv";
import { DEFAULT_CLAUDE_MODEL } from "@/lib/workops/state";

/** 설정 · 연동 — AI 엔진은 서버 어댑터 한 곳에서 전환한다. 키 · 비밀번호는 이 화면과 DB 에 두지 않는다 */
export default function SettingsPage() {
  return (
    <StateGate>
      {(ctx) => (
        <>
          <PageHeader
            title="설정·연동"
            description="AI 엔진(Claude API) 연결은 서버 어댑터 한 곳에서 전환합니다. API 키는 서버 환경변수로만 관리하며 이 화면과 DB에 저장하지 않습니다."
          />
          <Grid>
            <Col span={6}>
              <AiCard key={JSON.stringify(ctx.state.settings)} ctx={ctx} />
            </Col>
            <Col span={6}>
              <ProjectSystemCard />
            </Col>
            <Col span={6}>
              <ScreenCard key={ctx.state.settings.globalRelease} ctx={ctx} />
            </Col>
            <Col span={6}>
              <DemoCard ctx={ctx} />
            </Col>
          </Grid>
        </>
      )}
    </StateGate>
  );
}

function useCall(ctx: WorkopsCtx) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  async function call(path: string, body: object, done: string) {
    setError(null);
    try {
      await ctx.send(path, body);
      toast(done);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }
  return { error, call };
}

function AiCard({ ctx }: { ctx: WorkopsCtx }) {
  const { state, data } = ctx;
  const s = state.settings;
  const [ai, setAi] = useState(s.ai);
  const [model, setModel] = useState(s.claude.model);
  const [maxTokens, setMaxTokens] = useState(String(s.claude.maxTokens));
  const { error, call } = useCall(ctx);
  const keyMissing = ai === "claude" && !data.claudeConfigured;

  return (
    <Card
      title="AI 엔진"
      actions={s.ai === "claude" ? <Badge tone={data.claudeConfigured ? "green" : "orange"}>Claude API</Badge> : <Badge tone="green">재생 모드</Badge>}
    >
      {error && <Banner tone="error">{error}</Banner>}
      {keyMissing && <Banner tone="warn">서버에 ANTHROPIC_API_KEY 가 없습니다. 키를 설정하기 전까지 Agent 호출은 실패합니다.</Banner>}
      <Field label="모드">
        <div role="radiogroup" className="flex flex-wrap gap-4 py-1.5">
          {(
            [
              ["mock", "저장된 결과 재생 (SC-01)"],
              ["claude", "Claude API"],
            ] as const
          ).map(([v, l]) => (
            <label key={v} className="flex cursor-pointer items-center gap-1.5">
              <input type="radio" name="ai" className="size-4 accent-primary" checked={ai === v} onChange={() => setAi(v)} />
              {l}
            </label>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-12 gap-4">
        <Field label="모델" hint={`기본 ${DEFAULT_CLAUDE_MODEL}`} className="col-span-12 md:col-span-7">
          <Input className="font-mono" value={model} onChange={(e) => setModel(e.target.value.trim())} />
        </Field>
        <Field label="max_tokens" className="col-span-12 md:col-span-5">
          <Input type="number" min={1000} max={64000} className="tabular-nums" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} />
        </Field>
      </div>
      <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
        <dt className="text-muted-foreground">API 키</dt>
        <dd>{data.claudeConfigured ? "서버 환경변수에 설정됨" : "설정되지 않음 (ANTHROPIC_API_KEY)"}</dd>
        <dt className="text-muted-foreground">호출 방식</dt>
        <dd>Agent 3종 순차 호출 · prompts/*.md 를 system 으로, 입력 JSON 을 user 로 보내고 구조화 출력으로 받음</dd>
      </dl>
      <p className="text-caption text-muted-foreground">
        비용·추천·에스컬레이션은 응답에서 쓰지 않고 서버 코드가 계산합니다. 인용은 검색된 문서로만 제한됩니다. 건당 LLM 비용 목표 ≤ 1,000원.
      </p>
      <div className="flex justify-end">
        <Button onClick={() => void call("/api/workops/config/settings", { ai, model, maxTokens: Number(maxTokens) }, "AI 설정을 저장했습니다")}>
          AI 설정 저장
        </Button>
      </div>
    </Card>
  );
}

function ProjectSystemCard() {
  const mapping: [string, string][] = [
    ["Release", "Jira Version"],
    ["Requirement", "Epic / Story"],
    ["Task", "Task (크리티컬 패스 = label)"],
    ["Risk", 'Issue type "Risk"'],
    ["Change Request", 'Issue type "Change"'],
    ["Member", "Assignee"],
  ];
  return (
    <Card title="프로젝트 시스템" actions={<Badge tone="green">Mock System 사용 중</Badge>}>
      <p className="text-body">
        MVP는 합성 데이터로 만든 Mock Project System만 사용합니다. 실제 사내 시스템(Jira 등) 연동은 PRD P2(제외)입니다. 연동할 때는 아래 매핑으로 서버 어댑터를 붙이고,
        자격증명은 서버 환경변수(.env 의 ATLASSIAN_*)로만 둡니다.
      </p>
      <div className="text-label text-muted-foreground">엔티티 매핑 (앱 → Jira)</div>
      <DataTable compact rowCount={mapping.length} columns={[{ label: "앱 엔티티" }, { label: "Jira" }]}>
        {mapping.map(([k, v]) => (
          <tr key={k}>
            <td><Mono className="text-foreground">{k}</Mono></td>
            <td>{v}</td>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}

function ScreenCard({ ctx }: { ctx: WorkopsCtx }) {
  const { state } = ctx;
  const [release, setRelease] = useState(state.settings.globalRelease);
  const { error, call } = useCall(ctx);
  return (
    <Card title="화면">
      {error && <Banner tone="error">{error}</Banner>}
      <Field label="글로벌 릴리스 필터" hint="컨텍스트 바 · 새 이슈 기본값">
        <NativeSelect value={release} onChange={(e) => setRelease(e.target.value)}>
          {state.db.releases.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <p className="text-caption text-muted-foreground">테마(라이트·다크)와 언어는 상단 바 오른쪽에서 바꿉니다.</p>
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => void call("/api/workops/config/settings", { globalRelease: release }, "화면 설정을 저장했습니다")}>
          화면 설정 저장
        </Button>
      </div>
    </Card>
  );
}

function DemoCard({ ctx }: { ctx: WorkopsCtx }) {
  const { state } = ctx;
  const { error, call } = useCall(ctx);
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const size = Math.round(JSON.stringify(state).length / 1024);

  return (
    <Card title="시연·데이터">
      {error && <Banner tone="error">{error}</Banner>}
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-primary"
          checked={state.settings.simulateApplyFail}
          onChange={(e) =>
            void call("/api/workops/config/settings", { simulateApplyFail: e.target.checked }, e.target.checked ? "반영 실패 시뮬레이션을 켰습니다" : "반영 실패 시뮬레이션을 껐습니다")
          }
        />
        <span>
          반영 실패 시뮬레이션
          <span className="block text-caption text-muted-foreground">승인 반영 시 오류를 일으켜 롤백 동작을 시연합니다</span>
        </span>
      </label>
      <p className="text-caption text-muted-foreground">
        저장소: 서버 SQLite ({size} KB) · 이슈 {state.db.issues.length}건 · Agent 실행 {state.agentRuns.length}회 · 효과 기록 {state.effectRecords.length}건
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            downloadJson("workops_state.json", state);
            toast("JSON을 내려받았습니다");
          }}
        >
          <Download />
          전체 데이터 JSON
        </Button>
        <Button variant="destructive" onClick={() => setConfirm(true)}>
          시드로 초기화
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="시드로 초기화"
        confirmLabel="초기화"
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          const ok = await call("/api/workops/config/reset", {}, "시드로 초기화했습니다");
          setBusy(false);
          if (ok) setConfirm(false);
        }}
      >
        <p>등록한 이슈, 분석 결과, 승인 이력, 효과 기록, 할 일 담당자가 모두 지워지고 PRD 시드 데이터로 돌아갑니다. 팀원 모두에게 적용됩니다.</p>
      </ConfirmDialog>
    </Card>
  );
}
