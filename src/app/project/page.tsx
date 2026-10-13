"use client";

import { useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SideSheet, useToast } from "@/components/workops/overlays";
import { StateGate } from "@/components/workops/state-gate";
import {
  Badge,
  Card,
  DataTable,
  KeyValues,
  Meter,
  Mono,
  PageHeader,
  StatusBadge,
  UrlTabs,
  numCell,
  useTab,
} from "@/components/workops/ui";
import { downloadCsv } from "@/lib/workops/csv";
import { fmtDateTime, fmtNum, won } from "@/lib/workops/format";
import type { WorkOpsState } from "@/lib/workops/types";

const TABS = [
  ["releases", "Release"],
  ["requirements", "Requirement"],
  ["tasks", "Task"],
  ["risks", "Risk"],
  ["members", "Member"],
  ["contracts", "계약"],
  ["crs", "Change Request"],
  ["decisions", "Decision Log"],
  ["agentruns", "Agent Run"],
] as const;
type Tab = (typeof TABS)[number][0];
const KEYS = TABS.map((t) => t[0]);

type Sheet = { kind: "entity"; entity: "releases" | "requirements" | "tasks" | "risks"; id: string } | { kind: "cr"; id: string };

function rowsOf(state: WorkOpsState, tab: Tab): object[] {
  if (tab === "crs") return state.changeRequests;
  if (tab === "decisions") return state.decisionLogs;
  if (tab === "agentruns") return state.agentRuns;
  return state.db[tab];
}

