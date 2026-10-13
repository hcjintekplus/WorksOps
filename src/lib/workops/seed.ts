/**
 * 시드 데이터 — PRD v0.4 의 합성 데이터 (Mock Project System · Knowledge 27건 · 판단 기준 · 비용 가정치).
 * 모든 수치와 문서는 합성 가정치이다. 문서 속 ID 는 Mock DB 시드와 정확히 일치해야 한다(PRD 09장).
 */
import type { Assumptions, KnowledgeDoc, ProjectDb, Rules } from "@/lib/workops/types";

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  hourly_rate:        { value: 50000,      unit: '원/시간', note: '시간당 인건비 (fully-loaded)' },
  hours_per_day:      { value: 8,          unit: '시간',    note: '1일 = 1영업일' },
  days_per_month:     { value: 20,         unit: '영업일',  note: '1개월 = 20영업일' },
  headcount:          { value: 100,        unit: '명',      note: '출시 투입 인원' },
  external_cost_day:  { value: 10000000,   unit: '원/일',   note: '마케팅·유통·계약 페널티 (외부 비용)' },
  daily_delay_cost:   { value: 50000000,   unit: '원/일',   note: '일 지연 비용 = 100명×8h×5만 + 외부 1,000만' },
  buffer_days:        { value: 5,          unit: '영업일',  note: '출시 버퍼 (릴리스 계획서)' },
  before_decision_days:{ value: 5,         unit: '영업일',  note: 'Before 대응안 확정 기간 (탐색·회의·문서화)' },
  after_decision_days:{ value: 1,          unit: '영업일',  note: 'After 대응안 확정 기간 (보수적)' },
  before_manhours:    { value: 120,        unit: '인시',    note: 'Before 투입 10명×12시간' },
  after_manhours:     { value: 30,         unit: '인시',    note: 'After 투입 10명×3시간' },
  issues_per_year:    { value: 20,         unit: '건/년',   note: '1개 프로젝트팀 연 주요 이슈' },
  schedule_issues_per_year:{ value: 4,     unit: '건/년',   note: '그중 출시 일정 영향 이슈' },
  annual_opex:        { value: 50000000,   unit: '원/년',   note: 'LLM·클라우드·유지보수' },
  llm_cost_per_run:   { value: 10000,      unit: '원/건',   note: 'LLM 비용 가정 (실측 전)' },
  recurrence_loss_days:{ value: 5,         unit: '일',      note: '재발 시 손실 = 5일 × 일 지연 비용' },
  // 기능 축소안의 기회손실 · 후속 비용은 CG-001 §2 산정법에 따른 가정치다. LLM 이 만들지 않는다.
  scope_cut_opportunity_loss:{ value: 100000000, unit: '원', note: '기능 축소 기회손실 (CG-001 §2, 미제공 4주)' },
  scope_cut_follow_up_cost:{ value: 20000000,  unit: '원',   note: '기능 축소 후속 업데이트 배포 비용' },
  llm_krw_per_1k_input:{ value: 4,         unit: '원/1k 토큰', note: 'LLM 입력 단가 (실제 단가로 교체)' },
  llm_krw_per_1k_output:{ value: 20,       unit: '원/1k 토큰', note: 'LLM 출력 단가 (실제 단가로 교체)' },
};

/* ---------- 판단 기준 (rules.yaml) ---------- */
export const DEFAULT_RULES: Rules = {
  evidence: [
    { level: 'High', rule: '서로 다른 유형의 문서 2건 이상이 직접 지지하고, 재현 조건이 증상과 일치' },
    { level: 'Med',  rule: '직접 근거 1건, 또는 간접 근거 2건' },
    { level: 'Low',  rule: '유사 과거 이슈에서 유추한 것뿐' },
    { level: '근거 부족', rule: '검색 유사도가 임계값 미만이거나 인용할 근거 없음 → "확인 필요"' },
  ],
  gate: [
    { id: 'G1', rule: 'Critical이 남은 채 출시하는 안 금지', ref: 'QP-001' },
    { id: 'G2', rule: '기능 축소: 대상 REQ가 P0가 아니고 고객사 계약 필수 기능이 아닐 때만', ref: 'CT-001' },
    { id: 'G3', rule: '근본 수정 추천: 1순위 원인 High일 때만', ref: 'PB-001' },
  ],
  recommend: [
    { id: 'R1', rule: '허용된 안 중 기대비용 최소' },
    { id: 'R2', rule: '차이 10% 이내면 리스크 낮은 안', param: 0.10 },
  ],
  escalate: [
    { id: 'E1', rule: '출시 연기 → 사업부장 승인 필요', ref: 'CM-001' },
    { id: 'E2', rule: '기대비용 ≥ 5억원 → 사업부장 승인 필요', ref: 'CM-001', param: 500000000 },
  ],
  similarity_threshold: 0.62,
};

