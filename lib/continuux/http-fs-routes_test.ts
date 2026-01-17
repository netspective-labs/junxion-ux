// lib/continuux/http-fs-routes_test.ts
//
// Validation + documentation tests for http-fs-routes.ts.
//
// These tests exercise:
// - basic static file serving under a mount
// - index routes (index.html -> / and /foo/index.html -> /foo)
// - dynamic segments ([slug].ext -> /:slug)
// - catch-all segments ([...rest].ext -> /*rest)
// - route groups ((group)/file.ext ignored in URL)
// - hidden segments (_internal, .hidden) not routable
// - multiple mounts
// - loader hook for special extensions (e.g. .md)
// - HEAD semantics (no body)
// - ETag / Last-Modified / cache-control
// - manifest introspection
// - content transforms (synthetic, for documentation)
//
// They also act as examples of how to use httpFsRoutes with the Application
// router from http.ts.

import { assert, assertEquals, assertMatch, assertRejects } from "@std/assert";
import * as path from "@std/path";
import {
  buildFsRouteManifest,
  type FsContentTransform,
  type FsRouteMatchInfo,
  type FsRoutesMount,
  httpFsRoutes,
} from "./http-fs-routes.ts";
import { Application, textResponse, type VarsRecord } from "./http.ts";

// Helper to create a temporary workspace for a single test.
async function withTempDir(
  fn: (root: string) => Promise<void>,
): Promise<void> {
  const dir = await Deno.makeTempDir({ prefix: "http-fs-routes-test-" });
  try {
    await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

// Small helper to write a text file ensuring parent dirs exist.
async function writeFile(root: string, relPath: string, content: string) {
  const full = path.join(root, relPath);
  await Deno.mkdir(path.dirname(full), { recursive: true });
  await Deno.writeTextFile(full, content);
}

// Create an Application wired with httpFsRoutes, then run an in-memory fetch.
async function makeAppAndFetch<
  State extends Record<string, unknown> = Record<string, unknown>,
  Vars extends VarsRecord = VarsRecord,
>(
  mounts: FsRoutesMount[],
  urlPath: string,
  init?: RequestInit,
  extra?: {
    loader?: (
      info: FsRouteMatchInfo,
    ) => Response | null | undefined | Promise<Response | null | undefined>;
    cacheControl?: string;
    etag?: "weak" | "strong" | false;
    enableLastModified?: boolean;
    transforms?: FsContentTransform<State, Vars>[];
  },
): Promise<Response> {
  const app = Application.sharedState<State, Vars>({} as State);

  app.use(
    httpFsRoutes<State, Vars>({
      mounts,
      loader: extra?.loader ? (_c, info) => extra.loader!(info) : undefined,
      cacheControl: extra?.cacheControl,
      etag: extra?.etag,
      enableLastModified: extra?.enableLastModified,
      transforms: extra?.transforms,
    }),
  );

  // Fallback notFound for clarity in tests.
  app.notFound((c) =>
    textResponse(`NOT_FOUND ${c.req.method} ${c.url.pathname}`, 404)
  );

  const req = new Request(`http://localhost${urlPath}`, init);
  return await app.fetch(req);
}

Deno.test("http-fs-routes: basic static file under root mount", async () => {
  await withTempDir(async (root) => {
    await writeFile(root, "hello.txt", "Hello FS Routes");

    const mounts: FsRoutesMount[] = [
      { mount: "/", root },
    ];

    // For non-index files, the route is based on the basename without extension:
    // hello.txt -> /hello
    const res = await makeAppAndFetch(mounts, "/hello");
    assertEquals(res.status, 200);

    const body = await res.text();
    assertEquals(body, "Hello FS Routes");

    // Some environments may or may not set a content-type for .txt.
    const ct = res.headers.get("content-type");
    if (ct) {
      assertMatch(ct, /text\/plain/);
    }
  });
});

Deno.test("http-fs-routes: index routes and nested index routes", async () => {
  await withTempDir(async (root) => {
    // Root-level index -> "/"
    await writeFile(root, "index.html", "<h1>Root Index</h1>");

    // Nested index -> "/guide"
    await writeFile(root, "guide/index.html", "<h1>Guide Index</h1>");

    const mounts: FsRoutesMount[] = [
      { mount: "/docs", root },
    ];

    // /docs should come from root index.html under the mount.
    {
      const res = await makeAppAndFetch(mounts, "/docs");
      assertEquals(res.status, 200);
      assertEquals(await res.text(), "<h1>Root Index</h1>");
    }

    // /docs/guide should come from guide/index.html.
    {
      const res = await makeAppAndFetch(mounts, "/docs/guide");
      assertEquals(res.status, 200);
      assertEquals(await res.text(), "<h1>Guide Index</h1>");
    }

    // Trailing slash should also work (/docs/guide/).
    {
      const res = await makeAppAndFetch(mounts, "/docs/guide/");
      assertEquals(res.status, 200);
      assertEquals(await res.text(), "<h1>Guide Index</h1>");
    }
  });
});

Deno.test("http-fs-routes: dynamic segment [slug] -> /:slug with loader", async () => {
  await withTempDir(async (root) => {
    await writeFile(root, "[slug].txt", "Dynamic file");

    const mounts: FsRoutesMount[] = [
      { mount: "/blog", root },
    ];

    const res = await makeAppAndFetch(
      mounts,
      "/blog/hello-world",
      undefined,
      {
        loader: (info) => {
          // Document params and mapping in the response.
          const body = JSON.stringify({
            template: info.template,
            routePath: info.routePath,
            params: info.params,
            filePath: path.relative(root, info.filePath),
          });
          return new Response(body, {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
      },
    );

    assertEquals(res.status, 200);
    const json = await res.json() as {
      template: string;
      routePath: string;
      params: Record<string, string>;
      filePath: string;
    };

    assertEquals(json.template, "/blog/:slug");
    assertEquals(json.routePath, "/blog/:slug");
    assertEquals(json.params.slug, "hello-world");
    assertEquals(json.filePath, "[slug].txt");
  });
});

Deno.test("http-fs-routes: catch-all segment [...rest] -> /*rest", async () => {
  await withTempDir(async (root) => {
    await writeFile(root, "posts/[...rest].html", "<h1>Catch-all</h1>");

    const mounts: FsRoutesMount[] = [
      { mount: "/docs", root },
    ];

    const res = await makeAppAndFetch(
      mounts,
      "/docs/posts/a/b/c",
      undefined,
      {
        loader: (info) => {
          const body = JSON.stringify({
            template: info.template,
            params: info.params,
          });
          return new Response(body, {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
      },
    );

    assertEquals(res.status, 200);
    const json = await res.json() as {
      template: string;
      params: Record<string, string>;
    };
    assertEquals(json.template, "/docs/posts/*rest");
    assertEquals(json.params.rest, "a/b/c");
  });
});

Deno.test("http-fs-routes: route groups and hidden segments", async () => {
  await withTempDir(async (root) => {
    // "(marketing)/[slug].html" -> /site/:slug
    await writeFile(
      root,
      "(marketing)/[slug].html",
      "<h1>Marketing Page</h1>",
    );

    // "_internal/secret.html" should never be routable.
    await writeFile(
      root,
      "_internal/secret.html",
      "<h1>Secret</h1>",
    );

    const mounts: FsRoutesMount[] = [
      { mount: "/site", root },
    ];

    // Route group segment should be stripped from URL.
    {
      const res = await makeAppAndFetch(
        mounts,
        "/site/landing",
        undefined,
        {
          loader: (info) =>
            new Response(
              JSON.stringify({
                routePath: info.routePath,
                params: info.params,
              }),
              { headers: { "content-type": "application/json" } },
            ),
        },
      );

      assertEquals(res.status, 200);
      const json = await res.json() as {
        routePath: string;
        params: Record<string, string>;
      };
      assertEquals(json.routePath, "/site/:slug");
      assertEquals(json.params.slug, "landing");
    }

    // Hidden segments starting with "_" should not be exposed as routes.
    {
      const res = await makeAppAndFetch(mounts, "/site/_internal/secret.html");
      assertEquals(res.status, 404);
      assertMatch(await res.text(), /^NOT_FOUND/);
    }
  });
});

Deno.test("http-fs-routes: multiple mounts", async () => {
  await withTempDir(async (root) => {
    const docsRoot = path.join(root, "docs");
    const assetsRoot = path.join(root, "assets");

    await writeFile(docsRoot, "intro.txt", "Docs Intro");
    await writeFile(assetsRoot, "logo.svg", "<svg>logo</svg>");

    const mounts: FsRoutesMount[] = [
      { mount: "/docs", root: docsRoot },
      { mount: "/assets", root: assetsRoot },
    ];

    // intro.txt -> /docs/intro
    {
      const res = await makeAppAndFetch(mounts, "/docs/intro");
      assertEquals(res.status, 200);
      assertEquals(await res.text(), "Docs Intro");
    }

    // logo.svg -> /assets/logo
    {
      const res = await makeAppAndFetch(mounts, "/assets/logo");
      assertEquals(res.status, 200);
      assertEquals(await res.text(), "<svg>logo</svg>");
    }
  });
});

Deno.test("http-fs-routes: HEAD requests strip body but keep headers", async () => {
  await withTempDir(async (root) => {
    await writeFile(root, "hello.txt", "Hello for HEAD");

    const mounts: FsRoutesMount[] = [
      { mount: "/", root },
    ];

    // hello.txt -> /hello
    const res = await makeAppAndFetch(
      mounts,
      "/hello",
      { method: "HEAD" },
    );

    assertEquals(res.status, 200);
    const text = await res.text();
    assertEquals(text, ""); // body stripped

    const ct = res.headers.get("content-type");
    if (ct) {
      assertMatch(ct, /text\/plain/);
    }
  });
});

Deno.test("http-fs-routes: non-GET/HEAD methods fall through to next handler", async () => {
  await withTempDir(async (root) => {
    await writeFile(root, "hello.txt", "Hello for POST");

    const app = Application.sharedState({});

    app.use(
      httpFsRoutes({
        mounts: [{ mount: "/", root }],
      }),
    );

    // A simple "fallback" handler to verify that POST bypasses FS routes.
    app.use((c, _next) => {
      return textResponse(`FALLBACK ${c.req.method} ${c.url.pathname}`, 200);
    });

    const req = new Request("http://localhost/hello", { method: "POST" });
    const res = await app.fetch(req);
    assertEquals(res.status, 200);
    assertEquals(await res.text(), "FALLBACK POST /hello");
  });
});

Deno.test("http-fs-routes: ETag and Last-Modified with conditional requests", async () => {
  await withTempDir(async (root) => {
    const fileRel = "cached.txt";
    const filePath = path.join(root, fileRel);
    await writeFile(root, fileRel, "Cached content");

    const mounts: FsRoutesMount[] = [
      { mount: "/", root },
    ];

    // First response: ensure Last-Modified is set and cache-control applied.
    const first = await makeAppAndFetch(
      mounts,
      "/cached",
      undefined,
      {
        cacheControl: "public, max-age=60",
        etag: false,
        enableLastModified: true,
      },
    );

    assertEquals(first.status, 200);
    const firstLastModified = first.headers.get("last-modified");
    assert(firstLastModified);

    const cacheControl = first.headers.get("cache-control");
    assertEquals(cacheControl, "public, max-age=60");

    // For deterministic 304 behavior, send an If-Modified-Since in the future
    // (relative to the file's mtime).
    const stat = await Deno.stat(filePath);
    assert(stat.mtime);
    const futureMs = stat.mtime!.getTime() + 24 * 60 * 60 * 1000;
    const futureDate = new Date(futureMs).toUTCString();

    const second = await makeAppAndFetch(
      mounts,
      "/cached",
      {
        headers: {
          "if-modified-since": futureDate,
        },
      },
      {
        cacheControl: "public, max-age=60",
        etag: false,
        enableLastModified: true,
      },
    );

    assertEquals(second.status, 304);
    const body = await second.text();
    assertEquals(body, "");
  });
});

Deno.test("http-fs-routes: weak ETag and If-None-Match", async () => {
  await withTempDir(async (root) => {
    await writeFile(root, "etag.txt", "ETag content");

    const mounts: FsRoutesMount[] = [
      { mount: "/", root },
    ];

    // etag.txt -> /etag
    const first = await makeAppAndFetch(
      mounts,
      "/etag",
      undefined,
      {
        cacheControl: "public, max-age=60",
        etag: "weak",
        enableLastModified: false,
      },
    );

    assertEquals(first.status, 200);
    const etag = first.headers.get("etag");
    assert(etag);

    const second = await makeAppAndFetch(
      mounts,
      "/etag",
      {
        headers: {
          "if-none-match": etag,
        },
      },
      {
        cacheControl: "public, max-age=60",
        etag: "weak",
        enableLastModified: false,
      },
    );

    assertEquals(second.status, 304);
    assertEquals(await second.text(), "");
  });
});

Deno.test("http-fs-routes: manifest describes compiled routes", async () => {
  await withTempDir(async (root) => {
    await writeFile(root, "index.html", "Home");
    await writeFile(root, "[slug].html", "Slug");
    await writeFile(root, "nested/[...rest].html", "Rest");

    const mounts: FsRoutesMount[] = [
      { mount: "/docs", root },
    ];

    const manifest = await buildFsRouteManifest(mounts);

    // We expect a manifest entry for each routable file.
    assertEquals(manifest.length, 3);

    const templates = manifest.map((r) => r.template).sort();
    assertEquals(templates, [
      "/docs",
      "/docs/:slug",
      "/docs/nested/*rest",
    ]);

    // The manifest entries carry basic metadata that can be used for docs.
    const docsIndex = manifest.find((r) => r.template === "/docs");
    assert(docsIndex);
    assertEquals(path.relative(root, docsIndex.filePath), "index.html");
  });
});

// Synthetic transformation: uppercase transform for .txt files
Deno.test("http-fs-routes: content transform can rewrite body", async () => {
  await withTempDir(async (root) => {
    await writeFile(root, "note.txt", "hello world");

    const mounts: FsRoutesMount[] = [
      { mount: "/", root },
    ];

    const td = new TextDecoder();

    const transforms: FsContentTransform<
      Record<string, unknown>,
      VarsRecord
    >[] = [
      {
        match: (info) => info.ext === ".txt",
        transform: (_ctx, _info, content, baseHeaders) => {
          const text = td.decode(content).toUpperCase();
          // Ensure we keep any pre-populated headers (like content-type).
          baseHeaders.set("x-transformed", "uppercase");
          return text;
        },
      },
    ];

    const res = await makeAppAndFetch(
      mounts,
      "/note",
      undefined,
      { transforms },
    );

    assertEquals(res.status, 200);
    assertEquals(await res.text(), "HELLO WORLD");
    assertEquals(res.headers.get("x-transformed"), "uppercase");
  });
});

// Synthetic transformation: object result with headers + status override
Deno.test("http-fs-routes: content transform can override headers and status", async () => {
  await withTempDir(async (root) => {
    await writeFile(root, "data.json", `{"value": 1}`);

    const mounts: FsRoutesMount[] = [
      { mount: "/", root },
    ];

    const td = new TextDecoder();

    const transforms: FsContentTransform<
      Record<string, unknown>,
      VarsRecord
    >[] = [
      {
        match: (info) => info.ext === ".json",
        transform: (_ctx, info, content, baseHeaders) => {
          const original = td.decode(content);
          const wrapped = JSON.stringify({
            route: info.template,
            original: JSON.parse(original),
          });

          // Show how to override headers and status while reusing the base.
          return {
            body: wrapped,
            status: 201,
            headers: {
              ...Object.fromEntries(baseHeaders.entries()),
              "x-transformed": "wrapped-json",
            },
          };
        },
      },
    ];

    const res = await makeAppAndFetch(
      mounts,
      "/data",
      undefined,
      { transforms },
    );

    assertEquals(res.status, 201);
    const json = await res.json() as {
      route: string;
      original: { value: number };
    };
    assertEquals(json.route, "/data");
    assertEquals(json.original.value, 1);
    assertEquals(res.headers.get("x-transformed"), "wrapped-json");
  });
});

// Basic negative test: malformed mount config should throw at middleware creation.
Deno.test("http-fs-routes: requires at least one mount", async () => {
  await assertRejects(
    // deno-lint-ignore require-await
    async () => {
      httpFsRoutes({ mounts: [] });
    },
  );
});
