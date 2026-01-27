/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// lib/continuux/browser-ua-aide.js
//
// Developer-facing ContinuUX browser runtime + Custom Element aide.
//
// Goals:
// - One module import gives a developer everything they need.
// - No duplicated logic: CxAide owns URL/session/SSE/posting/envelope building/wiring.
// - Works in two modes:
//   1) Page runtime (HTMX/Datastar-like): createCxUserAgent(...) installs delegated listeners.
//   2) Custom elements: customElementAide(...) adds this.cxAide to element instances.
//
// Convenience helpers for Custom Elements:
// - bindText(eventName, selectorOrId, mapFn?): update textContent on SSE events.
// - bindAction(selectorOrId, actionName, bodyOrFn?): wire click => POST {action,...}.

export const CX_DIAG_PREFIX = "[cx:diag]";

const kCx = Symbol("continuux:cxAide");

const kebabFromClassName = (name) => {
  const s = String(name || "").trim();
  const base = s || "x-element";
  const k = base
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
  return k.includes("-") ? k : `x-${k}`;
};

const safeExec = (jsText) => {
  try {
    (0, Function)(String(jsText))();
  } catch {
    // ignore
  }
};

const safeJsonParse = (t) => {
  if (typeof t !== "string" || !t.trim()) return undefined;
  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
};

// Attribute helpers that are safe and boring.
export const ceAttr = {
  has(el, name) {
    try {
      return el?.hasAttribute?.(name) || false;
    } catch {
      return false;
    }
  },

  bool(el, name, dflt) {
    try {
      if (el?.hasAttribute?.(name)) {
        const raw = el.getAttribute(name);
        const v = raw == null ? "" : String(raw).trim().toLowerCase();
        if (!v) return true;
        if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
        if (v === "false" || v === "0" || v === "no" || v === "off") {
          return false;
        }
        return dflt;
      }
    } catch {
      // ignore
    }
    return dflt;
  },

  string(el, name, dflt) {
    try {
      const v = el?.getAttribute?.(name);
      return v == null || v === "" ? dflt : String(v);
    } catch {
      return dflt;
    }
  },

  number(el, name, dflt) {
    const t = ceAttr.string(el, name, "");
    if (!t) return dflt;
    const n = Number(t);
    return Number.isFinite(n) ? n : dflt;
  },

  json(el, name, dflt) {
    const t = ceAttr.string(el, name, "");
    if (!t) return dflt;
    const v = safeJsonParse(t);
    return v === undefined ? dflt : v;
  },

  url(el, name, dflt) {
    const t = ceAttr.string(el, name, dflt);
    return t == null ? dflt : String(t);
  },
};

const kDefault = {
  // Network / SSE
  sseUrlAttr: "data-cx-sse-url",
  postUrlAttr: "data-cx-post-url",
  withCredsAttr: "data-cx-sse-with-credentials",
  sseUrl: "/cx/sse",
  postUrl: "/cx",
  withCredentials: true,

  // ContinuUX action attributes
  cxAttr: "data-cx",
  cxOnPrefix: "data-cx-on-",
  cxSignalsAttr: "data-cx-signals",
  cxHeadersAttr: "data-cx-headers",
  cxIdAttr: "data-cx-id",

  // SSE events
  jsEventName: "js",

  // Delegated DOM events (safe defaults)
  events: ["click", "submit", "change", "input", "keydown", "keyup"],

  preventDefaultSubmit: true,

  // Diagnostics
  diagnostics: false,
  debug: false,
};

