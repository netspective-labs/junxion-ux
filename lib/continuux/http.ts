/**
 * lib/continuux/http.ts
 *
 * This module provides a small, explicit, and fully type-safe HTTP foundation
 * for building pure TypeScript web UIs on Deno. It is intentionally minimal,
 * framework-light, and Fetch-native, with a strong emphasis on deterministic
 * behavior, explicit state semantics, and end-to-end type inference.
 *
 * Design goals:
 * - No hidden globals, registries, or implicit state
 * - Explicit request and application state lifetimes
 * - Strong typing for routes, params, SSE events, and per-request variables
 * - Safe defaults for streaming, abort handling, and observability
 * - Compatibility with Deno.serve and standard Fetch APIs
 *
 * What this module provides:
 *
 * Response helpers:
 * - Convenience helpers for text, HTML, JSON, and JavaScript responses
 * - Correct handling of Fetch edge cases (e.g. 204 / 304 with no body)
 *
 * Server-Sent Events (SSE):
 * - Type-safe SSE sessions via event maps
 * - Abort-aware lifecycle management using AbortSignal
 * - Automatic keepalive comments and optional retry hints
 * - Safe cleanup on disconnect to prevent leaked intervals or streams
 *
 * Typed router:
 * - Hono-inspired router without stringly-typed route keys
 * - Compile-time inference of path parameters from literal route strings
 * - Middleware with access to matched params
 * - Route grouping via typed base paths
 *
 * Application state semantics (explicit by construction):
 * - sharedState: one shared mutable object across all requests
 * - snapshotState: cloned state per request (mutations do not persist)
 * - stateFactory: per-request state produced by a factory
 *
 * These strategies remove ambiguity about whether state persists between
 * requests and make lifecycle choices explicit and inspectable.
 *
 * Per-request variables:
 * - Typed, mutable vars scoped to a single request
 * - Middleware-friendly storage for cross-cutting concerns
 *
 * Observability hooks:
 * - Optional hooks for request start, response completion, timing, and errors
 * - Minimal surface area, no imposed logging or tracing framework
 *
 * Architectural stance:
 * - No static file serving from disk
 * - Browser assets are expected to be served as bundled modules
 * - Encourages fully TypeScript-driven UI delivery
 *
 * Intended usage:
 * - Small to medium servers where correctness, clarity, and type safety matter
 * - Pure TypeScript UI stacks without heavyweight frameworks
 * - Systems that value explicit state and deterministic behavior
 *
 * This module is not a general-purpose web framework. It is a focused,
 * composable HTTP core designed to stay understandable, auditable, and
 * predictable as applications grow.
 */

/* =========================
 * response helpers
 * ========================= */

export const textResponse = (
  text: string,
  status = 200,
  headers?: HeadersInit,
) => {
  const h: HeadersInit = {
    "content-type": "text/plain; charset=utf-8",
    ...(headers ?? {}),
  };

  // Per Fetch spec, these status codes must not have a body.
  if (status === 204 || status === 304) {
    return new Response(null, { status, headers: h });
  }

  return new Response(text, { status, headers: h });
};

export const htmlResponse = (
  html: string,
  status = 200,
  headers?: HeadersInit,
) =>
  new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...(headers ?? {}),
    },
  });

export const jsonResponse = (
  obj: unknown,
  status = 200,
  headers?: HeadersInit,
) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(headers ?? {}),
    },
  });

export const jsResponse = (
  js: string,
  cacheControl = "no-store",
  status = 200,
  headers?: HeadersInit,
) =>
  new Response(js, {
    status,
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": cacheControl,
      ...(headers ?? {}),
    },
  });

export const methodNotAllowed = (path: string, allow: string) =>
  textResponse(
    ["Method not allowed.", "", `Endpoint: ${path}`, `Allowed: ${allow}`].join(
      "\n",
    ),
    405,
    { allow },
  );

/* =========================
 * small internal helpers
 * ========================= */

export type EmptyRecord = Record<PropertyKey, never>;
export type AnyParams = Record<string, string>;
export type VarsRecord = Record<string, unknown>;

