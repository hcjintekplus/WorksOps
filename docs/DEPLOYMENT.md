# WorksOps 배포 매뉴얼

> WorksOps (`https://service.intekplus.com/worksops`) · 대상 서버: `se-integration-service` 운영 서버 · **미배포**
>
> SQMS(`C:\Workspace\SQA` 의 docs/DEPLOYMENT.md)와 같은 인프라 구성을 따른다.
>
> ⚠️ 포트(65240 / 61302 / 55245)는 SQMS 다음 번호로 잡은 **가안**이다. 배포 전 서버의 `services.json`에서 비어 있는지 확인할 것.
> ⚠️ 게이트(`server.js`, `src/app.js`, `src/config.js`)와 `deploy/` 스크립트는 SQA 저장소에 없고 서버의 `apps/sqms/`에만 있다. 그것을 복제해 이름·포트를 바꿔 쓴다.
> ⚠️ 아래 본문의 실측 기록(날짜, 서비스 수, 트러블슈팅)은 SQMS 배포 때의 것이다.

---

## 1. 개요

WorksOps는 Jira/Confluence를 읽는 Next.js 대시보드다.
사내 통합 서비스 서버(`integration-service` 모노레포)에 서비스로 편입해 배포한다.

| 항목 | 값 |
|---|---|
| 서비스 URL | `https://service.intekplus.com/worksops` |
| 서비스명 | `worksops` |
| 인증 | Microsoft Entra OIDC + 이메일 도메인 게이트 |
| 허용 도메인 | `intekplus.com`, `intekplus.onmicrosoft.com` |
| 코드 위치 | `~/integration-service/apps/worksops` |
| 런타임 | Node.js 20.20.0 (nvm) |
| 디스크 | 약 773MB |

---

## 2. 아키텍처

WorksOps는 **프로세스 2개**로 구성된다. Next.js 앱 앞에 인증 게이트가 별도로 선다.

```
인터넷
  │  https://service.intekplus.com/worksops/
  ▼
nginx  (443)
  │  location /worksops/  →  proxy_pass 127.0.0.1:65240   ※ no-strip
  ▼
worksops.service  (65240)          ← 인증 게이트 (Express + @intek/auth)
  │  · 미인증 → Entra 로그인 리다이렉트
  │  · 인증됨 → X-Auth-Email 헤더를 붙여 상류로 전달
  ▼
worksops-frontend.service  (61302) ← Next.js 16 (basePath=/worksops)
  │
  ▼
Jira Cloud / Confluence API
```

### 왜 프로세스를 나누는가

Next.js 프로세스는 **인증을 전혀 하지 않는다.** 인증은 전적으로 게이트가 담당한다.
이 서버의 유일한 기존 Next.js 앱인 `smart-account`가 쓰는 것과 동일한 구조다.

> 🔴 **nginx의 `proxy_pass`를 61302로 바꾸지 말 것.** 게이트를 건너뛰면 사내 Jira 데이터가
> 무인증으로 공개된다.

### 포트 배정

| 포트 | 용도 | 노출 |
|---|---|---|
| 65240 | 인증 게이트 (prodPort) | nginx만 접근 |
| 61302 | Next.js 상류 | 로컬 전용 |
| 55245 | 개발용 (devPort) | 미사용 |

---

## 3. 디렉터리 구조

```
~/integration-service/
├── services.json                     ← worksops 항목 등록
├── env/worksops.env                      ← 서비스 전용 env (시크릿 없음)
└── apps/worksops/
    ├── package.json                  ← pnpm workspace 멤버 (@intek/*)
    ├── server.js                     ← 게이트 진입점
    ├── src/
    │   ├── app.js                    ← OIDC + 도메인 게이트 + 리버스프록시
    │   └── config.js                 ← env 정본, fail-closed 검증
    ├── node_modules/                 ← 심링크 5개 (4장 참조)
    ├── deploy/                       ← 배포 자산
    │   ├── apply-worksops.sh             ← 적용 (멱등)
    │   ├── rollback-worksops.sh          ← 원복
    │   ├── link-worksops-deps.sh         ← 의존성 심링크
    │   ├── add_worksops_service.py       ← services.json 패치
    │   ├── insert_nginx_block.py     ← nginx 블록 삽입
    │   ├── worksops.service              ← systemd 유닛 (게이트)
    │   ├── worksops-frontend.service     ← systemd 유닛 (Next)
    │   ├── nginx-worksops.conf           ← nginx location 블록
    │   └── worksops.env                  ← env 원본
    └── service/web/frontend/         ← Next.js 앱 (npm, 워크스페이스 밖)
```

