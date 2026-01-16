// lib/continuux/interaction.ts
//
// Server-side helpers + userAgentAide for serving the browser UA module.
// This file assumes it sits next to "./interaction-browser-ua.js".

export type AttrValue = string | number | boolean | null | undefined;
export type Attrs = Record<string, AttrValue>;

export type CxDomEventName =
  | "click"
  | "dblclick"
  | "submit"
  | "change"
  | "input"
  | "keydown"
  | "keyup"
  | "focusin"
  | "focusout"
  | "pointerdown"
  | "pointerup";

export type CxEnvelopeKind = "cx/interaction";

export type CxClientMeta = {
  sessionId: string;
  requestId: string;
  userAgent?: string;
  href: string;
  pathname: string;
  search: string; // may be ""
  referrer?: string;
  ts: number;
  appVersion?: string;
};

export type CxElementMeta = {
  tag: string;
  id?: string;
  name?: string;
  className?: string;
  role?: string | null;
  cxId?: string;
};

export type CxPointerMeta = {
  x?: number;
  y?: number;
  button?: number;
  buttons?: number;
};

export type CxKeyMeta = {
  key?: string;
  code?: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
};

export type CxInputMeta = {
  value?: string;
  checked?: boolean;
};

export type CxFormValue = string | string[];
export type CxFormDataObject = Record<string, CxFormValue>;

export type CxInteractionEnvelope = {
  kind: CxEnvelopeKind;
  domEvent: CxDomEventName;
  spec: string;

  element: CxElementMeta;
  client: CxClientMeta;

  pointer?: CxPointerMeta;
  key?: CxKeyMeta;
  input?: CxInputMeta;
  form?: CxFormDataObject;

  signals?: Record<string, unknown>;
  headers?: Record<string, string>;
};

export type CxInbound = CxInteractionEnvelope;

export type SchemaLike<T> = { parse: (u: unknown) => T };

export type CxHandlerCtx<State, Vars extends Record<string, unknown>> = {
  state: State;
  vars: Vars;
  cx: CxInbound;
  req: Request;
  scratch: Record<string, unknown>;
};

export type CxHandlerResult =
  | { ok: true }
  | { ok: true; headers?: HeadersInit }
  | { ok: false; status: number; message: string };

export type CxHandler<State, Vars extends Record<string, unknown>, T> = (
  ctx: CxHandlerCtx<State, Vars> & { data: T },
) => Promise<CxHandlerResult> | CxHandlerResult;

export type CxRoute<State, Vars extends Record<string, unknown>, T> = {
  name: string;
  schema: SchemaLike<T> | ((u: unknown) => T);
  handler: CxHandler<State, Vars, T>;
};

export type CxRouter<State, Vars extends Record<string, unknown>> = {
  add<T>(route: CxRoute<State, Vars, T>): CxRouter<State, Vars>;
  has(name: string): boolean;
  decodeEnvelope(env: unknown): CxInbound;
  dispatch(
    name: string,
    req: Request,
    env: unknown,
    state: State,
    vars: Vars,
  ): Promise<CxHandlerResult>;
};

const asError = (err: unknown) =>
  err instanceof Error ? err : new Error(String(err));

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (v == null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

const mustNonEmptyString = (o: Record<string, unknown>, k: string): string => {
  const v = o[k];
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(`cx envelope: ${k} missing`);
  }
  return v;
};

const mustString = (o: Record<string, unknown>, k: string): string => {
  const v = o[k];
  if (typeof v !== "string") throw new Error(`cx envelope: ${k} missing`);
  return v;
};

const optString = (o: Record<string, unknown>, k: string): string | undefined =>
  typeof o[k] === "string" ? (o[k] as string) : undefined;

const mustNumber = (o: Record<string, unknown>, k: string): number => {
  const v = o[k];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new Error(`cx envelope: ${k} missing`);
  }
  return v;
};

