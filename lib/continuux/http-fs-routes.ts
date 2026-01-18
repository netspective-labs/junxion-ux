// lib/continuux/http-fs-routes.ts
//
// File-system backed “file-based routing” middleware for the ContinuUX HTTP
// core. This is intentionally small and explicit, inspired by Astro/Next-style
// routing but adapted for Deno + our typed router.
//
// Highlights:
//
// - Mounts one or more filesystem roots under URL “mount points”.
// - Uses a small routing convention:
//   - index.{html,tsx,ts,js,...}      → / (or /dir for nested index)
//   - [slug].ext                      → /:slug
//   - [...rest].ext                   → /*rest
//   - (group)/file.ext                → route group, excluded from URL
//   - _internal / .hidden segments    → not routable
// - Provides a low-level `loader` hook to override the entire response.
// - Provides a higher-level `transforms` pipeline based on HttpTransform,
//   applied just before the response is returned (good for layouts, bundling,
//   markdown → HTML, etc.).
// - Supports optional ETag + Last-Modified based conditional GETs.
// - Exposes `buildFsRouteManifest` for introspection / docs.
// - Exposes `tsBundleTransform` for “bundle *.ts to JS” using InMemoryBundler.

import { walk } from "@std/fs";
import { contentType } from "@std/media-types";
import * as path from "@std/path";
import { parse as parsePosix } from "@std/path";
import { InMemoryBundler } from "./bundle.ts";
import {
  applyTransforms,
  type HandlerCtx,
  type HttpMethod,
  type HttpTransform,
  type Middleware,
  textResponse,
  type VarsRecord,
} from "./http.ts";

/* =========================
 * Types
 * ========================= */

export type FsRoutesMount = {
  mount: string; // URL base, e.g. "/docs"
  root: string; // filesystem root directory
  globs?: string[]; // optional glob filters for this root
};

export type FsRouteManifestEntry = {
  mount: FsRoutesMount;
  filePath: string; // absolute
  relPath: string; // relative to mount.root, POSIX-style
  template: string; // URL template, e.g. "/docs/:slug"
  segments: string[]; // route segments (for docs/tools)
  filename: string; // basename with extension
  ext: string; // ".ts", ".html", etc.
};

export type FsRouteMatchInfo = {
  mount: FsRoutesMount;
  filePath: string;
  relPath: string;
  template: string;
  routePath: string;
  params: Record<string, string>;
  method: HttpMethod;
  segments: string[];
  filename: string;
  ext: string;
};

export type FsRoutesEtagMode = "weak" | "strong" | false;

export type FsRoutesOptions<State, Vars extends VarsRecord> = {
  mounts: FsRoutesMount[];

  // Optional global globs applied in addition to per-mount globs.
  globs?: string[];

  // Low-level override: if this returns a Response, it is used as-is.
  // If it returns null/undefined, built-in static handling runs.
  loader?: (
    ctx: HandlerCtx<string, State, Vars>,
    info: FsRouteMatchInfo,
  ) => Response | null | undefined | Promise<Response | null | undefined>;

  // HttpTransform pipeline run after we’ve constructed the static file Response
  // (and after conditional GET / 304 logic). Only used for GET. HEAD is not
  // transformed.
  //
  // The transform context includes the usual HandlerCtx plus:
  //   (ctx as any).fsRoute -> FsRouteMatchInfo
  //
  // so transforms that care about file routing can use:
  //   const fsRoute = (ctx as any).fsRoute as FsRouteMatchInfo | undefined;
  transforms?: HttpTransform<State, Vars>[];

  // Cache headers / conditional GETs.
  cacheControl?: string;
  etag?: FsRoutesEtagMode;
  enableLastModified?: boolean;
};

/* =========================
 * Internal helpers
 * ========================= */

