/**
 * 템플릿 프로젝트 제외.
 *
 * Jira에는 새 과제를 만들 때 복제하는 틀 프로젝트가 25개 있고, 그 안에도 실제 이슈가
 * 들어 있다(2026-09-16 실측: Test Request 29 · Bug 12 · Task 212). 실제 과제가 아니므로
 * 집계에 섞이면 안 된다.
 *
 * 이 모듈은 순수 문자열 처리만 한다 — 프로젝트 목록 조회와 캐시는 client.ts가 맡는다.
 */

/** 프로젝트 이름에 [Template] 이 들어가면 틀 프로젝트다. 대소문자·뒤 공백 유무는 제각각이다. */
export const TEMPLATE_PROJECT_NAME = /\[template\]/i;

export function isTemplateProject(name: string): boolean {
  return TEMPLATE_PROJECT_NAME.test(name);
}

/**
 * JQL을 조건부와 ORDER BY로 가른다.
 *
 * 조건을 덧붙이려면 ORDER BY 앞에 넣어야 한다 — `A AND (B ORDER BY c)` 는 문법 오류다.
 * 따옴표 안의 "order by"(예: summary ~ "order by date")는 정렬절이 아니므로 건너뛴다.
 */
export function splitOrderBy(jql: string): { where: string; orderBy: string } {
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < jql.length; i += 1) {
    const ch = jql[i];

    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    // 따옴표 밖에서 만난 ORDER BY 가 정렬절의 시작이다.
    if ((ch === "o" || ch === "O") && /^order\s+by\b/i.test(jql.slice(i))) {
      return { where: jql.slice(0, i).trim(), orderBy: jql.slice(i).trim() };
    }
  }

  return { where: jql.trim(), orderBy: "" };
}

/** 주어진 프로젝트 키들을 빼는 조건을 JQL 앞에 붙인다. 키가 없으면 원본 그대로. */
export function excludeProjects(jql: string, keys: string[]): string {
  if (keys.length === 0) return jql;

  const { where, orderBy } = splitOrderBy(jql);
  const exclusion = `project NOT IN (${keys.join(", ")})`;
  const condition = where ? `${exclusion} AND (${where})` : exclusion;

  return orderBy ? `${condition} ${orderBy}` : condition;
}