/* ---------- Mock Project System 시드 (release/requirement/task/risk/member) ---------- */
export const SEED: ProjectDb = {
  releases: [
    { id: 'REL-HUB20', name: 'Smart Home Hub 2.0', due_date: '2026-11-09', buffer_days: 5, contract_id: 'CT-001', status: '진행', d_minus: 28 },
  ],
  requirements: [
    { id: 'REQ-045', title: '자동 다중 연결 (동시 10대)', priority: 'P1', contract_required: false, status: '정상', release_id: 'REL-HUB20' },
    { id: 'REQ-012', title: '허브 초기 페어링', priority: 'P0', contract_required: true, status: '정상', release_id: 'REL-HUB20' },
    { id: 'REQ-030', title: '음성 비서 연동', priority: 'P0', contract_required: true, status: '정상', release_id: 'REL-HUB20' },
    { id: 'REQ-058', title: '에너지 사용량 리포트', priority: 'P2', contract_required: false, status: '정상', release_id: 'REL-HUB20' },
    { id: 'REQ-061', title: '앱 다크 모드', priority: 'P2', contract_required: false, status: '정상', release_id: 'REL-HUB20' },
  ],
  tasks: [
    { id: 'T-210', title: '연결 모듈 안정화 (FW 1.2.x)', owner_id: 'M-02', start: '2026-10-05', end: '2026-10-16', status: '진행', on_critical_path: true, requirement_id: 'REQ-045' },
    { id: 'T-215', title: '시스템 통합 테스트 2차', owner_id: 'M-03', start: '2026-10-13', end: '2026-10-23', status: '예정', on_critical_path: true, requirement_id: 'REQ-045' },
    { id: 'T-220', title: '출시 마케팅 캠페인 소재 확정', owner_id: 'M-05', start: '2026-10-13', end: '2026-10-20', status: '진행', on_critical_path: false, requirement_id: null },
    { id: 'T-230', title: '유통사 입고 물류 예약', owner_id: 'M-06', start: '2026-10-20', end: '2026-10-27', status: '예정', on_critical_path: true, requirement_id: null },
    { id: 'T-198', title: '음성 비서 인증 테스트', owner_id: 'M-03', start: '2026-09-28', end: '2026-10-09', status: '완료', on_critical_path: false, requirement_id: 'REQ-030' },
  ],
  risks: [
    { id: 'R-07', title: '다중 연결 안정성 미확보로 출시 지연', likelihood: 'H', impact: 'H', status: '열림', related_req_id: 'REQ-045', owner_id: 'M-01' },
    { id: 'R-03', title: '유통사 입고일 지연 시 페널티', likelihood: 'M', impact: 'H', status: '열림', related_req_id: null, owner_id: 'M-06' },
    { id: 'R-11', title: '앱 스토어 심사 지연', likelihood: 'L', impact: 'M', status: '열림', related_req_id: null, owner_id: 'M-05' },
  ],
  members: [
    { id: 'M-01', name: '김PM', role: 'PM', modules: ['전체'], current_load: 85 },
    { id: 'M-02', name: '박개발', role: '개발 리드', modules: ['기기 연결', 'FW'], current_load: 70 },
    { id: 'M-03', name: '이QA', role: 'QA 리드', modules: ['시스템 테스트', '회귀'], current_load: 60 },
    { id: 'M-04', name: '최FW', role: 'FW 엔지니어', modules: ['통신 스택'], current_load: 90 },
    { id: 'M-05', name: '정마케팅', role: '마케팅', modules: ['출시 캠페인'], current_load: 50 },
    { id: 'M-06', name: '한물류', role: '유통·물류', modules: ['입고'], current_load: 40 },
    { id: 'M-07', name: '오영업', role: '영업', modules: ['고객사 계약'], current_load: 55 },
  ],
  contracts: [
    { id: 'CT-001', buyer: '대형 유통사', delivery_date: '2026-11-12', penalty_per_day: 10000000, required_features: ['REQ-012', 'REQ-030'] },
  ],
  issues: [
    { id: 'Q-0812', title: '통신 설정값 오류로 간헐 연결 끊김', description: '초기 페어링 후 설정값 롤백으로 해결', severity: 'Major', module: '기기 연결', status: '종료', release_id: 'REL-HUB20', created_at: '2026-08-12T09:00:00', approved_at: '2026-08-18T15:00:00', selected_option: 'A', ai_recommended: 'A' },
  ],
};

