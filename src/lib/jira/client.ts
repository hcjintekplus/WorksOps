import "server-only";
import { getServerEnv } from "@/lib/env";
import { excludeProjects, isTemplateProject } from "@/lib/jira/template-projects";
import { recordJiraCall, recordJiraRetry } from "@/lib/perf";
import {
  jiraApproximateCountResponseSchema,
  jiraIssueSchema,
  jiraSearchResponseSchema,
  type JiraIssue,
} from "@/lib/jira/types";

export class JiraApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "JiraApiError";
  }
}

function authHeader() {
  const { jiraEmail, jiraApiToken } = getServerEnv();
  const token = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString("base64");
  return `Basic ${token}`;
}

/** 429(요청 한도)·일시 장애에 다시 시도할 횟수와 한 번에 기다리는 최대 시간 */
const MAX_RETRIES = 3;
const MAX_RETRY_WAIT_MS = 10_000;
const RETRYABLE = new Set([429, 502, 503, 504]);

/** Retry-After(초 또는 HTTP 날짜)를 따르고, 없으면 1s · 2s · 4s 로 늘린다. */
function retryDelayMs(res: Response, attempt: number): number {
  const header = res.headers.get("retry-after");
  const seconds = header ? Number(header) : NaN;
  const fromHeader = Number.isFinite(seconds)
    ? seconds * 1000
    : header
      ? Date.parse(header) - Date.now()
      : NaN;
  const wait = Number.isFinite(fromHeader) && fromHeader > 0 ? fromHeader : 1000 * 2 ** attempt;
  return Math.min(wait, MAX_RETRY_WAIT_MS);
}

