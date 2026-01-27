#!/usr/bin/env -S deno run -A --watch --unstable-bundle --node-modules-dir=auto
/**
 * ContinuUX “Hello World” (Counter) app.
 *
 * Demonstrates:
 * - Fluent HTML on the server (no templating engine)
 * - Type-safe HTTP routing + typed SSE
 * - ContinuUX interaction model end-to-end
 * - Explicit shared application state semantics
 *
 * Styling:
 * - PicoCSS via CDN
 *
 * Run:
 *   deno run -A support/learn/01-hello/counter.ts
 */

import {
  createSseDiagnostics,
  type SseDiagnosticEntry,
} from "../../../lib/continuux/http-ux/aide.ts";
import { Application } from "../../../lib/continuux/http.ts";
import {
  actionSchemas,
  createCx,
} from "../../../lib/continuux/interaction-html.ts";
import {
  type CxHandlerResult,
  CxMiddlewareBuilder,
  type CxPatchPayload,
  decodeCxEnvelope,
} from "../../../lib/continuux/interaction.ts";
import * as H from "../../../lib/natural-html/elements.ts";
import { customElement } from "../../../lib/natural-html/elements.ts";

const appState = { count: 0 };
type State = typeof appState;
type Vars = Record<string, never>;

const interactivityAide = <
  State extends { count: number },
  Vars extends Record<string, unknown>,
>(
  state: State,
) => {
  const actions = actionSchemas({
    increment: decodeCxEnvelope,
    reset: decodeCxEnvelope,
  });

  type ServerEvents = {
    readonly message: string;
    readonly diag: SseDiagnosticEntry;
    readonly connection: SseDiagnosticEntry;
    readonly patch: CxPatchPayload;
  };

  const cx = createCx<State, Vars, typeof actions, ServerEvents>(actions);
  const hub = cx.server.sseHub();
  const builder = new CxMiddlewareBuilder<ServerEvents>({
    hub,
    postUrl: "/cx",
    sseUrl: "/cx/sse",
    importUrl: "/browser-ua-aide.js",
  });
  const patch = builder.patch;

  const sseDiagsElement = customElement("sse-inspector");
  const sseDiagsElementId = `sse-diagnostics`;
  const sseDiagnostics = createSseDiagnostics(hub, "diag", "connection");

  const commitAction = (
    action: "increment" | "reset",
    spec: string,
    sessionId?: string,
    nextValue?: number,
  ): CxHandlerResult => {
    state.count = typeof nextValue === "number" ? nextValue : state.count + 1;
    const payload: CxPatchPayload = {
      ops: [
        patch.setText("#count", String(state.count)),
        patch.setText("#status", `ok:${action}`),
        patch.setDataset("body", "lastSpec", spec),
        patch.setDataset("body", "lastCount", String(state.count)),
      ],
    };

    hub.broadcast("patch", payload);
    if (sessionId) {
      sseDiagnostics.diag(sessionId, {
        message: `${action}`,
        level: "info",
        payload: { sessionId, count: state.count, execPatch: payload },
      });
    }
    return { ok: true };
  };

  const middleware = builder.middleware<State, Vars, typeof actions, "action">({
    uaCacheControl: "no-store",
    onConnect: async ({ session, sessionId }) => {
      await session.sendWhenReady("patch", {
        ops: [
          patch.setText("#count", String(state.count)),
          patch.setDataset("body", "lastCount", String(state.count)),
          patch.setDataset("body", "lastSpec", "init"),
          patch.setText("#status", "connected"),
        ],
      });
      await session.sendWhenReady("message", `connected:${sessionId}`);
      sseDiagnostics.connection(sessionId, {
        message: "SSE diagnostics channel established",
        level: "info",
      });
    },
    interaction: {
      cx,
      handlers: {
        increment: ({ cx: env, sessionId }) =>
          commitAction("increment", env.spec, sessionId),
        reset: ({ cx: env, sessionId }) =>
          commitAction("reset", env.spec, sessionId, 0),
      },
    },
  });

  return {
    cx,
    middleware,
    sseDiagnostics,
    sseDiagsElement,
    sseDiagsElementId,
  };
};

const {
  cx,
  middleware: interactivityMiddleware,
  sseDiagnostics,
  sseDiagsElement,
  sseDiagsElementId,
} = interactivityAide<State, Vars>(appState);

const pageHtml = (): string => {
  const boot = cx.html.bootModuleScriptTag({
    diagnostics: false,
    debug: false,
    autoConnect: true,
    attrs: { id: "cxBoot" },
  });

  return H.render(
    H.doctype(),
    H.html(
      H.head(
        H.meta({ charset: "utf-8" }),
        H.meta({
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        }),
        H.title("ContinuUX Hello (Counter)"),
        H.link({
          rel: "stylesheet",
          href: "https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css",
        }),
        H.style(`:root { font-size: 85%; }`),
      ),
      H.body(
        H.main(
          {
            class: "container",
            style: "max-width:720px; padding-top:2rem;",
          },
          H.div(
            H.hgroup(
              H.h1("ContinuUX Hello"),
              H.p("Counter app using SSE + server-executed JS"),
            ),
            H.article(
              H.div(
                { id: "countWrap" },
                H.p({ style: "margin-bottom:.25rem;" }, "Count"),
                H.p(
                  { style: "font-size:2.2rem; margin-top:0;" },
                  H.strong({ id: "count" }, "0"),
                ),
              ),
              H.div(
                { style: "display:flex; gap:.75rem; flex-wrap:wrap;" },
                H.button(
                  { id: "inc", ...cx.html.click("increment") },
                  "Increment",
                ),
                H.button(
                  {
                    id: "reset",
                    ...cx.html.click("reset"),
                    class: "secondary",
                  },
                  "Reset",
                ),
              ),
              H.div(
                {
                  id: "status",
                  style: "margin-top:1rem; color:var(--pico-muted-color);",
                },
                "",
              ),
            ),
            H.small(
              { style: "display:block; margin-top:1rem;" },
              "Open two tabs to see shared in-memory state.",
            ),
            H.section(
              { class: "dialog-diagnostics", id: sseDiagsElementId },
              H.h3("SSE diagnostics"),
              H.p(
                "Watch how ContinuUX SSE updates carry validation and submission events.",
              ),
              sseDiagsElement(),
            ),
          ),
          boot,
          H.script(
            { type: "module" },
            H.trustedRaw(sseDiagnostics.inspectorScript()),
          ),
          H.script(
            { type: "module" },
            H.trustedRaw(`window.__page_ready = "ok";`),
          ),
        ),
      ),
    ),
  );
};

const app = Application.sharedState(appState);

app.use(sseDiagnostics.middleware<State, Vars>());
app.use(interactivityMiddleware);
app.get(
  "/",
  () =>
    new Response(pageHtml(), {
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
);

app.serve({ port: 7681 });
