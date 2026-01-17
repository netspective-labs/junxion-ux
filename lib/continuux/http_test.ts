// lib/continuux/http_test.ts
//
// Deno tests for lib/continuux/http.ts
//
// Run with:
//   deno test -A lib/continuux/http_test.ts
//
// Notes:
// - Bundling uses Deno.bundle which can require --unstable-bundle. Tests adapt.
// - SSE is a streaming response: this test cancels the body when done.

import {
  Application,
  composeMiddleware,
  cors,
  HandlerCtx,
  htmlResponse,
  jsonResponse,
  jsResponse,
  logger,
  methodNotAllowed,
  Middleware,
  notFoundPureTsUi,
  observe,
  requestIdHeader,
  RouteMiddleware,
  sseEvery,
  sseSession,
  textResponse,
} from "./http.ts";

const hostname = "127.0.0.1";

type StartedServer = {
  baseUrl: string;
  close: () => Promise<void>;
};

const startServer = (
  handler: (req: Request) => Response | Promise<Response>,
): StartedServer => {
  const server = Deno.serve({ hostname, port: 0, onListen: () => {} }, handler);

  const addr = (server as unknown as { addr: { port: number } }).addr;
  const port = addr.port;

  const baseUrl = `http://${hostname}:${port}`;

  const close = async () => {
    const s = server as unknown as {
      shutdown?: () => void;
      finished?: Promise<unknown>;
    };
    try {
      s.shutdown?.();
    } finally {
      await (s.finished ?? Promise.resolve());
    }
  };

  return { baseUrl, close };
};

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const withTimeout = async <T>(p: Promise<T>, ms: number, label = "timeout") => {
  let id: number | undefined;
  const t = new Promise<never>((_, rej) => {
    id = setTimeout(() => rej(new Error(label)), ms) as unknown as number;
  });
  try {
    return await Promise.race([p, t]);
  } finally {
    if (id !== undefined) clearTimeout(id);
  }
};

// Drain a Response body to satisfy leak sanitizer.
// Works whether or not the body is empty; does not call cancel().
const drain = async (r: Response): Promise<void> => {
  try {
    await r.arrayBuffer();
  } catch {
    // If already consumed/locked, ignore.
  }
};

// For streaming responses like SSE: cancel if not fully drained.
const cancelQuietly = async (r: Response): Promise<void> => {
  try {
    await r.body?.cancel();
  } catch {
    // ignore
  }
};

type SseMessage = {
  event: string;
  data: string;
  raw: string;
};

const parseSseFrames = (text: string): SseMessage[] => {
  const frames = text.split(/\n\n/).map((s) => s.trimEnd()).filter((s) =>
    s.length > 0
  );
  const out: SseMessage[] = [];

  for (const raw of frames) {
    const lines = raw.split(/\r?\n/);
    let event = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) event = line.slice("event:".length).trim();
      if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trimStart());
      }
    }
    out.push({ event, data: dataLines.join("\n"), raw });
  }

  return out;
};

const readSseUntil = async (
  r: Response,
  pred: (acc: { text: string; messages: SseMessage[] }) => boolean,
  ms = 1500,
) => {
  const body = r.body;
  if (!body) throw new Error("SSE response has no body");

  const reader = body.getReader();
  const dec = new TextDecoder();

  let text = "";
  let messages: SseMessage[] = [];

  const run = (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        messages = parseSseFrames(text);
        if (pred({ text, messages })) break;
      }
      return { text, messages };
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
    }
  })();

  return await withTimeout(run, ms, "SSE read timeout");
};

