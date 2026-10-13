"use client";

import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/workops/overlays";
import { StateGate, type WorkopsCtx } from "@/components/workops/state-gate";
import {
  Badge,
  Card,
  CodeBlock,
  Col,
  DataTable,
  Grid,
  KeyValues,
  Meter,
  Mono,
  NativeSelect,
  PageHeader,
  Section,
  StatusBadge,
  UrlTabs,
  numCell,
  useTab,
} from "@/components/workops/ui";
import { downloadCsv } from "@/lib/workops/csv";
import { todayIso } from "@/lib/workops/format";
import { DATA_MODEL, DOMAINS, FEATURES, FOLDER_TREE, NFRS, PHASES, TEAM, WORK_PACKAGES } from "@/lib/workops/prd-content";
import { GOLD_QUERIES, KNOWLEDGE, VARIANT_SCENARIOS } from "@/lib/workops/seed";
import type { Todo } from "@/lib/workops/types";

const TABS = [
  ["overview", "01–04 개요·문제·사용자"],
  ["features", "05 AI 기능"],
  ["scenario", "06 시나리오"],
  ["screens", "07 화면 정의"],
  ["tech", "08 기술 요구사항"],
  ["data", "09 데이터 확보"],
  ["schedule", "10 일정"],
  ["todos", "12 업무 패키지·할 일"],
] as const;
const KEYS = TABS.map((t) => t[0]);

const P0_SCREENS = ["S-001", "S-002", "S-002", "S-002", "S-003", "S-003", "S-003", "S-004", "S-004"];
/** P1 구현 상태 — 이 웹 시스템 기준 */
const P1_STATUS = ["예정", "완료", "완료", "예정"];

const SCENARIO_STEPS: [string, string][] = [
  ["PM이 이슈 접수 화면에 Q-1024를 입력합니다. 제목: 여러 기기 연속 연결 시 허브 재부팅 (FW 1.2.3), 심각도 Critical, 릴리스 Smart Home Hub 2.0 D-28", "S-001"],
  ["시스템이 이슈를 저장하고 타이머를 시작한 뒤 Analysis Agent를 실행합니다.", "-"],
  ["Analysis Agent가 원인 후보 3개를 근거 문서와 함께 제시합니다. ① FW 1.2.3의 통신 라이브러리 업데이트로 연결 대기열이 넘침 High ② 동시 연결 대수 요구사항 변경(5→10대)이 FW 설정에 반영되지 않음 Med ③ 다중 연결 회귀 테스트 누락 Med. 유사 이슈 Q-0812를 연결합니다.", "S-002"],
  ["Impact Agent가 영향 Requirement(REQ-045 자동 다중 연결, P1), Task(T-210, T-215), 크리티컬 패스, 리스크(R-07), 고객사 계약 조항(CT-001)을 조회하고 방치 시 출시 1개월 지연을 산출합니다.", "S-002"],
  ["Action Agent가 대응안 A(근본 수정 후 전체 재검증), B(자동 다중 연결 기능을 끄고 정시 출시, 4주 후 업데이트 배포), C(출시 1개월 연기)를 만들고 변경요청서 초안과 담당자를 추천합니다. cost_model이 기대비용을 A 4.0억 / B 1.3억 / C 10억원으로 계산하고, 판단 기준에 따라 B를 추천합니다. C에는 \"사업부장 승인 필요\" 표시가 붙습니다.", "S-003"],
  ["PM이 추천 근거(QP-001 충족, REQ-045는 계약상 필수 기능 아님, 기대비용 최소, 선례 Q-0590)를 확인하고 변경요청서를 수정해 B를 승인합니다. AI 추천과 다른 안을 고를 수도 있으며, 그 경우 사유가 기록됩니다.", "S-003"],
  ["시스템이 승인 결과를 반영합니다: Issue 상태 갱신, 변경요청서 생성, Task 3건 생성(T-301~303), REQ-045 차기 업데이트로 이월, 출시일 유지, R-07 갱신.", "S-004"],
  ["PM이 효과 카드에서 KPI 3개를 확인합니다. Before(확정 5영업일·120인시·600만원)와 After(실측 확정 기간·인시·LLM 비용)를 비교해 건당 절감액과 지연 비용 회피액이 계산됩니다.", "S-004"],
];

