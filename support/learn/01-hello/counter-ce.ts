#!/usr/bin/env -S deno run -A --watch --node-modules-dir=auto
/**
 * @module support/learn/01-hello/counter-ce.ts
 *
 * ContinuUX “Hello World” (Counter) using Custom Elements as the primary
 * interactivity boundary.
 */

import { Application } from "../../../lib/continuux/http.ts";
import {
  createCx,
  type CxActionHandlers,
  defineSchemas,
} from "../../../lib/continuux/interaction-html.ts";
import {
  type CxHandlerResult,
  CxMiddlewareBuilder,
  decodeCxEnvelope,
} from "../../../lib/continuux/interaction.ts";
import * as H from "../../../lib/natural-html/elements.ts";

const here = new URL(".", import.meta.url);
const counterScriptUrl = new URL("./counter-ce.js", here);

const appState = { count: 0 };

type State = typeof appState;
type Vars = Record<string, never>;

const schemas = defineSchemas({
  increment: (value: unknown) => decodeCxEnvelope(value),
  reset: (value: unknown) => decodeCxEnvelope(value),
});

type ServerEvents = {
  readonly count: { value: number };
  readonly status: { text: string };
};

const cx = createCx<State, Vars, typeof schemas, ServerEvents>(schemas);
const builder = new CxMiddlewareBuilder<ServerEvents>({
  sseUrl: "/ce/sse",
  postUrl: "/ce/action",
  importUrl: "/.cx/browser-ua-aide.js",
});
const hub = builder.hub;

const commitAction = (
  action: "increment" | "reset",
  nextValue?: number,
): CxHandlerResult => {
  if (typeof nextValue === "number") {
    appState.count = nextValue;
  } else {
    appState.count += 1;
  }

  hub.broadcast("count", { value: appState.count });
  hub.broadcast("status", { text: `ok:${action}` });
  return { ok: true };
};

const handlers: CxActionHandlers<
  State,
  Vars,
  typeof schemas,
  ServerEvents,
  "action"
> = {
  increment: () => commitAction("increment"),
  reset: () => commitAction("reset", 0),
};

const pageHtml = (): string => {
  const { sseUrl, postUrl, sseWithCredentials } = builder.config;
  const sseCredValue = sseWithCredentials ? "true" : "false";
  const aideAttrs = builder.userAgentAide.attrs;

  return H.render(
    H.doctype(),
    H.html(
      H.head(
        H.meta({ charset: "utf-8" }),
        H.meta({
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        }),
        H.title("ContinuUX Hello (Counter CE)"),
        H.link({
          rel: "stylesheet",
          href: "https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css",
        }),
      ),
      H.body(
        H.main(
          { class: "container", style: "max-width:720px; padding-top:2rem;" },
          H.hgroup(
            H.h1("ContinuUX Hello"),
            H.p("Counter app with Custom Element + SSE (no global UA)"),
          ),
          H.article(
            H.customElement("counter-ce")({
              [aideAttrs.sseUrl]: sseUrl,
              [aideAttrs.postUrl]: postUrl,
              [aideAttrs.sseWithCredentials]: sseCredValue,
              style: "display:block;",
            }),
          ),
          H.small(
            { style: "display:block; margin-top:1rem;" },
            "Open two tabs to see shared in-memory state via SSE broadcasts.",
          ),
          H.script(
            { type: "module", id: "ceBoot" },
            H.javaScript`
              import { registerCounterCe } from "/counter-ce.js";
              registerCounterCe();
              window.__page_ready = "ok";
            `,
          ),
        ),
      ),
    ),
  );
};

const app = Application.sharedState<State, Vars>(appState);

app.use(
  builder.middleware<State, Vars, typeof schemas, "action">({
    uaCacheControl: "no-store",
    onConnect: async ({ session }) => {
      await session.sendWhenReady("count", { value: appState.count });
      await session.sendWhenReady("status", { text: "connected" });
    },
    interaction: {
      cx,
      handlers,
    },
  }),
);

app.get(
  "/",
  () =>
    new Response(pageHtml(), {
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
);

app.get("/counter-ce.js", async () => {
  const path = await Deno.realPath(counterScriptUrl);
  let js = await Deno.readTextFile(path);
  js = js.replace(
    "../../../lib/continuux/browser-ua-aide.js",
    "/.cx/browser-ua-aide.js",
  );
  return new Response(js, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
});

app.serve();