export const decodeCxEnvelope = (env: unknown): CxInbound => {
  if (!isPlainObject(env)) throw new Error("cx envelope: object expected");

  const kind = mustNonEmptyString(env, "kind");
  if (kind !== "cx/interaction") {
    throw new Error(`cx envelope: bad kind ${kind}`);
  }

  const domEvent = mustNonEmptyString(env, "domEvent") as CxDomEventName;
  const spec = mustNonEmptyString(env, "spec");

  const elementU = env["element"];
  if (!isPlainObject(elementU)) throw new Error("cx envelope: element missing");
  const element: CxElementMeta = {
    tag: mustNonEmptyString(elementU, "tag"),
    id: optString(elementU, "id"),
    name: optString(elementU, "name"),
    className: optString(elementU, "className"),
    role: typeof elementU["role"] === "string"
      ? (elementU["role"] as string)
      : null,
    cxId: optString(elementU, "cxId"),
  };

  const clientU = env["client"];
  if (!isPlainObject(clientU)) throw new Error("cx envelope: client missing");
  const client: CxClientMeta = {
    sessionId: mustNonEmptyString(clientU, "sessionId"),
    requestId: mustNonEmptyString(clientU, "requestId"),
    userAgent: optString(clientU, "userAgent"),
    href: mustNonEmptyString(clientU, "href"),
    pathname: mustNonEmptyString(clientU, "pathname"),
    search: mustString(clientU, "search"), // allow ""
    referrer: optString(clientU, "referrer"),
    ts: mustNumber(clientU, "ts"),
    appVersion: optString(clientU, "appVersion"),
  };

  const out: CxInbound = {
    kind: "cx/interaction",
    domEvent,
    spec,
    element,
    client,
  };

  if (isPlainObject(env["pointer"])) {
    out.pointer = env["pointer"] as CxPointerMeta;
  }
  if (isPlainObject(env["key"])) out.key = env["key"] as CxKeyMeta;
  if (isPlainObject(env["input"])) out.input = env["input"] as CxInputMeta;
  if (isPlainObject(env["form"])) out.form = env["form"] as CxFormDataObject;
  if (isPlainObject(env["signals"])) {
    out.signals = env["signals"] as Record<string, unknown>;
  }
  if (isPlainObject(env["headers"])) {
    const h = env["headers"] as Record<string, unknown>;
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(h)) {
      if (typeof v === "string") headers[k] = v;
    }
    out.headers = headers;
  }

  return out;
};

export const cxRouter = <
  State,
  Vars extends Record<string, unknown>,
>(): CxRouter<State, Vars> => {
  const routes = new Map<string, CxRoute<State, Vars, unknown>>();

  const parseWith = <T>(
    schema: SchemaLike<T> | ((u: unknown) => T),
    u: unknown,
  ): T => {
    if (typeof schema === "function") return schema(u);
    return schema.parse(u);
  };

  return {
    add<T>(route: CxRoute<State, Vars, T>) {
      routes.set(route.name, route as unknown as CxRoute<State, Vars, unknown>);
      return this;
    },

    has(name) {
      return routes.has(name);
    },

    decodeEnvelope: decodeCxEnvelope,

    async dispatch(name, req, env, state, vars) {
      const r = routes.get(name);
      if (!r) {
        return {
          ok: false,
          status: 404,
          message: `cx route not found: ${name}`,
        };
      }

      let cx: CxInbound;
      try {
        cx = decodeCxEnvelope(env);
      } catch (err) {
        const e = asError(err);
        return { ok: false, status: 400, message: e.message };
      }

      let data: unknown;
      try {
        data = parseWith(r.schema as unknown as SchemaLike<unknown>, env);
      } catch (err) {
        const e = asError(err);
        return {
          ok: false,
          status: 400,
          message: `cx validation failed: ${e.message}`,
        };
      }

      const ctx: CxHandlerCtx<State, Vars> & { data: unknown } = {
        state,
        vars,
        cx,
        req,
        scratch: Object.create(null),
        data,
      };

      try {
        return await r.handler(ctx as never);
      } catch (err) {
        const e = asError(err);
        return {
          ok: false,
          status: 500,
          message: `cx handler error: ${e.message}`,
        };
      }
    },
  };
};

/* =========================
 * Diagnostics helpers (shared by tests and tools)
 * ========================= */

export const CX_DIAG_PREFIX = "[cx:diag]";

export type CxDiagEvent = {
  kind: string;
  ts: number;
  data: unknown;
};

export const parseCxDiagLine = (line: string): CxDiagEvent | null => {
  if (!line.startsWith(CX_DIAG_PREFIX)) return null;
  const jsonText = line.slice(CX_DIAG_PREFIX.length).trim();
  try {
    const obj = JSON.parse(jsonText) as CxDiagEvent;
    if (!obj || typeof obj.kind !== "string" || typeof obj.ts !== "number") {
      return null;
    }
    return obj;
  } catch {
    return null;
  }
};

