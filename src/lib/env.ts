import { z } from "zod";

const envSchema = z.object({
  ATLASSIAN_URL: z.string().url(),
  ATLASSIAN_EMAIL: z.string().email(),
  ATLASSIAN_API_TOKEN: z.string().min(1),
});

/** ATLASSIAN_DOMAIN은 호스트만 담기도 한다("x.atlassian.net"). URL 형태로 맞춘다. */
function toUrl(value: string | undefined) {
  if (!value) return undefined;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function loadServerEnv() {
  const parsed = envSchema.safeParse({
    // 로컬(.env)은 ATLASSIAN_*, 운영 서버(.shared.env)는 JIRA_*/ATLASSIAN_DOMAIN을 쓴다.
    ATLASSIAN_URL:
      toUrl(process.env.ATLASSIAN_URL) ??
      toUrl(process.env.JIRA_BASE) ??
      toUrl(process.env.ATLASSIAN_DOMAIN),
    ATLASSIAN_EMAIL: process.env.ATLASSIAN_EMAIL ?? process.env.JIRA_BOT_EMAIL,
    // ATLASSAIN_TOKEN: historical typo in this project's .env; support both.
    ATLASSIAN_API_TOKEN:
      process.env.ATLASSIAN_API_TOKEN ??
      process.env.ATLASSAIN_TOKEN ??
      process.env.JIRA_API_TOKEN,
  });

  if (!parsed.success) {
    throw new Error(
      `Jira 연동 환경변수가 올바르지 않습니다: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`
    );
  }

  return {
    jiraBaseUrl: parsed.data.ATLASSIAN_URL.replace(/\/$/, ""),
    jiraEmail: parsed.data.ATLASSIAN_EMAIL,
    jiraApiToken: parsed.data.ATLASSIAN_API_TOKEN,
  };
}

let cached: ReturnType<typeof loadServerEnv> | null = null;

export function getServerEnv() {
  if (!cached) cached = loadServerEnv();
  return cached;
}