const SCREENS = [
  ["S-001", "이슈 접수 · 목록", "PM이 이슈를 등록하고 Agent 분석을 시작합니다. 최근 이슈의 진행 상태를 봅니다.", "[AI 분석 시작]을 누르면 이슈 저장 → 타이머 시작 → Analysis·Impact Agent 실행 → S-002로 이동. 목록 행을 누르면 해당 이슈의 최신 단계 화면으로 갑니다.", '"등록된 이슈가 없습니다. 새 이슈를 등록하세요"', "필수 항목(제목·증상·심각도) 누락 시 입력란 아래 빨간 문구. 분석 실패 시 상단 빨간 배너와 [재시도].", "/issues/new"],
  ["S-002", "AI 분석 결과 (원인 · 영향)", "원인 후보와 근거 문서, 일정·Task·계약 영향을 한 화면에서 검증합니다.", "[근거 N]을 누르면 인용 문서 ID·섹션·발췌를 펼칩니다. PM은 원인 후보를 제외·수정할 수 있습니다. [대응안 생성]은 Action Agent와 cost_model을 실행하고 S-003으로 이동합니다.", '근거가 부족하면 "근거 부족 · 확인 필요" 표시를 붙이고 사람이 직접 입력하도록 안내합니다.', "검색·Agent 호출 실패 시 상단 빨간 배너와 [재시도]. 이전 단계 결과는 유지합니다.", "/issues"],
  ["S-003", "대응안 비교 · 승인", "대응안별 일정·기대비용·리스크를 비교하고 PM이 최종 결정합니다.", "대응안 행을 펼치면 비용 구성(지연 비용·기회손실·후속 비용·재발 기대손실)이 보입니다. 라디오로 선택하고 변경요청서를 고친 뒤 [선택안 승인 및 반영]을 누르면 승인 이력 저장 → Mock System 반영 → S-004 이동. 추천과 다른 안을 고르면 사유 입력란이 나타납니다.", '"분석 결과 화면에서 대응안을 먼저 생성하세요"', "반영 중 오류가 나면 DB 변경을 롤백하고 빨간 배너로 알립니다. 대응안을 고르지 않으면 승인 버튼이 비활성화됩니다.", "/issues"],
  ["S-004", "반영 결과 · 효과 기록", "승인 결과가 Mock System에 반영된 것과 KPI 3개를 돈으로 확인합니다.", "탭을 누르면 해당 엔티티의 변경 항목을 보여 줍니다. After 값은 타이머·실행 로그·참여자 입력 인시·산식으로 자동 계산합니다.", '"승인된 이슈가 없습니다"', '가정치가 없으면 "가정치 설정 필요"를 표시하고 기본값을 씁니다.', "/kpi"],
] as const;

/** PRD · 일정 — AI WorkOps Agent PRD v0.4 전체 내용과 업무 패키지 진행 관리 */
export default function PrdPage() {
  const tab = useTab(KEYS, "overview");
  return (
    <StateGate>
      {(ctx) => (
        <>
          <PageHeader title="PRD·일정" description="AI WorkOps Agent PRD v0.4 전체 내용과 업무 패키지 진행 관리. CAIO 과정 12조 · 모든 수치는 합성 가정치." />
          <UrlTabs items={TABS.map(([k, l]) => [k, l])} current={tab} />
          {tab === "overview" && <Overview />}
          {tab === "features" && <Features />}
          {tab === "scenario" && <Scenario />}
          {tab === "screens" && (
            <Grid>
              {SCREENS.map((s) => (
                <Col key={s[0]} span={6}>
                  <Card
                    title={
                      <span>
                        <Mono className="text-foreground">{s[0]}</Mono> {s[1]}
                      </span>
                    }
                    actions={
                      <Link href={s[6]} className="text-caption text-primary hover:underline">
                        열기
                      </Link>
                    }
                  >
                    <KeyValues labelWidth={72} items={[["목적", s[2]], ["동작", s[3]], ["빈 상태", s[4]], ["에러 상태", s[5]]]} />
                  </Card>
                </Col>
              ))}
            </Grid>
          )}
          {tab === "tech" && <Tech />}
          {tab === "data" && <DataTab />}
          {tab === "schedule" && <Schedule />}
          {tab === "todos" && <Todos ctx={ctx} />}
        </>
      )}
    </StateGate>
  );
}

