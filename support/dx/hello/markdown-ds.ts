#!/usr/bin/env -S deno run -A --watch --unstable-bundle --node-modules-dir=auto
// support/dx/hello/markdown-ds.ts
/**
 * ContinuUX "Hello World" (Markdown + Design System) app.
 *
 * What this demonstrates end-to-end:
 * - Fluent DS semantic layout on the server (no templating engine).
 * - Fully type-safe HTTP routing (Application).
 * - Design system stylesheet auto-included via semanticLayout().
 * - Browser-only Markdown rendering using remark from CDN:
 *   - Fetch /example.md (example markdown)
 *   - Render it to HTML in the browser
 *
 * Run:
 *   deno run -A --unstable-bundle support/dx/hello/markdown-ds.ts
 *
 * Then open:
 *   http://127.0.0.1:8000
 */

import { autoTsJsBundler } from "../../../lib/continuux/bundle.ts";
import { Application } from "../../../lib/continuux/http.ts";
import {
  p,
  render,
  semanticLayout,
} from "../../../lib/universal/fluent-ds-semantic.ts";
import {
  trustedRaw,
  render as renderHtml,
  codeTag,
  div,
  h2,
  script,
  small,
  style,
} from "../../../lib/universal/fluent-html.ts";

type State = Record<string, never>;
type Vars = Record<string, never>;

const app = Application.sharedState<State, Vars>({});

const exampleMarkdown = `# Hello Markdown

This page demonstrates:

- Fluent DS semantic layout
- Remark (markdown -> HTML) in the browser
- Strongly typed client TS, auto-bundled to JS by the server

## Try editing this markdown

If you change /example.md, refresh the page and you will see the updated render.
`;

const pageLayout = () => {
  // semanticLayout() returns HTML plus dependency metadata you can mount.
  return semanticLayout({
    variant: "centered",
    lang: "en",
    title: "ContinuUX Hello Markdown (DS)",
    head: () =>
      trustedRaw(
        renderHtml(
          style(`
          :root {
            font-size: 90%;
          }
          `),
          script({ type: "module", src: "/markdown.client.ts" }),
        ),
        "markdown-ds head",
      ),
    shell: ({ header, content, footer }) => ({
      header: header.use("minimal", { title: "ContinuUX" }),
      content: content.use("standard", {
        pageTitle: "Hello Markdown",
        description: p(
          "Fluent DS + remark in-browser markdown rendering (bundled TS).",
        ),
        body: [
          h2("Rendered content"),
          div({ id: "status", "aria-busy": "true" }, "Loading markdown..."),
          div({ id: "content" }, ""),
          small(
            { style: "display:block; margin-top: 1rem;" },
            "Client code is served from ",
            codeTag("/markdown.client.ts"),
            " (bundled from TypeScript).",
          ),
        ],
      }),
      footer: footer.use("empty", {}),
    }),
  });
};

const pageHtml = (): string => {
  const page = pageLayout();

  // If you want to host dependencies yourself, mount them at page.dependencies.
  // For example, the default stylesheet is mounted at /fluent-ds/semantic.css.
  return render(page.html);
};

const cssResponse = async (path: string) =>
  new Response(await Deno.readTextFile(path), {
    headers: { "content-type": "text/css; charset=utf-8" },
  });

// Put middleware BEFORE routes.
// 1) Add a top-level request logger middleware FIRST.
app.use(async (c, next) => {
  const u = new URL(c.req.url);
  console.log("[req]", c.req.method, u.pathname);
  return await next();
});

// Bundle the strongly-typed client TS into browser JS on demand (cached in memory).
app.use(
  autoTsJsBundler({
    isCandidate: (url) =>
      url.pathname == "/markdown.client.ts"
        ? new URL("./markdown.client.ts", import.meta.url).pathname
        : false,
    jsThrowStatus: () => 200, // show message in the browser
  }),
);

app.get("/", () =>
  new Response(pageHtml(), {
    headers: { "content-type": "text/html; charset=utf-8" },
  }));

app.get("/example.md", () =>
  new Response(exampleMarkdown, {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  }));

app.get(
  "/fluent-ds/semantic.css",
  () =>
    cssResponse(
      new URL("../../../lib/universal/fluent-ds-semantic.css", import.meta.url)
        .pathname,
    ),
);

app.serve();