type CompiledFsRoute = FsRouteManifestEntry & {
  re: RegExp;
  keys: string[];
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Compile a path template like:
 *   /docs/:slug
 *   /docs/posts/*rest
 */
const compileTemplateToRe = (
  template: string,
): { re: RegExp; keys: string[] } => {
  const keys: string[] = [];
  const parts = template.split("/").filter((p) => p.length > 0);
  const reParts: string[] = [];
  let sawWildcard = false;

  for (const [idx, part] of parts.entries()) {
    if (part.startsWith("*")) {
      if (sawWildcard) {
        throw new Error(
          `Only one wildcard segment is allowed in template: ${template}`,
        );
      }
      if (idx !== parts.length - 1) {
        throw new Error(
          `Wildcard segment must be last in template: ${template}`,
        );
      }
      sawWildcard = true;
      const name = part.slice(1) || "wildcard";
      keys.push(name);
      reParts.push("(.*)");
      continue;
    }

    if (part.startsWith(":")) {
      const name = part.slice(1);
      keys.push(name);
      reParts.push("([^/]+)");
      continue;
    }

    reParts.push(escapeRe(part));
  }

  const re = new RegExp(`^/${reParts.join("/")}/?$`);
  return { re, keys };
};

const isRouteGroupSegment = (seg: string): boolean =>
  seg.startsWith("(") && seg.endsWith(")");

const isHiddenSegment = (seg: string): boolean =>
  seg.startsWith("_") || seg.startsWith(".");

// Normalize mount path to leading slash, no trailing slash (except root).
const normalizeMountPath = (mount: string): string => {
  if (!mount || mount === "/") return "";
  let m = mount.trim();
  if (!m.startsWith("/")) m = `/${m}`;
  if (m.endsWith("/")) m = m.slice(0, -1);
  return m;
};

/**
 * Turn a relative POSIX path + mount into a route template and segments.
 *
 * Examples (mount "/docs"):
 *   "index.html"              → "/docs"
 *   "guide/index.html"        → "/docs/guide"
 *   "[slug].html"             → "/docs/:slug"
 *   "posts/[...rest].html"    → "/docs/posts/*rest"
 *   "(marketing)/[slug].html" → "/docs/:slug"
 */
const buildTemplateForRelPath = (
  mount: FsRoutesMount,
  relPath: string,
): {
  template: string;
  segments: string[];
  filename: string;
  ext: string;
} | null => {
  const mBase = normalizeMountPath(mount.mount);
  const relNorm = relPath.replaceAll(path.SEPARATOR, "/");
  const parts = relNorm.split("/");
  if (parts.length === 0) return null;

  const filename = parts[parts.length - 1];
  const parsed = parsePosix(filename);
  const ext = parsed.ext;
  const name = parsed.name;

  // Skip any hidden segment anywhere in the tree.
  for (const seg of parts) {
    if (isHiddenSegment(seg)) return null;
  }

  const routeSegments: string[] = [];

  // Directories
  for (let i = 0; i < parts.length - 1; i++) {
    const seg = parts[i];
    if (isRouteGroupSegment(seg)) continue; // stripped from URL
    routeSegments.push(seg);
  }

  // Leaf
  if (name === "index") {
    // no extra segment; directory path only
  } else if (name.startsWith("[...") && name.endsWith("]")) {
    const inner = name.slice(4, -1) || "rest";
    routeSegments.push(`*${inner}`);
  } else if (name.startsWith("[") && name.endsWith("]")) {
    const inner = name.slice(1, -1) || "param";
    routeSegments.push(`:${inner}`);
  } else if (isRouteGroupSegment(name)) {
    // A leaf that is itself a group is odd; treat as non-routable.
    return null;
  } else {
    routeSegments.push(name);
  }

  // Build template
  const local = routeSegments.length ? `/${routeSegments.join("/")}` : "";
  let template = `${mBase}${local}`;
  if (!template) template = "/"; // root mount index
  if (!template.startsWith("/")) template = `/${template}`;

  return {
    template,
    segments: routeSegments,
    filename,
    ext,
  };
};

const buildCompiledRoutes = async (
  mounts: FsRoutesMount[],
  globalGlobs?: string[],
): Promise<CompiledFsRoute[]> => {
  const routes: CompiledFsRoute[] = [];

  for (const mount of mounts) {
    const rootAbs = await Deno.realPath(mount.root);
    const matchGlobs = [
      ...(globalGlobs ?? []),
      ...(mount.globs ?? []),
    ];

    const walkOpts: Parameters<typeof walk>[1] = {
      includeDirs: false,
      includeFiles: true,
      followSymlinks: false,
    };
    if (matchGlobs.length > 0) {
      walkOpts.match = matchGlobs.map((g) =>
        new RegExp(
          path.globToRegExp(g, { extended: true, globstar: true }).source,
        )
      );
    }

    try {
      for await (const entry of walk(rootAbs, walkOpts)) {
        if (!entry.isFile) continue;
        const relPath = path.relative(rootAbs, entry.path).replaceAll(
          path.SEPARATOR,
          "/",
        );
        const tmplInfo = buildTemplateForRelPath(mount, relPath);
        if (!tmplInfo) continue;

        const { template, segments, filename, ext } = tmplInfo;
        const { re, keys } = compileTemplateToRe(template);

        routes.push({
          mount,
          filePath: entry.path,
          relPath,
          template,
          segments,
          filename,
          ext,
          re,
          keys,
        });
      }
    } catch (err) {
      // If the directory vanishes while we’re walking it (e.g. test temp dir
      // cleaned up), treat it as "no more routes" instead of crashing.
      if (err instanceof Deno.errors.NotFound) {
        continue;
      }
      throw err;
    }
  }

  // Deterministic ordering (helpful for docs / debugging).
  routes.sort((a, b) => {
    if (a.template === b.template) {
      return a.filePath.localeCompare(b.filePath);
    }
    return a.template.localeCompare(b.template);
  });

  return routes;
};

/* =========================
 * Public: manifest
 * ========================= */

export async function buildFsRouteManifest(
  mounts: FsRoutesMount[],
  globs?: string[],
): Promise<FsRouteManifestEntry[]> {
  const compiled = await buildCompiledRoutes(mounts, globs);
  return compiled.map((r) => ({
    mount: r.mount,
    filePath: r.filePath,
    relPath: r.relPath,
    template: r.template,
    segments: [...r.segments],
    filename: r.filename,
    ext: r.ext,
  }));
}

/* =========================
 * Conditional GET helpers
 * ========================= */

const computeEtag = (
  mode: FsRoutesEtagMode,
  stat: Deno.FileInfo,
): string | null => {
  if (!mode) return null;
  const mtimeMs = stat.mtime?.getTime?.() ?? 0;
  const size = stat.size ?? 0;
  const token = `${mtimeMs.toString(16)}-${size.toString(16)}`;
  return mode === "weak" ? `W/"${token}"` : `"${token}"`;
};

const shouldSendNotModified = (
  req: Request,
  etag: string | null,
  mtime: Date | null | undefined,
): boolean => {
  const ifNoneMatch = req.headers.get("if-none-match");
  if (etag && ifNoneMatch) {
    // Simple exact match (no strong/weak semantics beyond the prefix).
    const etags = ifNoneMatch.split(",").map((v) => v.trim());
    if (etags.includes(etag)) return true;
  }

  const ifModifiedSince = req.headers.get("if-modified-since");
  if (ifModifiedSince && mtime) {
    const ims = Date.parse(ifModifiedSince);
    if (!Number.isNaN(ims)) {
      const mtimeMs = mtime.getTime();
      if (mtimeMs <= ims) return true;
    }
  }

  return false;
};

/* =========================
 * Middleware factory
 * ========================= */

export function httpFsRoutes<State, Vars extends VarsRecord>(
  opts: FsRoutesOptions<State, Vars>,
): Middleware<State, Vars> {
  if (!opts.mounts || opts.mounts.length === 0) {
    throw new Error("httpFsRoutes: at least one mount is required");
  }

  const compiledPromise = buildCompiledRoutes(opts.mounts, opts.globs);

  return async (c, next) => {
    const method = c.req.method.toUpperCase() as HttpMethod;
    if (method !== "GET" && method !== "HEAD") {
      return await next();
    }

    const routes = await compiledPromise;
    const url = new URL(c.req.url);
    const pathname = url.pathname;

    // Find first matching route (simple linear scan; small route sets).
    let match: CompiledFsRoute | null = null;
    let params: Record<string, string> = {};

    for (const r of routes) {
      const m = pathname.match(r.re);
      if (!m) continue;
      const p: Record<string, string> = {};
      for (let i = 0; i < r.keys.length; i++) {
        p[r.keys[i]] = decodeURIComponent(m[i + 1] ?? "");
      }
      match = r;
      params = p;
      break;
    }

    if (!match) {
      return await next();
    }

    const info: FsRouteMatchInfo = {
      mount: match.mount,
      filePath: match.filePath,
      relPath: match.relPath,
      template: match.template,
      routePath: match.template,
      params,
      method,
      segments: [...match.segments],
      filename: match.filename,
      ext: match.ext,
    };

    const ctx = c as HandlerCtx<string, State, Vars>;

    // Optional loader gets first crack at the request.
    if (opts.loader) {
      const override = await opts.loader(ctx, info);
      if (override instanceof Response) {
        // We deliberately do not run transforms on loader overrides; if you
        // want that, you can call applyTransforms inside your loader.
        return override;
      }
    }

    // Stat the file once for all further decisions.
    let stat: Deno.FileInfo;
    try {
      stat = await Deno.stat(match.filePath);
      if (!stat.isFile) {
        return textResponse("Not found", 404);
      }
    } catch {
      return textResponse("Not found", 404);
    }

    const headers = new Headers();

    // Content-Type from extension, if known.
    const ct = contentType(match.filename) ?? undefined;
    if (ct) headers.set("content-type", ct);

    // Cache-Control, if configured.
    if (opts.cacheControl) {
      headers.set("cache-control", opts.cacheControl);
    }

    // Last-Modified, if enabled and mtime present.
    const mtime = stat.mtime ?? undefined;
    if (opts.enableLastModified && mtime) {
      headers.set("last-modified", mtime.toUTCString());
    }

    // ETag, if configured.
    const etag = computeEtag(opts.etag ?? false, stat);
    if (etag) headers.set("etag", etag);

    // Conditional GET / 304.
    if (shouldSendNotModified(c.req, etag, mtime)) {
      return new Response(null, { status: 304, headers });
    }

    // HEAD: no body, but headers should still be set. We intentionally skip
    // transforms for HEAD to avoid pointless body reads.
    if (method === "HEAD") {
      return new Response(null, { status: 200, headers });
    }

    // Default GET: read the file and then optionally run HttpTransform(s).
    const body = await Deno.readFile(match.filePath);
    let res = new Response(body, { status: 200, headers });

    const transforms = opts.transforms ?? [];
    if (transforms.length > 0) {
      // Enrich the transform context with fsRoute so FS-aware transforms
      // (e.g. tsBundleTransform) can access routing metadata.
      const tctx = {
        ...(ctx as HandlerCtx<string, State, Vars>),
        response: res,
        fsRoute: info,
      };

      res = await applyTransforms<State, Vars>(tctx, transforms);
    }

    return res;
  };
}

/* =========================
 * Convenience: TS bundling transform
 * ========================= */

export type TsBundleTransformConfig = {
  bundler?: InMemoryBundler;
  minify?: boolean;
  cacheControl?: string; // default "no-store"
  /**
   * Optional cache key supplier. Defaults to filePath.
   */
  cacheKey?: (info: FsRouteMatchInfo) => string;
  /**
   * Optional predicate override. Defaults to "ext === .ts".
   */
  match?: (info: FsRouteMatchInfo) => boolean;
};

/**
 * A HttpTransform that:
 * - Only runs when there is FsRouteMatchInfo on the context.
 * - Matches `*.ts` files (by default).
 * - Uses InMemoryBundler to bundle them as browser JS modules.
 * - Serves the resulting JS with `text/javascript` and `no-store` (by default).
 *
 * Typical usage:
 *
 *   app.use(
 *     httpFsRoutes({
 *       mounts: [{ mount: "/ui", root: "./ui" }],
 *       transforms: [
 *         tsBundleTransform(), // bundle *.ts under /ui
 *       ],
 *     }),
 *   );
 */
export function tsBundleTransform<State, Vars extends VarsRecord>(
  cfg: TsBundleTransformConfig = {},
): HttpTransform<State, Vars> {
  const bundler = cfg.bundler ?? new InMemoryBundler({
    defaultMinify: cfg.minify ?? false,
  });
  const matchFn = cfg.match ??
    ((info: FsRouteMatchInfo) => info.ext === ".ts");

  return async (ctx) => {
    // deno-lint-ignore no-explicit-any
    const fsRoute = (ctx as any).fsRoute as FsRouteMatchInfo | undefined;
    if (!fsRoute) return null;
    if (!matchFn(fsRoute)) return null;

    const entry = fsRoute.filePath;
    const cacheKey = cfg.cacheKey?.(fsRoute) ?? entry;
    const cacheControl = cfg.cacheControl ?? "no-store";

    // Let the bundler produce a JS Response, then convert that into a
    // HttpTransformResult (body + headers + status) for applyTransforms.
    const jsRes = await bundler.jsModuleResponse(entry, {
      cacheKey,
      minify: cfg.minify,
      cacheControl,
    });

    const jsText = await jsRes.text();
    const outHeaders: Record<string, string> = {};
    jsRes.headers.forEach((v, k) => {
      outHeaders[k] = v;
    });

    return {
      body: jsText,
      headers: outHeaders,
      status: jsRes.status,
    };
  };
}
