import type { Metadata } from "next";
import { cookies } from "next/headers";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { LANG_COOKIE, toLang } from "@/i18n/config";
import { I18nProvider } from "@/i18n/provider";
import { AppShell } from "@/components/app-shell";

/**
 * Pretendard Variable 을 self-host 한다.
 *
 * CDN 링크 대신 next/font/local 을 쓰는 이유는 FOUT 이다 — next/font 가 빌드 때
 * @font-face 를 인라인하고 폰트를 preload 해서, 첫 페인트가 시스템 서체로 그려졌다가
 * 바뀌는 일이 없다. 가변 폰트 한 벌(2.0MB)이라 웨이트별 파일도 필요 없다.
 * 서체 이름은 CSS 변수로만 내보내고 실제 font-family 는 globals.css 가 정한다.
 */
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WorksOps",
  description: "WorksOps 대시보드",
};

/**
 * 첫 페인트 전에 테마 클래스를 박는다 (PRD §8).
 *
 * 저장된 선택이 있으면 그걸, 없으면 OS 설정을 따른다. 리액트가 붙기 전에 돌아야
 * 라이트로 한 번 번쩍이는 것(FOUC)을 막을 수 있어 인라인 스크립트로 둔다.
 * `dark`/`light` 중 하나를 항상 명시하므로 dark: 변형이 클래스 기준으로 동작한다.
 */
const THEME_BOOTSTRAP = `(function(){try{var s=localStorage.getItem("worksops-theme");var dark=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.add(dark?"dark":"light")}catch(e){document.documentElement.classList.add("light")}})()`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // 화면 언어. 쿠키로 받아 서버 렌더부터 그 언어로 그린다 (src/i18n).
  const lang = toLang((await cookies()).get(LANG_COOKIE)?.value);
  return (
    <html lang={lang} className={`${pretendard.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="flex min-h-full flex-col">
        <I18nProvider initialLang={lang}>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
