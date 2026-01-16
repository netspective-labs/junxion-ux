// support/assurance/hello/markdown.ts
/**
 * ContinuUX “Hello World” (Markdown) app.
 *
 * What this demonstrates end-to-end:
 * - Fluent HTML on the server (no templating engine).
 * - Fully type-safe HTTP routing (Application).
 * - PicoCSS via CDN (no build step).
 * - Browser-only Markdown rendering using remark from CDN:
 *   - Fetch /README.md (example markdown)
 *   - Render it to HTML in the browser
 *
 * Run:
 *   deno run -A support/assurance/hello/markdown.ts
 *
 * Then open:
 *   http://127.0.0.1:8000
 */

import * as H from "../../../lib/continuux/html.ts";
import { Application } from "../../../lib/continuux/http.ts";

type State = Record<string, never>;
type Vars = Record<string, never>;

const app = Application.sharedState<State, Vars>({});

const exampleMarkdown = `# ContinuUX Markdown Demo

This is a tiny example showing:

- PicoCSS from a CDN
- \`remark\` + \`remark-html\` from a CDN
- Rendering Markdown to HTML **in the browser**
- The server stays simple and type-safe

## Notes

- Markdown is fetched from \`/README.md\`
- Rendering happens in a \`<script type="module">\`
- This is intentionally a “support/assurance” style example
`;

const pageHtml = (): string => {
  const picoHref =
    "https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css";

  return H.render(
    H.doctype(),
    H.html(
      H.head(
        H.meta({ charset: "utf-8" }),
        H.meta({
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        }),
        H.title("ContinuUX Hello (Markdown)"),
        H.link({ rel: "stylesheet", href: picoHref }),
      ),
      H.body(
        H.main(
          { class: "container", style: "max-width: 900px; padding-top: 2rem;" },
          H.hgroup(
            H.h1("ContinuUX Hello"),
            H.p("Markdown rendered in the browser using remark (CDN)"),
          ),
          H.article(
            H.div({ id: "status", style: "margin-bottom: 1rem;" }, "Loading…"),
            H.div({ id: "content" }, ""),
          ),
          H.details(
            { style: "margin-top: 1rem;" },
            H.summary("View raw markdown"),
            H.pre({ id: "raw", style: "white-space: pre-wrap;" }, ""),
          ),
          H.script(
            { type: "module" },
            H.trustedRaw(`
              const statusEl = document.getElementById("status");
              const contentEl = document.getElementById("content");
              const rawEl = document.getElementById("raw");

              const setStatus = (s) => { if (statusEl) statusEl.textContent = s; };

              try {
                setStatus("Fetching markdown…");
                const mdResp = await fetch("/README.md", { cache: "no-store" });
                if (!mdResp.ok) throw new Error("GET /README.md failed: " + mdResp.status + " " + mdResp.statusText);
                const md = await mdResp.text();
                if (rawEl) rawEl.textContent = md;

                setStatus("Loading remark…");

                // remark + remark-html from CDN (ESM)
                const [{ remark }, remarkHtml] = await Promise.all([
                  import("https://esm.sh/remark@15"),
                  import("https://esm.sh/remark-html@16"),
                ]);

                setStatus("Rendering…");

                const file = await remark().use(remarkHtml.default ?? remarkHtml).process(md);
                const html = String(file);

                if (contentEl) contentEl.innerHTML = html;

                setStatus("Done.");
              } catch (e) {
                const msg = String(e && (e.stack || e.message || e));
                setStatus("Error: " + msg);
                if (contentEl) contentEl.textContent = "";
              }
            `),
          ),
        ),
      ),
    ),
  );
};

app.get(
  "/",
  () =>
    new Response(pageHtml(), {
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
);

app.get(
  "/README.md",
  () =>
    new Response(exampleMarkdown, {
      headers: { "content-type": "text/markdown; charset=utf-8" },
    }),
);

app.get("/healthz", () => new Response("ok", { status: 200 }));

app.serve();
