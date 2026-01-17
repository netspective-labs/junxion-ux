// lib/continuux/http-proxy_test.ts
//
// Validation + documentation tests for http-proxy.ts.
//
// These tests use real HTTP upstreams via Deno.serve and the Application
// router from http.ts as the "front" server, with httpProxy/httpProxyFromManifest
// added as middleware.
//
// Covered behaviors:
// - basic prefix proxy via httpProxyFromManifest
// - mount stripping and query forwarding
// - method filtering and fallback routing
// - request header rewrite (set/add/drop)
// - response header rewrite + security headers + hop-by-hop stripping
// - HEAD semantics (no body, headers preserved)
// - upstream timeout and the onProxyError hook
// - requireHttpsUpstream and allowedUpstreamHosts validation
// - maxRequestBodyBytes guard
// - onNoMatch fallback when no proxy route matches
//
// These tests aim to double as example usage for the proxy APIs.

import { assertEquals, assertMatch } from "@std/assert";
import {
  httpProxy,
  httpProxyFromManifest,
  type ProxyManifestRoute,
} from "./http-proxy.ts";
import { Application, textResponse, type VarsRecord } from "./http.ts";

// Small helper: run a test with a real HTTP upstream server.
// The upstream handler is passed to Deno.serve on port 0, and the callback
// receives the base URL (e.g. "http://127.0.0.1:12345").
async function withUpstreamServer(
  handler: (req: Request) => Response | Promise<Response>,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const ac = new AbortController();
  const server = Deno.serve(
    {
      hostname: "127.0.0.1",
      port: 0,
      signal: ac.signal,
      onListen: () => {},
    },
    handler,
  );

  const addr = server.addr as Deno.NetAddr;
  const base = `http://127.0.0.1:${addr.port}`;

  try {
    await fn(base);
  } finally {
    ac.abort();
  }
}

Deno.test(
  "http-proxy: basic prefix proxy via manifest with mount stripping and query forwarding",
  async () => {
    await withUpstreamServer(async (req) => {
      const url = new URL(req.url);
      const bodyText = await req.text();
      const json = {
        method: req.method,
        path: url.pathname,
        search: url.search,
        body: bodyText,
        headers: Object.fromEntries(req.headers),
      };
      return new Response(JSON.stringify(json), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-upstream": "echo",
        },
      });
    }, async (base) => {
      type State = Record<string, unknown>;
      type Vars = VarsRecord;

      const manifest: ProxyManifestRoute<State, Vars>[] = [
        {
          name: "api",
          mount: "/api",
          upstream: `${base}/backend`,
          stripMount: true,
          forwardQuery: true,
          methods: ["GET", "POST"],
        },
      ];

      const app = Application.sharedState<State, Vars>({} as State);

      app.use(
        httpProxyFromManifest<State, Vars>(manifest, {
          timeoutMs: 2_000,
        }),
      );

      // Fallback to prove that non-matching paths fall through.
      app.use((c) =>
        textResponse(`FALLBACK ${c.req.method} ${c.url.pathname}`, 200)
      );

      // GET with query, mapped:
      //   client:  /api/echo?x=1
      //   upstream base: `${base}/backend`
      //   stripMount: true → upstream: /backend/echo?x=1
      const req = new Request("http://localhost/api/echo?x=1", {
        method: "GET",
      });
      const res = await app.fetch(req);

      assertEquals(res.status, 200);
      assertEquals(res.headers.get("x-upstream"), "echo");

      const data = await res.json() as {
        method: string;
        path: string;
        search: string;
        body: string;
        headers: Record<string, string>;
      };

      assertEquals(data.method, "GET");
      assertEquals(data.path, "/backend/echo");
      assertEquals(data.search, "?x=1");
      assertEquals(data.body, "");
      assertEquals(data.headers["x-forwarded-host"], "localhost");
    });
  },
);

Deno.test(
  "http-proxy: method filtering and fallback when route does not allow method",
  async () => {
    await withUpstreamServer((_req) => {
      return new Response("should-not-be-called", { status: 500 });
    }, async (base) => {
      const app = Application.sharedState({});

      app.use(
        httpProxy({
          routes: [
            {
              name: "get-only",
              methods: ["GET"],
              match: (c) => c.url.pathname.startsWith("/api"),
              target: (c) =>
                `${base}${c.url.pathname.replace(/^\/api/, "/backend")}`,
            },
          ],
        }),
      );

      // Fallback that should handle POST since route is GET-only.
      app.use((c) =>
        textResponse(`FALLBACK ${c.req.method} ${c.url.pathname}`, 200)
      );

      const req = new Request("http://localhost/api/echo", {
        method: "POST",
        body: "payload",
      });
      const res = await app.fetch(req);

      assertEquals(res.status, 200);
      assertEquals(await res.text(), "FALLBACK POST /api/echo");
    });
  },
);

