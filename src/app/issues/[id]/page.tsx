"use client";

import { use } from "react";
import { IssueDetail } from "@/components/workops/issue/issue-detail";
import { StateGate } from "@/components/workops/state-gate";
import { EmptyState } from "@/components/workops/ui";

/** 이슈 상세: S-001 접수 · S-002 분석 · S-003 대응안 · S-004 반영 결과 (단계는 ?step= 로 URL 에 남는다) */
export default function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <StateGate>
      {(ctx) => {
        const issue = ctx.state.db.issues.find((i) => i.id === id);
        if (!issue) return <EmptyState>이슈 {id} 를 찾을 수 없습니다</EmptyState>;
        return <IssueDetail key={issue.id} issue={issue} ctx={ctx} />;
      }}
    </StateGate>
  );
}
