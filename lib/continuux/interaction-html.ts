// lib/continuux/interaction-html.ts
//
// ContinuUX: type-safe interaction HTML + type-safe server wiring.
//
// Goal:
// - Juniors should NOT need to know any attribute strings like "data-cx-on-click"
//   or endpoint strings like "/cx" when generating HTML.
// - Juniors should write functions and get strongly typed attrs + handlers.
// - Provide a typed "actions" registry that:
//   1) Generates HTML attrs for client -> server posts (CX envelopes)
//   2) Decodes/validates inbound events on the server
//   3) Manages SSE sessions and sends typed server -> client events
//
// This module intentionally leans on:
// - html.ts for tag building, Attrs, and safe HTML rendering
// - http.ts for SSE session primitives
// - interaction.ts for envelope decoding and UA module serving
//
// Note: The browser UA supports an SSE event name "js" that executes JS.
// This module exposes that as a typed event helper, but you should treat it
// as privileged. Keep generated JS deterministic and server-controlled.

import type { Attrs, RawHtml } from "./html.ts";
import { script, trustedRaw } from "./html.ts";
import type { SseEventMap, SseSession } from "./http.ts";
import type {
  CxDomEventName,
  CxHandlerResult,
  CxInbound,
  SchemaLike,
} from "./interaction.ts";
import { decodeCxEnvelope, userAgentAide } from "./interaction.ts";

/* =========================
 * shared types
 * ========================= */

export type CxSpecPrefix = "action" | (string & { readonly __cxPrefix: never });

export type SpecFor<
  Prefix extends string,
  Name extends string,
> = `${Prefix}:${Name}`;

export type InferSchema<S> = S extends SchemaLike<infer T> ? T
  : S extends (u: unknown) => infer T ? T
  : never;

export type CxActionSchemas = Record<
  string,
  SchemaLike<unknown> | ((u: unknown) => unknown)
>;

export type CxActionHandlers<
  State,
  Vars extends Record<string, unknown>,
  Schemas extends CxActionSchemas,
  SseOut extends SseEventMap,
  Prefix extends string,
> = {
  [K in keyof Schemas]: (
    ctx: {
      name: K;
      spec: SpecFor<Prefix, Extract<K, string>>;
      req: Request;
      cx: CxInbound;
      state: State;
      vars: Vars;
      data: InferSchema<Schemas[K]>;
      scratch: Record<string, unknown>;

      // SSE helpers (may be undefined if you did not wire SSE).
      sse?: CxSseHub<SseOut>;
      sessionId: string;
      requestId: string;

      emit: {
        send: <K2 extends keyof SseOut>(event: K2, data: SseOut[K2]) => boolean;
        broadcast: <K2 extends keyof SseOut>(
          event: K2,
          data: SseOut[K2],
        ) => void;
        js: (jsText: string) => boolean;
      };
    },
  ) => Promise<CxHandlerResult> | CxHandlerResult;
};

