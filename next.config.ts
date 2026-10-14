import type { NextConfig } from "next";

/**
 * 운영은 https://service.intekplus.com/worksops 서브경로로 서빙된다
 * (nginx no-strip 프록시 → 이 Next 프로세스). 서브경로 서빙에는 basePath가 필수다 —
 * Next가 에셋(/_next)·라우트·Link를 전부 이 prefix 아래로 낸다.
 *
 * 로컬 개발에서도 같은 경로(/worksops)로 뜨므로 운영과 경로가 갈리지 않는다.
 */
const BASE_PATH = "/worksops";

/**
 * 배포 시각. 화면에 "지금 보고 있는 게 언제 올라간 버전인지" 를 띄운다.
 *
 * 빌드 시점에 한 번 계산해 문자열로 박는다 — 런타임에 만들면 서버와 브라우저의
 * 시간대가 달라 하이드레이션이 어긋난다. 운영 배포는 push 직후 빌드하므로
 * 이 값이 곧 push 시각이다.
 */
const BUILD_TIME = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date());

const nextConfig: NextConfig = {
  basePath: BASE_PATH,
  /**
   * WorksOps DB(SQLite, sql.js, src/lib/db.ts). WASM 파일을 node_modules 에서 직접 읽어야 해서 번들하지 않는다.
   */
  serverExternalPackages: ["sql.js"],
  /**
   * Vercel(works-ops.vercel.app)처럼 도메인 루트로 들어오면 basePath 로 보낸다.
   * 운영 nginx 는 /worksops 만 넘기므로 영향이 없다.
   */
  async redirects() {
    return [{ source: "/", destination: BASE_PATH, basePath: false, permanent: false }];
  },
  /**
   * 클라이언트의 상대 fetch("/api/...")에는 basePath가 자동으로 붙지 않는다.
   * src/lib/fetcher.ts가 이 값을 읽어 앞에 붙인다.
   */
  env: {
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
    NEXT_PUBLIC_BUILD_TIME: BUILD_TIME,
  },
};

export default nextConfig;