Deno.test(
  "http-proxy: manifest request header rewrite (set/add/drop)",
  async () => {
    await withUpstreamServer((req) => {
      const url = new URL(req.url);
      const json = {
        path: url.pathname,
        headers: Object.fromEntries(req.headers),
      };
      return new Response(JSON.stringify(json), {
        headers: { "content-type": "application/json" },
      });
    }, async (base) => {
      type State = Record<string, unknown>;
      type Vars = VarsRecord;

      const manifest: ProxyManifestRoute<State, Vars>[] = [
        {
          name: "api",
          mount: "/api",
          upstream: `${base}`,
          stripMount: false,
          forwardQuery: false,
          requestHeaders: {
            drop: ["x-drop-me"],
            set: { "x-set-me": "set-value" },
            add: { "x-add-me": "add-value" },
          },
        },
      ];

      const app = Application.sharedState<State, Vars>({} as State);

      app.use(
        httpProxyFromManifest<State, Vars>(manifest),
      );

      const req = new Request("http://localhost/api/echo", {
        method: "GET",
        headers: {
          "x-drop-me": "should-be-removed",
          "x-original": "keep-me",
        },
      });

      const res = await app.fetch(req);
      assertEquals(res.status, 200);

      const data = await res.json() as {
        path: string;
        headers: Record<string, string>;
      };

      assertEquals(data.path, "/api/echo");
      assertEquals(data.headers["x-original"], "keep-me");
      assertEquals(data.headers["x-set-me"], "set-value");
      assertEquals(data.headers["x-add-me"], "add-value");
      // x-drop-me should be absent from upstream.
      assertEquals(data.headers["x-drop-me"], undefined);
    });
  },
);

Deno.test(
  "http-proxy: response header rewrite and security headers plus hop-by-hop stripping",
  async () => {
    await withUpstreamServer((_req) => {
      return new Response("payload", {
        headers: {
          "Server": "nginx",
          "X-Powered-By": "PHP/8.0",
          "X-Upstream": "raw",
          "Connection": "keep-alive",
        },
      });
    }, async (base) => {
      const app = Application.sharedState({});

      app.use(
        httpProxy({
          routes: [
            {
              name: "headers",
              match: (c) => c.url.pathname === "/headers",
              target: () => `${base}/headers`,
              rewriteResponse: (_ctx, upstream) => {
                const h = new Headers(upstream.headers);
                h.set("x-route-rewritten", "true");
                return new Response(upstream.body, {
                  status: upstream.status,
                  headers: h,
                });
              },
            },
          ],
          securityHeaders: {
            "x-frame-options": "DENY",
            "content-security-policy": "default-src 'self'",
          },
        }),
      );

      const req = new Request("http://localhost/headers");
      const res = await app.fetch(req);

      assertEquals(res.status, 200);
      const text = await res.text();
      assertEquals(text, "payload");

      const headers = res.headers;
      // Hop-by-hop and noisy identity headers should be stripped.
      assertEquals(headers.get("server"), null);
      assertEquals(headers.get("x-powered-by"), null);
      assertEquals(headers.get("connection"), null);

      // Our upstream header should survive, as well as route rewrite.
      assertEquals(headers.get("x-upstream"), "raw");
      assertEquals(headers.get("x-route-rewritten"), "true");

      // Global security headers applied.
      assertEquals(headers.get("x-frame-options"), "DENY");
      assertEquals(
        headers.get("content-security-policy"),
        "default-src 'self'",
      );
    });
  },
);

