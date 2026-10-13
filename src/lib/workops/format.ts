/** 화면 표시용 서식. 서버 · 클라이언트 공용. */

/** 원 → "1.33억원" · "449만원" · "9,800원" */
export function won(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "-";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 100_000_000) {
    let t = (abs / 100_000_000 + 1e-9).toFixed(2);
    if (t.includes(".")) t = t.replace(/\.?0+$/, "");
    return `${sign}${t}억원`;
  }
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000).toLocaleString("ko-KR")}만원`;
  return `${sign}${Math.round(abs).toLocaleString("ko-KR")}원`;
}

export function fmtNum(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString("ko-KR");
}

/** 밀리초 → "01:02:03" */
export function fmtTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** 오늘(+offset일) YYYY-MM-DD */
export function todayIso(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}
