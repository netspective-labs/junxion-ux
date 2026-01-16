// support/assurance/hello/main.ts
/**
 * ContinuUX “Hello World” (Counter) app.
 *
 * What this demonstrates end-to-end:
 * - Fluent HTML on the server (no templating engine).
 * - Fully type-safe HTTP routing (Application) + typed SSE sessions.
 * - ContinuUX interaction model:
 *   - Browser UA captures DOM events -> POST /cx (typed envelopes)
 *   - Server updates application state
 *   - Server broadcasts JS over SSE -> browser executes it -> DOM updates
 *
 * Styling:
 * - PicoCSS loaded via CDN (no build step).
 *
 * Run:
 *   deno run -A support/assurance/hello/main.ts
 *
 * Then open:
 *   http://127.0.0.1:8000
 *
 * Notes on state semantics:
 * - This uses Application.sharedState(...) which is explicit shared mutable state
 *   across requests within this single process. It is not persisted and is not
 *   multi-process safe (it is intentionally “toy app” semantics).
 */

import {
  type Attrs,
  attrs as mergeAttrs,
  body,
  button,
  div,
  doctype,
  head,
  html,
  meta,
  render,
  script,
  title,
  trustedRaw,
} from "../../../lib/continuux/html.ts";
import { Application, textResponse } from "../../../lib/continuux/http.ts";
import {
  createCx,
  cxPostHandler,
  cxSseRegister,
  defineSchemas,
} from "../../../lib/continuux/interaction-html.ts";
import { decodeCxEnvelope } from "../../../lib/continuux/interaction.ts";

type State = { count: number };
type Vars = Record<string, never>;

const appState: State = { count: 0 };

// We keep the schemas tiny: just “increment” + “reset”.
// The envelope decoding is type-safe and shared with tests.
const schemas = defineSchemas({
  increment: (u: unknown) => decodeCxEnvelope(u),
  reset: (u: unknown) => decodeCxEnvelope(u),
});

// Server event map for SSE.
// In this app we only need "js" and an optional "message".
type ServerEvents = { js: string; message: string };

const cx = createCx<State, Vars, typeof schemas, ServerEvents>(schemas);
const hub = cx.server.sseHub();

const setTextJs = (id: string, text: string) => {
  // IMPORTANT: never assign through optional chaining; it's a SyntaxError.
  return `{
    const __el = document.getElementById(${JSON.stringify(id)});
    if (__el) __el.textContent = ${JSON.stringify(text)};
  }`;
};

const setDatasetJs = (k: string, v: string) => {
  return `{
    try { document.body.dataset[${JSON.stringify(k)}] = ${
    JSON.stringify(v)
  }; } catch {}
  }`;
};

const pageHtml = (): string => {
  // Attach ContinuUX data-* attributes to the <html> element:
  // - enables SSE auto-connect (EventSource) to /cx/sse
  // - enables UA wiring (event capture + POSTs to /cx)
  const appAttrs: Attrs = mergeAttrs(
    cx.html.sse({ url: "/cx/sse", withCredentials: true }),
  );

  // Boot script tag that imports the UA module from /interaction-browser-ua.js
  // and wires up DOM events using data-cx attributes.
  const boot = cx.html.bootModuleScriptTag({
    diagnostics: false,
    debug: false,
    autoConnect: true,
    attrs: { id: "cxBoot" },
  });

  // PicoCSS via CDN (no build step). If you want “pinned” versions, lock it here.
  const pico = trustedRaw(
    `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">`,
  );

  return render(
    doctype(),
    html(
      appAttrs,
      head(
        meta({ charset: "utf-8" }),
        meta({
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        }),
        title("ContinuUX Hello (Counter)"),
        pico,
      ),
      body(
        trustedRaw(`
          <main class="container" style="max-width: 720px; padding-top: 2rem;">
        `),
        div({}, [
          trustedRaw(
            `<hgroup><h1>ContinuUX Hello</h1><p>Counter app using SSE + server-executed JS</p></hgroup>`,
          ),
          trustedRaw(`<article>`),
          div({ id: "countWrap" }, [
            trustedRaw(`<p style="margin-bottom: .25rem;">Count</p>`),
            trustedRaw(
              `<p style="font-size: 2.2rem; margin-top: 0;"><strong id="count">0</strong></p>`,
            ),
          ]),
          div({ style: "display:flex; gap:.75rem; flex-wrap:wrap;" }, [
            button({ id: "inc", ...cx.html.click("increment") }, "Increment"),
            button({
              id: "reset",
              ...cx.html.click("reset"),
              class: "secondary",
            }, "Reset"),
          ]),
          div({
            id: "status",
            style: "margin-top: 1rem; color: var(--pico-muted-color);",
          }, ""),
          trustedRaw(`</article>`),
          trustedRaw(`
            <small style="display:block; margin-top: 1rem;">
              Try opening two tabs: both see the same shared in-memory count (single-process shared state).
            </small>
          `),
        ]),
        boot,
        trustedRaw(`</main>`),
        // tiny “page ready” flag (optional)
        script({ type: "module" }, trustedRaw(`window.__page_ready = "ok";`)),
      ),
    ),
  );
};

// Shared mutable state across requests (explicit semantics).
const app = Application.sharedState<State, Vars>(appState);

// Serve the browser UA module used by the boot script.
app.get("/interaction-browser-ua.js", async () => {
  return await cx.server.uaModuleResponse("no-store");
});

// Main page.
app.get("/", () =>
  new Response(pageHtml(), {
    headers: { "content-type": "text/html; charset=utf-8" },
  }));

// SSE endpoint. Registers the session and sends the initial render JS.
app.get(
  "/cx/sse",
  (c) =>
    c.sse<ServerEvents>(async (session) => {
      const sessionId = c.query("sessionId") ?? "unknown";
      cxSseRegister(hub, sessionId, session);

      // Initial UI render
      await session.sendWhenReady(
        "js",
        setTextJs("count", String(appState.count)),
      );
      await session.sendWhenReady(
        "js",
        setDatasetJs("lastCount", String(appState.count)),
      );
      await session.sendWhenReady("js", setDatasetJs("lastSpec", "init"));
      await session.sendWhenReady("js", setTextJs("status", "connected"));
      await session.sendWhenReady("message", `connected:${sessionId}`);
    }),
);

// POST endpoint: receives typed envelopes, mutates state, broadcasts DOM update JS via SSE.
app.post("/cx", async (c) => {
  const bodyU = await c.readJson();

  const r = await cxPostHandler(cx, {
    req: c.req,
    body: bodyU,
    state: appState, // explicit shared state
    vars: c.vars,
    sse: hub,
    handlers: {
      increment: ({ cx: env }) => {
        appState.count += 1;

        const js = `${setTextJs("count", String(appState.count))}\n` +
          `${setTextJs("status", "ok:increment")}\n` +
          `${setDatasetJs("lastSpec", env.spec)}\n` +
          `${setDatasetJs("lastCount", String(appState.count))}\n`;

        hub.broadcast("js", js);
        return { ok: true };
      },

      reset: ({ cx: env }) => {
        appState.count = 0;

        const js = `${setTextJs("count", "0")}\n` +
          `${setTextJs("status", "ok:reset")}\n` +
          `${setDatasetJs("lastSpec", env.spec)}\n` +
          `${setDatasetJs("lastCount", "0")}\n`;

        hub.broadcast("js", js);
        return { ok: true };
      },
    },
  });

  if (r.ok) return new Response(null, { status: 204 });
  return textResponse(r.message, r.status);
});

app.serve();