export const asError = (err: unknown) =>
  err instanceof Error ? err : new Error(String(err));

/* =========================
 * SSE (type-safe + abort-aware)
 * ========================= */

export type SseEventMap = Record<string, unknown>;

export type SseOptions = {
  headers?: HeadersInit;
  retryMs?: number;
  disableProxyBuffering?: boolean; // default true
  keepAliveMs?: number; // default 15000
  keepAliveComment?: string; // default "keepalive"
  signal?: AbortSignal;
};

export type SseSession<E extends SseEventMap> = {
  response: Response;
  ready: Promise<void>;
  isClosed: () => boolean;
  close: () => void;

  send: <K extends keyof E>(event: K, data: E[K]) => boolean;
  sendWhenReady: <K extends keyof E>(event: K, data: E[K]) => Promise<boolean>;

  comment: (text?: string) => boolean;
  error: (message: string) => boolean;
};

const enc = new TextEncoder();
const sseEncode = (s: string) => enc.encode(s);

const sseDataToText = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (
    typeof v === "number" || typeof v === "boolean" || typeof v === "bigint"
  ) return String(v);
  if (v instanceof Uint8Array) return new TextDecoder().decode(v);
  return JSON.stringify(v);
};

const sseFrame = (event: string, dataText: string): Uint8Array => {
  const lines = dataText.split(/\r?\n/);
  let s = `event: ${event}\n`;
  for (const line of lines) s += `data: ${line}\n`;
  s += "\n";
  return sseEncode(s);
};

const sseCommentFrame = (comment: string): Uint8Array => {
  const c = comment.trim();
  return sseEncode(c ? `: ${c}\n\n` : `:\n\n`);
};

const sseRetryFrame = (retryMs: number): Uint8Array =>
  sseEncode(`retry: ${retryMs}\n\n`);

export const sseSession = <E extends SseEventMap = { message: string }>(
  opts: SseOptions = {},
): SseSession<E> => {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;

  let readyResolve!: () => void;
  const ready = new Promise<void>((r) => (readyResolve = r));

  const isClosed = () => closed;

  const cleanup: Array<() => void> = [];

  const close = () => {
    if (closed) return;
    closed = true;

    for (const fn of cleanup.splice(0)) {
      try {
        fn();
      } catch {
        // ignore
      }
    }

    try {
      controller?.close();
    } catch {
      // ignore
    } finally {
      controller = null;
    }
  };

  const enqueue = (chunk: Uint8Array): boolean => {
    if (closed || !controller) return false;
    try {
      controller.enqueue(chunk);
      return true;
    } catch {
      close();
      return false;
    }
  };

  const send = <K extends keyof E>(event: K, data: E[K]) =>
    enqueue(sseFrame(String(event), sseDataToText(data)));

  const error = (message: string) => enqueue(sseFrame("error", message));

  const comment = (text?: string) =>
    enqueue(sseCommentFrame(text ?? (opts.keepAliveComment ?? "keepalive")));

  const sendWhenReady = async <K extends keyof E>(event: K, data: E[K]) => {
    await ready;
    if (closed) return false;
    return send(event, data);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      readyResolve();
    },
    cancel() {
      close();
    },
  });

  const disableProxyBuffering = opts.disableProxyBuffering ?? true;

  const headers: HeadersInit = {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    "connection": "keep-alive",
    "content-encoding": "identity",
    ...(disableProxyBuffering ? { "x-accel-buffering": "no" } : {}),
    ...(opts.headers ?? {}),
  };

  const response = new Response(stream, { headers });

  if (typeof opts.retryMs === "number" && opts.retryMs >= 0) {
    void ready.then(() => enqueue(sseRetryFrame(opts.retryMs!)));
  }

  const keepAliveMs = opts.keepAliveMs ?? 15_000;
  const kaId = setInterval(() => {
    if (closed) return;
    comment(opts.keepAliveComment ?? "keepalive");
  }, keepAliveMs);
  cleanup.push(() => clearInterval(kaId));

  const signal = opts.signal;
  if (signal) {
    const onAbort = () => close();
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
    cleanup.push(() => signal.removeEventListener("abort", onAbort));
  }

  return {
    response,
    ready,
    isClosed,
    close,
    send,
    sendWhenReady,
    comment,
    error,
  };
};