### 패키지 매니저가 두 개인 이유

모노레포는 **pnpm**을, WorksOps 대시보드는 **npm**을 쓴다. 충돌하지 않는다.

`pnpm-workspace.yaml`의 멤버 글롭은 `apps/*`다. Next 앱은 `apps/worksops/service/web/frontend`에
있어 이 글롭에 걸리지 않으므로 자기 `node_modules`를 갖는 독립 npm 프로젝트로 남는다.
`smart-account`도 같은 배치다.

---

## 4. 의존성 연결 — `pnpm install`을 쓰지 않는다

> 🔴 **운영 서버에서 `pnpm install`을 실행하지 말 것.**

2026-09-14 실측: `pnpm install --filter worksops`를 실행하면 pnpm이 다음 확인을 띄운다.

```
? The modules directories will be removed and reinstalled from scratch. Proceed? (Y/n)
```

승인하면 **워크스페이스 전체 `node_modules`를 지우고 다시 설치한다.** 라이브 27개 서비스가
동시에 의존성을 잃는다. 게이트 하나를 붙이려고 감수할 위험이 아니다.

대신 모노레포가 `voc-gateway`에서 이미 쓰던 방식대로 **심링크를 손으로 건다**
(`pnpm-workspace.yaml` 주석에 그 경위가 적혀 있다).

`apps/worksops/node_modules/`에 생성되는 링크 5개:

| 링크 | 대상 |
|---|---|
| `express` | `../../../node_modules/.pnpm/express@4.22.2/node_modules/express` |
| `http-proxy-middleware` | `../../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware` |
| `@intek/auth` | `../../../../packages/auth` |
| `@intek/config` | `../../../../packages/config` |
| `@intek/express-kit` | `../../../../packages/express-kit` |

버전은 `smart-account`가 실제로 쓰는 것과 동일하게 맞췄다. `link-worksops-deps.sh`가 스토어에
해당 버전이 있는지 먼저 확인하고, 없으면 즉시 중단한다.

부작용: `pnpm-lock.yaml`에 `worksops`가 남지 않는다. `voc-gateway`도 같은 상태이고
`deploy/live-guard.sh`가 모듈 해석 실패를 잡아 주므로 운영상 문제는 없다.

---

## 5. 환경변수

시크릿은 **서비스 전용 파일에 두지 않는다.** systemd가 아래 순서로 읽고 뒤가 앞을 덮어쓴다.

| 순서 | 파일 | 제공하는 값 |
|---|---|---|
| 1 | `/home/se/.shared.env` | `AZURE_TENANT_ID`, `JIRA_BOT_EMAIL`, `JIRA_API_TOKEN`, `ATLASSIAN_DOMAIN` |
| 2 | `env/legacy/lead.env` | `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `SESSION_SECRET` |
| 3 | `env/worksops.env` | `AZURE_REDIRECT_URI`, `BASE_PATH`, `UPSTREAM_TARGET`, `ALLOWED_EMAIL_DOMAINS` |

`env/worksops.env`에는 **공개해도 무방한 값만** 들어간다. redirect URI만 이 서비스 것으로 덮어쓰고
나머지 Entra 자격증명은 공유 앱 것을 그대로 쓴다.

```properties
AZURE_REDIRECT_URI=https://service.intekplus.com/worksops/auth/callback
BASE_PATH=/worksops
UPSTREAM_TARGET=http://127.0.0.1:61302
ALLOWED_EMAIL_DOMAINS=intekplus.com,intekplus.onmicrosoft.com
```

### Jira 조회 계정

로컬 개발은 개인 API 토큰을, 운영은 **봇 계정**(`JIRA_BOT_EMAIL` / `JIRA_API_TOKEN`)을 쓴다.
`src/lib/env.ts`가 두 이름 체계를 모두 폴백으로 읽는다.

> ⚠️ 봇 계정의 프로젝트 열람 권한이 개인 계정과 다르면 집계 건수가 로컬과 달라진다.
> 배포 후 화면에서 건수를 한 번 대조할 것.

### Entra 앱 등록 (배포 전 필수)

```
https://service.intekplus.com/worksops/auth/callback
```

> 🔴 **기존 redirect URI를 삭제하지 말 것.** 19개 앱이 같은 Entra 앱을 공유한다
> (`client_id`/`secret` 동일). 추가만 한다.
>
> 등록되지 않으면 로그인 시 `AADSTS50011` 오류가 난다.

---

## 6. 배포 절차

### 6.1 사전 준비 (개발 PC)

`next.config.ts`에 `basePath`가 설정돼 있어야 한다. 서브경로 서빙의 전제다.

```ts
const BASE_PATH = "/worksops";

