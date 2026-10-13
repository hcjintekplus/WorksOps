/**
 * AI WorkOps Agent 도메인 타입 (PRD v0.4 08장 데이터 모델 · Agent 입출력 스키마).
 * Mock Project System 의 엔티티와 Agent 3종의 입출력, cost_model · rules 결과를 정의한다.
 */

export type Severity = "Critical" | "Major" | "Minor";
export type IssueStatus = "접수" | "분석중" | "승인대기" | "대응중" | "종료";
export type EvidenceStrength = "High" | "Med" | "Low";
export type OptionType = "fix" | "scope_cut" | "delay";
export type RiskLevel = "Low" | "Medium" | "High";
export type HML = "H" | "M" | "L";

export type Release = {
  id: string;
  name: string;
  due_date: string;
  buffer_days: number;
  contract_id: string;
  status: string;
  d_minus: number;
};

export type Requirement = {
  id: string;
  title: string;
  priority: "P0" | "P1" | "P2";
  contract_required: boolean;
  status: "정상" | "변경" | "이월";
  release_id: string;
};

export type Task = {
  id: string;
  title: string;
  owner_id: string;
  start: string;
  end: string;
  status: "예정" | "진행" | "완료";
  on_critical_path: boolean;
  requirement_id: string | null;
};

export type Risk = {
  id: string;
  title: string;
  likelihood: HML;
  impact: HML;
  status: string;
  related_req_id: string | null;
  owner_id: string;
};

export type Member = { id: string; name: string; role: string; modules: string[]; current_load: number };

export type Contract = {
  id: string;
  buyer: string;
  delivery_date: string;
  penalty_per_day: number;
  required_features: string[];
};

export type Issue = {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  module: string;
  status: IssueStatus;
  release_id: string;
  created_at: string;
  approved_at: string | null;
  selected_option?: string;
  ai_recommended?: string;
  /** 시연용: 근거 부족 동작 (변형 시나리오 V-03) */
  simulate?: "insufficient";
};

export type ProjectDb = {
  releases: Release[];
  requirements: Requirement[];
  tasks: Task[];
  risks: Risk[];
  members: Member[];
  contracts: Contract[];
  issues: Issue[];
};

export type KnowledgeDoc = {
  doc_id: string;
  doc_type: string;
  product: string;
  module: string;
  severity: string;
  title: string;
  must: string;
  agents: string[];
  distractor?: boolean;
  sections: Record<string, string>;
};

export type Assumption = { value: number; unit: string; note: string };
export type Assumptions = Record<string, Assumption>;

export type Rules = {
  evidence: { level: string; rule: string }[];
  gate: { id: string; rule: string; ref: string }[];
  recommend: { id: string; rule: string; param?: number }[];
  escalate: { id: string; rule: string; ref: string; param?: number }[];
  similarity_threshold: number;
};

/* ---------- Agent 입출력 ---------- */

export type Usage = { input_tokens: number; output_tokens: number };

export type Citation = { doc_id: string; section: string; snippet: string };

export type Cause = { rank: number; label: string; evidence_strength: EvidenceStrength; citations: Citation[] };

export type AnalysisResult = {
  issue_id: string;
  causes: Cause[];
  similar_issues: { issue_id: string; summary: string; resolution: string }[];
  insufficient_evidence: boolean;
};

export type ImpactResult = {
  issue_id: string;
  affected_requirements: string[];
  affected_tasks: string[];
  critical_path_tasks: string[];
  affected_risks: string[];
  contract_terms: { clause: string; penalty: number; required_features: string[] }[];
  release_blocked: boolean;
  baseline: { fix_and_verify_days: number; buffer_days: number; delay_if_untreated: number };
};

/** LLM 은 내용 · 파라미터만 만든다. 비용은 cost_model 이 계산한다. */
export type ActionOption = {
  option_id: string;
  type: OptionType;
  title: string;
  description: string;
  work_days: number;
  scope_cut_req: string | null;
  recurrence_prob: number;
  risk: RiskLevel;
  rationale_docs: string[];
};

export type ChangeRequestDraft = { title: string; reason: string; impact: string; approval_request: string };

export type ActionResult = {
  issue_id: string;
  options: ActionOption[];
  change_request_draft: ChangeRequestDraft;
  suggested_owners: { task: string; member_id: string; reason: string }[];
};

/** cost_model 결과 */
export type CostedOption = ActionOption & {
  delay_days: number;
  delay_cost: number;
  opportunity_loss: number;
  follow_up_cost: number;
  recurrence_loss: number;
  expected_cost: number;
};

/** rules 결과 */
export type RuledOption = CostedOption & { allowed: boolean; blocked_reason: string | null; escalation: string | null };

export type OptionCosts = {
  options: RuledOption[];
  recommended_option: string | null;
  recommendation_reason: string[];
};

/* ---------- 기록 ---------- */

export type AgentName = "Analysis" | "Impact" | "Action";

export type AgentRun = {
  id: string;
  issue_id: string;
  agent: AgentName;
  started_at: string;
  ended_at?: string;
  tokens?: number;
  llm_cost_krw?: number;
  status: "실행" | "완료" | "실패";
  error?: string;
  engine: "mock" | "claude";
};

export type ChangeRequest = ChangeRequestDraft & {
  id: string;
  issue_id: string;
  option_id: string;
  status: "초안" | "승인";
};

export type DecisionLog = {
  id: string;
  issue_id: string;
  ai_recommended: string | null;
  pm_selected: string;
  override_reason: string | null;
  decided_at: string;
};

export type Change = {
  entity: "Issue" | "ChangeRequest" | "Requirement" | "Task" | "Release" | "Risk";
  id: string;
  change: string;
  kind: "신규" | "변경" | "유지";
};

export type Effect = {
  decision_days_before: number;
  decision_days_after: number;
  manhours_before: number;
  manhours_after: number;
  labor_cost_before: number;
  labor_cost_after: number;
  llm_cost: number;
  labor_saving: number;
  delay_cost_avoided: number;
  annual_net: number;
  annual_conservative: number;
};

export type EffectRecord = Effect & { issue_id: string; recorded_at: string };

export type EffectInput = { manhours?: number; review_hours?: number; days?: number };

/** 이슈 하나의 처리 기록 (S-001 ~ S-004) */
export type IssueRun = {
  issue_id: string;
  timer_start: number | null;
  timer_ms: number;
  retrieved?: { doc_id: string; score: number }[];
  analysis?: AnalysisResult;
  impact?: ImpactResult;
  action?: ActionResult;
  costs?: OptionCosts;
  error?: string;
  comment?: string;
  decision?: DecisionLog;
  changes?: Change[];
  effect?: Effect;
  effectInput?: EffectInput;
};

export type Todo = {
  no: string;
  wp: string;
  task: string;
  output: string;
  effort: string;
  due: string;
  owner: string;
  status: "예정" | "진행" | "완료";
};

export type BeforeMeasure = { who: string; days: number; manhours: number; date: string };

export type Settings = {
  ai: "mock" | "claude";
  claude: { model: string; maxTokens: number };
  globalRelease: string;
  simulateApplyFail: boolean;
};

export type WorkOpsState = {
  db: ProjectDb;
  assumptions: Assumptions;
  rules: Rules;
  runs: Record<string, IssueRun>;
  changeRequests: ChangeRequest[];
  decisionLogs: DecisionLog[];
  effectRecords: EffectRecord[];
  agentRuns: AgentRun[];
  todos: Todo[];
  beforeMeasure: BeforeMeasure | null;
  settings: Settings;
  seq: number;
};