export const sseEvery = <E extends SseEventMap, K extends keyof E>(
  session: SseSession<E>,
  intervalMs: number,
  event: K,
  fn: () => E[K] | null,
): () => void => {
  const id = setInterval(() => {
    if (session.isClosed()) {
      clearInterval(id);
      return;
    }
    const data = fn();
    if (data == null) return;
    const ok = session.send(event, data);
    if (!ok) clearInterval(id);
  }, intervalMs);

  return () => {
    clearInterval(id);
    session.close();
  };
};

/* =========================
 * Hono-inspired router (typed params + typed vars + observability)
 * ========================= */

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD";

type IsWideString<S extends string> = string extends S ? true : false;

type ExtractParamName<S extends string> = S extends
  `${string}:${infer P}/${infer Rest}` ? P | ExtractParamName<`/${Rest}`>
  : S extends `${string}:${infer P}` ? P
  : never;

export type ParamsOf<Path extends string> = IsWideString<Path> extends true
  ? AnyParams
  : [ExtractParamName<Path>] extends [never] ? EmptyRecord
  : { [K in ExtractParamName<Path>]: string };

export type SchemaLike<T> = { parse: (u: unknown) => T };

export type HandlerCtx<Path extends string, State, Vars extends VarsRecord> = {
  req: Request;
  url: URL;
  params: ParamsOf<Path>;

  state: State;

  vars: Vars;
  getVar: <K extends keyof Vars>(key: K) => Vars[K];
  setVar: <K extends keyof Vars>(key: K, value: Vars[K]) => void;

  requestId: string;

  text: (body: string, init?: ResponseInit) => Response;
  html: (body: string, init?: ResponseInit) => Response;
  json: (body: unknown, init?: ResponseInit) => Response;

  query: (name: string) => string | null;
  queryAll: () => URLSearchParams;

  readText: () => Promise<string>;
  readJson: () => Promise<unknown>;
  readJsonParsed: <T>(parser: (u: unknown) => T) => Promise<T>;
  readJsonWith: <T>(schema: SchemaLike<T>) => Promise<T>;
  readFormData: () => Promise<FormData>;

  sse: <E extends SseEventMap>(
    producer: (
      session: SseSession<E>,
      c: HandlerCtx<Path, State, Vars>,
    ) => void | Promise<void>,
    opts?: Omit<SseOptions, "signal">,
  ) => Response;
};

export type Handler<
  Path extends string,
  State,
  Vars extends VarsRecord,
> = (
  c: HandlerCtx<Path, State, Vars>,
) => Response | Promise<Response>;

export type Middleware<State, Vars extends VarsRecord> = (
  c: HandlerCtx<string, State, Vars>,
  next: () => Promise<Response>,
) => Response | Promise<Response>;

// Per-route middleware: typed to the route's Path so params are strongly typed.
export type RouteMiddleware<
  Path extends string,
  State,
  Vars extends VarsRecord,
> = (
  c: HandlerCtx<Path, State, Vars>,
  next: () => Promise<Response>,
) => Response | Promise<Response>;

export type ObservabilityHooks<State, Vars extends VarsRecord> = {
  onRequest?: (c: HandlerCtx<string, State, Vars>) => void;
  onResponse?: (
    c: HandlerCtx<string, State, Vars>,
    r: Response,
    ms: number,
  ) => void;
  onError?: (c: HandlerCtx<string, State, Vars>, err: unknown) => void;
};

export type CompiledRoute<State, Vars extends VarsRecord> = {
  method: HttpMethod;
  template: string;
  keys: string[];
  re: RegExp;
  handler: (
    req: Request,
    url: URL,
    params: AnyParams,
    state: State,
    vars: Vars,
    requestId: string,
  ) => Promise<Response>;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const compilePath = (template: string): { re: RegExp; keys: string[] } => {
  const keys: string[] = [];
  const parts = template.split("/").filter((p) => p.length > 0);
  const reParts = parts.map((p) => {
    if (p.startsWith(":")) {
      keys.push(p.slice(1));
      return "([^/]+)";
    }
    return escapeRe(p);
  });
  const re = new RegExp(`^/${reParts.join("/")}/?$`);
  return { re, keys };
};

const withBase = (base: string, path: string): string => {
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!b) return p;
  return `${b}${p}`;
};

