"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SideSheet } from "@/components/workops/overlays";
import { StateGate } from "@/components/workops/state-gate";
import {
  Badge,
  Banner,
  Card,
  Col,
  DataTable,
  EmptyState,
  Field,
  Grid,
  KeyValues,
  Mono,
  NativeSelect,
  PageHeader,
  StatusBadge,
  UrlTabs,
  useTab,
} from "@/components/workops/ui";
import { findDoc, searchKnowledge, tokenize } from "@/lib/workops/knowledge";
import { CAUSE_MATRIX, GOLD_QUERIES, KNOWLEDGE, VARIANT_SCENARIOS } from "@/lib/workops/seed";

const TABS = [
  ["search", "문서 검색"],
  ["docs", `문서 목록 (${KNOWLEDGE.length})`],
  ["matrix", "원인 × 근거 매트릭스"],
  ["gold", `골드 질의 (${GOLD_QUERIES.length})`],
  ["variants", `변형 시나리오 (${VARIANT_SCENARIOS.length})`],
] as const;
const KEYS = TABS.map((t) => t[0]);
const DOC_TYPES = [...new Set(KNOWLEDGE.map((d) => d.doc_type))];

/** Knowledge — 근거 문서 17건 + 방해 문서 10건. 모든 원인 후보는 문서 ID·섹션 단위로 인용한다 */
export default function KnowledgePage() {
  const tab = useTab(KEYS, "search");
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const docId = search.get("doc");

  // ?doc= 로 열고 닫는다 → 근거 링크를 공유할 수 있다
  function setDoc(id: string | null) {
    const params = new URLSearchParams(search);
    if (id) params.set("doc", id);
    else params.delete("doc");
    router.replace(`${pathname}?${params}`, { scroll: false });
  }

  return (
    <StateGate>
      {({ state }) => (
        <>
          <PageHeader title="Knowledge" description="근거 문서 17건 + 방해 문서 10건. 모든 원인 후보는 문서 ID·섹션 단위로 인용해야 합니다." />
          <UrlTabs items={TABS.map(([k, l]) => [k, l])} current={tab} />
          {tab === "search" && <SearchTab threshold={state.rules.similarity_threshold} initial={search.get("q") ?? ""} onOpen={setDoc} />}
          {tab === "docs" && (
            <Card flush>
              <DataTable
                rowCount={KNOWLEDGE.length}
                columns={[{ label: "ID" }, { label: "문서" }, { label: "유형" }, { label: "제품" }, { label: "모듈" }, { label: "꼭 들어갈 내용" }, { label: "사용 Agent" }]}
              >
                {KNOWLEDGE.map((d) => (
                  <tr key={d.doc_id} className="cursor-pointer" tabIndex={0} onClick={() => setDoc(d.doc_id)} onKeyDown={(e) => e.key === "Enter" && setDoc(d.doc_id)}>
                    <td><Mono>{d.doc_id}</Mono></td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        {d.title}
                        {d.distractor && <Badge>방해</Badge>}
                      </span>
                    </td>
                    <td className="text-caption text-muted-foreground">{d.doc_type}</td>
                    <td className="text-caption text-muted-foreground">{d.product}</td>
                    <td className="text-caption text-muted-foreground">{d.module}</td>
                    <td className="text-caption whitespace-normal text-muted-foreground">{d.must}</td>
                    <td className="text-caption text-muted-foreground">{d.agents.join(", ") || "검색 정확도 검증"}</td>
                  </tr>
                ))}
              </DataTable>
            </Card>
          )}
          {tab === "matrix" && (
            <Card flush title="원인 × 근거 매트릭스 (문서 작성 기준)" caption={'변형 시나리오 5건 중 1~2건은 일부러 근거를 비워 "근거 부족" 동작을 시연'}>
              <DataTable rowCount={CAUSE_MATRIX.length} columns={[{ label: "원인 후보" }, { label: "직접 근거" }, { label: "보조 근거" }, { label: "목표 강도" }]}>
                {CAUSE_MATRIX.map((m) => (
                  <tr key={m.cause}>
                    <td>{m.cause}</td>
                    <td className="font-mono text-[13px]">{m.direct}</td>
                    <td className="font-mono text-[13px]">{m.support}</td>
                    <td><StatusBadge status={m.target} /></td>
                  </tr>
                ))}
              </DataTable>
            </Card>
          )}
          {tab === "gold" && <GoldTab />}
          {tab === "variants" && (
            <Card flush title="변형 시나리오 5건" caption="WP1 · 기한 11/1 · 4건 완주 목표">
              <DataTable rowCount={VARIANT_SCENARIOS.length} columns={[{ label: "ID" }, { label: "시나리오" }, { label: "검증 목적" }, { label: "근거" }, { label: "상태" }, { label: "" }]}>
                {VARIANT_SCENARIOS.map((v) => (
                  <tr key={v.id}>
                    <td><Mono>{v.id}</Mono></td>
                    <td>{v.title}</td>
                    <td className="text-caption text-muted-foreground">{v.purpose}</td>
                    <td><Badge tone={v.evidence === "의도적 결손" ? "orange" : "gray"}>{v.evidence}</Badge></td>
                    <td><StatusBadge status={v.status} /></td>
                    <td className="text-right">
                      {v.id === "V-03" && (
                        <Button variant="outline" size="sm" onClick={() => router.push("/issues/new")}>
                          근거 부족 시연
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </DataTable>
            </Card>
          )}
          <DocSheet docId={docId} onClose={() => setDoc(null)} />
        </>
      )}
    </StateGate>
  );
}

function SearchTab({ threshold, initial, onOpen }: { threshold: number; initial: string; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState(initial);
  const [submitted, setSubmitted] = useState(initial);
  const [type, setType] = useState("");
  const [distract, setDistract] = useState(false);
  const terms = useMemo(() => tokenize(submitted), [submitted]);
  const hits = useMemo(
    () => searchKnowledge(submitted, 12).filter((h) => (!type || h.doc.doc_type === type) && (distract || !h.doc.distractor)),
    [submitted, type, distract]
  );

  return (
    <Grid>
      <Col span={8}>
        <Card>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(query);
            }}
          >
            <Field label="검색어" className="flex-1">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="예) 연결 대기열 최대 크기" />
            </Field>
            <Button type="submit">
              <Search />
              검색
            </Button>
          </form>
          <p className="text-caption text-muted-foreground">
            키워드 검색입니다. 벡터DB(Chroma) 연결 시 search.py 결과로 교체됩니다. 점수 {threshold} 미만은 &quot;유사도 낮음&quot;으로 표시합니다.
          </p>
          {!submitted ? (
            <EmptyState>검색어를 입력하면 문서 ID·섹션 단위로 근거를 찾습니다</EmptyState>
          ) : !hits.length ? (
            <EmptyState>조건에 맞는 문서가 없습니다 — 근거 부족 · 확인 필요</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {hits.map(({ doc, score }) => {
                const sec =
                  Object.entries(doc.sections).find(([, v]) => terms.some((t) => v.toLowerCase().includes(t))) ?? Object.entries(doc.sections)[0];
                return (
                  <li key={doc.doc_id} className="space-y-1 py-3">
                    <h3 className="flex flex-wrap items-center gap-2 text-headline">
                      <button type="button" className="text-left text-primary hover:underline" onClick={() => onOpen(doc.doc_id)}>
                        {doc.title}
                      </button>
                      <span className="font-mono text-caption text-muted-foreground">
                        {doc.doc_id} §{sec[0]}
                      </span>
                      {score < threshold && <Badge>유사도 낮음</Badge>}
                    </h3>
                    <div className="text-caption text-muted-foreground">
                      {doc.doc_type} · {doc.product} · {doc.module} · 점수 {score.toFixed(2)}
                    </div>
                    <p>
                      <Highlight text={sec[1]} terms={terms} />
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </Col>
      <Col span={4}>
        <Card title="필터">
          <Field label="문서 유형">
            <NativeSelect value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">전체</option>
              {DOC_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </NativeSelect>
          </Field>
          <label className="flex items-center gap-2 text-body">
            <input type="checkbox" className="size-4 accent-primary" checked={distract} onChange={(e) => setDistract(e.target.checked)} />
            방해 문서 D-01 ~ D-10 포함
          </label>
          <p className="text-caption text-muted-foreground">
            사용 Agent별 문서 수: Analysis {KNOWLEDGE.filter((d) => d.agents.includes("Analysis")).length} · Impact{" "}
            {KNOWLEDGE.filter((d) => d.agents.includes("Impact")).length} · Action {KNOWLEDGE.filter((d) => d.agents.includes("Action")).length}
          </p>
        </Card>
      </Col>
    </Grid>
  );
}

/** 검색어 강조 — 색이 아니라 굵기로 (디자인 시스템: 강조는 굵기) */
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return (
    <>
      {text.split(pattern).map((part, i) =>
        i % 2 ? (
          <mark key={i} className="rounded-[2px] bg-muted px-0.5 font-semibold text-foreground">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

function GoldTab() {
  const [results, setResults] = useState<(number | null)[] | null>(null);
  const top1 = results?.filter((r) => r === 0).length ?? 0;

  function evaluate() {
    setResults(
      GOLD_QUERIES.map((g) => {
        const rank = searchKnowledge(g.q, 3)
          .filter((h) => !h.doc.distractor)
          .findIndex((h) => h.doc.doc_id === g.doc);
        return rank < 0 ? null : rank;
      })
    );
  }

  return (
    <Card
      flush
      title="골드 질의 20개"
      caption="검색 정확도는 내부 품질 관리용 · 발표 KPI 제외"
      actions={
        <Button variant="outline" size="sm" onClick={evaluate}>
          전체 평가 실행
        </Button>
      }
    >
      {results && (
        <div className="px-5 pt-4">
          <Banner tone={top1 >= 16 ? "ok" : "warn"}>
            Top-1 정확도 {top1}/{GOLD_QUERIES.length} ({Math.round((top1 / GOLD_QUERIES.length) * 100)}%) · 키워드 검색 기준 · 목표 16건 이상
          </Banner>
        </div>
      )}
      <DataTable compact rowCount={GOLD_QUERIES.length} columns={[{ label: "#", num: true }, { label: "질문" }, { label: "정답 문서" }, { label: "섹션" }, { label: "결과" }]}>
        {GOLD_QUERIES.map((g, i) => {
          const r = results?.[i];
          return (
            <tr key={g.q}>
              <td className="text-right text-caption text-muted-foreground tabular-nums">{i + 1}</td>
              <td>{g.q}</td>
              <td><Mono>{g.doc}</Mono></td>
              <td className="text-caption text-muted-foreground">{g.section}</td>
              <td>
                {results === null ? (
                  <span className="text-caption text-muted-foreground">-</span>
                ) : r === 0 ? (
                  <Badge tone="green">Top-1</Badge>
                ) : r != null ? (
                  <Badge tone="orange">Top-{r + 1}</Badge>
                ) : (
                  <Badge tone="red">미검출</Badge>
                )}
              </td>
            </tr>
          );
        })}
      </DataTable>
    </Card>
  );
}

function DocSheet({ docId, onClose }: { docId: string | null; onClose: () => void }) {
  const doc = docId ? findDoc(docId) : undefined;
  return (
    <SideSheet
      open={Boolean(doc)}
      onOpenChange={(o) => !o && onClose()}
      title={
        doc && (
          <span>
            <Mono className="text-foreground">{doc.doc_id}</Mono> {doc.title}
          </span>
        )
      }
    >
      {doc && (
        <>
          <KeyValues
            items={[
              ["유형", doc.doc_type],
              ["제품", doc.product],
              ["모듈", doc.module],
              ["심각도", doc.severity],
              ["사용 Agent", doc.agents.join(", ") || "-"],
              ["꼭 들어갈 내용", doc.must],
            ]}
          />
          <div className="text-label text-muted-foreground">섹션</div>
          {Object.entries(doc.sections).map(([k, v]) => (
            <div key={k} className="space-y-1">
              <div className="font-mono text-caption text-muted-foreground">§{k}</div>
              <blockquote className="rounded-r-[6px] border-l-2 border-label-3 bg-background px-3 py-2.5">{v}</blockquote>
            </div>
          ))}
        </>
      )}
    </SideSheet>
  );
}