async function jiraFetch(path: string, init?: RequestInit) {
  const { jiraBaseUrl } = getServerEnv();
  let res: Response;
  for (let attempt = 0; ; attempt++) {
    const started = performance.now();
    res = await fetch(`${jiraBaseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: authHeader(),
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });
    recordJiraCall(path, res.status, performance.now() - started);
    // 조회 전용 호출뿐이라(검색 POST 도 읽기) 같은 요청을 다시 보내도 안전하다.
    if (!RETRYABLE.has(res.status) || attempt >= MAX_RETRIES) break;
    recordJiraRetry();
    await res.body?.cancel().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs(res, attempt)));
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new JiraApiError(
      `Jira API 요청 실패 (${res.status}): ${body.slice(0, 300)}`,
      res.status
    );
  }

  return res.json();
}

const DEFAULT_FIELDS = [
  "summary",
  "status",
  "duedate",
  "reporter",
  "created",
  "project",
];

type SearchPageOptions = {
  jql: string;
  maxResults?: number;
  nextPageToken?: string;
  fields?: string[];
  expandChangelog?: boolean;
};

/**
 * 틀 프로젝트의 키. 이름은 바뀔 일이 드물고 조회가 한 번이면 충분해서 프로세스 수명 동안 캐시한다.
 * 목록 조회가 실패해도 본 조회까지 막지는 않는다 — 제외를 포기하고 그대로 진행한다.
 */
let templateKeys: Promise<string[]> | null = null;

function templateProjectKeys(): Promise<string[]> {
  templateKeys ??= jiraListProjects()
    .then((projects) => projects.filter((p) => isTemplateProject(p.name)).map((p) => p.key))
    .catch(() => []);
  return templateKeys;
}

/**
 * 🔴 모든 JQL 검색은 이 함수를 거친다. 라우트마다 제외 조건을 적으면 새로 생긴 라우트가
 *    빠뜨리기 때문에, 진입점 한 곳에서 건다.
 */
async function withoutTemplateProjects(jql: string): Promise<string> {
  return excludeProjects(jql, await templateProjectKeys());
}

export async function jiraSearchPage({
  jql,
  maxResults = 100,
  nextPageToken,
  fields = DEFAULT_FIELDS,
  expandChangelog = false,
}: SearchPageOptions) {
  const body: Record<string, unknown> = {
    jql: await withoutTemplateProjects(jql),
    maxResults,
    fields,
  };
  if (nextPageToken) body.nextPageToken = nextPageToken;
  if (expandChangelog) body.expand = "changelog";

  const json = await jiraFetch("/rest/api/3/search/jql", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return jiraSearchResponseSchema.parse(json);
}

/**
 * Fetches every issue matching the JQL, paging through Jira's cursor-based
 * search endpoint. Capped to avoid runaway requests against a misconfigured JQL.
 */
export async function jiraSearchAll(
  options: Omit<SearchPageOptions, "nextPageToken">,
  cap = 2000
): Promise<JiraIssue[]> {
  const all: JiraIssue[] = [];
  let nextPageToken: string | undefined;

  do {
    const page = await jiraSearchPage({ ...options, nextPageToken });
    all.push(...page.issues);
    nextPageToken = page.isLast ? undefined : page.nextPageToken;
  } while (nextPageToken && all.length < cap);

  return all;
}

export async function jiraApproximateCount(jql: string): Promise<number> {
  const json = await jiraFetch("/rest/api/3/search/approximate-count", {
    method: "POST",
    body: JSON.stringify({ jql: await withoutTemplateProjects(jql) }),
  });
  return jiraApproximateCountResponseSchema.parse(json).count;
}

export type RawIssueRow = { key: string; fields: Record<string, unknown> };

/**
 * Loosely-typed search for rendering embedded "blockCard" tables in TR
 * descriptions, whose columns vary per TR and aren't known ahead of time.
 */
export async function jiraSearchRawFields(jql: string, fields: string[], maxResults = 50): Promise<RawIssueRow[]> {
  const json = await jiraFetch("/rest/api/3/search/jql", {
    method: "POST",
    body: JSON.stringify({ jql: await withoutTemplateProjects(jql), maxResults, fields }),
  });
  const issues = (json as { issues?: RawIssueRow[] }).issues ?? [];
  return issues;
}

/** Same as jiraSearchRawFields but pages through every match (cursor-based), for loosely-typed one-off queries. */
export async function jiraSearchAllRawFields(jql: string, fields: string[], cap = 2000): Promise<RawIssueRow[]> {
  const all: RawIssueRow[] = [];
  let nextPageToken: string | undefined;

  do {
    const body: Record<string, unknown> = { jql: await withoutTemplateProjects(jql), maxResults: 100, fields };
    if (nextPageToken) body.nextPageToken = nextPageToken;

    const json = (await jiraFetch("/rest/api/3/search/jql", {
      method: "POST",
      body: JSON.stringify(body),
    })) as { issues?: RawIssueRow[]; nextPageToken?: string; isLast?: boolean };

    all.push(...(json.issues ?? []));
    nextPageToken = json.isLast ? undefined : json.nextPageToken;
  } while (nextPageToken && all.length < cap);

  return all;
}

/** 이슈 변경 이력 (search 의 expand=changelog 응답) */
export type JiraChangelog = {
  /** 전체 이력 수. search 응답은 최대 40건만 싣기 때문에 histories 보다 클 수 있다. */
  total?: number;
  histories?: {
    created?: string;
    items?: { field?: string; fromString?: string | null; toString?: string | null }[];
  }[];
};

export type RawIssueRowWithChangelog = RawIssueRow & { changelog?: JiraChangelog };

/**
 * 이슈 한 건의 전체 변경 이력. search 의 expand=changelog 가 잘려 올 때(40건 초과) 쓴다.
 * 오래된 순으로 돌려준다.
 */
export async function jiraGetFullChangelog(key: string): Promise<JiraChangelog> {
  const histories: NonNullable<JiraChangelog["histories"]> = [];
  let startAt = 0;

  for (;;) {
    const json = (await jiraFetch(
      `/rest/api/3/issue/${encodeURIComponent(key)}/changelog?startAt=${startAt}&maxResults=100`
    )) as { values?: NonNullable<JiraChangelog["histories"]>; isLast?: boolean; total?: number };
    const values = json.values ?? [];
    histories.push(...values);
    startAt += values.length;
    if (json.isLast !== false || values.length === 0) break;
  }

  return { total: histories.length, histories };
}

/** jiraSearchAllRawFields 와 같지만 변경 이력(expand=changelog)을 함께 받는다. */
export async function jiraSearchAllRawFieldsWithChangelog(
  jql: string,
  fields: string[],
  cap = 2000
): Promise<RawIssueRowWithChangelog[]> {
  const all: RawIssueRowWithChangelog[] = [];
  let nextPageToken: string | undefined;

  do {
    const body: Record<string, unknown> = {
      jql: await withoutTemplateProjects(jql),
      maxResults: 100,
      fields,
      expand: "changelog",
    };
    if (nextPageToken) body.nextPageToken = nextPageToken;

    const json = (await jiraFetch("/rest/api/3/search/jql", {
      method: "POST",
      body: JSON.stringify(body),
    })) as { issues?: RawIssueRowWithChangelog[]; nextPageToken?: string; isLast?: boolean };

    all.push(...(json.issues ?? []));
    nextPageToken = json.isLast ? undefined : json.nextPageToken;
  } while (nextPageToken && all.length < cap);

  return all;
}

export type JiraRemoteLink = {
  /** 예: "appId=...&pageId=957775898" — Confluence 페이지 id가 여기 들어 있다. */
  globalId?: string;
  application?: { name?: string; type?: string };
  relationship?: string;
  object?: { title?: string; url?: string };
};

/** 이슈에 연결된 원격 링크(Confluence 페이지 mention 등). 검색 API로는 조회되지 않아 이슈별로 호출한다. */
export async function jiraGetRemoteLinks(issueKey: string): Promise<JiraRemoteLink[]> {
  const json = await jiraFetch(`/rest/api/3/issue/${encodeURIComponent(issueKey)}/remotelink`);
  return Array.isArray(json) ? (json as JiraRemoteLink[]) : [];
}

export type JiraProject = { key: string; name: string };

/** 접근 가능한 모든 Jira 프로젝트. 페이지네이션을 끝까지 따라간다. */
export async function jiraListProjects(): Promise<JiraProject[]> {
  const projects: JiraProject[] = [];
  const PAGE = 100;

  for (let startAt = 0; startAt < 5000; startAt += PAGE) {
    const json = (await jiraFetch(
      `/rest/api/3/project/search?startAt=${startAt}&maxResults=${PAGE}`
    )) as { values?: JiraProject[]; isLast?: boolean };

    const values = json.values ?? [];
    projects.push(...values.map((p) => ({ key: p.key, name: p.name })));
    if (json.isLast || values.length < PAGE) break;
  }

  return projects;
}

export type JiraField = { id: string; name: string; clauseNames?: string[] };

/** Every field known to this Jira instance (system + custom), used to resolve a custom field's id by its display name. */
export async function jiraGetFields(): Promise<JiraField[]> {
  const json = await jiraFetch("/rest/api/3/field");
  return json as JiraField[];
}

const fieldIdCache = new Map<string, string[]>();

/**
 * Resolves every custom field id (customfield_NNNNN) matching the name used in JQL.
 * The API's `name` is locale-translated (e.g. "해결 버전" surfaces as "Resolved Version"), so the
 * literal written in a JQL clause is only found in `clauseNames` — matched case-insensitively,
 * since JQL field names are themselves case-insensitive.
 *
 * A name can map to several fields (e.g. two "Severity" fields used by different project schemes),
 * so callers that read values should try each id and take whichever the issue actually carries.
 */
export async function jiraFieldIdsByClauseName(clauseName: string): Promise<string[]> {
  const cacheKey = clauseName.toLowerCase();
  const cached = fieldIdCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const fields = await jiraGetFields();
  const ids = fields
    .filter((f) => f.clauseNames?.some((c) => c.toLowerCase() === cacheKey))
    .map((f) => f.id);
  fieldIdCache.set(cacheKey, ids);
  return ids;
}

/** Convenience wrapper for names that resolve to a single field. */
export async function jiraFieldIdByClauseName(clauseName: string): Promise<string | null> {
  return (await jiraFieldIdsByClauseName(clauseName))[0] ?? null;
}

export async function jiraGetIssue(key: string): Promise<JiraIssue> {
  const params = new URLSearchParams({
    expand: "changelog",
    fields: [...DEFAULT_FIELDS, "description"].join(","),
  });
  const json = await jiraFetch(`/rest/api/3/issue/${encodeURIComponent(key)}?${params}`);
  return jiraIssueSchema.parse(json);
}

export function jiraIssueUrl(key: string) {
  const { jiraBaseUrl } = getServerEnv();
  return `${jiraBaseUrl}/browse/${key}`;
}