type JoinPath<Base extends string, Path extends string> = `${Base}${Path extends
  `/${string}` ? Path : `/${Path}`}`;

const genRequestId = () => (globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

/* =========================
 * Middleware helpers
 * ========================= */

// Compose global middleware into a single middleware.
export const composeMiddleware = <State, Vars extends VarsRecord>(
  ...mws: Middleware<State, Vars>[]
): Middleware<State, Vars> =>
(c, next) => {
  const run = (i: number): Promise<Response> => {
    if (i >= mws.length) return next();
    const mw = mws[i];
    return Promise.resolve(mw(c, () => run(i + 1)));
  };
  return run(0);
};

// Compose per-route middleware plus final handler.
const composeRoute = <
  Path extends string,
  State,
  Vars extends VarsRecord,
>(
  mws: RouteMiddleware<Path, State, Vars>[],
  handler: Handler<Path, State, Vars>,
): (c: HandlerCtx<Path, State, Vars>) => Promise<Response> => {
  return (c) => {
    const run = (i: number): Promise<Response> => {
      if (i >= mws.length) return Promise.resolve(handler(c));
      const mw = mws[i];
      return Promise.resolve(mw(c, () => run(i + 1)));
    };
    return run(0);
  };
};

export const observe = <State, Vars extends VarsRecord>(
  hooks: ObservabilityHooks<State, Vars>,
): Middleware<State, Vars> =>
async (c, next) => {
  const t0 = performance.now();
  try {
    hooks.onRequest?.(c);
    const r = await next();
    const ms = performance.now() - t0;
    hooks.onResponse?.(c, r, ms);
    return r;
  } catch (err) {
    hooks.onError?.(c, err);
    throw err;
  }
};

/* =========================
 * Application state semantics (explicit)
 * ========================= */

export type StateStrategy = "shared" | "snapshot" | "factory";

export type StateProvider<State> = {
  readonly strategy: StateStrategy;
  getState: (req: Request) => State;
};

const defaultClone = <T>(v: T): T => {
  try {
    // deno-lint-ignore no-explicit-any
    return structuredClone(v as any);
  } catch {
    return JSON.parse(JSON.stringify(v)) as T;
  }
};

export class Application<
  State extends Record<string, unknown> = EmptyRecord,
  Vars extends VarsRecord = EmptyRecord,
> {
  readonly #routes: CompiledRoute<State, Vars>[] = [];
  readonly #mw: Array<{ base: string; fn: Middleware<State, Vars> }> = [];
  readonly #stateProvider: StateProvider<State>;
  #onError?:
    | ((
      err: unknown,
      c: HandlerCtx<string, State, Vars>,
    ) => Response | Promise<Response>)
    | undefined;
  #onNotFound?:
    | ((c: HandlerCtx<string, State, Vars>) => Response | Promise<Response>)
    | undefined;

  private constructor(stateProvider: StateProvider<State>) {
    this.#stateProvider = stateProvider;
  }

  static sharedState<
    State extends Record<string, unknown> = EmptyRecord,
    Vars extends VarsRecord = EmptyRecord,
  >(state: State): Application<State, Vars> {
    return new Application<State, Vars>({
      strategy: "shared",
      getState: () => state,
    });
  }

  static snapshotState<
    State extends Record<string, unknown> = EmptyRecord,
    Vars extends VarsRecord = EmptyRecord,
  >(
    state: State,
    opts?: { clone?: (v: State) => State },
  ): Application<State, Vars> {
    const clone = opts?.clone ?? defaultClone;
    return new Application<State, Vars>({
      strategy: "snapshot",
      getState: () => clone(state),
    });
  }

  static stateFactory<
    State extends Record<string, unknown> = EmptyRecord,
    Vars extends VarsRecord = EmptyRecord,
  >(factory: (req: Request) => State): Application<State, Vars> {
    return new Application<State, Vars>({
      strategy: "factory",
      getState: (req) => factory(req),
    });
  }

  stateSemantics(): StateStrategy {
    return this.#stateProvider.strategy;
  }

  // Overload 1: generic-only, explicit type parameter.
  withVars<More extends VarsRecord>(): Application<State, Vars & More>;
  // Overload 2: shape-based inference, juniors can pass an example object.
  withVars<More extends VarsRecord>(_: More): Application<State, Vars & More>;
  withVars<More extends VarsRecord>(
    _?: More,
  ): Application<State, Vars & More> {
    return this as unknown as Application<State, Vars & More>;
  }

  // Configure global error handler.
  onError(
    fn: (
      err: unknown,
      c: HandlerCtx<string, State, Vars>,
    ) => Response | Promise<Response>,
  ): this {
    this.#onError = fn;
    return this;
  }

  // Configure global not-found handler.
  notFound(
    fn: (c: HandlerCtx<string, State, Vars>) => Response | Promise<Response>,
  ): this {
    this.#onNotFound = fn;
    return this;
  }

  use(fn: Middleware<State, Vars>): this;
  use<Base extends string>(base: Base, fn: Middleware<State, Vars>): this;
  use(a: string | Middleware<State, Vars>, b?: Middleware<State, Vars>): this {
    if (typeof a === "function") {
      this.#mw.push({ base: "", fn: a });
      return this;
    }
    if (typeof b !== "function") {
      throw new Error("use(base, fn) requires a function");
    }
    this.#mw.push({ base: a, fn: b });
    return this;
  }

  // Mount a child Application under a base path (sub-app mounting).
  mount<Base extends string>(
    base: Base,
    child: Application<State, Vars>,
  ): this {
    const baseNorm = base.endsWith("/") ? base.slice(0, -1) : base;
    this.use(baseNorm, async (c) => {
      const url = new URL(c.req.url);
      const path = url.pathname;
      const prefix = baseNorm;
      const newPath = path.startsWith(prefix)
        ? path.slice(prefix.length) || "/"
        : path;
      url.pathname = newPath;
      const childReq = new Request(url.toString(), c.req);
      return await child.fetch(childReq);
    });
    return this;
  }

  // Route methods with per-route middleware support:
  // app.get("/path", handler)
  // app.get("/path", mw1, mw2, handler)
  get<Path extends string>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<Path, State, Vars>,
    ]
  ): this {
    const routeMws = handlers.slice(
      0,
      -1,
    ) as RouteMiddleware<Path, State, Vars>[];
    const h = handlers[handlers.length - 1] as Handler<Path, State, Vars>;
    return this.#add("GET", path, routeMws, h);
  }

  post<Path extends string>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<Path, State, Vars>,
    ]
  ): this {
    const routeMws = handlers.slice(
      0,
      -1,
    ) as RouteMiddleware<Path, State, Vars>[];
    const h = handlers[handlers.length - 1] as Handler<Path, State, Vars>;
    return this.#add("POST", path, routeMws, h);
  }

  put<Path extends string>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<Path, State, Vars>,
    ]
  ): this {
    const routeMws = handlers.slice(
      0,
      -1,
    ) as RouteMiddleware<Path, State, Vars>[];
    const h = handlers[handlers.length - 1] as Handler<Path, State, Vars>;
    return this.#add("PUT", path, routeMws, h);
  }

  patch<Path extends string>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<Path, State, Vars>,
    ]
  ): this {
    const routeMws = handlers.slice(
      0,
      -1,
    ) as RouteMiddleware<Path, State, Vars>[];
    const h = handlers[handlers.length - 1] as Handler<Path, State, Vars>;
    return this.#add("PATCH", path, routeMws, h);
  }

  delete<Path extends string>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<Path, State, Vars>,
    ]
  ): this {
    const routeMws = handlers.slice(
      0,
      -1,
    ) as RouteMiddleware<Path, State, Vars>[];
    const h = handlers[handlers.length - 1] as Handler<Path, State, Vars>;
    return this.#add("DELETE", path, routeMws, h);
  }

  all<Path extends string>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<Path, State, Vars>[],
      Handler<Path, State, Vars>,
    ]
  ): this {
    const routeMws = handlers.slice(
      0,
      -1,
    ) as RouteMiddleware<Path, State, Vars>[];
    const h = handlers[handlers.length - 1] as Handler<Path, State, Vars>;
    this.#add("GET", path, routeMws, h);
    this.#add("POST", path, routeMws, h);
    this.#add("PUT", path, routeMws, h);
    this.#add("PATCH", path, routeMws, h);
    this.#add("DELETE", path, routeMws, h);
    this.#add("OPTIONS", path, routeMws, h);
    this.#add("HEAD", path, routeMws, h);
    return this;
  }

  route<Base extends string>(
    base: Base,
    fn: (r: RouteBuilder<State, Vars, Base>) => void,
  ): this {
    fn(new RouteBuilder<State, Vars, Base>(this, base));
    return this;
  }

  // Simple schema-aware helpers for JSON body routes.
  postJson<Path extends string, Body>(
    path: Path,
    schema: SchemaLike<Body>,
    handler: (
      c: HandlerCtx<Path, State, Vars>,
      body: Body,
    ) => Response | Promise<Response>,
    ...mws: RouteMiddleware<Path, State, Vars>[]
  ): this {
    return this.post(
      path,
      ...mws,
      async (c) => {
        const body = await c.readJsonWith(schema);
        return handler(c, body);
      },
    );
  }

  putJson<Path extends string, Body>(
    path: Path,
    schema: SchemaLike<Body>,
    handler: (
      c: HandlerCtx<Path, State, Vars>,
      body: Body,
    ) => Response | Promise<Response>,
    ...mws: RouteMiddleware<Path, State, Vars>[]
  ): this {
    return this.put(
      path,
      ...mws,
      async (c) => {
        const body = await c.readJsonWith(schema);
        return handler(c, body);
      },
    );
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method.toUpperCase() as HttpMethod;
    const path = url.pathname;

    const match = this.#match(method, path);
    const params = match?.params ?? ({} as AnyParams);

    const mw = this.#mw
      .filter((m) =>
        path === m.base ||
        (m.base &&
          path.startsWith(m.base.endsWith("/") ? m.base : `${m.base}/`)) ||
        m.base === ""
      )
      .map((m) => m.fn);

    const requestId = genRequestId();
    const vars = Object.create(null) as Vars;
    const state = this.#stateProvider.getState(req);

    const dispatch = (): Promise<Response> => {
      if (match) {
        return match.route.handler(
          req,
          url,
          match.params,
          state,
          vars,
          requestId,
        );
      }

      const allow = this.#allowList(path);
      if (allow) return Promise.resolve(methodNotAllowed(path, allow));

      if (this.#onNotFound) {
        const ctx = this.#ctx<string>(
          req,
          url,
          params,
          state,
          vars,
          requestId,
        );
        return Promise.resolve(this.#onNotFound(ctx));
      }

      return Promise.resolve(
        textResponse(`Not found: ${req.method} ${path}`, 404),
      );
    };

    const run = (i: number): Promise<Response> => {
      if (i >= mw.length) return dispatch();
      const ctx = this.#ctx<string>(
        req,
        url,
        params,
        state,
        vars,
        requestId,
      );
      const fn = mw[i];
      return Promise.resolve(fn(ctx, () => run(i + 1)));
    };

    try {
      return await run(0);
    } catch (err) {
      if (this.#onError) {
        const ctx = this.#ctx<string>(
          req,
          url,
          params,
          state,
          vars,
          requestId,
        );
        return await this.#onError(err, ctx);
      }
      throw err;
    }
  }

  serve(options?: Deno.ServeOptions): void {
    Deno.serve(options ?? {}, (req) => this.fetch(req));
  }

  #allowList(path: string): string {
    const methods = new Set<HttpMethod>();
    for (const r of this.#routes) {
      if (path.match(r.re)) methods.add(r.method);
    }
    return Array.from(methods).sort().join(", ");
  }

  #match(
    method: HttpMethod,
    path: string,
  ): { route: CompiledRoute<State, Vars>; params: AnyParams } | null {
    for (const r of this.#routes) {
      if (r.method !== method) continue;
      const m = path.match(r.re);
      if (!m) continue;
      const params: AnyParams = {};
      for (let i = 0; i < r.keys.length; i++) {
        params[r.keys[i]] = decodeURIComponent(m[i + 1] ?? "");
      }
      return { route: r, params };
    }
    return null;
  }

  #ctx<Path extends string>(
    req: Request,
    url: URL,
    params: AnyParams,
    state: State,
    vars: Vars,
    requestId: string,
  ): HandlerCtx<Path, State, Vars> {
    const initWith = (init?: ResponseInit) => init ?? {};
    const typedParams = params as ParamsOf<Path>;
    return {
      req,
      url,
      params: typedParams,
      state,

      vars,
      getVar: (k) => vars[k],
      setVar: (k, v) => {
        vars[k] = v;
      },

      requestId,

      text: (body, init) =>
        textResponse(
          body,
          initWith(init).status ?? 200,
          initWith(init).headers,
        ),
      html: (body, init) =>
        htmlResponse(
          body,
          initWith(init).status ?? 200,
          initWith(init).headers,
        ),
      json: (body, init) =>
        jsonResponse(
          body,
          initWith(init).status ?? 200,
          initWith(init).headers,
        ),

      query: (name) => url.searchParams.get(name),
      queryAll: () => url.searchParams,

      readText: async () => await req.text(),
      readJson: async () => (await req.json()) as unknown,
      readJsonParsed: async <T>(parser: (u: unknown) => T) => {
        const u = (await req.json()) as unknown;
        return parser(u);
      },
      readJsonWith: async <T>(schema: SchemaLike<T>) => {
        const u = (await req.json()) as unknown;
        return schema.parse(u);
      },
      readFormData: async () => await req.formData(),

      sse: <E extends SseEventMap>(
        producer: (
          session: SseSession<E>,
          c: HandlerCtx<Path, State, Vars>,
        ) => void | Promise<void>,
        opts?: Omit<SseOptions, "signal">,
      ) => {
        const session = sseSession<E>({ ...(opts ?? {}), signal: req.signal });
        void (async () => {
          try {
            await session.ready;
            await producer(
              session,
              this.#ctx<Path>(
                req,
                url,
                params,
                state,
                vars,
                requestId,
              ),
            );
          } catch (err) {
            const e = asError(err);
            session.error(`SSE producer error: ${e.message}`);
            session.close();
          }
        })();
        return session.response;
      },
    };
  }

  #add<M extends HttpMethod, Path extends string>(
    method: M,
    path: Path,
    routeMws: RouteMiddleware<Path, State, Vars>[],
    h: Handler<Path, State, Vars>,
  ): this {
    const p = path.startsWith("/") ? path : `/${path}`;
    const { re, keys } = compilePath(p);
    const composed = composeRoute(routeMws, h);

    const handler = async (
      req: Request,
      url: URL,
      params: AnyParams,
      state: State,
      vars: Vars,
      requestId: string,
    ) => {
      const ctx = this.#ctx<Path>(
        req,
        url,
        params,
        state,
        vars,
        requestId,
      );
      return await composed(ctx);
    };

    this.#routes.push({ method, template: p, keys, re, handler });
    return this;
  }
}