/** 프로젝트 데이터 — Mock Project System. 승인된 결정만 여기에 반영되고 모든 변경은 CR · Decision Log 에 남는다 */
export default function ProjectPage() {
  const tab = useTab(KEYS, "releases");
  const toast = useToast();
  const [sheet, setSheet] = useState<Sheet | null>(null);

  return (
    <StateGate>
      {({ state }) => {
        const db = state.db;
        const member = (id: string | null) => db.members.find((m) => m.id === id)?.name ?? id ?? "-";
        const open = (entity: Extract<Sheet, { kind: "entity" }>["entity"], id: string) => setSheet({ kind: "entity", entity, id });
        const rowProps = (entity: Extract<Sheet, { kind: "entity" }>["entity"], id: string) => ({
          className: "cursor-pointer",
          onClick: () => open(entity, id),
          tabIndex: 0,
          onKeyDown: (e: React.KeyboardEvent) => e.key === "Enter" && open(entity, id),
        });

        return (
          <>
            <PageHeader
              title="프로젝트 데이터"
              description="Mock Project System · 승인된 결정만 여기에 반영되며, 모든 변경은 Change Request·Decision Log에 남습니다."
              actions={
                <Button
                  variant="outline"
                  onClick={() => {
                    const data = rowsOf(state, tab) as Record<string, unknown>[];
                    if (!data.length) return toast("내보낼 데이터가 없습니다");
                    const keys = Object.keys(data[0]);
                    downloadCsv(`${tab}.csv`, [keys, ...data.map((d) => keys.map((k) => (Array.isArray(d[k]) ? (d[k] as unknown[]).join("|") : d[k])))]);
                    toast("CSV를 내려받았습니다");
                  }}
                >
                  <Download />
                  현재 탭 CSV
                </Button>
              }
            />
            <UrlTabs items={TABS.map(([k, l]) => [k, l])} current={tab} />

            <Card flush>
              {tab === "releases" && (
                <DataTable
                  rowCount={db.releases.length}
                  columns={[{ label: "ID" }, { label: "이름" }, { label: "출시일", num: true }, { label: "버퍼(영업일)", num: true }, { label: "계약" }, { label: "D-", num: true }, { label: "상태" }]}
                >
                  {db.releases.map((r) => (
                    <tr key={r.id} {...rowProps("releases", r.id)}>
                      <td><Mono>{r.id}</Mono></td>
                      <td>{r.name}</td>
                      <td className={numCell}>{r.due_date}</td>
                      <td className={numCell}>{r.buffer_days}</td>
                      <td><Mono className="text-foreground">{r.contract_id}</Mono></td>
                      <td className={numCell}>{r.d_minus}</td>
                      <td><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </DataTable>
              )}
              {tab === "requirements" && (
                <DataTable
                  rowCount={db.requirements.length}
                  columns={[{ label: "ID" }, { label: "제목" }, { label: "우선순위" }, { label: "계약 필수" }, { label: "상태" }, { label: "릴리스" }]}
                >
                  {db.requirements.map((r) => (
                    <tr key={r.id} {...rowProps("requirements", r.id)}>
                      <td><Mono>{r.id}</Mono></td>
                      <td>{r.title}</td>
                      <td>{r.priority}</td>
                      <td>{r.contract_required ? <Badge tone="blue">필수</Badge> : "아니오"}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="text-caption text-muted-foreground">{r.release_id}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
              {tab === "tasks" && (
                <DataTable
                  rowCount={db.tasks.length}
                  columns={[{ label: "ID" }, { label: "제목" }, { label: "담당" }, { label: "시작", num: true }, { label: "종료", num: true }, { label: "상태" }, { label: "크리티컬 패스" }, { label: "REQ" }]}
                >
                  {db.tasks.map((t) => (
                    <tr key={t.id} {...rowProps("tasks", t.id)}>
                      <td><Mono>{t.id}</Mono></td>
                      <td>{t.title}</td>
                      <td>{member(t.owner_id)}</td>
                      <td className={`${numCell} text-caption`}>{t.start}</td>
                      <td className={`${numCell} text-caption`}>{t.end}</td>
                      <td><StatusBadge status={t.status} /></td>
                      <td>{t.on_critical_path ? <Badge tone="orange">예</Badge> : "-"}</td>
                      <td className="font-mono text-caption text-muted-foreground">{t.requirement_id ?? "-"}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
              {tab === "risks" && (
                <DataTable
                  rowCount={db.risks.length}
                  columns={[{ label: "ID" }, { label: "제목" }, { label: "가능성" }, { label: "영향" }, { label: "상태" }, { label: "REQ" }, { label: "담당" }]}
                >
                  {db.risks.map((r) => (
                    <tr key={r.id} {...rowProps("risks", r.id)}>
                      <td><Mono>{r.id}</Mono></td>
                      <td>{r.title}</td>
                      <td><StatusBadge status={r.likelihood} /></td>
                      <td><StatusBadge status={r.impact} /></td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="font-mono text-caption text-muted-foreground">{r.related_req_id ?? "-"}</td>
                      <td>{member(r.owner_id)}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
              {tab === "members" && (
                <DataTable rowCount={db.members.length} columns={[{ label: "ID" }, { label: "이름" }, { label: "역할" }, { label: "담당 모듈" }, { label: "현재 부하", num: true }]}>
                  {db.members.map((m) => (
                    <tr key={m.id}>
                      <td><Mono>{m.id}</Mono></td>
                      <td>{m.name}</td>
                      <td>{m.role}</td>
                      <td className="text-caption text-muted-foreground">{m.modules.join(", ")}</td>
                      <td className={numCell}>
                        <span className="inline-flex items-center gap-2">
                          {m.current_load}%
                          <Meter value={m.current_load} attn={m.current_load >= 85} className="w-[72px]" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              )}
              {tab === "contracts" && (
                <DataTable rowCount={db.contracts.length} columns={[{ label: "ID" }, { label: "고객사" }, { label: "입고일", num: true }, { label: "일 페널티", num: true }, { label: "계약 필수 기능" }]}>
                  {db.contracts.map((c) => (
                    <tr key={c.id}>
                      <td><Mono>{c.id}</Mono></td>
                      <td>{c.buyer}</td>
                      <td className={numCell}>{c.delivery_date}</td>
                      <td className={numCell}>{won(c.penalty_per_day)}</td>
                      <td className="font-mono text-caption text-muted-foreground">{c.required_features.join(", ")}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
              {tab === "crs" && (
                <DataTable
                  rowCount={state.changeRequests.length}
                  empty="승인된 변경요청서가 없습니다"
                  columns={[{ label: "ID" }, { label: "이슈" }, { label: "안" }, { label: "제목" }, { label: "상태" }]}
                >
                  {state.changeRequests.map((c) => (
                    <tr key={c.id} className="cursor-pointer" tabIndex={0} onClick={() => setSheet({ kind: "cr", id: c.id })}>
                      <td><Mono>{c.id}</Mono></td>
                      <td><Link href={`/issues/${c.issue_id}`} onClick={(e) => e.stopPropagation()}><Mono>{c.issue_id}</Mono></Link></td>
                      <td>{c.option_id}</td>
                      <td>{c.title}</td>
                      <td><StatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </DataTable>
              )}
              {tab === "decisions" && (
                <DataTable
                  rowCount={state.decisionLogs.length}
                  empty="결정 이력이 없습니다"
                  columns={[{ label: "ID" }, { label: "이슈" }, { label: "AI 추천" }, { label: "PM 선택" }, { label: "변경 사유" }, { label: "결정 시각", num: true }]}
                >
                  {state.decisionLogs.map((d) => (
                    <tr key={d.id}>
                      <td><Mono>{d.id}</Mono></td>
                      <td><Link href={`/issues/${d.issue_id}?step=result`}><Mono>{d.issue_id}</Mono></Link></td>
                      <td>{d.ai_recommended ?? "-"}</td>
                      <td>
                        <span className="inline-flex items-center gap-2">
                          {d.pm_selected}
                          {d.pm_selected !== d.ai_recommended && <Badge tone="orange">PM 변경</Badge>}
                        </span>
                      </td>
                      <td className="whitespace-normal">{d.override_reason ?? "-"}</td>
                      <td className={`${numCell} text-caption text-muted-foreground`}>{fmtDateTime(d.decided_at)}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
              {tab === "agentruns" && (
                <DataTable
                  rowCount={state.agentRuns.length}
                  empty="Agent 실행 기록이 없습니다"
                  columns={[{ label: "ID" }, { label: "이슈" }, { label: "Agent" }, { label: "엔진" }, { label: "상태" }, { label: "토큰", num: true }, { label: "LLM 비용", num: true }, { label: "시작", num: true }]}
                  footer={
                    state.agentRuns.length ? (
                      <tr>
                        <td colSpan={5}>합계</td>
                        <td className={numCell}>{fmtNum(state.agentRuns.reduce((s, r) => s + (r.tokens ?? 0), 0))}</td>
                        <td className={numCell}>{fmtNum(state.agentRuns.reduce((s, r) => s + (r.llm_cost_krw ?? 0), 0))}원</td>
                        <td />
                      </tr>
                    ) : null
                  }
                >
                  {[...state.agentRuns].reverse().map((r) => (
                    <tr key={r.id}>
                      <td><Mono>{r.id}</Mono></td>
                      <td><Mono className="text-foreground">{r.issue_id}</Mono></td>
                      <td>{r.agent}</td>
                      <td className="text-caption text-muted-foreground">{r.engine === "claude" ? "Claude" : "재생"}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className={numCell}>{fmtNum(r.tokens)}</td>
                      <td className={numCell}>{fmtNum(r.llm_cost_krw)}원</td>
                      <td className={`${numCell} text-caption text-muted-foreground`}>{fmtDateTime(r.started_at)}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </Card>

            <EntitySheet state={state} sheet={sheet} onClose={() => setSheet(null)} />
          </>
        );
      }}
    </StateGate>
  );
}

function EntitySheet({ state, sheet, onClose }: { state: WorkOpsState; sheet: Sheet | null; onClose: () => void }) {
  if (!sheet) return <SideSheet open={false} onOpenChange={onClose} title="">{null}</SideSheet>;

  if (sheet.kind === "cr") {
    const c = state.changeRequests.find((x) => x.id === sheet.id);
    return (
      <SideSheet open onOpenChange={(o) => !o && onClose()} title={<Mono className="text-foreground">{sheet.id}</Mono>}>
        {c && (
          <KeyValues
            items={[
              ["이슈", <Link key="i" href={`/issues/${c.issue_id}?step=result`}><Mono>{c.issue_id}</Mono></Link>],
              ["대응안", c.option_id],
              ["제목", c.title],
              ["사유", c.reason],
              ["영향 범위", c.impact],
              ["승인 요청", c.approval_request],
              ["상태", <StatusBadge key="s" status={c.status} />],
            ]}
          />
        )}
      </SideSheet>
    );
  }

  const entity = (state.db[sheet.entity] as { id: string }[]).find((x) => x.id === sheet.id) as Record<string, unknown> | undefined;
  const memberName = (id: unknown) => state.db.members.find((m) => m.id === id)?.name ?? String(id);
  const related = state.db.issues.filter((i) => {
    const im = state.runs[i.id]?.impact;
    return im && [...im.affected_requirements, ...im.affected_tasks, ...im.affected_risks].includes(sheet.id);
  });

  return (
    <SideSheet open onOpenChange={(o) => !o && onClose()} title={<Mono className="text-foreground">{sheet.id}</Mono>}>
      {entity && (
        <KeyValues
          items={Object.entries(entity).map(([k, v]) => [
            k,
            k === "owner_id" ? memberName(v) : Array.isArray(v) ? v.join(", ") : v === null ? "-" : String(v),
          ])}
        />
      )}
      {related.length > 0 && (
        <div className="space-y-2">
          <div className="text-label text-muted-foreground">관련 이슈</div>
          {related.map((i) => (
            <Link key={i.id} href={`/issues/${i.id}`} className="block text-primary hover:underline" onClick={onClose}>
              {i.id} {i.title}
            </Link>
          ))}
        </div>
      )}
    </SideSheet>
  );
}