Deno.test("response helpers set correct content-type and body", async (t) => {
  await t.step("textResponse", async () => {
    const r = textResponse("hi");
    if (r.status !== 200) throw new Error("status mismatch");
    if (r.headers.get("content-type") !== "text/plain; charset=utf-8") {
      throw new Error("content-type mismatch");
    }
    const body = await r.text();
    if (body !== "hi") throw new Error("body mismatch");
  });

  await t.step("htmlResponse", async () => {
    const r = htmlResponse("<h1>x</h1>", 201, { "x-test": "1" });
    if (r.status !== 201) throw new Error("status mismatch");
    if (r.headers.get("content-type") !== "text/html; charset=utf-8") {
      throw new Error("content-type mismatch");
    }
    if (r.headers.get("x-test") !== "1") throw new Error("header mismatch");
    const body = await r.text();
    if (body !== "<h1>x</h1>") throw new Error("body mismatch");
  });

  await t.step("jsonResponse", async () => {
    const r = jsonResponse({ a: 1 }, 202);
    if (r.status !== 202) throw new Error("status mismatch");
    if (r.headers.get("content-type") !== "application/json; charset=utf-8") {
      throw new Error("content-type mismatch");
    }
    const body = await r.text();
    if (body !== JSON.stringify({ a: 1 })) throw new Error("body mismatch");
  });

  await t.step("jsResponse", async () => {
    const r = jsResponse("console.log(1)", "max-age=60", 203);
    if (r.status !== 203) throw new Error("status mismatch");
    if (r.headers.get("content-type") !== "text/javascript; charset=utf-8") {
      throw new Error("content-type mismatch");
    }
    if (r.headers.get("cache-control") !== "max-age=60") {
      throw new Error("cache-control mismatch");
    }
    const body = await r.text();
    if (body !== "console.log(1)") throw new Error("body mismatch");
  });

  await t.step("methodNotAllowed", async () => {
    const r = methodNotAllowed("/x", "GET, POST");
    if (r.status !== 405) throw new Error("status mismatch");
    if (r.headers.get("allow") !== "GET, POST") {
      throw new Error("allow mismatch");
    }
    const body = await r.text();
    if (!body.includes("Method not allowed.")) throw new Error("body missing");
    if (!body.includes("Endpoint: /x")) {
      throw new Error("body missing endpoint");
    }
  });
});

Deno.test("sseSession basic behavior: send, keepalive, close behavior", async (t) => {
  await t.step(
    "sseSession emits event and data; close is idempotent",
    async () => {
      type Events = { hello: { x: number } };

      const s = sseSession<Events>({ keepAliveMs: 50 });
      await s.ready;

      const ok = s.send("hello", { x: 1 });
      if (!ok) throw new Error("send returned false");

      s.error("oops");
      s.close();
      s.close();
    },
  );

  await t.step("sseEvery sends periodic events and stop closes", async () => {
    type Events = { tick: number };

    const s = sseSession<Events>({ keepAliveMs: 25 });
    await s.ready;

    let n = 0;
    const stop = sseEvery(s, 10, "tick", () => ++n);

    await delay(35);
    stop();
    if (!s.isClosed()) throw new Error("session should be closed after stop()");
  });
});

Deno.test("composeMiddleware runs middlewares in expected order", async () => {
  const order: string[] = [];

  // deno-lint-ignore ban-types
  const mw1: Middleware<{}, {}> = async (_c, next) => {
    order.push("mw1:before");
    const res = await next();
    order.push("mw1:after");
    return res;
  };

  // deno-lint-ignore ban-types
  const mw2: Middleware<{}, {}> = async (_c, next) => {
    order.push("mw2:before");
    const res = await next();
    order.push("mw2:after");
    return res;
  };

  // deno-lint-ignore ban-types
  const composed = composeMiddleware<{}, {}>(mw1, mw2);

  // deno-lint-ignore ban-types
  const c = {} as HandlerCtx<string, {}, {}>;

  const r = await composed(
    c,
    () => {
      order.push("handler");
      return Promise.resolve(new Response("ok"));
    },
  );

  const text = await r.text();
  if (text !== "ok") throw new Error("response body mismatch");

  const expected = [
    "mw1:before",
    "mw2:before",
    "handler",
    "mw2:after",
    "mw1:after",
  ];
  if (order.join(",") !== expected.join(",")) {
    throw new Error(
      `order mismatch: ${order.join(",")} vs ${expected.join(",")}`,
    );
  }
});