export class RouteBuilder<
  State extends Record<string, unknown>,
  Vars extends VarsRecord,
  Base extends string,
> {
  constructor(private app: Application<State, Vars>, private base: Base) {}

  get<Path extends string>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<JoinPath<Base, Path>, State, Vars>[],
      Handler<JoinPath<Base, Path>, State, Vars>,
    ]
  ): this {
    const full = withBase(this.base, path) as JoinPath<Base, Path>;
    this.app.get(full, ...handlers);
    return this;
  }

  post<Path extends string>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<JoinPath<Base, Path>, State, Vars>[],
      Handler<JoinPath<Base, Path>, State, Vars>,
    ]
  ): this {
    const full = withBase(this.base, path) as JoinPath<Base, Path>;
    this.app.post(full, ...handlers);
    return this;
  }

  put<Path extends string>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<JoinPath<Base, Path>, State, Vars>[],
      Handler<JoinPath<Base, Path>, State, Vars>,
    ]
  ): this {
    const full = withBase(this.base, path) as JoinPath<Base, Path>;
    this.app.put(full, ...handlers);
    return this;
  }

  patch<Path extends string>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<JoinPath<Base, Path>, State, Vars>[],
      Handler<JoinPath<Base, Path>, State, Vars>,
    ]
  ): this {
    const full = withBase(this.base, path) as JoinPath<Base, Path>;
    this.app.patch(full, ...handlers);
    return this;
  }

  delete<Path extends string>(
    path: Path,
    ...handlers: [
      ...RouteMiddleware<JoinPath<Base, Path>, State, Vars>[],
      Handler<JoinPath<Base, Path>, State, Vars>,
    ]
  ): this {
    const full = withBase(this.base, path) as JoinPath<Base, Path>;
    this.app.delete(full, ...handlers);
    return this;
  }
}

