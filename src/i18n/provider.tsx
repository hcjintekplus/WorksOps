"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { LANG_COOKIE, LANG_LOCALE, type Lang } from "@/i18n/config";
import { translate, type Translate } from "@/i18n/translate";

type I18n = { lang: Lang; locale: string; t: Translate; setLang: (lang: Lang) => void };

const I18nContext = createContext<I18n | null>(null);

/**
 * 화면 언어 공급자. 처음 언어는 서버가 쿠키에서 읽어 넘긴다(layout.tsx) — 그래서 서버 렌더와
 * 첫 화면이 같은 언어로 그려져 수화가 어긋나거나 한국어가 번쩍이지 않는다.
 */
export function I18nProvider({ initialLang, children }: { initialLang: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    // 1년. basePath(/worksops) 아래 모든 화면에 쓰이게 경로를 / 로 둔다.
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
  }, []);

  const value = useMemo<I18n>(
    () => ({
      lang,
      locale: LANG_LOCALE[lang],
      t: (source, vars) => translate(lang, source, vars),
      setLang,
    }),
    [lang, setLang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** 화면 문구 번역: const { t } = useT(); t("새로고침") */
export function useT(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useT 는 I18nProvider 안에서만 쓸 수 있습니다.");
  return value;
}
