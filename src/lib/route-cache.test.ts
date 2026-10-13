import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// "server-only" 는 Next 밖(vitest)에서 import 하면 막는다. 테스트에서는 빈 모듈로 둔다.
vi.mock("server-only", () => ({}));

type Handler = (request: Request, ctx: unknown) => Promise<Response>;

async function load(env: Record<string, string> = {}) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import("./route-cache");
}

const req = (query = "") => new Request(`http://localhost/api/x${query}`);
const state = (res: Response) => res.headers.get("server-timing")?.match(/cache;desc="(\w+)"/)?.[1];

function countingHandler(make: (n: number) => Response | Promise<Response> = (n) => Response.json({ n })) {
  let calls = 0;
  const handler: Handler = async () => make(++calls);
  return { handler, calls: () => calls };
}

beforeEach(() => vi.spyOn(console, "log").mockImplementation(() => undefined));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("jiraRoute", () => {
  it("처음은 계산하고 다음은 캐시에서 준다. 파라미터 순서가 달라도 같은 키다", async () => {
    const { jiraRoute } = await load();
    const h = countingHandler();
    const GET = jiraRoute("x", h.handler);

    const first = await GET(req("?a=1&b=2"), {});
    expect(state(first)).toBe("miss");
    expect(await first.json()).toEqual({ n: 1 });

    const second = await GET(req("?b=2&a=1"), {});
    expect(state(second)).toBe("hit");
    expect(await second.json()).toEqual({ n: 1 });
    expect(h.calls()).toBe(1);
  });

  it("동시에 들어온 같은 요청은 한 번만 계산한다", async () => {
    const { jiraRoute } = await load();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const h = countingHandler(async (n) => {
      await gate;
      return Response.json({ n });
    });
    const GET = jiraRoute("x", h.handler);

    const pending = [GET(req(), {}), GET(req(), {}), GET(req(), {})];
    release();
    const bodies = await Promise.all((await Promise.all(pending)).map((r) => r.json()));
    expect(bodies).toEqual([{ n: 1 }, { n: 1 }, { n: 1 }]);
    expect(h.calls()).toBe(1);
  });

  it("오류 응답은 담지 않아 다음 요청이 다시 계산한다", async () => {
    const { jiraRoute } = await load();
    const h = countingHandler((n) =>
      n === 1 ? Response.json({ message: "Jira 오류" }, { status: 502 }) : Response.json({ n })
    );
    const GET = jiraRoute("x", h.handler);

    expect((await GET(req(), {})).status).toBe(502);
    const retry = await GET(req(), {});
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ n: 2 });
  });

  it("fresh=1 은 캐시를 건너뛰고 새 값으로 바꿔 담는다", async () => {
    const { jiraRoute } = await load();
    const h = countingHandler();
    const GET = jiraRoute("x", h.handler);

    await GET(req(), {});
    const fresh = await GET(req("?fresh=1"), {});
    expect(state(fresh)).toBe("bypass");
    expect(await fresh.json()).toEqual({ n: 2 });
    expect(await (await GET(req(), {})).json()).toEqual({ n: 2 });
  });

  it("FRESH 가 지나면 묵은 값을 바로 주고 뒤에서 한 번 다시 계산한다", async () => {
    const { jiraRoute } = await load({ RESPONSE_CACHE_FRESH_MS: "1", RESPONSE_CACHE_STALE_MS: "60000" });
    const h = countingHandler();
    const GET = jiraRoute("x", h.handler);

    await GET(req(), {});
    await new Promise((r) => setTimeout(r, 5));
    const stale = await GET(req(), {});
    expect(state(stale)).toBe("stale");
    expect(await stale.json()).toEqual({ n: 1 });

    await vi.waitFor(() => expect(h.calls()).toBe(2));
    await new Promise((r) => setTimeout(r, 5));
    expect(await (await GET(req(), {})).json()).toEqual({ n: 2 });
  });

  it("RESPONSE_CACHE_ENABLED=false 면 매번 계산한다 (원복용)", async () => {
    const { jiraRoute } = await load({ RESPONSE_CACHE_ENABLED: "false" });
    const h = countingHandler();
    const GET = jiraRoute("x", h.handler);

    expect(state(await GET(req(), {}))).toBe("off");
    await GET(req(), {});
    expect(h.calls()).toBe(2);
  });

  it("경로 파라미터는 key 옵션으로 구분한다", async () => {
    const { jiraRoute } = await load();
    const handler = async (_r: Request, ctx: { id: string }) => Response.json({ id: ctx.id });
    const GET = jiraRoute("x", handler, { key: async (ctx) => ctx.id });

    expect(await (await GET(req(), { id: "A-1" })).json()).toEqual({ id: "A-1" });
    expect(await (await GET(req(), { id: "B-2" })).json()).toEqual({ id: "B-2" });
  });
});