const nextConfig: NextConfig = {
  basePath: BASE_PATH,
  // 클라이언트의 상대 fetch("/api/...")에는 basePath가 자동으로 붙지 않는다.
  // src/lib/fetcher.ts가 이 값을 읽어 앞에 붙인다.
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
};
```

`package.json`의 `start`는 **내부 포트**를 가리켜야 한다(65240은 게이트가 점유).

```json
"start": "next start -p 61302 -H 127.0.0.1"
```

### 6.2 소스 전송

`.env`·`node_modules`·`.next`·`.git`을 제외하고 전송한다.

```bash
DEST=/home/se/integration-service/apps/worksops/service/web/frontend

tar --exclude=node_modules --exclude=.next --exclude=.git \
    --exclude='.env*' --exclude=scratchpad -czf - . \
 | ssh -i <키> -p 52843 se@<서버> "mkdir -p $DEST && tar -xzf - -C $DEST"
```

> 🔴 `.env`는 절대 전송하지 않는다. 운영 자격증명은 서버의 `.shared.env`에서 온다.
> 전송 후 `find $DEST -name '.env*'`로 유입이 없는지 확인할 것.

### 6.3 빌드 (서버)

```bash
export PATH=/home/se/.nvm/versions/node/v20.20.0/bin:$PATH
cd /home/se/integration-service/apps/worksops/service/web/frontend

npm ci --no-audit --no-fund
NODE_ENV=production npm run build
```

> Next.js 16은 **Node 20 이상**을 요구한다. 서버 기본 `node`는 18.19.1이므로
> nvm 경로를 PATH 앞에 붙여야 한다. systemd 유닛에도 절대 경로로 박혀 있다.

### 6.4 적용

게이트 소스(`server.js`, `src/`, `package.json`)와 `deploy/` 자산을 올린 뒤 한 줄로 적용한다.

```bash
ssh -i <키> -p 52843 se@<서버> \
  "bash ~/integration-service/apps/worksops/deploy/apply-worksops.sh"
```

스크립트가 수행하는 6단계 — **전부 additive이고 멱등하다.**

| 단계 | 내용 | 백업 |
|---|---|---|
| 1/6 | `services.json`에 `worksops` 등록 | ✅ |
| 2/6 | `env/worksops.env` 설치 (0600) | ✅ |
| 3/6 | 의존성 심링크 연결 + 해석 검증 | — |
| 4/6 | systemd 유닛 2개 설치·기동 | — |
| 5/6 | nginx 블록 삽입 → `nginx -t` → reload | ✅ |
| 6/6 | 스모크 테스트 | — |

백업은 `~/integration-service/deploy/backup/worksops-<타임스탬프>/`에 남는다.

### 6.5 nginx 블록

`/etc/nginx/sites-available/service.intekplus.com.conf`의 server 블록 맨 끝에 삽입된다.
(`sites-enabled`는 이 파일로의 심링크다.)

```nginx
location = /worksops {
  proxy_pass http://127.0.0.1:65240;
  proxy_http_version 1.1;
  proxy_set_header Host              $host;
  proxy_set_header X-Real-IP         $remote_addr;
  proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto https;
}
location /worksops/ {
  proxy_pass http://127.0.0.1:65240;
  proxy_http_version 1.1;
  proxy_set_header Host              $host;
  proxy_set_header X-Real-IP         $remote_addr;
  proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto https;
  proxy_read_timeout 120s;
  proxy_send_timeout 120s;
}
```

**세 가지 금지 사항**

> 🔴 `proxy_pass` 끝에 **슬래시를 붙이지 말 것**(no-strip). Next가 `basePath=/worksops`로
> 빌드돼 접두사를 스스로 붙인다. 슬래시를 붙이면 `/worksops`가 두 번 떨어져 404가 난다.
> `services.json`의 `stripPrefix: false`와 일치해야 한다.
>
> 🔴 `location = /worksops { return 301 /worksops/; }` 를 쓰지 말 것. basePath 앱에서는
> Next가 `/worksops`를 정상 응답하므로 **무한 리다이렉트**가 된다.
>
> 🔴 타임아웃을 기본값(60s)으로 두지 말 것. `/api/current-tests`가 Jira를 수십 회 호출해
> 12~20초가 걸린다.

---

## 7. 검증

### 7.1 계층별 확인

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:61302/worksops      # 200 (Next)
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:65240/healthz   # 200 (게이트)
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:65240/worksops/     # 401 (게이트 동작)
```

