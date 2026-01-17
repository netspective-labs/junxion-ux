/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// lib/continuux/interaction-browser-ua.js
//
// Browser User Agent runtime for Continuux interactions (modern JS).
//
// Contract:
// - Interaction attributes: data-cx-*
//   - data-cx="SPEC" (fallback if no per-event attr exists)
//   - data-cx-on-click="SPEC", data-cx-on-submit="SPEC", etc.
//   - data-cx-id="stable-id" (optional)
//   - data-cx-signals='{"k":"v"}' (optional JSON)
//   - data-cx-headers='{"X-Foo":"bar"}' (optional JSON)
//
// - Network bus attributes: data-cx-sse-*
//   - data-cx-sse-url="/cx/sse" (optional override, set on <html> or <body>)
//   - data-cx-sse-with-credentials="true|false" (optional override)
//
// Behavior:
// - Delegates DOM events, finds closest element carrying a cx spec.
// - Sends a structured envelope to server via POST.
// - Maintains an SSE connection for server->client messages.
// - SSE "js" event payload is treated as executable JavaScript and run in page context.
//
// Notes:
// - Server must enforce authn/authz, validation, origin, and any signing policy.
// - UA keeps logic minimal and deterministic.

/**
 * @typedef {"click"|"dblclick"|"submit"|"change"|"input"|"keydown"|"keyup"|"focusin"|"focusout"|"pointerdown"|"pointerup"} CxDomEventName
 */

/**
 * @typedef {Object} CxUserAgentConfig
 * @property {string=} postUrl POST endpoint receiving interaction envelopes (default "/cx")
 * @property {string=} sseUrl SSE endpoint (default "/cx/sse")
 * @property {boolean=} sseWithCredentials Whether EventSource uses credentials (default true)
 * @property {boolean=} autoConnect Whether to auto-connect SSE (default true)
 * @property {CxDomEventName[]=} events DOM events to listen to (default common set)
 * @property {boolean=} debug Whether to log debug output (default false)
 * @property {boolean=} diagnostics Whether to emit machine-readable diagnostics to console (default false)
 * @property {string=} attrPrefix Attribute prefix (default "data-cx")
 * @property {string=} sseJsEventName SSE event name that carries JS (default "js")
 * @property {string=} appVersion Optional app version tag
 * @property {boolean=} preventDefaultSubmit Prevent default on submit (default true)
 */

/**
 * @typedef {Object} CxUserAgent
 * @property {string} sessionId Stable-ish session id (localStorage backed when possible)
 * @property {CxUserAgentConfig} config Normalized config
 * @property {() => void} connect Open SSE if not already connected
 * @property {() => void} disconnect Close SSE if open
 * @property {(spec: string, domEvent?: CxDomEventName, el?: Element | null) => Promise<void>} post Send a synthetic interaction envelope
 * @property {() => void} wire Attach event delegation listeners
 * @property {(jsText: string) => void} exec Execute JS (used for SSE)
 */

export const CX_DIAG_PREFIX = "[cx:diag]";

/**
 * Factory: creates the CX browser user agent object.
 *
 * @param {CxUserAgentConfig=} cfg
 * @returns {CxUserAgent}
 */