/* =========================
 * Simple built-in middleware
 * ========================= */

// Basic request logger (method, path, status, ms, requestId).
export const logger = <State, Vars extends VarsRecord>(): Middleware<
  State,
  Vars
> =>
async (c, next) => {
  const start = performance.now();
  const method = c.req.method;
  const { pathname } = c.url;
  try {
    const res = await next();
    const ms = (performance.now() - start).toFixed(1);
    // eslint-disable-next-line no-console
    console.log(
      `[${c.requestId}] ${method} ${pathname} -> ${res.status} ${ms}ms`,
    );
    return res;
  } catch (err) {
    const ms = (performance.now() - start).toFixed(1);
    // eslint-disable-next-line no-console
    console.error(
      `[${c.requestId}] ${method} ${pathname} ERROR ${ms}ms`,
      err,
    );
    throw err;
  }
};

// Attach x-request-id response header.
export const requestIdHeader = <State, Vars extends VarsRecord>(): Middleware<
  State,
  Vars
> =>
async (c, next) => {
  const res = await next();
  const headers = new Headers(res.headers);
  headers.set("x-request-id", c.requestId);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
};

export type SimpleCorsOptions = {
  origin?: string; // default "*"
  allowMethods?: HttpMethod[]; // default common methods
  allowHeaders?: string[]; // default "*"
};

