#!/usr/bin/env -S deno run -A --watch --unstable-bundle --node-modules-dir=auto
// support/assurance/counter/server.ts
//
// End-to-end counter assurance server.
// - Pure TypeScript UI (no filesystem static serving, no public/ directory)
// - Bundles browser modules in-memory via Deno.bundle and serves JS endpoints
// - Demonstrates fragment updates via POST + SSE streaming fragments
//
// Run:
//   ./support/assurance/counter/server.ts
//
// Open:
//   http://127.0.0.1:8000/

import * as H from "../../../lib/html/server/fluent.ts";
import {
  htmlResponse,
  InMemoryBundler,
  notFoundPureTsUi,
  sseEvery,
  sseSession,
  textResponse,
} from "../../../lib/http/server.ts";

let count = 0;

// Custom element tag fn (server-side fluent)
const JxCounter = H.customElement("jx-counter");

// Module entrypoints (TS only, resolved relative to this file)
const runtimeEntry = import.meta.resolve(
  "../../../src/html/browser-ua/runtime.ts",
);

const counterElementEntry = import.meta.resolve(
  "./counter-element.ts",
);

// In-memory bundler with cache
const bundler = new InMemoryBundler({ defaultMinify: true });

// Warm the runtime bundle at startup so the first page load is fast.
// If it fails, hard fail with a clear message.
{
  const r = await bundler.bundle(runtimeEntry, { cacheKey: "runtime.auto.js" });
  if (!r.ok) {
    throw new Error(
      [
        "Startup failed: unable to bundle runtime module.",
        "",
        r.message,
      ].join("\n"),
    );
  }
}

// HTML fragment (outer swap target)
const fragmentHtml = () => H.render(JxCounter({ count }));

// Full page HTML (no external CSS, no CDNs)
const pageHtml = () => {
  const runtimeUrl = "/runtime.auto.js";
  const counterUrl = "/counter-element.auto.js";

  return H.render(
    H.doctype(),
    H.html(
      { lang: "en" },
      H.head(
        H.meta({ charset: "utf-8" }),
        H.meta({
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        }),
        H.title("JunxionUX Counter Assurance"),
        H.styleCss(`
          :root { color-scheme: light dark; }
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; }
          main { max-width: 760px; margin: 0 auto; padding: 24px; }
          h1 { margin: 0 0 12px 0; }
          .card { padding: 1rem; border: 1px solid rgba(127,127,127,0.35); border-radius: 12px; }
          .row { display: flex; gap: 0.5rem; align-items: baseline; margin: 0.5rem 0; }
          .label { opacity: 0.7; }
          .value { font-size: 1.25rem; }
          .hint { opacity: 0.7; font-size: 0.95rem; margin-top: 0.75rem; }
          button { padding: 0.5rem 0.75rem; border-radius: 10px; border: 1px solid rgba(127,127,127,0.35); background: transparent; cursor: pointer; }
          button:hover { filter: brightness(0.97); }
        `),
      ),
      H.body(
        H.main(
          H.h1("Counter"),
          JxCounter({ count }),
          H.p(
            { class: "hint" },
            "Increment triggers POST /inc which returns a fragment that replaces the custom element. ",
            "SSE pushes fragment events via /events.",
          ),
        ),
        H.scriptJs(
          [
            `import { enhance } from ${JSON.stringify(runtimeUrl)};`,
            `import ${JSON.stringify(counterUrl)};`,
            `enhance();`,
          ].join("\n"),
          { type: "module" },
        ),
      ),
    ),
  );
};

const knownModuleRoutes = [
  "/runtime.auto.js",
  "/counter-element.auto.js",
];

const methodNotAllowed = (path: string, allow: string) =>
  textResponse(
    [
      "Method not allowed.",
      "",
      `Endpoint: ${path}`,
      `Allowed: ${allow}`,
    ].join("\n"),
    405,
    { "allow": allow },
  );

Deno.serve({ hostname: "127.0.0.1", port: 8000 }, async (req) => {
  const url = new URL(req.url);

  // Index page
  if (url.pathname === "/" && req.method === "GET") {
    return htmlResponse(pageHtml());
  }

  // Bundled runtime JS (pre-warmed and cached)
  if (url.pathname === "/runtime.auto.js") {
    if (req.method !== "GET") {
      return methodNotAllowed("/runtime.auto.js", "GET");
    }
    return await bundler.jsModuleResponse(runtimeEntry, {
      cacheKey: "runtime.auto.js",
      minify: true,
      cacheControl: "no-store",
    });
  }

  // Bundled counter element JS (on-demand, cached)
  if (url.pathname === "/counter-element.auto.js") {
    if (req.method !== "GET") {
      return methodNotAllowed("/counter-element.auto.js", "GET");
    }
    return await bundler.jsModuleResponse(counterElementEntry, {
      cacheKey: "counter-element.auto.js",
      minify: true,
      cacheControl: "no-store",
    });
  }

  // Fragment update endpoint (pull)
  if (url.pathname === "/inc") {
    if (req.method !== "POST") return methodNotAllowed("/inc", "POST");
    count++;
    return htmlResponse(fragmentHtml());
  }

  // SSE endpoint (push fragments)
  if (url.pathname === "/events") {
    if (req.method !== "GET") return methodNotAllowed("/events", "GET");

    const session = sseSession();

    // Initial push so the client always gets a first fragment quickly.
    session.send("fragment", fragmentHtml());

    // Periodic pushes; automatically stops when client disconnects.
    const stop = sseEvery(session, 2000, () => ({
      event: "fragment",
      data: fragmentHtml(),
    }));

    // Hard stop after 60 seconds for assurance runs.
    const stopTimer = setTimeout(() => {
      stop();
    }, 60_000);

    // Ensure timer is cleared when the stream closes naturally.
    const prevClose = session.close;
    session.close = () => {
      clearTimeout(stopTimer);
      prevClose();
    };

    return session.response;
  }

  return notFoundPureTsUi(req, knownModuleRoutes);
});