Deno.test(
  "Router, params, middleware, typed vars, method not allowed, SSE (end-to-end server)",
  async (t) => {
    type State = { prefix: string };

    const app = Application.sharedState<State>({ prefix: "p:" }).withVars<
      { userId: string }
    >();

    const seen: string[] = [];

    app.use(observe({
      onRequest: (c) => seen.push(`obs:req:${c.requestId}`),
      onResponse: (c, _r, _ms) => seen.push(`obs:res:${c.requestId}`),
    }));

    app.use("/api", async (c, next) => {
      c.setVar("userId", "u-1");
      return await next();
    });

    app.get("/hello", (c) => c.text(`${c.state.prefix}hello`));

    app.get("/api/users/:id", (c) => {
      const userId = c.getVar("userId");
      return c.json({ id: c.params.id, q: c.query("q"), userId });
    });

    app.post("/api/users/:id", async (c) => {
      const body = await c.readJsonParsed((u) => {
        const v = u as { name?: unknown };
        if (typeof v?.name !== "string") throw new Error("name must be string");
        return { name: v.name };
      });
      return c.json({ id: c.params.id, name: body.name }, { status: 201 });
    });

    app.get("/only-get", (c) => c.text("ok"));

    app.route("/v1", (r) => {
      r.get("/ping", (c) => c.text("pong"));
    });

    app.get("/events", (c) =>
      c.sse<{ msg: string; done: true }>(
        async (s) => {
          await s.sendWhenReady("msg", "a");
          s.send("msg", "b");
          s.send("done", true);
        },
        { keepAliveMs: 25 },
      ));

    // Compile-time inference checks (type-check only)
    {
      void app.get("/typed/:x/:y", (c) => {
        const x: string = c.params.x;
        const y: string = c.params.y;
        return c.text(`${x}-${y}`);
      });

      // @ts-expect-error param name does not exist
      void app.get("/typed/:x", (c) => c.text(c.params.nope));

      void app.get("/vars", (c) => c.text(c.getVar("userId")));
    }

    const server = startServer((req) => app.fetch(req));
    try {
      await t.step("GET /hello returns text", async () => {
        const r = await fetch(`${server.baseUrl}/hello`);
        const body = await r.text();
        if (body !== "p:hello") throw new Error("body mismatch");
      });

      await t.step("GET /api/users/:id returns params/query/vars", async () => {
        const r = await fetch(`${server.baseUrl}/api/users/42?q=ok`);
        const j = await r.json();
        if (j.id !== "42") throw new Error("param mismatch");
        if (j.q !== "ok") throw new Error("query mismatch");
        if (j.userId !== "u-1") throw new Error("vars mismatch");
      });

      await t.step(
        "POST /api/users/:id reads json and returns 201",
        async () => {
          const r = await fetch(`${server.baseUrl}/api/users/7`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "N" }),
          });
          try {
            if (r.status !== 201) throw new Error("status mismatch");
            const j = await r.json();
            if (j.id !== "7") throw new Error("param mismatch");
            if (j.name !== "N") throw new Error("body mismatch");
          } finally {
            // json() consumes, so only drain defensively (no cancel)
            await drain(r);
          }
        },
      );

      await t.step(
        "method not allowed returns 405 with Allow header",
        async () => {
          const r = await fetch(`${server.baseUrl}/only-get`, {
            method: "POST",
          });
          if (r.status !== 405) throw new Error("expected 405");
          const allow = r.headers.get("allow") ?? "";
          if (!allow.includes("GET")) {
            throw new Error("allow should include GET");
          }
          await drain(r); // do not cancel
        },
      );

      await t.step("route() base path works: GET /v1/ping", async () => {
        const r = await fetch(`${server.baseUrl}/v1/ping`);
        const body = await r.text(); // consumes
        if (body !== "pong") throw new Error("body mismatch");
      });

      await t.step(
        "SSE endpoint streams events and shuts down cleanly",
        async () => {
          const ac = new AbortController();

          const r = await fetch(`${server.baseUrl}/events`, {
            headers: { accept: "text/event-stream" },
            signal: ac.signal,
          });

          if (r.status !== 200) throw new Error("status mismatch");
          const ct = r.headers.get("content-type") ?? "";
          if (!ct.startsWith("text/event-stream")) {
            throw new Error("content-type mismatch");
          }

          const out = await readSseUntil(
            r,
            ({ messages }) => messages.some((m) => m.event === "done"),
            1500,
          );

          const events = out.messages.map((m) => m.event);
          if (!events.includes("msg")) throw new Error("missing msg events");
          if (!events.includes("done")) throw new Error("missing done event");

          // We stop early; explicitly cancel streaming body.
          await cancelQuietly(r);
          ac.abort();

          await delay(30);
        },
      );

      await t.step("notFoundPureTsUi hints for static-like paths", async () => {
        const req = new Request(`${server.baseUrl}/assets/app.js`, {
          method: "GET",
        });
        const hintRoutes = ["/mod/app.ts", "/mod/runtime.ts"];
        const r = notFoundPureTsUi(req, hintRoutes);
        if (r.status !== 404) throw new Error("status mismatch");
        const body = await r.text();
        if (!body.includes("does not serve static files")) {
          throw new Error("missing explanation");
        }
        if (!body.includes("/mod/app.ts")) {
          throw new Error("missing hint route");
        }
      });

      await t.step("observability hooks fired", () => {
        const hasReq = seen.some((s) => s.startsWith("obs:req:"));
        const hasRes = seen.some((s) => s.startsWith("obs:res:"));
        if (!hasReq || !hasRes) throw new Error("expected observability hooks");
      });
    } finally {
      await server.close();
    }
  },
);

