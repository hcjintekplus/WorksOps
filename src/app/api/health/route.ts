/** 배포 스모크 테스트용. Jira · DB 를 건드리지 않는다. */
export function GET() {
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