/* ---------- Knowledge 문서 (근거 17 + 방해 10) ---------- */
export const KNOWLEDGE: KnowledgeDoc[] = [
  { doc_id: 'QP-001', doc_type: '품질규정', product: '공통', module: '-', severity: '-', title: '품질규정', must: '심각도 정의, Critical 0건이어야 출시 가능, 재검증 범위, 예외 승인 절차', agents: ['Analysis', 'Action'], sections: { '3.1': 'Critical: 핵심 기능 불가 또는 기기 재부팅·데이터 손실을 유발하는 결함. Critical 결함이 1건이라도 남아 있는 상태에서는 출시할 수 없다.', '4.2': '근본 수정 후에는 영향 모듈 전체 회귀 검증을 수행한다.', '5.1': '예외 출시는 사업부장 승인과 QA 리드 서명이 필요하다.' } },
  { doc_id: 'CM-001', doc_type: '변경관리규정', product: '공통', module: '-', severity: '-', title: '변경관리규정', must: '변경요청서 필수 항목, 기능 축소·이월 절차, 출시 연기는 사업부장 승인', agents: ['Action'], sections: { '2.1': '변경요청서는 제목·사유·영향 범위·승인 요청 사항을 필수로 포함한다.', '3.3': '기능 축소·이월은 PM 승인으로 처리하며 요구사항 상태를 "이월"로 변경한다.', '4.1': '출시 연기 또는 기대비용 5억원 이상 변경은 사업부장 승인을 받아야 한다.' } },
  { doc_id: 'CT-001', doc_type: '계약 요약', product: 'Hub 2.0', module: '-', severity: '-', title: '고객사(유통사) 계약 요약', must: '입고일, 납기 지연 페널티(일 단위), 계약상 필수 기능 목록', agents: ['Impact', 'Action'], sections: { '1': '입고일 2026-11-12. 입고 지연 시 일 1,000만원 페널티.', '2': '필수 기능: REQ-012 허브 초기 페어링, REQ-030 음성 비서 연동. 자동 다중 연결(REQ-045)은 필수 기능 목록에 포함되지 않는다.' } },
  { doc_id: 'RP-HUB20', doc_type: '릴리스 계획서', product: 'Hub 2.0', module: '-', severity: '-', title: '릴리스 계획서', must: '출시일, 마일스톤, 버퍼 5영업일, 기능 목록(REQ-045 포함), 마케팅·유통 일정', agents: ['Impact'], sections: { '2': '출시일 2026-11-09. 최종 검증 완료 목표 D-10. 출시 버퍼 5영업일.', '3': '기능 목록: REQ-012, REQ-030, REQ-045, REQ-058, REQ-061.', '4': '마케팅 캠페인 집행 D-14. 유통사 입고 D+3.' } },
  { doc_id: 'SRS-HUB20', doc_type: '요구사항 발췌', product: 'Hub 2.0', module: '기기 연결', severity: '-', title: '요구사항 발췌', must: 'REQ-045 자동 다중 연결, 변경 이력(동시 5→10대), 우선순위 P1', agents: ['Analysis'], sections: { 'REQ-045': '허브는 IoT 기기를 자동으로 다중 연결한다. 우선순위 P1.', '변경이력 v1.3': '2026-08-20 동시 연결 대수 5대 → 10대로 상향. FW 설정값(max_queue) 반영 여부는 확인되지 않음.' } },
  { doc_id: 'SDD-HUB', doc_type: '설계 발췌', product: 'Hub 2.0', module: '기기 연결', severity: '-', title: '연결 모듈 설계 발췌', must: '통신 스택 구조, 연결 대기열, 버퍼 크기 설정값', agents: ['Analysis'], sections: { '3.2': '연결 요청은 connection_queue에 적재되며 max_queue(기본 5) 초과 시 워치독이 재시작을 트리거한다.', '3.4': '버퍼 크기는 FW 설정 파일 conn.cfg 에서 읽는다.' } },
  { doc_id: 'CHG-123', doc_type: 'FW 변경 이력', product: 'Hub 2.0', module: 'FW', severity: '-', title: 'FW 1.2.3 변경 이력', must: '통신 라이브러리 버전 업데이트', agents: ['Analysis'], sections: { '1': 'FW 1.2.3 (2026-09-30): 통신 라이브러리 libconn 2.4 → 2.6 업데이트. 연결 대기열 처리 방식 변경(동기→비동기).', '2': '회귀 범위: 단일 연결 시나리오만 수행.' } },
  { doc_id: 'TR-0921', doc_type: '테스트 리포트', product: 'Hub 2.0', module: '기기 연결', severity: 'Critical', title: '시스템 테스트 리포트', must: '8대 이상 연속 연결 시 재부팅, 재현율 5/20', agents: ['Analysis'], sections: { '4.3': '8대 이상 IoT 기기를 30초 이내 연속 연결 시 허브 재부팅. 재현율 5/20. FW 1.2.3에서만 발생, 1.2.2에서는 미발생.' } },
  { doc_id: 'TR-REG', doc_type: '회귀 테스트 커버리지', product: 'Hub 2.0', module: '시스템 테스트', severity: '-', title: '회귀 테스트 커버리지', must: '다중 연결 회귀 케이스 없음', agents: ['Analysis'], sections: { '2': '회귀 스위트 142건 중 다중 연결(5대 이상) 케이스 0건.' } },
  { doc_id: 'Q-0812', doc_type: '과거 이슈', product: 'Hub 1.x', module: '기기 연결', severity: 'Major', title: '과거 이슈 Q-0812', must: '통신 설정값 오류, 롤백으로 해결 (가장 유사)', agents: ['Analysis'], sections: { '요약': '통신 설정값 오류로 간헐 연결 끊김. 설정값 롤백으로 2일 내 해결. 출시 영향 없음.' } },
  { doc_id: 'Q-0655', doc_type: '과거 이슈', product: 'Hub 1.x', module: 'FW', severity: 'Critical', title: '과거 이슈 Q-0655', must: '근본 수정 후 출시했으나 1회 재발', agents: ['Action'], sections: { '요약': '근본 수정 후 출시, 출시 3주 뒤 동일 증상 1회 재발. 핫픽스 배포 비용 발생.' } },
  { doc_id: 'Q-0590', doc_type: '과거 이슈', product: 'Hub 1.x', module: '앱', severity: 'Critical', title: '과거 이슈 Q-0590', must: '출시 직전 기능을 끄고 출시, 후속 업데이트로 복구, VOC 영향 경미', agents: ['Action'], sections: { '요약': '출시 직전 P1 기능을 비활성화하고 정시 출시. 4주 후 업데이트로 복구. VOC 12건, 평점 영향 없음.' } },
  { doc_id: 'Q-0703', doc_type: '과거 이슈', product: 'Hub 1.x', module: '-', severity: 'Critical', title: '과거 이슈 Q-0703', must: '출시 1개월 연기, 실제 손실 규모', agents: ['Action'], sections: { '요약': '출시 1개월 연기. 인건비 8억, 마케팅 재집행·유통 페널티 2억 등 총 10억원 손실.' } },
  { doc_id: 'Q-0901', doc_type: '과거 이슈', product: 'Hub 2.0', module: '기기 연결', severity: 'Major', title: '과거 이슈 Q-0901', must: '요구사항 변경이 FW에 미반영', agents: ['Analysis'], sections: { '요약': '요구사항 변경(타임아웃 값)이 FW 설정에 반영되지 않아 테스트 실패. 설정 동기화 절차 부재.' } },
  { doc_id: 'CG-001', doc_type: '비용 가이드', product: '공통', module: '-', severity: '-', title: '지연 비용 산정 가이드', must: '일 지연 비용 5,000만원 구성, 기능 축소 기회손실 산정법', agents: ['Impact', 'cost'], sections: { '1': '일 지연 비용 = 투입 인력 비용(100명×8h×5만=4,000만) + 외부 비용 1,000만 = 5,000만원.', '2': '기능 축소 기회손실 = 해당 기능 기여 매출 추정 × 미제공 기간 비율. 후속 업데이트 비용 별도.' } },
  { doc_id: 'PB-001', doc_type: '플레이북', product: '공통', module: '-', severity: '-', title: '이슈 대응 플레이북', must: '대응안 유형별 적용 조건 (판단 기준을 문서화)', agents: ['Action'], sections: { '1': '근본 수정(fix): 1순위 원인 근거가 High이고 버퍼 내 재검증 가능할 때.', '2': '기능 축소(scope_cut): 대상 요구사항이 P0가 아니고 계약 필수 기능이 아닐 때. 후속 업데이트 계획 필수.', '3': '출시 연기(delay): 위 두 안이 모두 불가할 때. 사업부장 승인.' , '4': '추천: 허용된 안 중 기대비용 최소. 차이 10% 이내면 리스크 낮은 안.' } },
  { doc_id: 'ORG-001', doc_type: '조직 R&R', product: '공통', module: '-', severity: '-', title: '조직 R&R', must: '모듈별 담당 리드, 승인 권한', agents: ['Action'], sections: { '1': '기기 연결·FW: 개발 리드 박개발. 시스템 테스트·회귀: QA 리드 이QA.', '2': '승인 권한: 기능 축소·이월 PM, 출시 연기 사업부장.' } },
  // 방해 문서 D-01 ~ D-10
  { doc_id: 'D-01', doc_type: '과거 이슈', product: 'Hub 2.0', module: '앱', severity: 'Minor', title: '앱 설정 화면 글자 겹침', must: '방해 문서', agents: [], distractor: true, sections: { '요약': '앱 설정 화면에서 긴 기기 이름이 겹쳐 표시됨.' } },
  { doc_id: 'D-02', doc_type: '품질규정', product: 'Air Purifier 3', module: '-', severity: '-', title: '공기청정기 품질규정', must: '방해 문서', agents: [], distractor: true, sections: { '1': '필터 교체 주기 테스트 기준.' } },
  { doc_id: 'D-03', doc_type: '테스트 리포트', product: 'Hub 2.0', module: '전원', severity: 'Major', title: '전원 어댑터 발열 리포트', must: '방해 문서', agents: [], distractor: true, sections: { '1': '장시간 사용 시 어댑터 표면 온도 48°C.' } },
  { doc_id: 'D-04', doc_type: '요구사항 발췌', product: 'Hub 2.0', module: '앱', severity: '-', title: 'REQ-061 앱 다크 모드', must: '방해 문서', agents: [], distractor: true, sections: { 'REQ-061': '앱은 시스템 다크 모드를 따른다. P2.' } },
  { doc_id: 'D-05', doc_type: '릴리스 계획서', product: 'Air Purifier 3', module: '-', severity: '-', title: '공기청정기 3 릴리스 계획', must: '방해 문서', agents: [], distractor: true, sections: { '1': '출시일 2027-02-01.' } },
  { doc_id: 'D-06', doc_type: '과거 이슈', product: 'Hub 1.x', module: '음성', severity: 'Major', title: '음성 비서 오인식', must: '방해 문서', agents: [], distractor: true, sections: { '요약': '특정 억양에서 웨이크워드 오인식률 증가.' } },
  { doc_id: 'D-07', doc_type: '변경 이력', product: 'Hub 2.0', module: '앱', severity: '-', title: '앱 3.1 변경 이력', must: '방해 문서', agents: [], distractor: true, sections: { '1': '앱 UI 라이브러리 업데이트.' } },
  { doc_id: 'D-08', doc_type: '계약 요약', product: 'Air Purifier 3', module: '-', severity: '-', title: '공기청정기 유통 계약', must: '방해 문서', agents: [], distractor: true, sections: { '1': '입고일 2027-02-05.' } },
  { doc_id: 'D-09', doc_type: '설계 발췌', product: 'Hub 2.0', module: '에너지', severity: '-', title: '에너지 리포트 모듈 설계', must: '방해 문서', agents: [], distractor: true, sections: { '1': '전력 사용량은 1분 단위로 집계.' } },
  { doc_id: 'D-10', doc_type: '조직 R&R', product: 'Air Purifier 3', module: '-', severity: '-', title: '공기청정기 조직 R&R', must: '방해 문서', agents: [], distractor: true, sections: { '1': '필터 모듈 담당 리드.' } },
];

