/**
 * lib/continuux/http-proxy.ts
 *
 * Typed reverse proxy middleware for ContinuUX HTTP applications.
 *
 * Features:
 * - Multiple proxy routes (per-method match + target function)
 * - URL rewriting via route.target
 * - Optional request rewrite (headers, method, body)
 * - Optional response rewrite / content transform
 * - Basic reverse-proxy headers (x-forwarded-*)
 * - Hop-by-hop header stripping (req + res)
 * - Optional upstream host allow-list and HTTPS-only upstreams
 * - Optional max request body size (defensive against large uploads)
 * - Optional response security headers overlay
 * - Structured error hooks for logging/observability
 */

import {
  asError,
  type HandlerCtx,
  HttpMethod,
  type Middleware,
  textResponse,
  type VarsRecord,
} from "./http.ts";

/**
 * How to match a proxy route.
 */
export type ProxyRouteMatch<State, Vars extends VarsRecord> = (
  c: HandlerCtx<string, State, Vars>,
) => boolean;

/**
 * How to compute the upstream URL for a given request.
 */
export type ProxyTarget<State, Vars extends VarsRecord> = (
  c: HandlerCtx<string, State, Vars>,
) => string | URL | Promise<string | URL>;

export type ProxyRequestRewriter<State, Vars extends VarsRecord> = (
  ctx: HandlerCtx<string, State, Vars>,
  upstreamUrl: URL,
  baseRequest: Request,
) => Request | Promise<Request>;

export type ProxyResponseRewriter<State, Vars extends VarsRecord> = (
  ctx: HandlerCtx<string, State, Vars>,
  upstreamResponse: Response,
) => Response | Promise<Response>;

export type ProxyErrorKind = "target" | "upstream-timeout" | "upstream-fetch";

export type ProxyErrorInfo = {
  routeName?: string;
  upstreamUrl?: string;
  error: Error;
};

/**
 * Single proxy route configuration.
 */
export type ProxyRoute<State, Vars extends VarsRecord> = {
  name?: string;

  /**
   * Methods this route should handle. If omitted, all HTTP methods are allowed.
   */
  methods?: HttpMethod[];

  /**
   * Route match predicate. If it returns true, this route is considered
   * a candidate for the current request.
   */
  match: ProxyRouteMatch<State, Vars>;

  /**
   * Computes the upstream URL. Implement path rewrites, host routing,
   * tenant-specific upstreams, etc. here.
   */
  target: ProxyTarget<State, Vars>;

  /**
   * Optional per-route request rewriter.
   */
  rewriteRequest?: ProxyRequestRewriter<State, Vars>;

  /**
   * Optional per-route response rewriter.
   */
  rewriteResponse?: ProxyResponseRewriter<State, Vars>;
};

/**
 * Options for the httpProxy middleware.
 */
export type HttpProxyOptions<State, Vars extends VarsRecord> = {
  routes: ProxyRoute<State, Vars>[];

  /**
   * Global timeout for upstream requests in milliseconds. If exceeded,
   * a 504 Gateway Timeout is returned.
   */
  timeoutMs?: number;

  /**
   * Whether to preserve the original client Host header when forwarding.
   * If false (default), the Host header is set to the upstream host.
   */
  preserveHostHeader?: boolean;

  /**
   * Optional fallback when no route matches.
   * If not provided, the request is passed to `next()`.
   */
  onNoMatch?: (
    c: HandlerCtx<string, State, Vars>,
  ) => Response | Promise<Response>;

  /**
   * Optional request header pass-through filter.
   * Receives lowercase header name, return true to forward.
   * Hop-by-hop headers are always stripped regardless.
   */
  passThroughHeader?: (name: string) => boolean;

  /**
   * Upstream host allow-list. If provided, any upstream whose host
   * does not satisfy this function will be rejected with 502.
   */
  allowedUpstreamHosts?: (host: string) => boolean;

  /**
   * If true, only https:// upstream URLs are allowed. Others yield 502.
   */
  requireHttpsUpstream?: boolean;

  /**
   * Maximum allowed request body size in bytes. If exceeded, a 413
   * response is returned. This guard buffers the body once; the proxy
   * then forwards the buffered body to upstream.
   */
  maxRequestBodyBytes?: number;

  /**
   * Optional response header strip policy. Receives lowercase header
   * name; return true to strip it from the proxied response.
   *
   * This is applied after removing hop-by-hop headers, and before
   * applying securityHeaders.
   */
  stripResponseHeader?: (name: string) => boolean;

  /**
   * Optional response security headers overlay.
   * Keys are header names (case-insensitive), values are header values.
   * These are set on the final proxied response (overwriting upstream).
   */
  securityHeaders?: Record<string, string>;

  /**
   * Optional error hook invoked for target errors, upstream timeouts,
   * and fetch errors. If it returns a Response, that response is used.
   * If it returns void, the default 502/504 responses are used.
   */
  onProxyError?: (
    c: HandlerCtx<string, State, Vars>,
    kind: ProxyErrorKind,
    info: ProxyErrorInfo,
  ) => Response | void | Promise<Response | void>;
};

