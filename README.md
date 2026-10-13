# WorksOps — AI WorkOps Agent

프로젝트 이슈 하나를 끝까지 대응(원인 분석 → 영향·비용 평가 → 대응안 → 승인 → 반영)하고, 출시 지연 비용을 얼마나 줄이는지 돈으로 검증하는 웹 시스템.
기준은 `AI WorkOps Agent PRD v0.4` 와 서비스 웹 디자인 시스템 PRD 이며, 모든 데이터는 합성 가정치다.
SQMS(`C:\Workspace\SQA`)와 같은 스택·인프라로 구성했다.

## 화면

| 메뉴 | 경로 | 내용 |
|---|---|---|
| 대시보드 | `/` | KPI 3개 · 대응안 기대비용 · 주의 필요 · 최근 이슈 |
| 이슈 대응 | `/issues`, `/issues/new`, `/issues/[id]?step=` | S-001 접수 → S-002 원인·영향 → S-003 대응안 비교·승인 → S-004 반영·효과 |
| 프로젝트 데이터 | `/project?tab=` | Mock Project System (Release·Requirement·Task·Risk·Member·계약·CR·Decision Log·Agent Run) |
| Knowledge | `/knowledge?tab=&doc=` | 문서 검색 · 문서 27건 · 원인×근거 매트릭스 · 골드 질의 평가 · 변형 시나리오 |
| 판단 기준·가정치 | `/rules?tab=` | rules · 비용 가정치 편집 · 프롬프트 · 스키마 |
| 효과·KPI | `/kpi` | KPI 정의·계산 · Before 1회 측정 · After 기록 · 민감도 |
| PRD·일정 | `/prd?tab=` | PRD 본문 · 일정 · 업무 패키지·할 일(담당자·상태 저장) |
| 설정·연동 | `/settings` | AI 엔진(재생 ↔ Claude API) · 글로벌 릴리스 · 롤백 시연 · 초기화 |

## 판단의 세 층 — 코드 위치

| 층 | 위치 |
|---|---|
| 규칙 (지연일·비용·허용·추천·에스컬레이션) | `src/lib/workops/cost-model.ts` (+ 테스트) |
| 기준표를 받은 LLM (원인·근거 강도·대응안 파라미터) | `src/lib/workops/agents.ts`(재생) · `claude-ai.ts`(Claude) — 결과는 `finalize*` 경계에서 검증 |
| 사람 (선택·CR 수정·변경 사유) | S-003 화면 → `POST /api/workops/issues/[id]/approve` |

상태는 서버 SQLite(`.data/worksops.db`, `WORKSOPS_DATA_DIR` 로 변경) 한 벌이다. 쓰기는 복사본에 작업하고 성공했을 때만 저장하므로 승인 반영 중 오류가 나면 아무것도 바뀌지 않는다(롤백).
Claude API 키는 서버 환경변수 `ANTHROPIC_API_KEY` 로만 받는다.

| 구분 | 구성 |
|---|---|
| 런타임 | Node.js 20+ · Next.js 16 (App Router) · React 19 · TypeScript |
| FRONTEND | Tailwind CSS v4 · shadcn/ui(radix-nova) · SWR · lucide · i18n(ko/en/vi) · 라이트/다크 테마 · 앱 셸(사이드바 + 컨텍스트 바) |
| BACKEND | Next API Routes · Jira/Confluence 클라이언트(`src/lib/jira`, `src/lib/confluence`) · 응답 캐시(`route-cache.ts`) · 계측(`perf.ts`) · 쓰기 가드(`write-request.ts`) · SQLite(sql.js, `src/lib/db.ts`) |
| 테스트 | Vitest (`src/**/*.test.ts`) |
| 서빙 | basePath `/worksops` · 운영은 인증 게이트 뒤 ([docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)) |

## 로컬 실행

```bash
cp .env.example .env   # Atlassian 자격증명 입력 (커밋 금지)
npm ci
npm run dev            # http://127.0.0.1:55240/worksops
```

| 스크립트 | 내용 |
|---|---|
| `npm run dev` | 개발 서버 (127.0.0.1:55240) |
| `npm run build` / `npm start` | 운영 빌드 / 실행 (127.0.0.1:61302, 게이트 상류) |
| `npm run lint` | ESLint |
| `npm test` | Vitest |

## 새 화면 추가

1. `src/app/<경로>/page.tsx` 작성
2. `src/lib/nav.ts`의 `NAV_LINKS`에 메뉴 추가
3. 문구는 `t("한국어 원문")`로 쓰고 `src/i18n/messages/`에 en/vi 번역 추가

Jira를 읽는 API 라우트는 `jiraRoute()`(`src/lib/route-cache.ts`)로 감싸 캐시·계측을 받는다.