export function createCxUserAgent(cfg = {}) {
  const c = normalizeConfig(cfg);

  const log = (...args) => {
    if (!c.debug) return;
    try {
      // eslint-disable-next-line no-console
      console.log(...args);
    } catch {
      // ignore
    }
  };

  const diag = (kind, data = {}) => {
    if (!c.diagnostics) return;
    try {
      // eslint-disable-next-line no-console
      console.log(
        CX_DIAG_PREFIX,
        JSON.stringify({ kind, ts: Date.now(), data }),
      );
    } catch {
      // ignore
    }
  };

  const uuid = () => {
    try {
      return globalThis.crypto?.randomUUID?.() ??
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    } catch {
      return `${Date.now().toString(36)}-${
        Math.random().toString(36).slice(2)
      }`;
    }
  };

  const sessionId = (() => {
    try {
      const k = "cx:sessionId";
      let v = localStorage.getItem(k);
      if (!v) {
        v = uuid();
        localStorage.setItem(k, v);
      }
      return v;
    } catch {
      return uuid();
    }
  })();

  const attrName = (suffix) => c.attrPrefix + (suffix ? `-${suffix}` : "");

  const getAttr = (el, name) => {
    try {
      return el.getAttribute(name);
    } catch {
      return null;
    }
  };

  const parseJsonAttr = (el, name) => {
    const t = getAttr(el, name);
    if (!t) return undefined;
    try {
      return JSON.parse(t);
    } catch {
      return undefined;
    }
  };

  const findCxTarget = (start, domEvent) => {
    let el = start;
    const onName = attrName(`on-${domEvent}`);
    const baseName = attrName("");
    while (el && el !== document.documentElement) {
      if (el.nodeType === 1) {
        const spec = getAttr(el, onName) || getAttr(el, baseName);
        if (spec) return { el, spec };
      }
      el = el.parentElement;
    }
    return null;
  };

  const formToObject = (form) => {
    try {
      const fd = new FormData(form);
      /** @type {Record<string, string|string[]>} */
      const out = {};
      fd.forEach((v, k) => {
        const sv = typeof v === "string" ? v : (v?.name ? v.name : String(v));
        if (out[k] === undefined) out[k] = sv;
        else if (Array.isArray(out[k])) out[k].push(sv);
        else out[k] = [out[k], sv];
      });
      return out;
    } catch {
      return undefined;
    }
  };

  const elementMeta = (el) => {
    try {
      return {
        tag: (el.tagName || "").toLowerCase(),
        id: el.id || undefined,
        name: el.getAttribute?.("name") || undefined,
        className: el.className || undefined,
        role: el.getAttribute?.("role") ?? null,
        cxId: el.getAttribute?.(attrName("id")) || undefined,
      };
    } catch {
      return { tag: "unknown" };
    }
  };

  const clientMeta = (requestId) => {
    const loc = window.location;
    return {
      sessionId,
      requestId,
      userAgent: navigator?.userAgent || undefined,
      href: String(loc.href),
      pathname: String(loc.pathname),
      search: String(loc.search || ""),
      referrer: document?.referrer ? String(document.referrer) : undefined,
      ts: Date.now(),
      appVersion: c.appVersion || undefined,
    };
  };

  const envelope = (domEvent, spec, el, ev) => {
    const requestId = uuid();
    /** @type {any} */
    const env = {
      kind: "cx/interaction",
      domEvent,
      spec: String(spec),
      element: elementMeta(el),
      client: clientMeta(requestId),
    };

    const signals = parseJsonAttr(el, attrName("signals"));
    if (signals && typeof signals === "object") env.signals = signals;

    const headers = parseJsonAttr(el, attrName("headers"));
    if (headers && typeof headers === "object") env.headers = headers;

    try {
      if (
        ev && typeof ev.clientX === "number" && typeof ev.clientY === "number"
      ) {
        env.pointer = {
          x: ev.clientX,
          y: ev.clientY,
          button: ev.button,
          buttons: ev.buttons,
        };
      }
    } catch {
      // ignore
    }

    try {
      if (ev && typeof ev.key === "string") {
        env.key = {
          key: ev.key,
          code: ev.code,
          altKey: !!ev.altKey,
          ctrlKey: !!ev.ctrlKey,
          metaKey: !!ev.metaKey,
          shiftKey: !!ev.shiftKey,
          repeat: !!ev.repeat,
        };
      }
    } catch {
      // ignore
    }

    try {
      const t = ev?.target;
      if (t && t.nodeType === 1) {
        if ("value" in t) env.input = { value: String(t.value) };
        if ("checked" in t) {
          env.input ??= {};
          env.input.checked = !!t.checked;
        }
      }
    } catch {
      // ignore
    }

    try {
      if (domEvent === "submit") {
        let f = el;
        if (f?.tagName?.toLowerCase() !== "form") {
          let p = f;
          while (p?.tagName?.toLowerCase() !== "form") p = p.parentElement;
          f = p;
        }
        if (f?.tagName?.toLowerCase() === "form") env.form = formToObject(f);
      }
    } catch {
      // ignore
    }

    return env;
  };

  const resolveSseUrl = () => {
    let url = c.sseUrl;
    try {
      const root = document.documentElement || document.body;
      const override = root?.getAttribute?.(attrName("sse-url"));
      if (override) url = override;
    } catch {
      // ignore
    }
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}sessionId=${encodeURIComponent(sessionId)}`;
  };

  const resolveSseWithCredentials = () => {
    let v = c.sseWithCredentials;
    try {
      const root = document.documentElement || document.body;
      const o = root?.getAttribute?.(attrName("sse-with-credentials"));
      if (o === "false") v = false;
      if (o === "true") v = true;
    } catch {
      // ignore
    }
    return v;
  };

  const readTextLimited = async (res, limit = 2000) => {
    try {
      const t = await res.text();
      if (!t) return "";
      return t.length > limit ? t.slice(0, limit) + "…" : t;
    } catch {
      return "";
    }
  };

  const postEnvelope = async (env) => {
    /** @type {Record<string, string>} */
    const headers = { "content-type": "application/json" };
    try {
      headers["x-cx-session"] = env.client.sessionId;
      headers["x-cx-request"] = env.client.requestId;
    } catch {
      // ignore
    }

    diag("post:begin", {
      url: c.postUrl,
      domEvent: env.domEvent,
      spec: env.spec,
      requestId: env?.client?.requestId,
    });

    log("[cx] -> post", c.postUrl, env);

    try {
      const res = await fetch(c.postUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(env),
        credentials: "include",
        keepalive: true,
      });

      if (!res.ok) {
        const errText = await readTextLimited(res);
        diag("post:end", {
          ok: false,
          status: res.status,
          statusText: res.statusText || "",
          errorText: errText || "",
          domEvent: env.domEvent,
          spec: env.spec,
          requestId: env?.client?.requestId,
        });
        log("[cx] post non-2xx", res.status, res.statusText, errText);
        return;
      }

      diag("post:end", {
        ok: true,
        status: res.status,
        domEvent: env.domEvent,
        spec: env.spec,
        requestId: env?.client?.requestId,
      });
    } catch (err) {
      diag("post:end", {
        ok: false,
        status: 0,
        statusText: "fetch_error",
        errorText: String(err && (err.stack || err.message || err)) || "",
        domEvent: env.domEvent,
        spec: env.spec,
        requestId: env?.client?.requestId,
      });
      log("[cx] post error", err);
    }
  };

  const safeExec = (jsText) => {
    diag("exec:begin", { bytes: String(jsText ?? "").length });
    try {
      (0, Function)(String(jsText))();
      diag("exec:end", { ok: true });
    } catch (err) {
      diag("exec:end", {
        ok: false,
        error: String(err && (err.stack || err.message || err)),
      });
      log("[cx] js exec error", err);
    }
  };

  /** @type {EventSource|null} */
  let es = null;

  const connectSse = () => {
    if (es) return;

    const full = resolveSseUrl();
    const withCreds = resolveSseWithCredentials();
    diag("sse:connect", { url: full, withCredentials: withCreds });
    log("[cx] SSE connect", full, "withCredentials=", withCreds);

    try {
      es = new EventSource(full, { withCredentials: withCreds });
    } catch (err) {
      es = null;
      diag("sse:init_error", {
        error: String(err && (err.stack || err.message || err)),
      });
      log("[cx] SSE init error", err);
      return;
    }

    try {
      es.addEventListener("open", () => {
        diag("sse:open", {});
      });
    } catch {
      // ignore
    }

    es.addEventListener(c.sseJsEventName, (ev) => {
      try {
        diag("sse:js", { bytes: String(ev?.data ?? "").length });
        safeExec(ev.data);
      } catch {
        // ignore
      }
    });

    es.addEventListener("error", () => {
      diag("sse:error", {});
      log("[cx] SSE error");
    });
  };

  const disconnectSse = () => {
    if (!es) return;
    try {
      es.close();
    } catch {
      // ignore
    }
    es = null;
    diag("sse:close", {});
  };

  const handleEvent = (domEvent, ev) => {
    const t = ev?.target;
    if (!t || t.nodeType !== 1) {
      diag("dom:ignore", { domEvent, reason: "no_target" });
      return;
    }

    const found = findCxTarget(t, domEvent);
    if (!found) {
      diag("dom:ignore", { domEvent, reason: "no_spec" });
      return;
    }

    diag("dom:target", {
      domEvent,
      spec: String(found.spec),
      tag: String(found.el?.tagName || "").toLowerCase(),
    });

    try {
      if (domEvent === "submit" && c.preventDefaultSubmit) ev.preventDefault();

      if (domEvent === "click") {
        const el = found.el;
        if (el?.tagName?.toLowerCase() === "a" && el.getAttribute("href")) {
          ev.preventDefault();
        }
      }
    } catch {
      // ignore
    }

    connectSse();
    void postEnvelope(envelope(domEvent, found.spec, found.el, ev));
  };

  let wired = false;

  const wire = () => {
    if (wired) return;
    wired = true;

    diag("wire:begin", { events: c.events.slice() });

    for (const name of c.events) {
      document.addEventListener(name, (ev) => handleEvent(name, ev), true);
    }

    window.addEventListener("beforeunload", () => disconnectSse());

    diag("wire:end", {});
  };

  // start
  wire();
  if (c.autoConnect) connectSse();

  diag("init", {
    sessionId,
    postUrl: c.postUrl,
    sseUrl: c.sseUrl,
    diagnostics: !!c.diagnostics,
  });

  return {
    sessionId,
    config: c,
    connect: connectSse,
    disconnect: disconnectSse,
    post: async (spec, domEvent = "click", el = document.documentElement) => {
      connectSse();
      void postEnvelope(envelope(domEvent, spec, el, null));
    },
    wire,
    exec: safeExec,
  };
}

/** @param {CxUserAgentConfig} cfg */
function normalizeConfig(cfg) {
  const events = (cfg.events && cfg.events.length)
    ? cfg.events.slice()
    : /** @type {CxDomEventName[]} */ ([
      "click",
      "submit",
      "change",
      "input",
      "keydown",
    ]);

  return /** @type {CxUserAgentConfig} */ ({
    postUrl: cfg.postUrl || "/cx",
    sseUrl: cfg.sseUrl || "/cx/sse",
    sseWithCredentials: typeof cfg.sseWithCredentials === "boolean"
      ? cfg.sseWithCredentials
      : true,
    autoConnect: typeof cfg.autoConnect === "boolean" ? cfg.autoConnect : true,
    debug: !!cfg.debug,
    diagnostics: !!cfg.diagnostics,
    attrPrefix: cfg.attrPrefix || "data-cx",
    sseJsEventName: cfg.sseJsEventName || "js",
    appVersion: cfg.appVersion || "",
    preventDefaultSubmit: typeof cfg.preventDefaultSubmit === "boolean"
      ? cfg.preventDefaultSubmit
      : true,
    events,
  });
}