export const tail = <T>(arr: T[], n: number): T[] =>
  arr.slice(Math.max(0, arr.length - n));

export type CxDiagnosticsDumpInput = {
  title: string;

  diags: CxDiagEvent[];
  diagRawLines: string[];

  consoleLogs: string[];
  pageErrors: string[];

  posts?: Array<{ domEvent: string; spec: string }>;
};

export const formatCxDiagnosticsDump = (i: CxDiagnosticsDumpInput): string => {
  const postsLine = i.posts && i.posts.length
    ? i.posts.map((p) => `${p.domEvent}:${p.spec}`).join(", ")
    : "";

  return [
    i.title,
    "",
    `diag count: ${i.diags.length}`,
    ...tail(i.diagRawLines, 80).map((s) => `  ${s}`),
    "",
    "Console logs:",
    ...tail(i.consoleLogs, 120),
    "",
    "Page errors:",
    ...tail(i.pageErrors, 80),
    "",
    `posts: ${postsLine}`,
  ].join("\n");
};

export const sawDiag = (
  diags: CxDiagEvent[],
  kind: string,
  pred?: (d: CxDiagEvent) => boolean,
): boolean => diags.some((d) => d.kind === kind && (!pred || pred(d)));

/* =========================
 * Attributes and UA serving
 * ========================= */

export type UserAgentAideConfig = {
  defaultPostUrl?: string;
  defaultSseUrl?: string;
};

export type UserAgentAide = {
  attrs: {
    cx: string;
    on: (domEvent: CxDomEventName) => string;
    id: string;
    signals: string;
    headers: string;
    sseUrl: string;
    sseWithCredentials: string;
  };

  moduleSource: () => Promise<string>;
  moduleResponse: (cacheControl?: string) => Promise<Response>;

  bootModuleSnippet: (opts?: {
    importUrl?: string;
    postUrl?: string;
    sseUrl?: string;
    debug?: boolean;
    diagnostics?: boolean;
    autoConnect?: boolean;
  }) => string;
};

export const userAgentAide = (
  _cfg: UserAgentAideConfig = {},
): UserAgentAide => {
  const prefix = "data-cx";

  const attrs = {
    cx: `${prefix}`,
    on: (domEvent: CxDomEventName) => `${prefix}-on-${domEvent}`,
    id: `${prefix}-id`,
    signals: `${prefix}-signals`,
    headers: `${prefix}-headers`,
    sseUrl: `${prefix}-sse-url`,
    sseWithCredentials: `${prefix}-sse-with-credentials`,
  };

  const moduleSource = async (): Promise<string> => {
    const resolved = import.meta.resolve("./interaction-browser-ua.js");
    const res = await fetch(resolved);
    if (!res.ok) {
      throw new Error(
        `Failed to load interaction-browser-ua.js (${res.status} ${res.statusText}) from ${resolved}`,
      );
    }
    return await res.text();
  };

  const moduleResponse = async (
    cacheControl = "no-store",
  ): Promise<Response> => {
    const js = await moduleSource();
    return new Response(js, {
      headers: {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": cacheControl,
      },
    });
  };

  const bootModuleSnippet = (opts: {
    importUrl?: string;
    postUrl?: string;
    sseUrl?: string;
    debug?: boolean;
    diagnostics?: boolean;
    autoConnect?: boolean;
  } = {}): string => {
    const importUrl = opts.importUrl ?? "/interaction-browser-ua.js";
    const postUrl = opts.postUrl ?? "/cx";
    const sseUrl = opts.sseUrl ?? "/cx/sse";
    const debug = !!opts.debug;
    const diagnostics = !!opts.diagnostics;
    const autoConnect = opts.autoConnect ?? true;

    return [
      `import { createCxUserAgent } from ${JSON.stringify(importUrl)};`,
      `window.CX = createCxUserAgent({`,
      `  postUrl: ${JSON.stringify(postUrl)},`,
      `  sseUrl: ${JSON.stringify(sseUrl)},`,
      `  debug: ${String(debug)},`,
      `  diagnostics: ${String(diagnostics)},`,
      `  autoConnect: ${String(autoConnect)},`,
      `});`,
    ].join("\n");
  };

  return { attrs, moduleSource, moduleResponse, bootModuleSnippet };
};
