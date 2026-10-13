"use client";

import { LANG_LABEL, LANGS, type Lang } from "@/i18n/config";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * 화면 언어 전환 — 국기 버튼 (한국어 · English · Tiếng Việt). 머리글의 테마 전환 옆에 둔다.
 *
 * 국기 이모지는 Windows 에서 그림 대신 "KR" 같은 글자로 나와서 작은 SVG 로 그린다.
 * 버튼 이름(aria-label · title)은 각 언어의 이름이다.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang, t } = useT();

  return (
    <div
      role="radiogroup"
      aria-label={t("언어")}
      className={cn("inline-flex h-7 items-center gap-0.5 rounded-control border border-border bg-card p-0.5", className)}
    >
      {LANGS.map((value: Lang) => {
        const Flag = FLAGS[value];
        const selected = lang === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={LANG_LABEL[value]}
            title={LANG_LABEL[value]}
            onClick={() => setLang(value)}
            className={cn(
              "inline-flex h-full items-center rounded-[4px] px-1 transition-[background-color,opacity]",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              selected ? "bg-muted" : "opacity-60 hover:opacity-100"
            )}
          >
            <Flag />
          </button>
        );
      })}
    </div>
  );
}

/** 국기 하나: 20×14, 테두리를 얇게 둘러 흰 바탕 국기가 배경에 묻히지 않게 한다. */
function FlagFrame({ children }: { children: React.ReactNode }) {
  return (
    <svg aria-hidden width="20" height="14" viewBox="0 0 30 20" className="block overflow-hidden rounded-[2px]">
      {children}
      <rect x="0.5" y="0.5" width="29" height="19" fill="none" stroke="rgba(0,0,0,.18)" />
    </svg>
  );
}

/** 대한민국 (태극과 네 괘를 단순화) */
function FlagKo() {
  // 괘: 막대 세 줄. broken 이면 가운데가 끊긴 줄이다.
  const trigram = (cx: number, cy: number, angle: number, broken: [boolean, boolean, boolean]) => (
    <g transform={`translate(${cx} ${cy}) rotate(${angle})`} fill="#000">
      {broken.map((b, i) =>
        b ? (
          <g key={i}>
            <rect x={-2.5} y={-2 + i * 1.5} width={2.1} height={0.9} />
            <rect x={0.4} y={-2 + i * 1.5} width={2.1} height={0.9} />
          </g>
        ) : (
          <rect key={i} x={-2.5} y={-2 + i * 1.5} width={5} height={0.9} />
        )
      )}
    </g>
  );
  return (
    <FlagFrame>
      <rect width="30" height="20" fill="#fff" />
      {/* 태극: 위 빨강 · 아래 파랑 */}
      <g transform="translate(15 10) rotate(33.7)">
        <path d="M-5 0a5 5 0 0 1 10 0a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 0-5 0" fill="#cd2e3a" />
        <path d="M-5 0a5 5 0 0 0 10 0a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 0-5 0" fill="#0047a0" />
      </g>
      {trigram(6.2, 4.6, -56.3, [false, false, false])}
      {trigram(23.8, 15.4, -56.3, [true, true, true])}
      {trigram(23.8, 4.6, 56.3, [false, true, false])}
      {trigram(6.2, 15.4, 56.3, [true, false, true])}
    </FlagFrame>
  );
}

/** 미국 (English) */
function FlagEn() {
  return (
    <FlagFrame>
      <rect width="30" height="20" fill="#fff" />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} y={(i * 2 * 20) / 13} width="30" height={20 / 13} fill="#b22234" />
      ))}
      <rect width="12" height={(20 / 13) * 7} fill="#3c3b6e" />
      {/* 별은 작은 점으로 줄인다 */}
      {Array.from({ length: 4 }, (_, row) =>
        Array.from({ length: 5 }, (_, col) => (
          <circle key={`${row}-${col}`} cx={1.4 + col * 2.3} cy={1.4 + row * 2.6} r={0.45} fill="#fff" />
        ))
      )}
    </FlagFrame>
  );
}

/** 베트남 */
function FlagVi() {
  return (
    <FlagFrame>
      <rect width="30" height="20" fill="#da251d" />
      <polygon
        fill="#ffcd00"
        points="15,4.2 16.35,8.35 20.7,8.35 17.18,10.9 18.52,15.05 15,12.5 11.48,15.05 12.82,10.9 9.3,8.35 13.65,8.35"
      />
    </FlagFrame>
  );
}

const FLAGS: Record<Lang, () => React.JSX.Element> = { ko: FlagKo, en: FlagEn, vi: FlagVi };
