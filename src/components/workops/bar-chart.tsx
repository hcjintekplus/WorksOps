/**
 * 막대 차트 — 네이비 시리즈가 기본이고, 임계선을 넘은 막대만 오렌지 (디자인 시스템 C-02).
 */
export function BarChart({
  values,
  labels,
  threshold,
  format = (v) => String(Number(v.toFixed(2))),
  ariaLabel,
}: {
  values: number[];
  labels: string[];
  threshold?: number;
  format?: (v: number) => string;
  ariaLabel: string;
}) {
  const W = 640;
  const H = 220;
  const padL = 48;
  const padB = 28;
  const padT = 12;
  // 눈금이 0 · 2.5 · 5 처럼 읽기 쉬운 값에 떨어지도록 최대값을 1 · 2 · 2.5 · 5 × 10ⁿ 단위로 올린다.
  const raw = Math.max(...values, threshold ?? 0, 1) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * pow >= raw) ?? 10) * pow;
  const max = step * 4;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const gw = (W - padL - 12) / labels.length;
  const bw = Math.min(48, gw * 0.5);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[220px] w-full" role="img" aria-label={ariaLabel}>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={padL} x2={W - 12} y1={y(max * f)} y2={y(max * f)} stroke="var(--border)" />
          <text x={padL - 8} y={y(max * f) + 4} fontSize={11} textAnchor="end" fill="var(--muted-foreground)">
            {format(max * f)}
          </text>
        </g>
      ))}
      {values.map((v, i) => {
        const x = padL + gw * i + gw / 2 - bw / 2;
        const over = threshold !== undefined && v > threshold;
        return (
          <g key={labels[i]}>
            <rect x={x} y={y(v)} width={bw} height={H - padB - y(v)} rx={2} fill={over ? "var(--warning)" : "var(--primary)"} />
            <text x={x + bw / 2} y={y(v) - 6} fontSize={11} textAnchor="middle" fill="var(--foreground)">
              {format(v)}
            </text>
            <text x={padL + gw * i + gw / 2} y={H - 8} fontSize={11} textAnchor="middle" fill="var(--muted-foreground)">
              {labels[i]}
            </text>
          </g>
        );
      })}
      {threshold !== undefined && (
        <line x1={padL} x2={W - 12} y1={y(threshold)} y2={y(threshold)} stroke="var(--warning)" strokeDasharray="4 3" />
      )}
    </svg>
  );
}