Deno.test(
  "http-proxy: HEAD requests strip body but keep headers",
  async () => {
    await withUpstreamServer((_req) => {
      return new Response("body-ignored", {
        headers: {
          "x-upstream": "head-test",
          "content-type": "text/plain; charset=utf-8",
        },
      });
    }, async (base) => {
      const app = Application.sharedState({});

      app.use(
        httpProxy({
          routes: [
            {
              name: "head",
              match: (c) => c.url.pathname === "/head",
              target: () => `${base}/head`,
            },
          ],
        }),
      );

      const req = new Request("http://localhost/head", { method: "HEAD" });
      const res = await app.fetch(req);

      assertEquals(res.status, 200);
      const body = await res.text();
      assertEquals(body, "");

      const ct = res.headers.get("content-type") ?? "";
      assertMatch(ct, /text\/plain/);
      assertEquals(res.headers.get("x-upstream"), "head-test");
    });
  },
);

Deno.test(
  "http-proxy: upstream timeout triggers onProxyError and 504",
  async () => {
    await withUpstreamServer((_req) => {
      // Simulate a slow upstream without timers (busy-wait ~100ms).
      const start = Date.now();
      while (Date.now() - start < 100) {
        // busy loop to exceed proxy timeout
      }
      return new Response("too-late", { headers: { "x-upstream": "slow" } });
    }, async (base) => {
      const app = Application.sharedState({});

      let errorKind: string | undefined;

      app.use(
        httpProxy({
          routes: [
            {
              name: "slow",
              match: (c) => c.url.pathname === "/slow",
              target: () => `${base}/slow`,
            },
          ],
          timeoutMs: 10, // 10ms, much smaller than upstream delay
          onProxyError: (_c, kind) => {
            errorKind = kind;
          },
        }),
      );

      const req = new Request("http://localhost/slow");
      const res = await app.fetch(req);

      assertEquals(errorKind, "upstream-timeout");
      assertEquals(res.status, 504);
      const text = await res.text();
      assertMatch(text, /Gateway Timeout/);
    });
  },
);

Deno.test(
  "http-proxy: requireHttpsUpstream and allowedUpstreamHosts validation",
  async () => {
    // No real upstream server needed; validation happens before fetch.
    const app = Application.sharedState({});

    app.use(
      httpProxy({
        routes: [
          {
            name: "insecure",
            match: (c) => c.url.pathname === "/insecure",
            target: () => "http://example.com/any",
          },
          {
            name: "disallowed-host",
            match: (c) => c.url.pathname === "/blocked",
            target: () => "https://not-allowed.example/blocked",
          },
        ],
        requireHttpsUpstream: true,
        allowedUpstreamHosts: (host) => host === "allowed.example",
      }),
    );

    // Insecure upstream protocol should be rejected with 502.
    {
      const req = new Request("http://localhost/insecure");
      const res = await app.fetch(req);
      assertEquals(res.status, 502);
      const text = await res.text();
      assertMatch(text, /Upstream protocol must be HTTPS/);
    }

    // Disallowed host should be rejected with 502 as well.
    {
      const req = new Request("http://localhost/blocked");
      const res = await app.fetch(req);
      assertEquals(res.status, 502);
      const text = await res.text();
      assertMatch(text, /Upstream host is not permitted/);
    }
  },
);

Deno.test(
  "http-proxy: maxRequestBodyBytes returns 413 for oversized payloads",
  async () => {
    // No need for a real upstream; max body guard short-circuits before fetch.
    const app = Application.sharedState({});

    app.use(
      httpProxy({
        routes: [
          {
            name: "body-limit",
            match: (c) => c.url.pathname === "/upload",
            target: () => "http://example.com/upload",
          },
        ],
        maxRequestBodyBytes: 5, // bytes
      }),
    );

    const req = new Request("http://localhost/upload", {
      method: "POST",
      body: "123456", // 6 bytes, exceeds limit
    });

    const res = await app.fetch(req);
    assertEquals(res.status, 413);
    const text = await res.text();
    assertMatch(text, /Payload Too Large/);
  },
);

Deno.test(
  "http-proxy: onNoMatch fallback when no proxy route matches",
  async () => {
    // No upstream needed; we test the onNoMatch path.
    const app = Application.sharedState({});

    app.use(
      httpProxy({
        routes: [
          {
            name: "foo",
            match: (c) => c.url.pathname.startsWith("/foo"),
            target: () => "http://example.com/foo",
          },
        ],
        onNoMatch: (c) =>
          textResponse(`NO_MATCH ${c.req.method} ${c.url.pathname}`, 404),
      }),
    );

    const req = new Request("http://localhost/bar");
    const res = await app.fetch(req);

    assertEquals(res.status, 404);
    assertEquals(await res.text(), "NO_MATCH GET /bar");
  },
);