Deno.test(
  "middleware, error handling, mount, schema helpers, CORS, requestIdHeader, logger",
  async (t) => {
    type State = { tag: string };

    // Capture logs instead of emitting them.
    const capturedLogs: string[] = [];
    const capturedErrors: string[] = [];
    const origLog = console.log;
    const origError = console.error;

    console.log = (...args: unknown[]) => {
      capturedLogs.push(args.map((a) => String(a)).join(" "));
    };
    console.error = (...args: unknown[]) => {
      capturedErrors.push(args.map((a) => String(a)).join(" "));
    };

    try {
      const app = Application.sharedState<State>({ tag: "root" }).withVars<
        { auth?: string }
      >();

      app.use(logger());
      app.use(requestIdHeader());
      app.use(cors());

      app.onError((err, c) => {
        const msg = String(err instanceof Error ? err.message : err);
        return c.text(`handled:${msg}`, { status: 500 });
      });

      app.notFound((c) => c.text("nf", { status: 404 }));

      // Route-level middleware ordering
      const order: string[] = [];

      // deno-lint-ignore no-explicit-any
      const mw1: RouteMiddleware<"/mw/:id", State, any> = async (c, next) => {
        order.push(`mw1:${c.params.id}`);
        const res = await next();
        order.push("mw1-after");
        return res;
      };

      app.get("/mw/:id", mw1, (c) => {
        order.push(`handler:${c.params.id}`);
        return c.text("ok");
      });

      // Schema-aware helpers
      const schema = {
        parse(u: unknown): { n: string } {
          const v = u as { n?: unknown };
          if (typeof v.n !== "string") throw new Error("bad-body");
          return { n: v.n };
        },
      };

      app.postJson(
        "/json",
        schema,
        (c, body) => c.json({ got: body.n, method: c.req.method }),
      );

      app.putJson(
        "/json",
        schema,
        (c, body) => c.json({ got: body.n, method: c.req.method }),
      );

      // Simple route to inspect headers (CORS, requestIdHeader)
      app.get("/cors", (c) => c.text("ok"));

      // Route that throws to hit onError
      app.get("/boom", () => {
        throw new Error("boom");
      });

      // Child app mounted under /child
      const child = Application.sharedState<State>({ tag: "child" });
      child.get(
        "/info",
        (c) => c.json({ path: c.url.pathname, tag: c.state.tag }),
      );
      app.mount("/child", child);

      const server = startServer((req) => app.fetch(req));

      try {
        await t.step("route-level middleware runs around handler", async () => {
          const r = await fetch(`${server.baseUrl}/mw/123`);
          const body = await r.text();
          if (body !== "ok") throw new Error("body mismatch");
          const expected = ["mw1:123", "handler:123", "mw1-after"];
          if (order.join(",") !== expected.join(",")) {
            throw new Error(
              `route mw order mismatch: ${order.join(",")} vs ${
                expected.join(",")
              }`,
            );
          }
        });

        await t.step(
          "postJson and putJson use schema and return body",
          async () => {
            const r1 = await fetch(`${server.baseUrl}/json`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ n: "P" }),
            });
            const j1 = await r1.json();
            if (j1.got !== "P" || j1.method !== "POST") {
              throw new Error("postJson response mismatch");
            }
            await drain(r1);

            const r2 = await fetch(`${server.baseUrl}/json`, {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ n: "U" }),
            });
            const j2 = await r2.json();
            if (j2.got !== "U" || j2.method !== "PUT") {
              throw new Error("putJson response mismatch");
            }
            await drain(r2);
          },
        );

        await t.step("CORS middleware handles OPTIONS preflight", async () => {
          const r = await fetch(`${server.baseUrl}/json`, {
            method: "OPTIONS",
          });
          if (r.status !== 204) throw new Error("expected 204 for OPTIONS");
          const acao = r.headers.get("access-control-allow-origin");
          if (!acao) throw new Error("missing CORS allow-origin");
          const methods = r.headers.get("access-control-allow-methods") ?? "";
          if (!methods.includes("POST") || !methods.includes("PUT")) {
            throw new Error("missing CORS allow-methods");
          }
          await r.text(); // consume
        });

        await t.step(
          "CORS + requestIdHeader present on normal route",
          async () => {
            const r = await fetch(`${server.baseUrl}/cors`);
            const body = await r.text();
            if (body !== "ok") throw new Error("body mismatch");
            const acao = r.headers.get("access-control-allow-origin");
            if (!acao) throw new Error("missing CORS header on GET");
            const rid = r.headers.get("x-request-id");
            if (!rid || rid.length === 0) {
              throw new Error("missing x-request-id header");
            }
          },
        );

        await t.step(
          "onError handler converts thrown error to 500 response",
          async () => {
            const r = await fetch(`${server.baseUrl}/boom`);
            const body = await r.text();
            if (r.status !== 500) throw new Error("expected 500 status");
            if (!body.startsWith("handled:")) {
              throw new Error("onError did not handle error as expected");
            }
          },
        );

        await t.step("notFound handler handles unknown routes", async () => {
          const r = await fetch(`${server.baseUrl}/no-such-route`);
          const body = await r.text();
          if (r.status !== 404) throw new Error("expected 404");
          if (body !== "nf") throw new Error("notFound body mismatch");
        });

        await t.step("mount() routes child app under base path", async () => {
          const r = await fetch(`${server.baseUrl}/child/info`);
          const j = await r.json();
          if (j.path !== "/info") throw new Error("mounted path mismatch");
          if (j.tag !== "child") throw new Error("mounted state mismatch");
        });

        await t.step(
          "logger produced expected log lines (captured, not printed)",
          () => {
            const hasMw = capturedLogs.some((l) =>
              l.includes("GET /mw/123 -> 200")
            );
            const hasPostJson = capturedLogs.some((l) =>
              l.includes("POST /json -> 200")
            );
            const hasPutJson = capturedLogs.some((l) =>
              l.includes("PUT /json -> 200")
            );
            const hasOptionsJson = capturedLogs.some((l) =>
              l.includes("OPTIONS /json -> 204")
            );
            const hasCors = capturedLogs.some((l) =>
              l.includes("GET /cors -> 200")
            );
            const hasBoomError = capturedErrors.some((l) =>
              l.includes("GET /boom ERROR") && l.includes("Error: boom")
            );

            if (!hasMw) throw new Error("missing log for GET /mw/123");
            if (!hasPostJson) throw new Error("missing log for POST /json");
            if (!hasPutJson) throw new Error("missing log for PUT /json");
            if (!hasOptionsJson) {
              throw new Error("missing log for OPTIONS /json");
            }
            if (!hasCors) throw new Error("missing log for GET /cors");
            if (!hasBoomError) {
              throw new Error("missing error log for GET /boom");
            }
          },
        );
      } finally {
        await server.close();
      }
    } finally {
      // Restore console to avoid affecting other tests.
      console.log = origLog;
      console.error = origError;
    }
  },
);