export const CAUSE_MATRIX = [
  { cause: '① 라이브러리 업데이트로 대기열 초과', direct: 'CHG-123, TR-0921', support: 'SDD-HUB, Q-0812', target: 'High' },
  { cause: '② 동시 연결 요구사항 변경 미반영', direct: 'SRS-HUB20', support: 'Q-0901', target: 'Med' },
  { cause: '③ 회귀 테스트 누락', direct: 'TR-REG', support: 'QP-001', target: 'Med' },
];

export const GOLD_QUERIES = [
  { q: '여러 기기 연속 연결 시 허브 재부팅 재현 조건', doc: 'TR-0921', section: '4.3' },
  { q: 'FW 1.2.3에서 바뀐 통신 라이브러리', doc: 'CHG-123', section: '1' },
  { q: '연결 대기열 최대 크기 설정', doc: 'SDD-HUB', section: '3.2' },
  { q: '동시 연결 대수 요구사항 변경 이력', doc: 'SRS-HUB20', section: '변경이력 v1.3' },
  { q: '다중 연결 회귀 테스트 케이스 유무', doc: 'TR-REG', section: '2' },
  { q: 'Critical 결함이 남아 있을 때 출시 가능 여부', doc: 'QP-001', section: '3.1' },
  { q: '출시 연기 승인 권한', doc: 'CM-001', section: '4.1' },
  { q: '계약상 필수 기능 목록', doc: 'CT-001', section: '2' },
  { q: '입고 지연 페널티 금액', doc: 'CT-001', section: '1' },
  { q: '출시 버퍼 영업일', doc: 'RP-HUB20', section: '2' },
  { q: '일 지연 비용 구성', doc: 'CG-001', section: '1' },
  { q: '기능 축소 기회손실 산정법', doc: 'CG-001', section: '2' },
  { q: '기능을 끄고 출시한 과거 사례', doc: 'Q-0590', section: '요약' },
  { q: '근본 수정 후 재발한 사례', doc: 'Q-0655', section: '요약' },
  { q: '출시 1개월 연기 실제 손실', doc: 'Q-0703', section: '요약' },
  { q: '요구사항 변경이 FW에 미반영된 사례', doc: 'Q-0901', section: '요약' },
  { q: '통신 설정값 롤백으로 해결한 이슈', doc: 'Q-0812', section: '요약' },
  { q: '기능 축소 적용 조건', doc: 'PB-001', section: '2' },
  { q: '기기 연결 모듈 담당 리드', doc: 'ORG-001', section: '1' },
  { q: '변경요청서 필수 항목', doc: 'CM-001', section: '2.1' },
];

export const VARIANT_SCENARIOS = [
  { id: 'V-01', title: '동일 증상, FW 1.2.2 (라이브러리 변경 없음)', purpose: '원인 ① 근거 약화 → ② 순위 상승', evidence: '정상', status: '작성 예정' },
  { id: 'V-02', title: 'REQ-045가 계약 필수 기능인 경우', purpose: 'Gate G2로 B 차단 → A 추천', evidence: '정상', status: '작성 예정' },
  { id: 'V-03', title: '테스트 리포트 없음 (근거 부족)', purpose: '"근거 부족 · 확인 필요" 동작 시연', evidence: '의도적 결손', status: '작성 예정' },
  { id: 'V-04', title: '버퍼 10영업일, 작업일 11일', purpose: '지연일 0 → A 기대비용 변화', evidence: '정상', status: '작성 예정' },
  { id: 'V-05', title: '유사 과거 이슈만 존재', purpose: '근거 강도 Low 판정 + 인용 1건 이상 유지', evidence: '의도적 결손', status: '작성 예정' },
];
