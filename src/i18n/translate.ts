import type { Lang } from "@/i18n/config";
import { DICTIONARY } from "@/i18n/dictionary";

export type Vars = Record<string, string | number>;

/**
 * 한국어 원문 → 고른 언어.
 *
 * 키가 곧 한국어 원문이라 사전에 없으면 원문 그대로 나온다 — 번역이 빠져도 화면이 깨지지 않는다.
 * 바뀌는 값은 `{name}` 자리로 둔다: t("담당자 {n}명", { n: 3 }).
 * 단수 · 복수가 갈리는 언어는 번역문에 "{n} item|{n} items" 처럼 | 로 두 형태를 적는다.
 */
export function translate(lang: Lang, source: string, vars?: Vars): string {
  let text = lang === "ko" ? source : (DICTIONARY[lang][source] ?? source);
  if (!vars) return text;
  // 단수 | 복수: "{n} item|{n} items" 처럼 적으면 n 이 1 일 때 앞쪽을 쓴다 (영어용).
  if (text.includes("|") && typeof vars.n === "number") {
    const [one, other] = text.split("|");
    text = vars.n === 1 ? one : (other ?? one);
  }
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole
  );
}

export type Translate = (source: string, vars?: Vars) => string;
