# WorksOps

SQMS(`C:\Workspace\SQA`)와 같은 스택·인프라로 구성한 Next.js 풀스택 앱.

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
