// lib/continuux/bundle.ts
import {
  asError,
  jsResponse,
  type Middleware,
  textResponse,
  type VarsRecord,
} from "./http.ts";

const stackIfAny = (err: Error) => (err.stack ? `\n\n${err.stack}` : "");

export type BundleOptions = {
  cacheKey?: string;
  minify?: boolean;
  cacheControl?: string; // default "no-store"
};

export type BundleOk = { ok: true; js: string; cacheKey: string };
export type BundleErr = {
  ok: false;
  status: number;
  message: string;
  details?: string;
};
export type BundleResult = BundleOk | BundleErr;

export type InMemoryBundlerConfig = {
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

export function autoTsJsBundler<State, Vars extends VarsRecord>(
  { isCandidate, notFound, jsThrowStatus }: {
    isCandidate: (url: URL) => false | string;
    jsThrowStatus?: (suggested: number) => number;
    notFound?: (url: URL, err: unknown) => void;
  },
): Middleware<State, Vars> {
  const bundler = new InMemoryBundler({ defaultMinify: false });
  const jsThrow = (title: string, detail: string) =>
    [
      `// ${title}`,
      `throw new Error(${JSON.stringify(`${title}\n\n${detail}`)});`,
      `export {};`,
      ``,
    ].join("\n");

  // Add this middleware BEFORE your notFound handler (so it can intercept)
  return async (c, next) => {
    if (c.req.method !== "GET") return await next();

    const url = new URL(c.req.url);
    const candidate = isCandidate(url);
    if (!candidate) return await next();

    let entry: string;
    try {
      // realPath ensures the file exists and normalizes
      entry = await Deno.realPath(candidate);
    } catch (err) {
      notFound?.(url, err);
      return jsResponse(
        jsThrow("Client module not found", `${candidate}\n${String(err)}`),
        "no-store",
        jsThrowStatus?.(404) ?? 404,
      );
    }

    // Use a stable cacheKey so we bundle once per process per module path.
    const cacheKey = `client:${entry}`;

    const r = await bundler.bundle(entry, { cacheKey, minify: false });

    if (!r.ok) {
      return jsResponse(
        jsThrow("Failed to bundle client module", r.message),
        "no-store",
        jsThrowStatus?.(r.status) ?? r.status,
      );
    }

    // Proper browser JS module response
    return jsResponse(r.js, "no-store", 200);
  };
}