export const cors = <State, Vars extends VarsRecord>(
  opts: SimpleCorsOptions = {},
): Middleware<State, Vars> => {
  const origin = opts.origin ?? "*";
  const allowMethods = opts.allowMethods ?? [
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ];
  const allowHeaders = opts.allowHeaders ?? ["*"];

  return async (c, next) => {
    const reqMethod = c.req.method.toUpperCase();

    const baseHeaders: HeadersInit = {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": allowMethods.join(", "),
      "access-control-allow-headers": allowHeaders.join(", "),
    };

    if (reqMethod === "OPTIONS") {
      return textResponse("", 204, baseHeaders);
    }

    const res = await next();
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(baseHeaders)) {
      headers.set(k, v);
    }
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  };
};

/* =========================
 * 404 helper (kept)
 * ========================= */

export const notFoundPureTsUi = (req: Request, hintRoutes: string[]) => {
  const url = new URL(req.url);
  const looksStatic = req.method === "GET" &&
    (url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".map") ||
      url.pathname.endsWith(".html"));

  if (looksStatic) {
    return textResponse(
      [
        "Not found.",
        "",
        "This server does not serve static files from disk.",
        "All browser assets must be requested as bundled modules.",
        "",
        "Known module endpoints:",
        ...hintRoutes.map((r) => `  ${r}`),
        "",
        `Requested: ${req.method} ${url.pathname}`,
      ].join("\n"),
      404,
    );
  }

  return textResponse(`Not found: ${req.method} ${url.pathname}`, 404);
};
