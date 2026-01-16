// lib/http/server.ts
//
// Reusable HTTP server helpers for pure-TypeScript web UIs.
// - No filesystem static serving
// - In-memory module bundling (Deno.bundle) with caching
// - Friendly error messages for missing/broken bundles
// - Small response helpers (html/js/text/json)
// - SSE helper for event streams (safe on disconnect; no server crashes)

export type BundleOptions = {
  cacheKey?: string;
  minify?: boolean;
  cacheControl?: string; // default "no-store"
};

export type BundleOk = {
  ok: true;
  js: string;
  cacheKey: string;
};

export type BundleErr = {
  ok: false;
  status: number;
  message: string;
  details?: string;
};

export type BundleResult = BundleOk | BundleErr;

const asError = (err: unknown) => {
  if (err instanceof Error) return err;
  return new Error(String(err));
};

const stackIfAny = (err: Error) => (err.stack ? `\n\n${err.stack}` : "");

export const textResponse = (
  text: string,
  status = 200,
  headers?: HeadersInit,
) =>
  new Response(text, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...(headers ?? {}),
    },
  });

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

export type InMemoryBundlerConfig = {
  // default minify behavior when not specified per-request
  defaultMinify?: boolean;
};

export class InMemoryBundler {
  readonly #cache = new Map<string, string>();
  readonly #defaultMinify: boolean;

  constructor(cfg: InMemoryBundlerConfig = {}) {
    this.#defaultMinify = cfg.defaultMinify ?? true;
  }

  get cacheSize(): number {
    return this.#cache.size;
  }

  clearCache(): void {
    this.#cache.clear();
  }

  prime(cacheKey: string, js: string): void {
    this.#cache.set(cacheKey, js);
  }

  peek(cacheKey: string): string | undefined {
    return this.#cache.get(cacheKey);
  }

  async bundle(entry: string, opts: BundleOptions = {}): Promise<BundleResult> {
    const cacheKey = opts.cacheKey ?? entry;
    const cached = this.#cache.get(cacheKey);
    if (cached) return { ok: true, js: cached, cacheKey };

    let result: Awaited<ReturnType<typeof Deno.bundle>>;
    try {
      result = await Deno.bundle({
        entrypoints: [entry],
        outputDir: "dist",
        platform: "browser",
        minify: opts.minify ?? this.#defaultMinify,
        write: false,
      });
    } catch (err) {
      const e = asError(err);
      return {
        ok: false,
        status: 500,
        message:
          `Bundle error: Deno.bundle failed\n\nEntry:\n${entry}\n\n${e.message}${
            stackIfAny(e)
          }`,
      };
    }

    const outputs = result.outputFiles ?? [];
    if (outputs.length === 0) {
      return {
        ok: false,
        status: 500,
        message:
          `Bundle error: no output files produced\n\nEntry:\n${entry}\n\nTip: verify the module exists and that imports resolve.`,
      };
    }

    const jsFile = outputs.find((f) => f.path.endsWith(".js")) ?? outputs[0];
    const jsText = jsFile?.text?.() ?? "";
    if (!jsText.trim()) {
      return {
        ok: false,
        status: 500,
        message:
          `Bundle error: JavaScript output is empty\n\nEntry:\n${entry}\n\nTip: check import graph and bundler errors.`,
      };
    }

    this.#cache.set(cacheKey, jsText);
    return { ok: true, js: jsText, cacheKey };
  }

  async jsModuleResponse(
    entry: string,
    opts: BundleOptions = {},
  ): Promise<Response> {
    const r = await this.bundle(entry, opts);
    if (!r.ok) return textResponse(r.message, r.status);
    const cc = opts.cacheControl ?? "no-store";
    return jsResponse(r.js, cc);
  }
}

/* =========================
 * SSE (safe on disconnect)
 * ========================= */

export type SseHeaders = {
  // Optional additional headers
  headers?: HeadersInit;
};

export type SseSend = (event: string, data: string) => boolean;

export type SseSession = {
  response: Response;
  send: SseSend;
  close: () => void;
  isClosed: () => boolean;
};

const sseEncodeFrame = (event: string, data: string): Uint8Array => {
  // SSE requires each line to be prefixed with "data: "
  const lines = data.split(/\r?\n/);
  let s = `event: ${event}\n`;
  for (const line of lines) s += `data: ${line}\n`;
  s += `\n`;
  return new TextEncoder().encode(s);
};

export const sseSession = (opts: SseHeaders = {}): SseSession => {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;

  const isClosed = () => closed;

  const close = () => {
    if (closed) return;
    closed = true;
    try {
      controller?.close();
    } catch {
      // ignore: already closed/canceled
    } finally {
      controller = null;
    }
  };

  const send: SseSend = (event, data) => {
    if (closed || !controller) return false;
    try {
      controller.enqueue(sseEncodeFrame(event, data));
      return true;
    } catch {
      // Most common: client disconnected, stream canceled, or already closed.
      close();
      return false;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      close();
    },
  });

  return {
    response: new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "connection": "keep-alive",
        ...(opts.headers ?? {}),
      },
    }),
    send,
    close,
    isClosed,
  };
};

export const sseResponse = (
  producer: (send: SseSend) => { close?: () => void } | void,
  opts: SseHeaders = {},
): Response => {
  const session = sseSession(opts);

  try {
    const res = producer(session.send);
    const closer = res && typeof res === "object" ? res.close : undefined;
    if (closer) {
      // If producer provides its own closer, tie it to our close.
      const prevClose = session.close;
      session.close = () => {
        try {
          closer();
        } catch {
          // ignore
        }
        prevClose();
      };
    }
  } catch (err) {
    const e = asError(err);
    session.send("error", `SSE producer error: ${e.message}`);
    session.close();
  }

  return session.response;
};

export const sseEvery = (
  session: SseSession,
  intervalMs: number,
  fn: () => { event: string; data: string } | null,
): () => void => {
  const id = setInterval(() => {
    if (session.isClosed()) {
      clearInterval(id);
      return;
    }
    const msg = fn();
    if (!msg) return;
    const ok = session.send(msg.event, msg.data);
    if (!ok) clearInterval(id);
  }, intervalMs);

  return () => {
    clearInterval(id);
    session.close();
  };
};

/* =========================
 * 404 helper
 * ========================= */

export const notFoundPureTsUi = (req: Request, hintRoutes: string[]) => {
  const url = new URL(req.url);
  const looksStatic = req.method === "GET" &&
    (url.pathname.endsWith(".js") || url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".map") || url.pathname.endsWith(".html"));

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