### 7.2 외부 확인

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'Accept: text/html' https://service.intekplus.com/worksops/
```

| 응답 | 의미 |
|---|---|
| **302** | ✅ 정상 — `/worksops/auth/login` 으로 리다이렉트 |
| 401 | ✅ 정상 — 브라우저가 아닌 요청(Accept 헤더 없음)에 대한 게이트 응답 |
| 200 | 🔴 **게이트 미적용.** 즉시 원복할 것 |
| 404 | nginx 블록 미반영 — reload 직후라면 수 초 뒤 재시도 |
| 502 | Next 미기동 — `journalctl -u worksops-frontend -n 50` |

### 7.3 인증 체인 확인

```bash
curl -s -D - -o /dev/null -H 'Accept: text/html' \
  https://service.intekplus.com/worksops/auth/login | grep -i '^location:'
```

`login.microsoftonline.com/.../oauth2/v2.0/authorize` 로 가고,
`redirect_uri`가 `https://service.intekplus.com/worksops/auth/callback` 이어야 한다.

### 7.4 정보 유출 확인

인증 없이 정적 에셋·API가 새면 안 된다. **둘 다 401이어야 한다.**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://service.intekplus.com/worksops/_next/static/chunks/main.js
curl -s -o /dev/null -w '%{http_code}\n' https://service.intekplus.com/worksops/api/tr/models
```

---

## 8. 운영

### 로그

게이트는 구조화 JSON 로그를 남긴다(`authenticated`, `actor`, `durationMs` 포함).

```bash
sudo journalctl -u worksops.service -f              # 게이트 (접근 로그)
sudo journalctl -u worksops-frontend.service -f     # Next (앱 로그)
```

### 재시작

```bash
sudo systemctl restart worksops-frontend.service    # Next 먼저
sudo systemctl restart worksops.service             # 게이트
```

### 코드 갱신 (재배포)

```bash
# 1) 소스 전송 (6.2)  2) 빌드 (6.3)  3) Next만 재시작
sudo systemctl restart worksops-frontend.service
```

`services.json`·nginx·게이트가 그대로면 `apply-worksops.sh`를 다시 돌릴 필요는 없다.

---

## 9. 원복

```bash
bash ~/integration-service/apps/worksops/deploy/rollback-worksops.sh \
     ~/integration-service/deploy/backup/worksops-<타임스탬프>
```

수행 내용:

1. nginx 설정 원복 → `nginx -t` → reload
2. `worksops.service` / `worksops-frontend.service` 중지·비활성화·유닛 삭제
3. `services.json` 원복
4. `env/worksops.env` 삭제

`apps/worksops` 소스는 남는다(다른 서비스에 영향 없음). 완전히 지우려면
`rm -rf ~/integration-service/apps/worksops`.

---

## 10. 트러블슈팅 — 실제 겪은 문제

| 증상 | 원인 | 해결 |
|---|---|---|
| `FileNotFoundError: 'services.json'` | 패치 스크립트가 상대 경로를 열어 실행 위치(홈)에서 못 찾음 | 절대 경로를 인자로 전달 |
| `pnpm`이 전체 재설치 확인을 띄움 | 워크스페이스 `node_modules` 레이아웃 불일치 | `pnpm install` 포기, 심링크 수동 연결 (4장) |
| `Cannot find package '@intek/auth'` | 의존성 미연결 | `link-worksops-deps.sh` 실행 |
| 적용 직후 스모크만 404 | `systemctl reload nginx` 반영 전에 즉시 curl | 수 초 뒤 재확인 |
| 빌드 실패 (engine 경고) | 기본 `node` 18.19.1, Next 16은 20+ 요구 | nvm 경로를 PATH 앞에 |
| 로그인 시 `AADSTS50011` | Entra에 redirect URI 미등록 | `/worksops/auth/callback` 추가 (5장) |
