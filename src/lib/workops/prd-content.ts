/** PRD v0.4 본문 — PRD·일정 화면이 그대로 보여 주는 내용 (조원, 기능, 일정, 업무 패키지, 프롬프트 등) */
import type { Todo } from "@/lib/workops/types";

export const TEAM = [
  { name: '이현정', org: 'LG전자(주)', role: 'PM · 통합' },
  { name: '한창진', org: '(주)인텍플러스', role: 'Agent & 판단 기준' },
  { name: '정규열', org: '삼성물산(주) 건설부문', role: '프로젝트 데이터 & 비용 분석' },
  { name: '임주원', org: '삼성물산(주) 패션부문 기획팀', role: '기획 · Knowledge · 발표' },
];
export const DOMAINS = [
  { ind: '전자 (기준 시나리오)', issue: '출시 4주 전 Critical 결함 → 출시 지연, 마케팅·유통·고객사 계약 영향', swap: '품질규정, 변경관리규정, 테스트 리포트, 과거 이슈' },
  { ind: '건설 (확장 예시)', issue: '준공 2개월 전 핵심 자재 품질 불량 → 공정 지연, 지체상금', swap: '시방서, 품질관리 기준, 과거 하자 사례, 공사 계약 조건' },
  { ind: '장비 (확장 예시)', issue: '고객 납품 3주 전 검사 성능 미달 → 납기 지연 페널티', swap: '장비 사양서, 고객 검수 기준, 과거 납품 이슈' },
  { ind: '패션 (확장 예시)', issue: '시즌 출시 3주 전 핵심 원단 품질 불량 → 매장 입고 지연, 시즌 판매 기회 손실', swap: '원단·봉제 품질 기준, 생산 일정표, 유통사 입고 계약, 과거 시즌 이슈' },
];
export const FEATURES = {
  P0: [
    ['이슈 접수', '제목·증상·심각도·모듈·릴리스를 등록하고 처리 타이머를 시작합니다.'],
    ['Knowledge 검색', '근거 문서 17건 + 방해 문서 10건을 검색하고 문서 ID·섹션 단위로 근거를 인용합니다.'],
    ['Analysis Agent', '원인 후보 최대 3개, 근거 강도(High/Med/Low), 유사 과거 이슈를 제시합니다.'],
    ['Impact Agent', 'Mock DB를 조회해 영향 Requirement·Task·크리티컬 패스·고객사 계약 조항과 방치 시 지연일을 산출합니다. 계산은 산식으로 하며 LLM이 숫자를 만들지 않습니다.'],
    ['Action Agent', '대응안 A/B/C의 내용과 파라미터(작업일, 축소 기능, 재발 확률)를 만들고, 변경요청서 초안과 담당자 추천을 생성합니다. 비용은 cost_model이 계산합니다.'],
    ['추천·에스컬레이션', '판단 기준에 따라 허용되지 않는 대응안을 걸러내고, 기대비용이 가장 낮은 안을 추천하며 근거(규정·계약·선례)를 표시합니다. 출시 연기 등은 상위 승인 필요 표시를 붙입니다.'],
    ['PM 승인', '대응안 선택·수정·승인과 승인 이력을 기록합니다. 승인 전에는 시스템에 반영하지 않습니다(Human-in-the-Loop).'],
    ['Mock System 반영', '승인 결과를 Issue·Task·Requirement·Release·Risk·Change Request에 반영합니다. 실패하면 롤백합니다.'],
    ['효과 기록', 'KPI 3개(대응 인건비 절감, 지연 비용 회피, 연간 순절감액)를 Before/After로 계산해 표시합니다.'],
  ],
  P1: [
    ['이슈 유형 확장', '공급 지연·리소스 부족·요구사항 변경 유형, 건설·장비·패션 도메인을 Knowledge·판단 기준 교체로 추가'],
    ['대응안 재생성', 'PM 코멘트를 반영해 Action Agent 재실행'],
    ['효과 리포트 내보내기', '건당·연간 절감액을 CSV로 내려받기'],
    ['알림 Agent', '승인 결과를 담당자에게 메신저·메일로 전달'],
  ],
  P2: [
    '실제 사내 시스템(Jira·Redmine 등) 연동. MVP는 Mock Project System만 사용',
    '별도 Orchestrator 컴포넌트와 병렬 Agent. 파이프라인 코드 안에서 순차 호출',
    '사용자 인증·권한, 다중 프로젝트·다중 사용자 동시 편집',
    '실제 회사 문서·기밀 데이터 사용. 모든 데이터는 합성',
    '승인 없는 자동 실행·자동 반영',
    '모델 파인튜닝. 프롬프트와 RAG로만 대응',
  ],
};
export const PHASES = [
  { ph: 'Phase 0', period: '10/12 ~ 10/15', goal: '중간발표 준비: PRD v0.3, PRD 기반 HTML 발표자료', done: '3분 발표 리허설 완료', start: '2026-10-12', end: '2026-10-15' },
  { ph: '중간발표', period: '10/16', goal: '무엇을·왜·돈(KPI 3개) 중심 3분 발표 + 2분 피드백', done: '-', start: '2026-10-16', end: '2026-10-16' },
  { ph: 'Phase 1', period: '10/17 ~ 10/25', goal: '피드백 반영 PRD v1.0, 업무 패키지 선택. 콘텐츠(문서·시드·기준표) 1차, 화면 4개 + 가짜 응답으로 끝까지 연결', done: 'SC-01이 끝까지 화면 이동, DB 반영·롤백 동작', start: '2026-10-17', end: '2026-10-25' },
  { ph: 'Phase 2', period: '10/26 ~ 11/1', goal: 'Agent 3개 실제 LLM 연결, 비용 계산·판단 기준 적용', done: '추천 B 재현, 근거 인용 표시', start: '2026-10-26', end: '2026-11-01' },
  { ph: 'Phase 3', period: '11/2 ~ 11/8', goal: 'E2E 1차 (실제 LLM), 현업 인터뷰', done: 'SC-01 접수→승인→반영→효과 기록 1회 완주', start: '2026-11-02', end: '2026-11-08' },
  { ph: 'Phase 4', period: '11/9 ~ 11/15', goal: '변형 시나리오 테스트·개선, Before 1회 수작업 측정', done: '변형 5건 중 4건 완주', start: '2026-11-09', end: '2026-11-15' },
  { ph: 'Phase 5', period: '11/16 ~ 11/22', goal: '효과 검증', done: 'After 측정 3회, KPI 3개 확정', start: '2026-11-16', end: '2026-11-22' },
  { ph: 'Phase 6', period: '11/23 ~ 11/29', goal: '최종 정리', done: '데모 영상, 최종 발표자료, 보고서', start: '2026-11-23', end: '2026-11-29' },
];
export const WORK_PACKAGES = [
  { id: 'WP1', name: '시나리오·Knowledge', summary: '시나리오에 쓰일 가상 문서와 평가 질문 만들기', skill: '문서 작성, 기획', coding: '없음' },
  { id: 'WP2', name: '프로젝트 데이터·비용', summary: '가상 프로젝트 데이터와 비용 계산 엑셀, 현업 인터뷰', skill: '엑셀, 원가·일정 감각', coding: '없음' },
  { id: 'WP3', name: 'Agent 판단 기준·프롬프트', summary: 'AI가 따를 판단 기준표와 지시문(프롬프트) 작성, 결과 검수', skill: '업무 규칙 정리, 글쓰기', coding: '없음' },
  { id: 'WP4', name: '앱 구현·통합', summary: 'AI 코딩 도구로 화면·Agent·계산을 연결하고 시연 준비', skill: 'AI 코딩 도구 사용', coding: '있음' },
  { id: 'WP5', name: '효과 검증·발표', summary: 'Before/After 측정, KPI 계산, 최종 발표자료·보고서', skill: '분석, 발표', coding: '없음' },
];
export const TODOS_SEED: Omit<Todo, "owner" | "status">[] = [
  { no: '1-1', wp: 'WP1', task: 'Knowledge 근거 문서 17건 작성 (제공 템플릿 + LLM 초안 → 검수). 문서 속 ID를 시드 데이터와 일치', output: '문서 17건 (.docx 또는 .md)', effort: '8~10시간', due: '2026-10-25' },
  { no: '1-2', wp: 'WP1', task: '방해 문서 10건 작성 (시나리오와 무관한 이슈·규정)', output: '문서 10건', effort: '3시간', due: '2026-10-25' },
  { no: '1-3', wp: 'WP1', task: '골드 질의 20개 작성 (질문 + 정답 문서·섹션)', output: '엑셀 1장', effort: '2시간', due: '2026-10-25' },
  { no: '1-4', wp: 'WP1', task: '변형 시나리오 5건 작성 (근거 부족 1~2건 포함)', output: '시나리오 5건', effort: '4시간', due: '2026-11-01' },
  { no: '2-1', wp: 'WP2', task: 'Mock 프로젝트 데이터 작성: 릴리스·요구사항·Task·리스크·담당자 (제공 양식)', output: '엑셀 시트 5장', effort: '4시간', due: '2026-10-25' },
  { no: '2-2', wp: 'WP2', task: '비용 가정치·대응안 비용 계산 엑셀 (11장 산식을 엑셀로 검증)', output: '엑셀 1개', effort: '3시간', due: '2026-10-25' },
  { no: '2-3', wp: 'WP2', task: '현업 인터뷰 3건 (각 사 1건: 이슈 대응 소요 기간, 투입 인원, 지연 비용)', output: '인터뷰 메모 + 가정치 보정안', effort: '4시간', due: '2026-11-08' },
  { no: '3-1', wp: 'WP3', task: '판단 기준표 작성 (근거 강도, 대응안 허용·추천·에스컬레이션)', output: '엑셀 1장 + 플레이북 PB-001', effort: '3시간', due: '2026-10-25' },
  { no: '3-2', wp: 'WP3', task: 'Agent 3종 지시문(프롬프트)과 기대 출력 예시 작성', output: '문서 3건', effort: '5시간', due: '2026-11-01' },
  { no: '3-3', wp: 'WP3', task: '변형 시나리오 실행 결과 검수 (체크리스트로 맞음/틀림 판정, 개선점 정리)', output: '검수 체크리스트', effort: '4시간', due: '2026-11-15' },
  { no: '4-1', wp: 'WP4', task: '클라우드 개발환경·저장소 준비, LLM API 키 설정', output: '실행 가능한 저장소', effort: '3시간', due: '2026-10-19' },
  { no: '4-2', wp: 'WP4', task: '화면 4개 + 가짜 응답으로 처음부터 끝까지 연결, 콘텐츠(WP1~3) 적재', output: '동작하는 앱', effort: '8시간', due: '2026-10-25' },
  { no: '4-3', wp: 'WP4', task: '검색·Agent·비용 계산·판단 기준 실제 연결', output: '동작하는 앱', effort: '10시간', due: '2026-11-08' },
  { no: '4-4', wp: 'WP4', task: '저장된 결과 재생 모드, 시연 녹화', output: '재생 모드 + 데모 영상', effort: '4시간', due: '2026-11-29' },
  { no: '5-1', wp: 'WP5', task: 'Before 1회 수작업 측정 (팀원 1명이 AI 없이 같은 자료로 SC-01을 처리하며 시간 측정)', output: '측정표', effort: '3~4시간', due: '2026-11-15' },
  { no: '5-2', wp: 'WP5', task: 'After 측정 3회 (앱 타이머·실행 로그) + KPI 3개 계산', output: '엑셀 1장', effort: '3시간', due: '2026-11-22' },
  { no: '5-3', wp: 'WP5', task: '최종 발표자료(HTML)·데모 스크립트·최종 보고서', output: '발표자료 + 보고서', effort: '8시간', due: '2026-11-29' },
];
export const PROMPTS = {
  analysis: `# Analysis Agent (prompts/analysis.md)
역할: 이슈의 원인 후보를 최대 3개 제시한다. 숫자를 만들지 않는다.
입력: issue(제목·증상·심각도·모듈·릴리스), 검색된 근거 문서(doc_id, section, snippet)
판단 기준(근거 강도):
- High: 서로 다른 유형의 문서 2건 이상이 직접 지지 + 재현 조건이 증상과 일치
- Med: 직접 근거 1건, 또는 간접 근거 2건
- Low: 유사 과거 이슈에서 유추한 것뿐
- 인용할 근거가 없으면 insufficient_evidence=true 로 표시하고 후보를 만들지 않는다.
출력: JSON only (AnalysisResult 스키마). 모든 cause 에 citations ≥ 1.`,
  impact: `# Impact Agent (prompts/impact.md)
역할: 영향 범위를 Mock DB 조회 결과와 계약 문서로 정리한다. 지연일·비용은 계산하지 않는다(코드가 함).
입력: issue, AnalysisResult, DB 조회(requirement/task/risk/release/contract)
출력: JSON only (ImpactResult 스키마). release_blocked 는 QP-001 Critical 0건 기준.`,
  action: `# Action Agent (prompts/action.md)
역할: 대응안 A(fix) / B(scope_cut) / C(delay)의 내용과 파라미터(work_days, scope_cut_req, recurrence_prob, rationale_docs)를 만든다.
비용·허용 여부·추천·에스컬레이션은 cost_model + rules 가 계산하므로 생성하지 않는다.
추가 출력: change_request_draft(title, reason, impact, approval_request), suggested_owners(task, member_id, reason — ORG-001 근거).
출력: JSON only (ActionResult 스키마).`,
};
export const SCHEMAS = `AnalysisResult
├─ issue_id
├─ causes: list (≤3)
│   └─ rank, label, evidence_strength(High|Med|Low),
│      citations: [{doc_id, section, snippet}] (≥1 필수)
├─ similar_issues: [{issue_id, summary, resolution}]
└─ insufficient_evidence: bool

ImpactResult            ← 대응안 비용은 여기서 계산하지 않음
├─ affected_requirements, affected_tasks, critical_path_tasks, affected_risks
├─ contract_terms: [{clause, penalty, required_features}]
├─ release_blocked: bool (QP-001: Critical 0건 기준)
└─ baseline: {fix_and_verify_days, buffer_days, delay_if_untreated}

ActionResult            ← LLM은 내용·파라미터만 생성
├─ options: [{option_id, type, title, description,
│             work_days, scope_cut_req, recurrence_prob, rationale_docs}]
├─ change_request_draft: {title, reason, impact, approval_request}
└─ suggested_owners: [{task, member_id, reason}]

cost_model + rules (코드, 결정적)
├─ option_costs: [{option_id, delay_days, delay_cost, opportunity_loss,
│                   follow_up_cost, recurrence_loss, expected_cost}]
├─ allowed / blocked_reason, escalation
└─ recommended_option, recommendation_reason`;
export const DATA_MODEL = [
  ['Release', 'id, name, due_date, buffer_days, contract_id', '출시일·계약 연결'],
  ['Requirement', 'id(REQ-045), title, priority(P0/P1/P2), contract_required(bool), status(정상/변경/이월), release_id', '기능 축소 허용 여부 판단'],
  ['Task', 'id(T-210), title, owner_id, start, end, status(예정/진행/완료), on_critical_path, requirement_id', ''],
  ['Issue', 'id(Q-1024), title(≤100), description, severity, module, status(접수/분석중/승인대기/대응중/종료), release_id, created_at, approved_at', ''],
  ['Risk', 'id(R-07), title, likelihood(H/M/L), impact(H/M/L), status, related_req_id, owner_id', 'S-004 Risk 탭'],
  ['Member', 'id, name, role, modules, current_load(%)', '담당자 추천 근거'],
  ['ResponseOption', 'issue_id, option_id(A/B/C), type(fix/scope_cut/delay), work_days, scope_cut_req, recurrence_prob, 비용 항목별, expected_cost, allowed, escalation', 'Action 산출 + cost_model 계산'],
  ['ChangeRequest', 'id, issue_id, option_id, title, reason, impact, status(초안/승인)', ''],
  ['DecisionLog', 'id, issue_id, ai_recommended, pm_selected, override_reason, decided_at', ''],
  ['AgentRun', 'id, issue_id, agent, started_at, ended_at, tokens, llm_cost_krw, status', 'LLM 비용(KPI ①) 집계'],
  ['CostAssumption', 'key, value, unit, note', 'assumptions.yaml 에서 적재'],
  ['EffectRecord', 'issue_id, decision_days_before/after, manhours_before/after, labor_cost_before/after, llm_cost, delay_cost_avoided', 'KPI 3개 계산'],
  ['KnowledgeDoc', 'doc_id, doc_type, product, module, severity, section', '벡터DB 메타데이터'],
];
export const FOLDER_TREE = `workops-agent/
├─ app/            # Streamlit UI (S-001 ~ S-004)            ← WP4
├─ agents/         # analysis.py impact.py action.py pipeline.py ← WP4
├─ prompts/        # analysis.md impact.md action.md          ← WP3 (문서)
├─ rules/          # rules.yaml (판단 기준, 엑셀에서 변환)      ← WP3 (엑셀)
├─ knowledge/      # docs/*.md ingest.py search.py            ← docs: WP1
│  └─ eval/        # gold_queries, variants (변형 시나리오 5건) ← WP1
├─ mock_system/    # db.py models.py apply_decision.py        ← WP4
│  └─ seed/        # release/requirement/task/risk/member.csv ← WP2 (엑셀)
├─ cost/           # cost_model.py assumptions.yaml            ← 가정치: WP2
├─ tests/          # cost, apply_decision, rules 우선
└─ PRD.md`;
export const NFRS = [
  '이슈 입력~대응안 제시 응답 시간 ≤ 2분',
  '모든 원인 후보에 근거 문서 ≥ 1건 인용',
  '지연일·비용·추천은 코드로 계산. LLM이 숫자를 만들지 않음',
  'PM 승인 전 Mock DB 변경 0건, 반영 실패 시 롤백',
  '건당 LLM 비용 ≤ 1,000원',
  '단위 테스트: 비용 계산, 판단 규칙, 승인 반영 우선',
  '실제 회사 데이터 미사용, API 키는 저장소에 커밋하지 않음, 오픈소스 라이선스만 사용',
];
