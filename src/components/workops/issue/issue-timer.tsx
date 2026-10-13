"use client";

import { useEffect, useState } from "react";
import { fmtTime } from "@/lib/workops/format";
import { elapsedMs } from "@/lib/workops/state";
import type { IssueRun } from "@/lib/workops/types";

/** 처리 타이머 — 돌고 있으면 1초마다 다시 센다 (KPI ① After 실측) */
export function IssueTimer({ run }: { run: Pick<IssueRun, "timer_ms" | "timer_start"> }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!run.timer_start) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [run.timer_start]);
  return <span className="font-mono text-[13px] tabular-nums">{fmtTime(elapsedMs(run, now))}</span>;
}