/* =========================
 * internal helpers
 * ========================= */

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (v == null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

const safeJson = (v: unknown): string => JSON.stringify(v ?? null);

const parseWith = <T>(
  schema: SchemaLike<T> | ((u: unknown) => T),
  u: unknown,
): T => {
  if (typeof schema === "function") return schema(u);
  return schema.parse(u);
};

/* =========================
 * CX attribute building (type-safe, no strings)
 * ========================= */

export type CxHtmlConfig<Prefix extends string> = {
  prefix?: Prefix; // default "action"
  postUrl?: string; // default "/cx"
  sseUrl?: string; // default "/cx/sse"
  importUrl?: string; // default "/interaction-browser-ua.js"
  sseWithCredentials?: boolean; // default true
  attrPrefix?: string; // default "data-cx" (must match UA)
};

/**
 * Typed actions API returned by createCx().
 * - html: helpers that generate Attrs to attach to fluent HTML tags
 * - server: helpers to decode/dispatch and manage SSE
 */
export type CxKit<
  State,
  Vars extends Record<string, unknown>,
  Schemas extends CxActionSchemas,
  SseOut extends SseEventMap,
  Prefix extends string,
> = {
  config: Required<CxHtmlConfig<Prefix>>;

  // HTML-side helpers (Attrs and boot script)
  html: {
    // Boot UA in a module script (defaults are configured here).
    // Use inside <script type="module"> ... </script>.
    bootModuleCode: (opts?: {
      debug?: boolean;
      diagnostics?: boolean;
      autoConnect?: boolean;
      appVersion?: string;
      events?: readonly CxDomEventName[];
      preventDefaultSubmit?: boolean;
      sseJsEventName?: string;
    }) => string;

    bootModuleScriptTag: (opts?: {
      debug?: boolean;
      diagnostics?: boolean;
      autoConnect?: boolean;
      appVersion?: string;
      events?: readonly CxDomEventName[];
      preventDefaultSubmit?: boolean;
      sseJsEventName?: string;
      attrs?: Attrs;
    }) => RawHtml;

    // Root-level overrides for the UA network bus
    // (set on <html> or <body>, read by the UA).
    sse: (opts?: {
      url?: string;
      withCredentials?: boolean;
    }) => Attrs;

    // Attach optional context that rides along with the CX envelope.
    // These are read by the UA from the target element.
    signals: (obj: Record<string, unknown>) => Attrs;
    headers: (obj: Record<string, string>) => Attrs;
    cxId: (id: string) => Attrs;

    // Action specs (type-safe names)
    spec: <K extends keyof Schemas & string>(name: K) => SpecFor<Prefix, K>;

    // Per-event action binding (type-safe)
    on: <K extends keyof Schemas & string>(
      domEvent: CxDomEventName,
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ) => Attrs;

    // Convenience wrappers for common DOM events
    click: <K extends keyof Schemas & string>(
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ) => Attrs;

    submit: <K extends keyof Schemas & string>(
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ) => Attrs;

    change: <K extends keyof Schemas & string>(
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ) => Attrs;

    input: <K extends keyof Schemas & string>(
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ) => Attrs;

    keydown: <K extends keyof Schemas & string>(
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ) => Attrs;
  };

  // Server-side helpers: decode + dispatch + SSE hub
  server: {
    // Serve /interaction-browser-ua.js with correct content-type.
    uaModuleResponse: (cacheControl?: string) => Promise<Response>;

    // Decode + validate the inbound request body, ensuring spec matches
    // one of your registered actions, then call the matching handler.
    //
    // You can use this directly inside your POST /cx route.
    dispatchFromRequestJson: (
      req: Request,
      body: unknown,
      state: State,
      vars: Vars,
      handlers: CxActionHandlers<State, Vars, Schemas, SseOut, Prefix>,
      opts?: { sse?: CxSseHub<SseOut> },
    ) => Promise<CxHandlerResult>;

    // Convenience: convert a CxHandlerResult into a Response.
    // (204 by default on ok)
    toResponse: (r: CxHandlerResult) => Response;

    // Create an SSE hub you can share between routes.
    sseHub: () => CxSseHub<SseOut>;
  };
};

/* =========================
 * SSE hub (typed server -> client events)
 * ========================= */

export type CxSseHub<E extends SseEventMap> = {
  // Register a session under a sessionId (from query param or envelope).
  // You call this from GET /cx/sse.
  register: (sessionId: string, session: SseSession<E>) => void;

  // Remove a session id (usually called automatically on close).
  unregister: (sessionId: string) => void;

  // Send to exactly one session (returns false if missing/closed).
  send: <K extends keyof E>(sessionId: string, event: K, data: E[K]) => boolean;

  // Broadcast to all sessions (best effort).
  broadcast: <K extends keyof E>(event: K, data: E[K]) => void;

  // Utilities for "js" event if you include it in your event map.
  // You decide whether to include "js" in E.
  js: (sessionId: string, jsText: string) => boolean;
  broadcastJs: (jsText: string) => void;

  size: () => number;
};

const normalizeSessionId = (sid: string | null | undefined): string | null => {
  const s = (sid ?? "").trim();
  if (!s) return null;
  if (s === "unknown") return null;
  return s;
};

const createSseHub = <E extends SseEventMap>(): CxSseHub<E> => {
  const sessions = new Map<string, SseSession<E>>();

  const unregister = (sessionId: string) => {
    const sid = normalizeSessionId(sessionId);
    if (!sid) return;

    const s = sessions.get(sid);
    if (s) {
      try {
        s.close();
      } catch {
        // ignore
      }
    }
    sessions.delete(sid);
  };

  const register = (sessionId: string, session: SseSession<E>) => {
    const sid = normalizeSessionId(sessionId);
    if (!sid) {
      // Don’t register under a bogus key; that guarantees “send” will miss.
      try {
        session.close();
      } catch {
        // ignore
      }
      return;
    }

    // Replace existing session for the same sid.
    unregister(sid);
    sessions.set(sid, session);

    queueMicrotask(() => {
      if (session.isClosed()) sessions.delete(sid);
    });
  };

  const send = <K extends keyof E>(sessionId: string, event: K, data: E[K]) => {
    const sid = normalizeSessionId(sessionId);
    if (!sid) return false;

    const s = sessions.get(sid);
    if (!s || s.isClosed()) {
      sessions.delete(sid);
      return false;
    }
    const ok = s.send(event, data);
    if (!ok) sessions.delete(sid);
    return ok;
  };

  const broadcast = <K extends keyof E>(event: K, data: E[K]) => {
    for (const [sid, s] of sessions) {
      if (s.isClosed()) {
        sessions.delete(sid);
        continue;
      }
      const ok = s.send(event, data);
      if (!ok) sessions.delete(sid);
    }
  };

  const js = (sessionId: string, jsText: string) =>
    // @ts-expect-error: only works if E includes "js"
    send(sessionId, "js", jsText);

  const broadcastJs = (jsText: string) =>
    // @ts-expect-error: only works if E includes "js"
    broadcast("js", jsText);

  return {
    register,
    unregister,
    send,
    broadcast,
    js,
    broadcastJs,
    size: () => sessions.size,
  };
};

/* =========================
 * createCx(): the main entrypoint
 * ========================= */

export const createCx = <
  State,
  Vars extends Record<string, unknown>,
  Schemas extends CxActionSchemas,
  SseOut extends SseEventMap = { message: string; js: string },
  Prefix extends string = "action",
>(
  schemas: Schemas,
  cfg: CxHtmlConfig<Prefix> = {},
): CxKit<State, Vars, Schemas, SseOut, Prefix> => {
  const aide = userAgentAide();

  const config: Required<CxHtmlConfig<Prefix>> = {
    prefix: (cfg.prefix ?? "action") as Prefix,
    postUrl: cfg.postUrl ?? "/cx",
    sseUrl: cfg.sseUrl ?? "/cx/sse",
    importUrl: cfg.importUrl ?? "/interaction-browser-ua.js",
    sseWithCredentials: cfg.sseWithCredentials ?? true,
    attrPrefix: cfg.attrPrefix ?? "data-cx",
  };

  // UA attribute names (strings) are centralized here.
  // Nobody else should need to type them in app code.
  const attr = {
    cx: `${config.attrPrefix}`,
    on: (domEvent: CxDomEventName) => `${config.attrPrefix}-on-${domEvent}`,
    id: `${config.attrPrefix}-id`,
    signals: `${config.attrPrefix}-signals`,
    headers: `${config.attrPrefix}-headers`,
    sseUrl: `${config.attrPrefix}-sse-url`,
    sseWithCredentials: `${config.attrPrefix}-sse-with-credentials`,
  } as const;

  const spec = <K extends keyof Schemas & string>(
    name: K,
  ): SpecFor<Prefix, K> => `${config.prefix}:${name}` as SpecFor<Prefix, K>;

  const mergeExtras = (extra?: {
    signals?: Record<string, unknown>;
    headers?: Record<string, string>;
    cxId?: string;
  }): Attrs => {
    const out: Attrs = {};
    if (!extra) return out;
    if (extra.cxId) out[attr.id] = extra.cxId;
    if (extra.signals) out[attr.signals] = safeJson(extra.signals);
    if (extra.headers) out[attr.headers] = safeJson(extra.headers);
    return out;
  };

  const on = <K extends keyof Schemas & string>(
    domEvent: CxDomEventName,
    name: K,
    extra?: {
      signals?: Record<string, unknown>;
      headers?: Record<string, string>;
      cxId?: string;
    },
  ): Attrs => ({
    [attr.on(domEvent)]: spec(name),
    ...mergeExtras(extra),
  });

  const html = {
    bootModuleCode: (opts: {
      debug?: boolean;
      diagnostics?: boolean;
      autoConnect?: boolean;
      appVersion?: string;
      events?: readonly CxDomEventName[];
      preventDefaultSubmit?: boolean;
      sseJsEventName?: string;
    } = {}): string => {
      // We intentionally do not expose any raw string endpoints to callers.
      // They can override via opts, but defaults come from config.
      const importUrl = config.importUrl;
      const postUrl = config.postUrl;
      const sseUrl = config.sseUrl;

      // The browser module accepts additional knobs beyond userAgentAide.bootModuleSnippet.
      // We generate a minimal init but allow passing config keys that the UA supports.
      const lines: string[] = [
        `import { createCxUserAgent } from ${JSON.stringify(importUrl)};`,
        `window.CX = createCxUserAgent({`,
        `  postUrl: ${JSON.stringify(postUrl)},`,
        `  sseUrl: ${JSON.stringify(sseUrl)},`,
        `  sseWithCredentials: ${String(config.sseWithCredentials)},`,
        `  debug: ${String(!!opts.debug)},`,
        `  diagnostics: ${String(!!opts.diagnostics)},`,
        `  autoConnect: ${String(opts.autoConnect ?? true)},`,
      ];

      if (opts.appVersion) {
        lines.push(`  appVersion: ${safeJson(opts.appVersion)},`);
      }
      if (opts.events && opts.events.length) {
        lines.push(`  events: ${safeJson(Array.from(opts.events))},`);
      }
      if (typeof opts.preventDefaultSubmit === "boolean") {
        lines.push(
          `  preventDefaultSubmit: ${String(opts.preventDefaultSubmit)},`,
        );
      }
      if (opts.sseJsEventName) {
        lines.push(`  sseJsEventName: ${safeJson(opts.sseJsEventName)},`);
      }

      lines.push(`});`);
      return lines.join("\n");
    },

    bootModuleScriptTag: (opts: {
      debug?: boolean;
      diagnostics?: boolean;
      autoConnect?: boolean;
      appVersion?: string;
      events?: readonly CxDomEventName[];
      preventDefaultSubmit?: boolean;
      sseJsEventName?: string;
      attrs?: Attrs;
    } = {}): RawHtml => {
      const code = html.bootModuleCode(opts);
      return script(
        { type: "module", ...(opts.attrs ?? {}) },
        trustedRaw(code),
      );
    },

    sse: (opts?: { url?: string; withCredentials?: boolean }): Attrs => {
      const out: Attrs = {};
      if (opts?.url) out[attr.sseUrl] = opts.url;
      if (typeof opts?.withCredentials === "boolean") {
        out[attr.sseWithCredentials] = opts.withCredentials ? "true" : "false";
      }
      return out;
    },

    signals: (obj: Record<string, unknown>): Attrs => ({
      [attr.signals]: safeJson(obj),
    }),

    headers: (obj: Record<string, string>): Attrs => ({
      [attr.headers]: safeJson(obj),
    }),

    cxId: (id: string): Attrs => ({ [attr.id]: id }),

    spec,

    on,

    click: <K extends keyof Schemas & string>(
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ): Attrs => on("click", name, extra),

    submit: <K extends keyof Schemas & string>(
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ): Attrs => on("submit", name, extra),

    change: <K extends keyof Schemas & string>(
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ): Attrs => on("change", name, extra),

    input: <K extends keyof Schemas & string>(
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ): Attrs => on("input", name, extra),

    keydown: <K extends keyof Schemas & string>(
      name: K,
      extra?: {
        signals?: Record<string, unknown>;
        headers?: Record<string, string>;
        cxId?: string;
      },
    ): Attrs => on("keydown", name, extra),
  } as const;

  const server = {
    uaModuleResponse: async (cacheControl = "no-store"): Promise<Response> => {
      // Delegates to interaction.ts userAgentAide() which reads from disk.
      return await aide.moduleResponse(cacheControl);
    },

    dispatchFromRequestJson: async (
      req: Request,
      body: unknown,
      state: State,
      vars: Vars,
      handlers: CxActionHandlers<State, Vars, Schemas, SseOut, Prefix>,
      opts?: { sse?: CxSseHub<SseOut> },
    ): Promise<CxHandlerResult> => {
      let cx: CxInbound;
      try {
        cx = decodeCxEnvelope(body);
      } catch (err) {
        const msg = String(
          err && (err as Error).message ? (err as Error).message : err,
        );
        return { ok: false, status: 400, message: `bad cx envelope: ${msg}` };
      }

      const sp = cx.spec;
      if (typeof sp !== "string" || !sp.includes(":")) {
        return {
          ok: false,
          status: 400,
          message: `bad cx spec: ${String(sp)}`,
        };
      }

      const [prefix, name] = sp.split(":", 2);
      if (prefix !== config.prefix) {
        return {
          ok: false,
          status: 400,
          message: `unsupported cx prefix: ${prefix}`,
        };
      }

      const actionName = name as keyof Schemas & string;
      const schema = (schemas as Record<string, unknown>)[actionName];
      const handler = (handlers as Record<string, unknown>)[actionName];

      if (!schema || typeof handler !== "function") {
        return {
          ok: false,
          status: 404,
          message: `cx action not found: ${sp}`,
        };
      }

      let data: unknown;
      try {
        data = parseWith(schema as never, body);
      } catch (err) {
        const msg = String(
          err && (err as Error).message ? (err as Error).message : err,
        );
        return {
          ok: false,
          status: 400,
          message: `cx validation failed: ${msg}`,
        };
      }

      const sessionId = cx.client.sessionId;
      const requestId = cx.client.requestId;
      const hub = opts?.sse;

      const emit = {
        send: <K extends keyof SseOut>(event: K, data: SseOut[K]) => {
          if (!hub) return false;
          return hub.send(sessionId, event, data);
        },
        broadcast: <K extends keyof SseOut>(event: K, data: SseOut[K]) => {
          if (!hub) return;
          hub.broadcast(event, data);
        },
        js: (jsText: string) => {
          if (!hub) return false;
          // requires SseOut to include "js"
          return hub.js(sessionId, jsText);
        },
      } as const;

      const ctx = {
        name: actionName,
        spec: sp as SpecFor<Prefix, typeof actionName>,
        req,
        cx,
        state,
        vars,
        data: data as never,
        scratch: Object.create(null) as Record<string, unknown>,
        sse: opts?.sse,
        sessionId,
        requestId,
        emit,
      };

      try {
        return await (handler as (
          x: typeof ctx,
        ) => Promise<CxHandlerResult> | CxHandlerResult)(ctx);
      } catch (err) {
        const msg = String(
          err && (err as Error).message ? (err as Error).message : err,
        );
        return { ok: false, status: 500, message: `cx handler error: ${msg}` };
      }
    },

    toResponse: (r: CxHandlerResult): Response => {
      if (r.ok) {
        if ("headers" in r && r.headers) {
          return new Response(null, { status: 204, headers: r.headers });
        }
        return new Response(null, { status: 204 });
      }
      return new Response(r.message, {
        status: r.status,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    },

    sseHub: (): CxSseHub<SseOut> => createSseHub<SseOut>(),
  } as const;

  return { config, html, server };
};

/* =========================
 * Convenience: defineSchemas()
 * =========================
 *
 * This helper improves ergonomics and keeps object keys literal.
 * Example:
 *   const schemas = defineSchemas({
 *     ping: (u) => u, // or zod schema
 *     save: z.object({ id: z.string() })
 *   });
 */
export const defineSchemas = <S extends CxActionSchemas>(schemas: S): S =>
  schemas;

/* =========================
 * Convenience: cxPostHandler()
 * =========================
 *
 * If you want a single function to plug into POST /cx:
 *
 *   const cx = createCx<State, Vars>(schemas);
 *   app.post("/cx", async (c) => {
 *     const body = await c.readJson();
 *     const r = await cxPostHandler(cx, {
 *       req: c.req, body, state: c.state, vars: c.vars,
 *       handlers,
 *       sse,
 *     });
 *     return cx.server.toResponse(r);
 *   });
 */
export const cxPostHandler = async <
  State,
  Vars extends Record<string, unknown>,
  Schemas extends CxActionSchemas,
  SseOut extends SseEventMap,
  Prefix extends string,
>(
  cx: CxKit<State, Vars, Schemas, SseOut, Prefix>,
  args: {
    req: Request;
    body: unknown;
    state: State;
    vars: Vars;
    handlers: CxActionHandlers<State, Vars, Schemas, SseOut, Prefix>;
    sse?: CxSseHub<SseOut>;
  },
): Promise<CxHandlerResult> =>
  await cx.server.dispatchFromRequestJson(
    args.req,
    args.body,
    args.state,
    args.vars,
    args.handlers,
    { sse: args.sse },
  );

/* =========================
 * Convenience: cxSseRegister()
 * =========================
 *
 * Intended for GET /cx/sse route handler.
 *
 * The UA always appends ?sessionId=... to the SSE URL.
 * If you follow the defaults, you can do:
 *
 *   app.get("/cx/sse", (c) =>
 *     c.sse<SseEvents>(async (session) => {
 *       const sid = c.query("sessionId") ?? "unknown";
 *       cxSseRegister(sseHub, sid, session);
 *       session.send("message", "ready");
 *     })
 *   );
 */
export const cxSseRegister = <E extends SseEventMap>(
  hub: CxSseHub<E>,
  sessionId: string,
  session: SseSession<E>,
): void => {
  const sid = (sessionId ?? "").trim();

  if (!sid || sid === "unknown") {
    // Don’t keep a session that can never be addressed.
    try {
      session.close();
    } catch {
      // ignore
    }
    return;
  }

  hub.register(sid, session);

  void session.ready.then(() => {
    queueMicrotask(() => {
      if (session.isClosed()) hub.unregister(sid);
    });
  });
};

/* =========================
 * OPTIONAL: stricter header/signals helpers
 * =========================
 *
 * These are small type-safe builders that prevent accidental non-objects.
 */

export const cxSignals = (obj: Record<string, unknown>): Attrs => {
  if (!isPlainObject(obj)) {
    throw new Error("cxSignals expects a plain object");
  }
  // This helper is intentionally generic; prefer cx.html.signals(...) in app code.
  return { "data-cx-signals": safeJson(obj) };
};

export const cxHeaders = (obj: Record<string, string>): Attrs => {
  if (!isPlainObject(obj)) {
    throw new Error("cxHeaders expects a plain object");
  }
  return { "data-cx-headers": safeJson(obj) };
};