const uuid = () => {
  try {
    return globalThis.crypto?.randomUUID?.() ??
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
};

const getOrCreateSessionId = () => {
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
};

const withSessionId = (url, sessionId) => {
  const u = String(url || "").trim();
  if (!u) return "";
  const sep = u.includes("?") ? "&" : "?";
  return `${u}${sep}sessionId=${encodeURIComponent(sessionId)}`;
};

const asEl = (v) => {
  try {
    return v && typeof v === "object" && v.nodeType === 1 ? v : null;
  } catch {
    return null;
  }
};

const closestWithAttr = (startEl, attrName) => {
  let el = startEl;
  while (el) {
    try {
      if (el.hasAttribute && el.hasAttribute(attrName)) return el;
    } catch {
      // ignore
    }
    el = el.parentElement;
  }
  return null;
};

const requestId = () => uuid();

const elementMeta = (el) => {
  const tag = String(el?.tagName || "").toLowerCase() || "unknown";
  const id = ceAttr.string(el, "id", undefined);
  const name = ceAttr.string(el, "name", undefined);
  const className = ceAttr.string(el, "class", undefined);
  const role = ceAttr.string(el, "role", null);
  const cxId = ceAttr.string(el, kDefault.cxIdAttr, undefined);
  return { tag, id, name, className, role, cxId };
};

const clientMeta = (sessionId, reqId, appVersion) => {
  const loc = globalThis.location;
  const nav = globalThis.navigator;
  const href = String(loc?.href || "");
  const pathname = String(loc?.pathname || "");
  const search = String(loc?.search || "");
  const referrer = String(document?.referrer || "") || undefined;
  const userAgent = String(nav?.userAgent || "") || undefined;
  const ts = Date.now();
  const out = {
    sessionId,
    requestId: reqId,
    userAgent,
    href,
    pathname,
    search,
    referrer,
    ts,
  };
  if (appVersion) out.appVersion = String(appVersion);
  return out;
};

const formToObject = (form) => {
  const out = Object.create(null);
  try {
    const fd = new FormData(form);
    for (const [k, v] of fd.entries()) {
      const key = String(k);
      const val = typeof v === "string"
        ? v
        : (v && v.name ? v.name : String(v));
      if (Object.prototype.hasOwnProperty.call(out, key)) {
        const cur = out[key];
        if (Array.isArray(cur)) cur.push(val);
        else out[key] = [cur, val];
      } else {
        out[key] = val;
      }
    }
  } catch {
    // ignore
  }
  return out;
};

const headersFromAttr = (el) => {
  const h = ceAttr.json(el, kDefault.cxHeadersAttr, undefined);
  if (!h || typeof h !== "object") return undefined;
  const out = Object.create(null);
  for (const [k, v] of Object.entries(h)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
};

const signalsFromAttr = (el) => {
  const s = ceAttr.json(el, kDefault.cxSignalsAttr, undefined);
  if (!s || typeof s !== "object") return undefined;
  return s;
};

const jsonFromEvent = (ev) => {
  let data = ev?.data;
  try {
    data = typeof data === "string" ? JSON.parse(data) : data;
  } catch {
    // keep as string
  }
  return data;
};

export class CxAide {
  /** @param {HTMLElement} host */
  constructor(host) {
    this.host = host;
    this.#sessionId = getOrCreateSessionId();
    this.#es = null;

    this.#jsEventName = kDefault.jsEventName;
    this.#jsListener = null;

    this.#handlers = Object.create(null);
    this.#sseListenerByEvent = Object.create(null);

    this.#wired = false;
    this.#domUnbinders = [];
    this.#localUnbinders = [];

    this.#appVersion = undefined;
    this.#diagnostics = false;
    this.#debug = false;
    this.#preventDefaultSubmit = kDefault.preventDefaultSubmit;
    this.#events = kDefault.events.slice();
  }

  /** @type {EventSource|null} */
  #es;

  /** @type {string} */
  #sessionId;

  /** @type {string} */
  #jsEventName;

  /** @type {((ev: MessageEvent) => void)|null} */
  #jsListener;

  /** @type {Record<string, Function>} */
  #handlers;

  /** @type {Record<string, ((ev: MessageEvent) => void)>} */
  #sseListenerByEvent;

  /** @type {boolean} */
  #wired;

  /** @type {Array<() => void>} */
  #domUnbinders;

  /** @type {Array<() => void>} */
  #localUnbinders;

  /** @type {string|undefined} */
  #appVersion;

  /** @type {boolean} */
  #diagnostics;

  /** @type {boolean} */
  #debug;

  /** @type {boolean} */
  #preventDefaultSubmit;

  /** @type {string[]} */
  #events;

  diag(kind, data) {
    if (!this.#diagnostics) return;
    try {
      console.log(
        `${CX_DIAG_PREFIX} ${
          JSON.stringify({ kind: String(kind), ts: Date.now(), data })
        }`,
      );
    } catch {
      // ignore
    }
  }

  debugLog(...args) {
    if (!this.#debug) return;
    try {
      console.log("[cx:debug]", ...args);
    } catch {
      // ignore
    }
  }

  get sessionId() {
    return this.#sessionId;
  }

  get sseUrl() {
    return ceAttr.string(this.host, kDefault.sseUrlAttr, kDefault.sseUrl);
  }
  set sseUrl(v) {
    this.host.setAttribute(kDefault.sseUrlAttr, String(v));
  }

  get postUrl() {
    return ceAttr.string(this.host, kDefault.postUrlAttr, kDefault.postUrl);
  }
  set postUrl(v) {
    this.host.setAttribute(kDefault.postUrlAttr, String(v));
  }

  get withCredentials() {
    return ceAttr.bool(
      this.host,
      kDefault.withCredsAttr,
      kDefault.withCredentials,
    );
  }
  set withCredentials(v) {
    this.host.setAttribute(kDefault.withCredsAttr, v ? "true" : "false");
  }

  get isConnected() {
    return !!this.#es;
  }

  setAppVersion(v) {
    this.#appVersion = v == null ? undefined : String(v);
  }

  setDiagnostics(v) {
    this.#diagnostics = !!v;
  }

  setDebug(v) {
    this.#debug = !!v;
  }

  setEvents(list) {
    if (Array.isArray(list) && list.length) {
      this.#events = list.map((s) => String(s)).filter((s) => !!s);
    }
  }

  setPreventDefaultSubmit(v) {
    this.#preventDefaultSubmit = !!v;
  }

  // ----- Custom Element convenience

  #root() {
    const h = this.host;
    return (h && h.shadowRoot) ? h.shadowRoot : h;
  }

  #find(selectorOrId) {
    const root = this.#root();
    if (!root) return null;

    const s = String(selectorOrId ?? "").trim();
    if (!s) return null;

    try {
      if (
        s.startsWith("#") || s.startsWith(".") || s.startsWith("[") ||
        s.includes(" ") || s.includes(">") || s.includes(":")
      ) {
        return root.querySelector?.(s) ?? null;
      }

      // treat as id
      if (
        "getElementById" in root && typeof root.getElementById === "function"
      ) {
        return root.getElementById(s);
      }
      return root.querySelector?.(`#${CSS.escape(s)}`) ?? null;
    } catch {
      return null;
    }
  }

  unbindLocal() {
    for (const fn of this.#localUnbinders.splice(0)) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
  }

  bindAction(selectorOrId, actionName, bodyOrFn) {
    const el = this.#find(selectorOrId);
    if (!el) return false;

    const onClick = () => {
      try {
        const body = (typeof bodyOrFn === "function")
          ? bodyOrFn()
          : (bodyOrFn || undefined);
        const p = this.action(String(actionName), body, "click", el);
        p?.catch?.((e) => {
          this.diag("action:error", {
            action: String(actionName),
            message: String(e?.message || e),
          });
        });
      } catch (e) {
        this.diag("action:error", {
          action: String(actionName),
          message: String(e?.message || e),
        });
      }
    };

    try {
      el.addEventListener("click", onClick);
      this.#localUnbinders.push(() => {
        try {
          el.removeEventListener("click", onClick);
        } catch {
          // ignore
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  bindText(eventName, selectorOrId, mapFn) {
    const el = this.#find(selectorOrId);
    if (!el) return false;

    const fn = (d) => {
      let v;
      try {
        v = (typeof mapFn === "function")
          ? mapFn(d)
          : (d && typeof d === "object" &&
              ("text" in d || "value" in d))
          ? (d.text ?? d.value)
          : d;
      } catch {
        v = "";
      }

      try {
        el.textContent = String(v ?? "");
      } catch {
        // ignore
      }
    };

    this.on(String(eventName), fn);
    return true;
  }

  // ----- SSE handler management

  #bindSseHandler(eventName) {
    if (!this.#es) return;
    const name = String(eventName || "").trim();
    if (!name) return;
    if (name === this.#jsEventName) return;

    const fn = this.#handlers[name];
    if (typeof fn !== "function") return;

    const prev = this.#sseListenerByEvent[name];
    if (prev) {
      try {
        this.#es.removeEventListener(name, prev);
      } catch {
        // ignore
      }
      delete this.#sseListenerByEvent[name];
    }

    const listener = (ev) => {
      const data = jsonFromEvent(ev);
      try {
        fn(data, ev);
      } catch {
        // ignore
      }
    };

    this.#sseListenerByEvent[name] = listener;
    try {
      this.#es.addEventListener(name, listener);
    } catch {
      // ignore
    }
  }

  on(eventName, fn) {
    if (typeof eventName !== "string" || !eventName.trim()) return;
    if (typeof fn !== "function") return;

    const name = String(eventName).trim();

    this.#handlers[name] = fn;

    // If SSE is already live, bind immediately (so CE code can call on(...) after connect too).
    if (this.#es) this.#bindSseHandler(name);
  }

  off(eventName) {
    if (typeof eventName !== "string" || !eventName.trim()) return;

    const name = String(eventName).trim();
    delete this.#handlers[name];

    if (this.#es) {
      const prev = this.#sseListenerByEvent[name];
      if (prev) {
        try {
          this.#es.removeEventListener(name, prev);
        } catch {
          // ignore
        }
        delete this.#sseListenerByEvent[name];
      }
    }
  }

  sseConnect(opts = {}) {
    if (this.#es) return;

    const baseUrl = String(opts.url || this.sseUrl || "").trim();
    if (!baseUrl) throw new Error("cxAide.sseConnect requires sseUrl");

    const url = withSessionId(baseUrl, this.#sessionId);

    const withCredentials = (typeof opts.withCredentials === "boolean")
      ? opts.withCredentials
      : this.withCredentials;

    this.#jsEventName = String(opts.jsEventName || this.#jsEventName || "js");

    if (opts.handlers && typeof opts.handlers === "object") {
      for (const [k, v] of Object.entries(opts.handlers)) {
        if (typeof v === "function") this.#handlers[String(k)] = v;
      }
    }

    this.#es = new EventSource(url, { withCredentials });

    // JS event (server pushes JS to execute)
    this.#jsListener = (ev) => safeExec(ev?.data);
    try {
      this.#es.addEventListener(this.#jsEventName, this.#jsListener);
    } catch {
      // ignore
    }

    // Typed-ish events (JSON payloads)
    for (const k of Object.keys(this.#handlers)) this.#bindSseHandler(k);
  }

  sseDisconnect() {
    if (!this.#es) return;

    // remove listeners first (helps avoid retained closures)
    try {
      if (this.#jsListener) {
        try {
          this.#es.removeEventListener(this.#jsEventName, this.#jsListener);
        } catch {
          // ignore
        }
      }
      this.#jsListener = null;

      for (const [name, listener] of Object.entries(this.#sseListenerByEvent)) {
        try {
          this.#es.removeEventListener(name, listener);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }

    this.#sseListenerByEvent = Object.create(null);

    try {
      this.#es.close();
    } catch {
      // ignore
    }

    this.#es = null;
  }

  async postJson(url, body, opts = {}) {
    const u = String(url || "").trim();
    if (!u) throw new Error("cxAide.postJson requires url");

    const headers = {
      "content-type": "application/json",
      ...(opts.headers || {}),
    };

    const res = await fetch(u, {
      method: "POST",
      headers,
      body: JSON.stringify(body ?? null),
      credentials: opts.credentials || "include",
      keepalive: opts.keepalive !== false,
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText}${t ? `\n${t}` : ""}`);
    }
    return res;
  }

  action(action, body = {}, domEventName = "click", targetEl) {
    const url = String(this.postUrl || "").trim();
    if (!url) {
      throw new Error("cxAide.action requires postUrl (set cxAide.postUrl)");
    }
    const el = targetEl && asEl(targetEl) ? targetEl : this.host;
    const spec = `action:${action}`;
    const env = this.buildEnvelope(domEventName, el, spec, null);
    if (body && typeof body === "object" && Object.keys(body).length) {
      env.signals = Object.assign(env.signals || {}, body);
    }
    return this.postJson(url, env);
  }

  // ----- ContinuUX delegated runtime (HTMX/Datastar style)

  buildEnvelope(domEventName, targetEl, spec, ev) {
    const reqId = requestId();

    const env = {
      kind: "cx/interaction",
      domEvent: String(domEventName),
      spec: String(spec),

      element: elementMeta(targetEl),
      client: clientMeta(this.#sessionId, reqId, this.#appVersion),
    };

    const sig = signalsFromAttr(targetEl);
    if (sig) env.signals = sig;

    const hdr = headersFromAttr(targetEl);
    if (hdr) env.headers = hdr;

    // event-specific optional data
    try {
      if (ev && typeof ev === "object") {
        if ("clientX" in ev || "clientY" in ev) {
          env.pointer = {
            x: Number.isFinite(ev.clientX) ? ev.clientX : undefined,
            y: Number.isFinite(ev.clientY) ? ev.clientY : undefined,
            button: typeof ev.button === "number" ? ev.button : undefined,
            buttons: typeof ev.buttons === "number" ? ev.buttons : undefined,
          };
        }

        if ("key" in ev || "code" in ev) {
          env.key = {
            key: typeof ev.key === "string" ? ev.key : undefined,
            code: typeof ev.code === "string" ? ev.code : undefined,
            altKey: !!ev.altKey,
            ctrlKey: !!ev.ctrlKey,
            metaKey: !!ev.metaKey,
            shiftKey: !!ev.shiftKey,
            repeat: !!ev.repeat,
          };
        }

        const src = asEl(ev.target);
        if (src && (domEventName === "input" || domEventName === "change")) {
          const v = src && "value" in src ? String(src.value ?? "") : undefined;
          const checked = src && "checked" in src ? !!src.checked : undefined;
          env.input = { value: v, checked };
        }

        if (domEventName === "submit") {
          const f = targetEl && targetEl.tagName === "FORM" ? targetEl : null;
          if (f) env.form = formToObject(f);
        }
      }
    } catch {
      // ignore
    }

    return env;
  }

  resolveSpecForEvent(domEventName, startEl) {
    const onAttr = `${kDefault.cxOnPrefix}${String(domEventName)}`;
    const elOn = closestWithAttr(startEl, onAttr);
    if (elOn) {
      const s = ceAttr.string(elOn, onAttr, "");
      if (s) return { el: elOn, spec: s };
    }

    const elCx = closestWithAttr(startEl, kDefault.cxAttr);
    if (elCx) {
      const s = ceAttr.string(elCx, kDefault.cxAttr, "");
      if (s) return { el: elCx, spec: s };
    }

    return null;
  }

  async handleDomEvent(domEventName, ev) {
    const start = asEl(ev?.target);
    if (!start) return;

    const found = this.resolveSpecForEvent(domEventName, start);
    if (!found) return;

    // submit default handling
    if (domEventName === "submit") {
      if (this.#preventDefaultSubmit && ev?.preventDefault) {
        try {
          ev.preventDefault();
        } catch {
          // ignore
        }
      }
    }

    const env = this.buildEnvelope(domEventName, found.el, found.spec, ev);

    // observability headers (helpful in logs; harmless)
    const extraHeaders = Object.assign(Object.create(null), env.headers || {});
    extraHeaders["x-cx-session"] = String(env.client.sessionId || "");
    extraHeaders["x-cx-request"] = String(env.client.requestId || "");

    try {
      await this.postJson(this.postUrl, env, { headers: extraHeaders });
    } catch (err) {
      this.debugLog("post failed", err);
      this.diag("post:error", {
        message: String(err?.message || err),
        spec: env.spec,
        domEvent: env.domEvent,
      });
    }
  }

  wireDomEvents() {
    if (this.#wired) return;

    const onAny = (ev) => {
      const name = String(ev?.type || "");
      if (!name) return;
      void this.handleDomEvent(name, ev);
    };

    for (const e of this.#events) {
      try {
        document.addEventListener(e, onAny, true); // capture-phase delegation
        this.#domUnbinders.push(() => {
          try {
            document.removeEventListener(e, onAny, true);
          } catch {
            // ignore
          }
        });
      } catch {
        // ignore
      }
    }

    this.#wired = true;
    this.diag("wire:end", { ok: true });
  }

  unwireDomEvents() {
    if (!this.#wired) return;
    for (const fn of this.#domUnbinders.splice(0)) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
    this.#wired = false;
  }
}

export function createCxUserAgent(opts = {}) {
  const root = document.documentElement || document.body;
  const aide = new CxAide(root);

  // config
  if (opts.postUrl) aide.postUrl = String(opts.postUrl);
  if (opts.sseUrl) aide.sseUrl = String(opts.sseUrl);

  if (typeof opts.sseWithCredentials === "boolean") {
    aide.withCredentials = !!opts.sseWithCredentials;
  }
  if (typeof opts.withCredentials === "boolean") {
    aide.withCredentials = !!opts.withCredentials;
  }

  if (typeof opts.diagnostics === "boolean") {
    aide.setDiagnostics(opts.diagnostics);
  }
  if (typeof opts.debug === "boolean") aide.setDebug(opts.debug);
  if (opts.appVersion) aide.setAppVersion(opts.appVersion);

  if (Array.isArray(opts.events)) aide.setEvents(opts.events);
  if (typeof opts.preventDefaultSubmit === "boolean") {
    aide.setPreventDefaultSubmit(opts.preventDefaultSubmit);
  }

  // SSE
  const autoConnect = opts.autoConnect !== false;
  if (autoConnect) {
    try {
      aide.sseConnect({
        url: opts.sseUrl || aide.sseUrl,
        withCredentials: (typeof opts.sseWithCredentials === "boolean")
          ? !!opts.sseWithCredentials
          : aide.withCredentials,
        jsEventName: opts.sseJsEventName || opts.jsEventName || "js",
        handlers: opts.sseHandlers,
      });
    } catch (err) {
      aide.diag("sse:error", { message: String(err?.message || err) });
    }
  }

  // DOM delegation
  aide.wireDomEvents();

  return aide;
}

/**
 * @template {typeof HTMLElement} T
 * @param {T} ElementClass HTMLElement subclass (class definition, not instance)
 * @param {string=} name Optional custom element name ("x-y"). If omitted, derived from class name.
 */
export function customElementAide(ElementClass, name) {
  const resolvedName = name || kebabFromClassName(ElementClass?.name);

  const enhanceInstance = (el) => {
    if (!el || el[kCx]) return el;

    el[kCx] = new CxAide(el);

    Object.defineProperty(el, "cxAide", {
      enumerable: true,
      configurable: false,
      get() {
        return el[kCx];
      },
    });

    return el;
  };

  const instance = () => enhanceInstance(new ElementClass());

  const register = () => {
    if (!customElements.get(resolvedName)) {
      const Original = ElementClass;

      class Wrapped extends Original {
        constructor() {
          super();
          enhanceInstance(this);
        }

        connectedCallback() {
          if (typeof super.connectedCallback === "function") {
            super.connectedCallback();
          }
        }

        disconnectedCallback() {
          try {
            this.cxAide?.sseDisconnect?.();
            this.cxAide?.unwireDomEvents?.();
            this.cxAide?.unbindLocal?.();
          } catch {
            // ignore
          }
          if (typeof super.disconnectedCallback === "function") {
            super.disconnectedCallback();
          }
        }
      }

      customElements.define(resolvedName, Wrapped);
    }
    return resolvedName;
  };

  return { name: resolvedName, instance, register };
}