function Overview() {
  return (
    <>
      <Section title="프로젝트">
        <Grid>
          <Col span={8}>
            <Card title="AI WorkOps Agent">
              <p className="max-w-[76ch]">
                프로젝트 이슈 하나를 끝까지 대응(원인 분석 → 영향·비용 평가 → 대응안 → 승인 → 반영)하고, 출시 지연 비용을 얼마나 줄이는지 돈으로 검증하는 MVP.
              </p>
              <KeyValues
                items={[
                  ["기준 도메인", "전자제품 신제품 개발 프로젝트 (건설·장비 등 다른 산업으로 확장 가능)"],
                  ["대표 시나리오", "출시 4주 전 Critical 결함 · 방치 시 1개월 지연"],
                  ["과정", "CAIO 과정 · 12조 · PRD v0.3 → v0.4 · 중간발표 2026-10-16"],
                ]}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card flush title="01 조원 및 회사">
              <DataTable compact rowCount={TEAM.length} columns={[{ label: "이름" }, { label: "소속" }, { label: "역할 (안)" }]}>
                {TEAM.map((t) => (
                  <tr key={t.name}>
                    <td className="font-medium">{t.name}</td>
                    <td className="text-caption text-muted-foreground">{t.org}</td>
                    <td>{t.role}</td>
                  </tr>
                ))}
              </DataTable>
              <p className="px-5 py-3 text-caption text-muted-foreground">역할은 초안이며, 중간발표 피드백을 반영한 뒤 12장의 업무 패키지를 기준으로 확정합니다.</p>
            </Card>
          </Col>
        </Grid>
      </Section>
      <Section title="02 어떤 분야에 AI를 도입하려고 하는가">
        <Card flush>
          <p className="max-w-[76ch] px-5 pt-4 pb-2">
            신제품 출시 등 개발관리 프로젝트의 이슈 대응 업무(원인 분석 → 영향·비용 평가 → 대응안 수립 → 승인)에 AI Agent를 도입합니다. 출시 직전 이슈로 일정·비용이 흔들리는 구조는 업종과 관계없이 같기 때문에, 같은 구조에서 Knowledge와 판단 기준만 바꾸면 다른 산업에도 적용됩니다.
          </p>
          <DataTable rowCount={DOMAINS.length} columns={[{ label: "산업" }, { label: "같은 유형의 이슈" }, { label: "바꿔 끼우는 것" }]}>
            {DOMAINS.map((d) => (
              <tr key={d.ind}>
                <td className="font-medium">{d.ind}</td>
                <td className="whitespace-normal">{d.issue}</td>
                <td className="text-caption whitespace-normal text-muted-foreground">{d.swap}</td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </Section>
      <Section title="03 현재 어떤 문제가 있는가">
        <Grid>
          <Col span={8}>
            <Card>
              <KeyValues
                labelWidth={140}
                items={[
                  ["고통", "출시 임박 시점에 치명적 품질 이슈 또는 예상하지 않았던 이슈가 생기면 PM·QA·개발이 과거 이슈, 설계·테스트 문서, 규정, 일정표를 여러 시스템에서 직접 찾아 원인과 영향도를 추정합니다. 이어서 회의로 대응안을 정리하고 변경요청서까지 작성합니다. 판단보다 찾고 정리하는 일에 시간이 쓰이고, 대응이 늦어질수록 출시 지연으로 이어집니다."],
                  ["기존 대안의 한계", "메일·공유폴더·위키 검색과 담당자의 경험에 의존합니다. 정보가 흩어져 누락되기 쉽고, 지연 비용은 별도 엑셀로 근거 없이 추정하며, 대응 노하우는 개인에게만 남습니다. 범용 AI Tool, 챗봇은 프로젝트 일정·Task와 연결되지 않아 영향도 산정, 실행안, 승인 반영까지 이어 주지 못합니다."],
                  ["문제의 규모", "제품 출시에 투입된 인원을 100명으로, 해당 이슈로 출시 일정이 1개월 지연되는 것으로 가정합니다. 인건비뿐 아니라 마케팅 준비 지연, 유통(배송), 고객사와의 계약에 따른 페널티가 있는 경우 등 규모는 프로젝트의 성격마다 다를 수 있습니다."],
                ]}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card flush title="지연 비용 항목 산정 (가정)">
              <DataTable compact rowCount={3} columns={[{ label: "항목" }, { label: "1일", num: true }, { label: "1개월(20일)", num: true }]}>
                <tr><td className="whitespace-normal">투입 인력 비용<div className="text-caption text-muted-foreground">100명 × 8시간 × 5만원</div></td><td className={numCell}>4,000만원</td><td className={numCell}>8억원</td></tr>
                <tr><td className="whitespace-normal">외부 비용<div className="text-caption text-muted-foreground">마케팅 재집행, 유통·배송 변경, 계약 페널티</div></td><td className={numCell}>1,000만원</td><td className={numCell}>2억원</td></tr>
                <tr className="font-medium"><td>합계</td><td className={numCell}>5,000만원</td><td className={numCell}>10억원</td></tr>
              </DataTable>
            </Card>
          </Col>
        </Grid>
      </Section>
      <Section title="04 사용자는 누구인가">
        <Card>
          <KeyValues
            items={[
              ["이름", "김PM 책임, 38세 (가상 페르소나)"],
              ["소속", "전자제품 제조사 신제품 개발 PM, 프로젝트 관리 12년차. 대표 시나리오 제품은 Smart Home Hub 2.0 (투입 인원 100명)"],
              ["일과", "오전에는 일정·리스크를 점검하고 개발·QA 이슈를 리뷰합니다. 오후에는 유관 부서와 조율하고 변경요청서와 경영진 보고 자료를 씁니다. 출시 임박 시 치명적 이슈가 생기면 하루 대부분을 문서 탐색과 대응 회의에 씁니다."],
              ["지불 의사", "회사 예산(PMO·개발본부). 연간 운영비(LLM·클라우드·유지보수, 가정 연 5,000만원)보다 연간 절감액이 크면 도입합니다. 1개 프로젝트팀 기준 연간 순절감액은 약 8.4억원, 보수적으로 약 3.6억원입니다."],
              ["보조 사용자", "QA 리드·개발 리드. 원인 후보와 근거 문서를 검증하고, 승인된 Task를 받습니다."],
            ]}
          />
        </Card>
      </Section>
    </>
  );
}

function Features() {
  return (
    <Grid>
      <Col span={12}>
        <Card flush title="P0 — MVP 필수" caption="이 웹 시스템의 이슈 대응 흐름에 모두 구현">
          <DataTable rowCount={FEATURES.P0.length} columns={[{ label: "기능" }, { label: "설명" }, { label: "화면" }]}>
            {FEATURES.P0.map((f, i) => (
              <tr key={f[0]}>
                <td className="font-medium">{f[0]}</td>
                <td className="whitespace-normal">{f[1]}</td>
                <td className="font-mono text-caption text-muted-foreground">{P0_SCREENS[i]}</td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </Col>
      <Col span={6}>
        <Card flush title="P1 — 있으면 좋음">
          <DataTable compact rowCount={FEATURES.P1.length} columns={[{ label: "기능" }, { label: "설명" }, { label: "상태" }]}>
            {FEATURES.P1.map((f, i) => (
              <tr key={f[0]}>
                <td className="font-medium">{f[0]}</td>
                <td className="text-caption whitespace-normal text-muted-foreground">{f[1]}</td>
                <td><StatusBadge status={P1_STATUS[i]} /></td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </Col>
      <Col span={6}>
        <Card title="P2 — 제외 (Non-Goals)">
          <ul className="max-w-[76ch] list-disc space-y-1 pl-5">
            {FEATURES.P2.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </Card>
      </Col>
    </Grid>
  );
}

function Scenario() {
  const flow = [
    ["이슈 접수", "S-001"],
    ["Knowledge 검색", "근거 문서"],
    ["Analysis Agent", "원인 후보·근거 강도"],
    ["Impact Agent", "영향 범위·방치 시 지연"],
    ["Action Agent", "대응안 A/B/C"],
    ["비용 계산·추천", "cost_model + 판단 기준"],
    ["PM 결정", "승인 또는 재요청"],
    ["시스템 반영", "Task·일정·리스크"],
    ["효과 기록", "KPI 3개"],
  ];
  return (
    <div className="space-y-6">
      <Card title="SC-01 상황">
        <p className="max-w-[76ch]">
          Smart Home Hub 2.0은 100명이 투입된 신제품으로, 출시일과 대형 유통사 입고일이 계약으로 정해져 있습니다. 출시 4주 전(D-28) 최종 검증에서, 여러 IoT 기기를 연달아 연결하면 허브가 재부팅되는 Critical 결함이 발견됩니다. 원인은 확정되지 않았고, 근본 수정과 전체 재검증을 마치고 출시하면 일정이 1개월 밀립니다.
        </p>
        <KeyValues
          labelWidth={140}
          items={[
            ["얽힌 부서", "개발(원인 수정), QA(재검증), 마케팅(출시 캠페인), 유통·물류(입고 일정), 영업(고객사 계약)"],
            ["판단에 필요한 자료", "테스트 리포트, FW 변경 이력, 요구사항 변경 이력, 품질규정, 변경관리규정, 고객사 계약 조건, 과거 유사 이슈"],
            ["결정해야 할 것", "근본 수정 후 출시 / 문제 기능을 끄고 정시 출시 / 출시 연기 중 어느 쪽이 손실이 가장 적은가"],
          ]}
        />
      </Card>
      <Card title="흐름">
        <ol className="flex items-stretch gap-2 overflow-x-auto pb-1">
          {flow.map(([t, s], i) => (
            <Fragment key={t}>
              <li className="flex min-w-32 flex-1 flex-col rounded-control border border-border px-3 py-2.5">
                <b className="font-semibold">{t}</b>
                <small className="text-caption text-muted-foreground">{s}</small>
              </li>
              {i < flow.length - 1 && <ArrowRight className="size-4 shrink-0 self-center text-label-3" aria-hidden />}
            </Fragment>
          ))}
        </ol>
      </Card>
      <Card
        flush
        title="Step-by-step"
        actions={
          <Link href="/issues/new" className="text-caption text-primary hover:underline">
            이 앱에서 재현하기
          </Link>
        }
      >
        <DataTable rowCount={SCENARIO_STEPS.length} columns={[{ label: "#", num: true }, { label: "단계" }, { label: "화면" }]}>
          {SCENARIO_STEPS.map(([s, screen], i) => (
            <tr key={i}>
              <td className="text-right text-caption text-muted-foreground tabular-nums">{i + 1}</td>
              <td className="whitespace-normal">{s}</td>
              <td className="font-mono text-caption text-muted-foreground">{screen}</td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}

function Tech() {
  const prdStack: [string, string][] = [
    ["언어", "Python 3.11"],
    ["앱", "Streamlit 단일 앱(S-001~S-004 4페이지), 별도 API 서버 없음. Pydantic으로 Agent 입출력 검증"],
    ["DB", "SQLite (Mock Project System) + Chroma (Knowledge 벡터DB)"],
    ["LLM·임베딩", "JSON 구조화 출력을 지원하는 LLM API 1종 + 임베딩 모델 1종. API 키는 환경변수로 관리"],
    ["실행·배포", "클라우드 개발환경(예: GitHub Codespaces). 발표 대비 저장된 결과 재생 모드와 시연 녹화본 준비"],
  ];
  const impl: [string, string][] = [
    ["UI", "Next.js 16 · 서비스 웹 디자인 시스템(네이비·오렌지 2색, 4pt, 8단계 타이포) 토큰"],
    ["백엔드", "Next API Routes · 상태는 서버 SQLite(sql.js) 한 벌, 쓰기는 복사본 작업 후 성공 시에만 저장"],
    ["AI", "재생 모드(SC-01) ↔ Claude API(구조화 출력). 3 Agent 순차 호출, Orchestrator 없음. 키는 서버 환경변수"],
    ["결정적 계산", "cost_model + rules 는 서버 코드(단위 테스트). LLM 출력의 숫자 · 없는 ID 는 경계에서 걸러냄"],
    ["롤백", "승인 반영 중 예외가 나면 저장하지 않음 (설정에서 실패 시뮬레이션 가능)"],
  ];
  return (
    <Grid>
      <Col span={6}>
        <Card flush title="기술 스택 (PRD)">
          <DataTable compact rowCount={prdStack.length} columns={[{ label: "항목" }, { label: "내용" }]}>
            {prdStack.map(([k, v]) => (
              <tr key={k}><td className="font-medium">{k}</td><td className="text-caption whitespace-normal text-muted-foreground">{v}</td></tr>
            ))}
          </DataTable>
        </Card>
        <Card flush title="이 웹 시스템의 구현">
          <DataTable compact rowCount={impl.length} columns={[{ label: "항목" }, { label: "내용" }]}>
            {impl.map(([k, v]) => (
              <tr key={k}><td className="font-medium">{k}</td><td className="text-caption whitespace-normal text-muted-foreground">{v}</td></tr>
            ))}
          </DataTable>
        </Card>
      </Col>
      <Col span={6}>
        <Card title="프로젝트 구조 (PRD · 폴더 = 업무 패키지)">
          <CodeBlock>{FOLDER_TREE}</CodeBlock>
        </Card>
        <Card title="비기능 요구사항">
          <ul className="list-disc space-y-1 pl-5">
            {NFRS.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Card>
      </Col>
      <Col span={12}>
        <Card
          flush
          title="데이터 모델"
          actions={
            <Link href="/rules?tab=schema" className="text-caption text-primary hover:underline">
              Agent 입출력 스키마 보기
            </Link>
          }
        >
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
  );
}

function DataTab() {
  const rows: [string, number, number, string][] = [
    ["Knowledge 근거 문서", 17, KNOWLEDGE.filter((d) => !d.distractor).length, "/knowledge?tab=docs"],
    ["방해 문서", 10, KNOWLEDGE.filter((d) => d.distractor).length, "/knowledge?tab=docs"],
    ["Mock DB 시드 엔티티", 5, 5, "/project"],
    ["판단 기준표", 1, 1, "/rules"],
    ["골드 질의", 20, GOLD_QUERIES.length, "/knowledge?tab=gold"],
    ["변형 시나리오", 5, VARIANT_SCENARIOS.length, "/knowledge?tab=variants"],
    ["비용 가정치", 1, 1, "/rules?tab=assumptions"],
  ];
  return (
    <Grid>
      <Col span={6}>
        <Card title="09 데이터 확보 방안">
          <KeyValues
            items={[
              ["필요한 데이터", "① Knowledge 근거 문서 17건 + 방해 문서 10건 ② Mock DB 시드(Release·Requirement·Task·Risk·Member) ③ 판단 기준표 ④ 검색 평가용 골드 질의 20개 ⑤ 변형 시나리오 5건 ⑥ 비용 가정치"],
              ["출처", "합성 데이터. LLM으로 초안을 만들고 팀원이 검수합니다. 문서 속 ID(REQ-045, T-210, Q-0812 등)는 Mock DB 시드와 정확히 일치시킵니다. 비용 가정치는 팀원 소속 업종의 현업 인터뷰로 보정합니다."],
              ["난이도", "중. 문서의 현실감과 문서·DB 간 정합성이 핵심입니다."],
              ["저작권·개인정보", "모든 문서와 데이터가 합성이라 저작권·개인정보·기밀 이슈가 없습니다. 인터뷰는 익명화한 수치만 씁니다."],
            ]}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card title="확보 현황">
          <ul className="divide-y divide-border">
            {rows.map(([label, target, have, href]) => (
              <li key={label} className="flex items-center gap-3 py-2.5">
                <Link href={href} className="min-w-0 flex-1 font-medium hover:underline">
                  {label}
                </Link>
                <span className="text-caption text-muted-foreground tabular-nums">
                  {have}/{target}
                </span>
                <Meter value={(have / target) * 100} className="w-24" />
              </li>
            ))}
          </ul>
          <p className="text-caption text-muted-foreground">여기 적재된 문서는 앱 구동용 초안(시드)입니다. WP1 산출물로 교체하면 벡터DB에 적재합니다.</p>
        </Card>
      </Col>
    </Grid>
  );
}

function phaseStatus(start: string, end: string, today: string) {
  return today > end ? "완료" : today >= start ? "진행" : "예정";
}

function Schedule() {
  const today = todayIso();
  return (
    <div className="space-y-6">
      <Card flush title="10 구현 방안 및 일정" caption={`오늘 ${today}`}>
        <DataTable rowCount={PHASES.length} columns={[{ label: "Phase" }, { label: "기간" }, { label: "목표" }, { label: "완료 조건" }, { label: "상태" }]}>
          {PHASES.map((p) => (
            <tr key={p.ph}>
              <td className="font-medium">{p.ph}</td>
              <td className="text-caption text-muted-foreground tabular-nums">{p.period}</td>
              <td className="whitespace-normal">{p.goal}</td>
              <td className="text-caption whitespace-normal text-muted-foreground">{p.done}</td>
              <td><StatusBadge status={phaseStatus(p.start, p.end, today)} /></td>
            </tr>
          ))}
        </DataTable>
      </Card>
      <Card title="협업 규칙">
        <ul className="list-disc space-y-1 pl-5">
          <li>패키지마다 담당자 1명을 정하고, 산출물과 기한을 표대로 지킵니다.</li>
          <li>문서·엑셀 양식은 PM과 WP4 담당이 먼저 배포합니다.</li>
          <li>산출물은 공유폴더에 올리면 WP4 담당이 앱에 넣습니다. Git을 쓰지 않아도 됩니다.</li>
          <li>주 1회 30분 싱크는 동작하는 화면을 보면서 진행합니다.</li>
        </ul>
      </Card>
    </div>
  );
}

function Todos({ ctx }: { ctx: WorkopsCtx }) {
  const { state, send } = ctx;
  const toast = useToast();
  const today = todayIso();
  const owners = TEAM.map((t) => t.name);

  async function update(no: string, patch: Partial<Pick<Todo, "owner" | "status">>, done: string) {
    try {
      await send("/api/workops/config/todo", { no, ...patch });
      toast(done);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-6">
      <Card flush title="업무 패키지" caption="중간발표(10/16) 피드백을 반영한 뒤 각자 맡을 것을 고릅니다">
        <DataTable rowCount={WORK_PACKAGES.length} columns={[{ label: "패키지" }, { label: "하는 일 요약" }, { label: "필요 역량" }, { label: "코딩" }, { label: "담당자" }, { label: "진행", num: true }]}>
          {WORK_PACKAGES.map((w) => {
            const ts = state.todos.filter((t) => t.wp === w.id);
            const done = ts.filter((t) => t.status === "완료").length;
            const own = [...new Set(ts.map((t) => t.owner).filter(Boolean))];
            return (
              <tr key={w.id}>
                <td className="font-medium">{w.id} {w.name}</td>
                <td className="whitespace-normal">{w.summary}</td>
                <td className="text-caption text-muted-foreground">{w.skill}</td>
                <td>{w.coding}</td>
                <td>{own.join(", ") || <span className="text-caption text-muted-foreground">미정</span>}</td>
                <td className={numCell}>
                  <span className="inline-flex items-center gap-2">
                    {done}/{ts.length}
                    <Meter value={ts.length ? (done / ts.length) * 100 : 0} className="w-[72px]" />
                  </span>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </Card>
      <Card
        flush
        title="세부 할 일"
        caption="담당자·상태는 서버에 저장되어 팀원이 함께 봅니다"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              downloadCsv("workops_todos.csv", [
                ["No", "패키지", "해야 할 일", "산출물", "공수", "기한", "담당자", "상태"],
                ...state.todos.map((t) => [t.no, t.wp, t.task, t.output, t.effort, t.due, t.owner, t.status]),
              ]);
              toast("CSV를 내려받았습니다");
            }}
          >
            <Download />
            CSV
          </Button>
        }
      >
        <DataTable compact rowCount={state.todos.length} columns={[{ label: "No" }, { label: "패키지" }, { label: "해야 할 일" }, { label: "산출물" }, { label: "공수", num: true }, { label: "기한", num: true }, { label: "담당자" }, { label: "상태" }]}>
          {state.todos.map((t) => {
            const late = t.status !== "완료" && t.due < today;
            return (
              <tr key={t.no}>
                <td className="font-mono text-caption text-muted-foreground">{t.no}</td>
                <td className="text-caption text-muted-foreground">{t.wp}</td>
                <td className="min-w-[280px] whitespace-normal">{t.task}</td>
                <td className="text-caption whitespace-normal text-muted-foreground">{t.output}</td>
                <td className={`${numCell} text-caption`}>{t.effort}</td>
                <td className={numCell}>
                  <span className="inline-flex items-center gap-2">
                    {t.due.slice(5).replace("-", "/")}
                    {late && <Badge tone="orange">지연</Badge>}
                  </span>
                </td>
                <td>
                  <NativeSelect
                    aria-label={`${t.no} 담당자`}
                    className="h-8 w-28"
                    value={t.owner}
                    onChange={(e) => void update(t.no, { owner: e.target.value }, "담당자를 저장했습니다")}
                  >
                    <option value="">미정</option>
                    {owners.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </NativeSelect>
                </td>
                <td>
                  <NativeSelect
                    aria-label={`${t.no} 상태`}
                    className="h-8 w-24"
                    value={t.status}
                    onChange={(e) => void update(t.no, { status: e.target.value as Todo["status"] }, "상태를 저장했습니다")}
                  >
                    {(["예정", "진행", "완료"] as const).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </NativeSelect>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </Card>
    </div>
  );
}