/**
 * Convenience matchers.
 */

export function matchPathPrefix<State, Vars extends VarsRecord>(
  prefix: string,
): ProxyRouteMatch<State, Vars> {
  const norm = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return (c) => {
    const p = c.url.pathname;
    if (norm === "") return true;
    return p === norm || p.startsWith(norm + "/");
  };
}

export function matchPathExact<State, Vars extends VarsRecord>(
  path: string,
): ProxyRouteMatch<State, Vars> {
  const norm = path.startsWith("/") ? path : `/${path}`;
  return (c) => c.url.pathname === norm;
}

export function matchHost<State, Vars extends VarsRecord>(
  host: string,
): ProxyRouteMatch<State, Vars> {
  return (c) => c.url.host === host;
}

/**
 * Hop-by-hop headers per RFC 7230 that must not be forwarded.
 */
const HOP_BY_HOP_HEADERS = new Set<string>([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

/**
 * Apply a header filter based on hop-by-hop rules and a custom predicate.
 */
function shouldForwardHeader(
  nameLower: string,
  connectionTokens: Set<string>,
  custom?: (name: string) => boolean,
): boolean {
  if (HOP_BY_HOP_HEADERS.has(nameLower)) return false;
  if (connectionTokens.has(nameLower)) return false;
  if (custom && !custom(nameLower)) return false;
  return true;
}

/**
 * Default response header strip policy: hide server identity noise.
 */
function defaultStripResponseHeader(nameLower: string): boolean {
  if (HOP_BY_HOP_HEADERS.has(nameLower)) return true;
  if (nameLower === "server") return true;
  if (nameLower === "x-powered-by") return true;
  if (nameLower === "x-aspnet-version") return true;
  return false;
}

/**
 * Utility to apply response header sanitization and security headers.
 */
function sanitizeResponseHeaders(
  upstream: Response,
  opts: {
    stripResponseHeader?: (name: string) => boolean;
    securityHeaders?: Record<string, string>;
  },
): Headers {
  const stripFn = opts.stripResponseHeader
    ? (name: string) =>
      defaultStripResponseHeader(name) || opts.stripResponseHeader!(name)
    : defaultStripResponseHeader;

  // Connection header may declare additional hop-by-hop headers.
  const connectionHeader = upstream.headers.get("connection") ?? "";
  const connectionTokens = new Set(
    connectionHeader
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

  const out = new Headers();

  for (const [k, v] of upstream.headers.entries()) {
    const lower = k.toLowerCase();
    if (stripFn(lower)) continue;
    if (connectionTokens.has(lower)) continue;
    out.append(k, v);
  }

  if (opts.securityHeaders) {
    for (const [k, v] of Object.entries(opts.securityHeaders)) {
      out.set(k, v);
    }
  }

  return out;
}

/**
 * Create a reverse proxy middleware.
 */
export function httpProxy<State, Vars extends VarsRecord>(
  options: HttpProxyOptions<State, Vars>,
): Middleware<State, Vars> {
  const {
    routes,
    timeoutMs,
    preserveHostHeader = false,
    onNoMatch,
    passThroughHeader,
    allowedUpstreamHosts,
    requireHttpsUpstream,
    maxRequestBodyBytes,
    stripResponseHeader,
    securityHeaders,
    onProxyError,
  } = options;

  if (!routes || routes.length === 0) {
    throw new Error("httpProxy requires at least one ProxyRoute");
  }

  const invokeErrorHook = async (
    c: HandlerCtx<string, State, Vars>,
    kind: ProxyErrorKind,
    info: ProxyErrorInfo,
    fallback: () => Response,
  ): Promise<Response> => {
    if (!onProxyError) return fallback();
    const maybe = await onProxyError(c, kind, info);
    if (maybe instanceof Response) return maybe;
    return fallback();
  };

  return async (c, next) => {
    const { req } = c;
    const method = req.method.toUpperCase() as HttpMethod;

    // Find first matching route
    const route = routes.find((r) => {
      if (r.methods && r.methods.length > 0) {
        if (!r.methods.includes(method)) return false;
      }
      return r.match(c);
    });

    if (!route) {
      if (onNoMatch) return await onNoMatch(c);
      return await next();
    }

    let upstreamUrl: URL;
    try {
      const target = await route.target(c);
      upstreamUrl = typeof target === "string"
        ? new URL(target)
        : new URL(target.toString());
    } catch (err) {
      const e = asError(err);
      return await invokeErrorHook(
        c,
        "target",
        {
          routeName: route.name,
          upstreamUrl: undefined,
          error: e,
        },
        () =>
          textResponse(
            [
              "Proxy target error.",
              "",
              `Route: ${route.name ?? "(unnamed)"}`,
              `Error: ${e.message}`,
            ].join("\n"),
            502,
          ),
      );
    }

    if (requireHttpsUpstream && upstreamUrl.protocol !== "https:") {
      const e = new Error(
        `Upstream protocol not allowed: ${upstreamUrl.protocol}`,
      );
      return await invokeErrorHook(
        c,
        "target",
        {
          routeName: route.name,
          upstreamUrl: upstreamUrl.toString(),
          error: e,
        },
        () =>
          textResponse(
            [
              "Bad Gateway.",
              "",
              `Route: ${route.name ?? "(unnamed)"}`,
              "Upstream protocol must be HTTPS.",
            ].join("\n"),
            502,
          ),
      );
    }

    if (allowedUpstreamHosts && !allowedUpstreamHosts(upstreamUrl.host)) {
      const e = new Error(`Upstream host not allowed: ${upstreamUrl.host}`);
      return await invokeErrorHook(
        c,
        "target",
        {
          routeName: route.name,
          upstreamUrl: upstreamUrl.toString(),
          error: e,
        },
        () =>
          textResponse(
            [
              "Bad Gateway.",
              "",
              `Route: ${route.name ?? "(unnamed)"}`,
              "Upstream host is not permitted by proxy configuration.",
            ].join("\n"),
            502,
          ),
      );
    }

    // Build connectionTokens for hop-by-hop filtering based on client request.
    const clientConnectionHeader = req.headers.get("connection") ?? "";
    const clientConnectionTokens = new Set(
      clientConnectionHeader
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );

    // Build forwarded headers
    const forwarded = new Headers();

    for (const [k, v] of req.headers.entries()) {
      const lower = k.toLowerCase();
      if (lower === "host") continue;
      if (
        !shouldForwardHeader(lower, clientConnectionTokens, passThroughHeader)
      ) {
        continue;
      }
      forwarded.append(k, v);
    }

    // Standard reverse proxy headers
    const clientHost = c.url.host;
    const clientProto = c.url.protocol.replace(":", "");

    forwarded.set("x-forwarded-host", clientHost);
    forwarded.set("x-forwarded-proto", clientProto);
    forwarded.set("x-request-id", c.requestId);

    const existingXff = req.headers.get("x-forwarded-for");
    const remote = req.headers.get("x-real-ip") ?? "127.0.0.1";
    const newXff = existingXff ? `${existingXff}, ${remote}` : remote;
    forwarded.set("x-forwarded-for", newXff);

    if (!preserveHostHeader) {
      forwarded.set("host", upstreamUrl.host);
    } else {
      forwarded.set("host", clientHost);
    }

    // Optional request body size guard.
    // For non-GET/HEAD, we buffer the body if a limit is configured.
    let bodyInit: BodyInit | undefined;

    if (method === "GET" || method === "HEAD") {
      bodyInit = undefined;
    } else if (maxRequestBodyBytes != null && maxRequestBodyBytes >= 0) {
      try {
        const clone = req.clone();
        const buf = new Uint8Array(await clone.arrayBuffer());
        if (buf.byteLength > maxRequestBodyBytes) {
          const e = new Error(
            `Request body too large: ${buf.byteLength} > ${maxRequestBodyBytes}`,
          );
          return await invokeErrorHook(
            c,
            "target",
            {
              routeName: route.name,
              upstreamUrl: upstreamUrl.toString(),
              error: e,
            },
            () =>
              textResponse(
                "Payload Too Large.",
                413,
              ),
          );
        }
        bodyInit = buf;
      } catch (err) {
        const e = asError(err);
        return await invokeErrorHook(
          c,
          "target",
          {
            routeName: route.name,
            upstreamUrl: upstreamUrl.toString(),
            error: e,
          },
          () =>
            textResponse(
              "Unable to read request body.",
              400,
            ),
        );
      }
    } else {
      // No size limit configured: stream original body through.
      bodyInit = req.body ?? undefined;
    }

    // Build base upstream Request.
    let baseRequest = new Request(upstreamUrl.toString(), {
      method: req.method,
      headers: forwarded,
      body: bodyInit,
      redirect: "manual",
    });

    // Per-route request rewrite hook.
    if (route.rewriteRequest) {
      baseRequest = await route.rewriteRequest(c, upstreamUrl, baseRequest);
    }

    // Handle timeout with AbortController if configured.
    let controller: AbortController | undefined;
    let timeoutId: number | undefined;

    if (timeoutMs && timeoutMs > 0) {
      controller = new AbortController();
      timeoutId = setTimeout(
        () => controller?.abort(),
        timeoutMs,
      ) as unknown as number;
    }

    let upstreamRes: Response;
    try {
      upstreamRes = await fetch(baseRequest, {
        signal: controller?.signal,
      });
    } catch (err) {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      const e = asError(err);

      if (e.name === "AbortError") {
        return await invokeErrorHook(
          c,
          "upstream-timeout",
          {
            routeName: route.name,
            upstreamUrl: upstreamUrl.toString(),
            error: e,
          },
          () =>
            textResponse(
              [
                "Gateway Timeout.",
                "",
                `Route: ${route.name ?? "(unnamed)"}`,
                `Upstream: ${upstreamUrl.toString()}`,
              ].join("\n"),
              504,
            ),
        );
      }

      return await invokeErrorHook(
        c,
        "upstream-fetch",
        {
          routeName: route.name,
          upstreamUrl: upstreamUrl.toString(),
          error: e,
        },
        () =>
          textResponse(
            [
              "Bad Gateway.",
              "",
              `Route: ${route.name ?? "(unnamed)"}`,
              `Upstream: ${upstreamUrl.toString()}`,
              "",
              e.message,
            ].join("\n"),
            502,
          ),
      );
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }

    // Allow a per-route response rewriter.
    let finalRes = upstreamRes;
    if (route.rewriteResponse) {
      finalRes = await route.rewriteResponse(c, upstreamRes);
    }

    const sanitizedHeaders = sanitizeResponseHeaders(finalRes, {
      stripResponseHeader,
      securityHeaders,
    });

    // For HEAD requests, strip body but keep sanitized headers/status.
    if (method === "HEAD") {
      return new Response(null, {
        status: finalRes.status,
        headers: sanitizedHeaders,
      });
    }

    // Default: stream upstream body with sanitized headers.
    return new Response(finalRes.body, {
      status: finalRes.status,
      headers: sanitizedHeaders,
    });
  };
}

/**
 * Declarative proxy manifest layer
 *
 * This provides a file/manifest-friendly way to configure proxy routes:
 *
 *   const proxy = httpProxyFromManifest<State, Vars>(
 *     [
 *       {
 *         name: "api",
 *         mount: "/api",
 *         upstream: "https://backend.internal/api",
 *         stripMount: true,
 *         methods: ["GET", "POST"],
 *         forwardQuery: true,
 *         requestHeaders: {
 *           set: { "x-tenant": "acme" },
 *         },
 *         responseHeaders: {
 *           set: { "x-proxy": "continuux" },
 *         },
 *       },
 *     ],
 *     {
 *       timeoutMs: 5000,
 *       requireHttpsUpstream: true,
 *     },
 *   );
 *
 *   app.use(proxy);
 */

/**
 * Per-route declarative config for httpProxyFromManifest.
 *
 * State and Vars generics are threaded so `extraMatch` can see typed vars.
 */
export type ProxyManifestRoute<State, Vars extends VarsRecord> = {
  name?: string;

  /**
   * Mount path prefix, e.g. "/api" or "/service".
   * All requests whose pathname starts with this prefix will be candidates.
   */
  mount: string;

  /**
   * Upstream base URL. May be a string or URL. Path and query rewriting
   * will be applied relative to this base.
   *
   * Examples:
   *   "https://backend.internal"
   *   "https://backend.internal/base"
   */
  upstream: string | URL;

  /**
   * Methods this route should handle. If omitted, all methods are allowed.
   */
  methods?: HttpMethod[];

  /**
   * If true (default), the mount prefix is stripped from the request path
   * before joining with upstream's pathname.
   *
   * Example:
   *   mount = "/api"
   *   upstream = "https://backend.internal"
   *   request path = "/api/users"
   *   stripMount = true → upstream path "/users"
   *   stripMount = false → upstream path "/api/users"
   */
  stripMount?: boolean;

  /**
   * If true (default), the client's query string is forwarded to upstream.
   * If false, upstream's query string is left as-is.
   */
  forwardQuery?: boolean;

  /**
   * Optional additional match predicate (e.g. host, headers).
   * Only runs if the mount prefix matches.
   */
  extraMatch?: ProxyRouteMatch<State, Vars>;

  /**
   * Simple request header adjustments at the manifest level.
   * These run after the base proxy has applied x-forwarded-* etc.
   */
  requestHeaders?: {
    /**
     * Headers to set (overwrites any existing value).
     */
    set?: Record<string, string>;
    /**
     * Headers to add in addition to existing ones.
     */
    add?: Record<string, string>;
    /**
     * Headers to drop (case-insensitive).
     */
    drop?: string[];
  };

  /**
   * Simple response header adjustments at the manifest level.
   * These run before the global sanitizeResponseHeaders() pass.
   */
  responseHeaders?: {
    set?: Record<string, string>;
    add?: Record<string, string>;
    drop?: string[];
  };
};

/**
 * Case-insensitive header delete helper.
 */
const deleteHeaderCaseInsensitive = (headers: Headers, name: string) => {
  const lower = name.toLowerCase();
  for (const [k] of headers.entries()) {
    if (k.toLowerCase() === lower) {
      headers.delete(k);
    }
  }
};

/**
 * Join an upstream base path and a "rest" path segment.
 *
 * basePath:  "/api"   restPath: "/users"   → "/api/users"
 * basePath:  "/"      restPath: "/users"   → "/users"
 */
const joinUpstreamPath = (basePath: string, restPath: string): string => {
  const b = basePath === "" ? "/" : basePath;
  const bNorm = b.endsWith("/") ? b.slice(0, -1) : b;
  const rNorm = restPath.startsWith("/") ? restPath : `/${restPath}`;
  if (bNorm === "") return rNorm;
  if (bNorm === "/") return rNorm;
  return `${bNorm}${rNorm}`;
};

/**
 * Build ProxyRoute[] from a declarative manifest.
 */
export function buildProxyRoutesFromManifest<
  State,
  Vars extends VarsRecord,
>(
  manifest: ProxyManifestRoute<State, Vars>[],
): ProxyRoute<State, Vars>[] {
  return manifest.map((cfg): ProxyRoute<State, Vars> => {
    const {
      name,
      mount,
      upstream,
      methods,
      stripMount = true,
      forwardQuery = true,
      extraMatch,
      requestHeaders,
      responseHeaders,
    } = cfg;

    const mountNorm = mount.endsWith("/") ? mount.slice(0, -1) : mount;

    const baseMatch = matchPathPrefix<State, Vars>(mountNorm);

    const match: ProxyRouteMatch<State, Vars> = (c) => {
      if (!baseMatch(c)) return false;
      if (extraMatch && !extraMatch(c)) return false;
      return true;
    };

    const target: ProxyTarget<State, Vars> = (c) => {
      const upstreamBase = typeof upstream === "string"
        ? new URL(upstream)
        : new URL(upstream.toString());

      const reqPath = c.url.pathname;

      let restPath: string;
      if (stripMount) {
        if (!mountNorm) {
          restPath = reqPath || "/";
        } else {
          const raw = reqPath.slice(mountNorm.length) || "/";
          restPath = raw.startsWith("/") ? raw : `/${raw}`;
        }
      } else {
        restPath = reqPath || "/";
      }

      const url = new URL(upstreamBase.toString());
      url.pathname = joinUpstreamPath(url.pathname || "/", restPath);

      if (forwardQuery) {
        url.search = c.url.search;
      }

      return url;
    };

    const rewriteRequest: ProxyRequestRewriter<State, Vars> | undefined =
      requestHeaders
        ? (_ctx, _upstreamUrl, baseRequest) => {
          const h = new Headers(baseRequest.headers);

          if (requestHeaders.drop) {
            for (const name of requestHeaders.drop) {
              deleteHeaderCaseInsensitive(h, name);
            }
          }

          if (requestHeaders.set) {
            for (const [k, v] of Object.entries(requestHeaders.set)) {
              h.set(k, v);
            }
          }

          if (requestHeaders.add) {
            for (const [k, v] of Object.entries(requestHeaders.add)) {
              h.append(k, v);
            }
          }

          return new Request(baseRequest, { headers: h });
        }
        : undefined;

    const rewriteResponse: ProxyResponseRewriter<State, Vars> | undefined =
      responseHeaders
        ? (_ctx, upstreamResponse) => {
          const h = new Headers(upstreamResponse.headers);

          if (responseHeaders.drop) {
            for (const name of responseHeaders.drop) {
              deleteHeaderCaseInsensitive(h, name);
            }
          }

          if (responseHeaders.set) {
            for (const [k, v] of Object.entries(responseHeaders.set)) {
              h.set(k, v);
            }
          }

          if (responseHeaders.add) {
            for (const [k, v] of Object.entries(responseHeaders.add)) {
              h.append(k, v);
            }
          }

          return new Response(upstreamResponse.body, {
            status: upstreamResponse.status,
            headers: h,
          });
        }
        : undefined;

    return {
      name,
      methods,
      match,
      target,
      rewriteRequest,
      rewriteResponse,
    };
  });
}

/**
 * High-level convenience: build routes from a manifest and create
 * a proxy middleware in one call.
 *
 * All safety options from HttpProxyOptions remain available, except
 * `routes` (which is derived from the manifest).
 */
export function httpProxyFromManifest<State, Vars extends VarsRecord>(
  manifest: ProxyManifestRoute<State, Vars>[],
  opts?: Omit<HttpProxyOptions<State, Vars>, "routes">,
): Middleware<State, Vars> {
  if (!manifest || manifest.length === 0) {
    throw new Error(
      "httpProxyFromManifest requires at least one manifest route",
    );
  }

  const routes = buildProxyRoutesFromManifest<State, Vars>(manifest);

  return httpProxy<State, Vars>({
    ...(opts ?? {}),
    routes,
  });
}
