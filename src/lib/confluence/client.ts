import "server-only";
import { getServerEnv } from "@/lib/env";

/** Jira와 같은 Atlassian 사이트/자격증명을 쓰고, 경로만 /wiki 아래로 간다. */
async function confluenceFetch(path: string, follow = false): Promise<Response> {
  const { jiraBaseUrl, jiraEmail, jiraApiToken } = getServerEnv();
  const token = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString("base64");

  return fetch(`${jiraBaseUrl}${path}`, {
    headers: { Authorization: `Basic ${token}`, Accept: "application/json" },
    redirect: follow ? "follow" : "manual",
    cache: "no-store",
  });
}

type PageRef = { pageId: string; spaceKey: string | null };

/** 페이지 URL에서 page id와 space key를 뽑는다. */
function parsePageUrl(url: string): PageRef | null {
  const pageId = url.match(/\/pages\/(\d+)/)?.[1] ?? url.match(/pageId=(\d+)/)?.[1];
  if (!pageId) return null;
  return { pageId, spaceKey: url.match(/\/wiki\/spaces\/([^/]+)/)?.[1] ?? null };
}

/**
 * Artifacts URL을 page id / space key로 바꾼다.
 * `/wiki/x/AQCVLQ` 같은 단축 링크는 리다이렉트를 따라가 실제 페이지 URL을 얻는다.
 */
async function resolvePage(url: string): Promise<PageRef | null> {
  const direct = parsePageUrl(url);
  if (direct) return direct;

  const tiny = url.match(/\/wiki\/x\/([A-Za-z0-9_-]+)/)?.[1];
  if (!tiny) return null;

  const res = await confluenceFetch(`/wiki/x/${tiny}`, true);
  return parsePageUrl(res.url);
}

/**
 * Artifacts URL -> 최상위 폴더 URL 캐시.
 *
 * 문서함 구조는 거의 바뀌지 않는데 해석에는 왕복 두 번(단축 링크 리다이렉트 + ancestors)이
 * 필요하므로 성공한 결과만 프로세스 수명 동안 재사용한다.
 */
const topFolderCache = new Map<string, string>();

/**
 * Artifacts URL이 가리키는 페이지의 **가장 상위 폴더** URL.
 *
 * ancestors는 루트에서 가까운 순으로 오므로 첫 번째 folder가 최상위다.
 * (예: TMS Home > 📁 iPIS-500 > 📁 iPIS-500 Jedec Max Full test > 페이지 → "iPIS-500")
 * 폴더가 없거나 해석에 실패하면 null.
 */
export async function confluenceTopFolderUrl(artifactsUrl: string): Promise<string | null> {
  const cached = topFolderCache.get(artifactsUrl);
  if (cached) return cached;

  const url = await resolveTopFolderUrl(artifactsUrl);
  // 실패는 캐시하지 않는다. 일시적인 오류가 프로세스 수명 내내 남으면 안 된다.
  if (url) topFolderCache.set(artifactsUrl, url);
  return url;
}

async function resolveTopFolderUrl(artifactsUrl: string): Promise<string | null> {
  const page = await resolvePage(artifactsUrl);
  if (!page?.spaceKey) return null;

  const res = await confluenceFetch(`/wiki/api/v2/pages/${page.pageId}/ancestors?limit=50`);
  if (!res.ok) return null;

  const json = (await res.json()) as { results?: { id?: string | number; type?: string }[] };
  const topFolder = (json.results ?? []).find((a) => a.type === "folder" && a.id != null);
  if (!topFolder) return null;

  const { jiraBaseUrl } = getServerEnv();
  return `${jiraBaseUrl}/wiki/spaces/${page.spaceKey}/folder/${topFolder.id}`;
}
