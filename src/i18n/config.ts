/** 화면 언어. 한국어가 원문이고, 영어 · 베트남어는 사전(src/i18n/messages)에서 찾는다. */
export const LANGS = ["ko", "en", "vi"] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "ko";

/** 선택한 언어를 담는 쿠키. 서버가 첫 화면부터 그 언어로 그리게 쿠키로 둔다. */
export const LANG_COOKIE = "worksops-lang";

/** 전환 버튼에 찍는 이름 (각 언어로) */
export const LANG_LABEL: Record<Lang, string> = { ko: "한국어", en: "English", vi: "Tiếng Việt" };

/** 날짜 · 숫자 서식에 쓰는 로케일 */
export const LANG_LOCALE: Record<Lang, string> = { ko: "ko-KR", en: "en-US", vi: "vi-VN" };

export function toLang(value: string | undefined | null): Lang {
  return (LANGS as readonly string[]).includes(value ?? "") ? (value as Lang) : DEFAULT_LANG;
}
