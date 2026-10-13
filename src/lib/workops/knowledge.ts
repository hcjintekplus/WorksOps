import { KNOWLEDGE } from "@/lib/workops/seed";
import type { Issue, KnowledgeDoc } from "@/lib/workops/types";

/**
 * Knowledge 검색 — 키워드 기반. 벡터DB(Chroma) 를 붙이면 이 모듈만 바꾼다.
 * 점수는 검색어 단어 중 문서에 들어 있는 비율(0~1)이다.
 */
export type SearchHit = { doc: KnowledgeDoc; score: number };

export function tokenize(query: string): string[] {
  return (query || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.\-]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function docText(d: KnowledgeDoc): string {
  return `${d.title} ${d.must} ${d.module} ${d.product} ${Object.values(d.sections).join(" ")}`.toLowerCase();
}

export function searchKnowledge(query: string, k = 8, docs: KnowledgeDoc[] = KNOWLEDGE): SearchHit[] {
  const terms = tokenize(query);
  if (!terms.length) return [];
  return docs
    .map((doc) => {
      const text = docText(doc);
      const score = terms.reduce((s, t) => s + (text.includes(t) ? 1 : 0), 0) / terms.length;
      return { doc, score };
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/** 근거 부족 시연(V-03)에서 빼는 핵심 근거 문서 */
const CORE_EVIDENCE = ["TR-0921", "CHG-123", "SRS-HUB20", "TR-REG", "SDD-HUB"];

/**
 * 이슈 하나의 근거 문서를 모은다. 이슈 텍스트 + 모듈에 시나리오 핵심어를 더해 찾고 방해 문서는 거른다.
 */
export function retrieveForIssue(issue: Pick<Issue, "title" | "description" | "module" | "simulate">): SearchHit[] {
  const q = `${issue.title} ${issue.description} ${issue.module} 재부팅 연결 대기열 라이브러리 요구사항 회귀 품질규정 계약`;
  const hits = searchKnowledge(q, 20).filter((h) => !h.doc.distractor);
  if (issue.simulate === "insufficient") return hits.filter((h) => !CORE_EVIDENCE.includes(h.doc.doc_id));
  return hits;
}

export function findDoc(docId: string): KnowledgeDoc | undefined {
  return KNOWLEDGE.find((d) => d.doc_id === docId);
}

/** 문서의 섹션 본문. 없으면 빈 문자열 */
export function sectionText(docId: string, section: string): string {
  return findDoc(docId)?.sections[section] ?? "";
}
