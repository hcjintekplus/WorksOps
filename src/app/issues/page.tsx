"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IssueTimer } from "@/components/workops/issue/issue-timer";
import { StateGate } from "@/components/workops/state-gate";
import { Card, DataTable, Mono, PageHeader, Section, StatusBadge, numCell } from "@/components/workops/ui";

/** S-001 이슈 목록 */
export default function IssuesPage() {
  const router = useRouter();
  return (
    <StateGate>
      {({ state }) => (
        <>
          <PageHeader
            title="이슈 대응"
            description="접수 → 원인·영향 분석 → 대응안 비교·승인 → 반영·효과 기록. 승인 전에는 프로젝트 시스템에 아무것도 반영하지 않습니다."
            actions={
              <Button onClick={() => router.push("/issues/new")}>
                <Plus />새 이슈 접수
              </Button>
            }
          />
          <Section>
            <Card flush title="이슈 목록" caption={`${state.db.issues.length}건`}>
              <DataTable
                rowCount={state.db.issues.length}
                empty="등록된 이슈가 없습니다. 새 이슈를 등록하세요"
                columns={[
                  { label: "이슈" },
                  { label: "제목" },
                  { label: "심각도" },
                  { label: "모듈" },
                  { label: "릴리스" },
                  { label: "상태" },
                  { label: "처리 시간", num: true },
                  { label: "접수", num: true },
                ]}
              >
                {state.db.issues.map((i) => (
                  <tr key={i.id} className="cursor-pointer" onClick={() => router.push(`/issues/${i.id}`)}>
                    <td>
                      <Link href={`/issues/${i.id}`} onClick={(e) => e.stopPropagation()}>
                        <Mono>{i.id}</Mono>
                      </Link>
                    </td>
                    <td>{i.title}</td>
                    <td>
                      <StatusBadge status={i.severity} />
                    </td>
                    <td>{i.module}</td>
                    <td className="text-caption text-muted-foreground">
                      {state.db.releases.find((r) => r.id === i.release_id)?.name ?? "-"}
                    </td>
                    <td>
                      <StatusBadge status={i.status} />
                    </td>
                    <td className={numCell}>{state.runs[i.id] ? <IssueTimer run={state.runs[i.id]} /> : "-"}</td>
                    <td className={`${numCell} text-caption text-muted-foreground`}>{i.created_at.slice(0, 10)}</td>
                  </tr>
                ))}
              </DataTable>
            </Card>
          </Section>
        </>
      )}
    </StateGate>
  );
}
