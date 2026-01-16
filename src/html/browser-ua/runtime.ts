/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

// src/html/browser-ua/runtime.ts
//
// Dependency-free hypermedia runtime for Fluent + custom elements.
// Tolerant action parsing:
//   @get("/x")   (JSON string)
//   @get('/x')   (single-quoted string)
//   @get(/x)     (bare token; no spaces)
// Also supports basic target helpers:
//   data-target="self"              (current element)
//   data-target="closest:tag-name"  (closest ancestor matching tag-name)
// Otherwise data-target is treated as a selector scoped to Document or ShadowRoot.

type Mode = "replace" | "inner" | "append" | "prepend" | "before" | "after";

export type RuntimeOptions = {
  headerSelector?: string;
  headerMode?: string;
  headerOnlyIfMissing?: string;
  headerUseViewTransition?: string;
  headerRequest?: string;
  allowExpressions?: boolean;
  credentials?: RequestCredentials;
};

const DEFAULTS: Required<RuntimeOptions> = {
  headerSelector: "datastar-selector",
  headerMode: "datastar-mode",
  headerOnlyIfMissing: "datastar-only-if-missing",
  headerUseViewTransition: "datastar-use-view-transition",
  headerRequest: "Datastar-Request",
  allowExpressions: true,
  credentials: "same-origin",
};

type SignalListener = (path: string, value: unknown) => void;

class SignalStore {
  #root: Record<string, unknown>;
  #listeners = new Set<SignalListener>();

  constructor(initial?: Record<string, unknown>) {
    this.#root = initial ? structuredClone(initial) : {};
  }

  get root(): Record<string, unknown> {
    return this.#root;
  }

  subscribe(fn: SignalListener): () => void {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #notify(path: string, value: unknown) {
    for (const fn of this.#listeners) fn(path, value);
  }

  getPath(path: string): unknown {
    const parts = path.split(".").filter(Boolean);
    let cur: unknown = this.#root;
    for (const p of parts) {
      if (cur == null || typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[p];
    }
    return cur;
  }

  setPath(path: string, value: unknown) {
    const parts = path.split(".").filter(Boolean);
    if (parts.length === 0) return;

    let cur = this.#root as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      const v = cur[k];
      if (v == null || typeof v !== "object" || Array.isArray(v)) cur[k] = {};
      cur = cur[k] as Record<string, unknown>;
    }

    cur[parts[parts.length - 1]] = value;
    this.#notify(path, value);
  }

  merge(obj: Record<string, unknown>) {
    const walk = (
      base: Record<string, unknown>,
      add: Record<string, unknown>,
      prefix = "",
    ) => {
      for (const [k, v] of Object.entries(add)) {
        const p = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object" && !Array.isArray(v)) {
          const bv = base[k];
          if (!bv || typeof bv !== "object" || Array.isArray(bv)) base[k] = {};
          walk(
            base[k] as Record<string, unknown>,
            v as Record<string, unknown>,
            p,
          );
        } else {
          base[k] = v as unknown;
          this.#notify(p, v);
        }
      }
    };
    walk(this.#root, obj);
  }
}

const parseJsonObject = (s: string): Record<string, unknown> | null => {
  try {
    const v = JSON.parse(s);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
};

const truthy = (v: string | null) =>
  v != null && /^(1|true|yes|on)$/i.test(v.trim());

const normalizeMode = (v: string | null): Mode => {
  const s = (v ?? "").trim().toLowerCase();
  if (
    s === "replace" || s === "inner" || s === "append" || s === "prepend" ||
    s === "before" || s === "after"
  ) return s;
  if (s === "outer") return "replace";
  return "inner";
};

// ------------------------------
// Action parsing (tolerant)
// ------------------------------

const stripQuotes = (s: string): string | null => {
  const t = s.trim();
  if (t.length < 2) return null;

  const a = t[0];
  const b = t[t.length - 1];

  // JSON string or single-quoted string
  if ((a === `"` && b === `"`) || (a === `'` && b === `'`)) {
    // If it's double-quoted, prefer JSON.parse for escapes correctness.
    if (a === `"` && b === `"`) {
      try {
        const v = JSON.parse(t);
        return typeof v === "string" ? v : null;
      } catch {
        return null;
      }
    }

    // Single-quoted: accept simple escapes \' and \\ minimally.
    let out = "";
    for (let i = 1; i < t.length - 1; i++) {
      const ch = t[i];
      if (ch === "\\" && i + 1 < t.length - 1) {
        const n = t[i + 1];
        if (n === "'" || n === "\\" || n === "n" || n === "t" || n === "r") {
          if (n === "n") out += "\n";
          else if (n === "t") out += "\t";
          else if (n === "r") out += "\r";
          else out += n;
          i++;
          continue;
        }
        // Unknown escape: keep as-is (tolerant)
        out += n;
        i++;
        continue;
      }
      out += ch;
    }
    return out;
  }

  return null;
};

const parseActionArg = (raw: string): string | null => {
  const t = raw.trim();
  if (!t) return null;

  // JSON/double-quoted or single-quoted
  const q = stripQuotes(t);
  if (q != null) return q;

  // Bare token fallback for simple cases like /inc or relative/path
  // Reject if it contains whitespace or comma (i.e. multiple args).
  if (/\s/.test(t)) return null;
  if (t.includes(",")) return null;

  // Allow: /foo, foo, ./foo, ../foo, ?x=1, #hash, etc.
  return t;
};

const parseAction = (expr: string): { method: string; url: string } | null => {
  const m = expr.trim().match(/^@([a-zA-Z]+)\((.*)\)\s*$/);
  if (!m) return null;

  const name = m[1].toLowerCase();
  const argRaw = m[2].trim();
  if (!argRaw) return null;

  const url = parseActionArg(argRaw);
  if (!url) return null;

  const method = (() => {
    switch (name) {
      case "get":
        return "GET";
      case "post":
        return "POST";
      case "put":
        return "PUT";
      case "patch":
        return "PATCH";
      case "delete":
        return "DELETE";
      default:
        return "";
    }
  })();

  if (!method) return null;
  return { method, url };
};

// ------------------------------
// Bind helpers
// ------------------------------

const isFormLike = (
  el: Element,
): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
  el instanceof HTMLInputElement || el instanceof HTMLSelectElement ||
  el instanceof HTMLTextAreaElement;

const readBoundValue = (el: Element): unknown => {
  if (isFormLike(el)) {
    if (el instanceof HTMLInputElement) {
      if (el.type === "checkbox") return el.checked;
      if (el.type === "number") {
        return el.value === "" ? null : Number(el.value);
      }
      return el.value;
    }
    return el.value;
  }
  return el.textContent ?? "";
};

const writeBoundValue = (el: Element, value: unknown) => {
  if (isFormLike(el)) {
    if (el instanceof HTMLInputElement) {
      if (el.type === "checkbox") {
        el.checked = Boolean(value);
        return;
      }
      el.value = value == null ? "" : String(value);
      return;
    }
    el.value = value == null ? "" : String(value);
    return;
  }
  el.textContent = value == null ? "" : String(value);
};

const parseDirectiveName = (attrName: string) => {
  if (attrName.startsWith("data-on:")) {
    return { kind: "on" as const, arg: attrName.slice("data-on:".length) };
  }
  if (attrName.startsWith("data-bind:")) {
    return { kind: "bind" as const, arg: attrName.slice("data-bind:".length) };
  }
  if (attrName.startsWith("data-class:")) {
    return {
      kind: "class" as const,
      arg: attrName.slice("data-class:".length),
    };
  }
  if (attrName.startsWith("data-attr:")) {
    return { kind: "attr" as const, arg: attrName.slice("data-attr:".length) };
  }
  return null;
};

type CompileCtx = { signals: SignalStore; allowExpressions: boolean };

const compileExpr = (source: string, ctx: CompileCtx) => {
  const trimmed = source.trim();
  const action = parseAction(trimmed);

  if (!ctx.allowExpressions) return { kind: "action-only" as const, action };

  const fn = (() => {
    try {
      return new Function(
        "signals",
        "event",
        "el",
        `"use strict"; return (${trimmed});`,
      ) as (signals: SignalStore, event: Event | null, el: Element) => unknown;
    } catch {
      try {
        return new Function(
          "signals",
          "event",
          "el",
          `"use strict"; ${trimmed};`,
        ) as (
          signals: SignalStore,
          event: Event | null,
          el: Element,
        ) => unknown;
      } catch {
        return null;
      }
    }
  })();

  return { kind: "expr" as const, fn, action };
};

const applyHtmlUpdate = (htmlText: string, target: Element, mode: Mode) => {
  const tpl = document.createElement("template");
  tpl.innerHTML = htmlText;
  const nodes = Array.from(tpl.content.childNodes);

  switch (mode) {
    case "replace":
      target.replaceWith(...nodes);
      break;
    case "inner":
      target.replaceChildren(...nodes);
      break;
    case "append":
      target.append(...nodes);
      break;
    case "prepend":
      target.prepend(...nodes);
      break;
    case "before":
      target.before(...nodes);
      break;
    case "after":
      target.after(...nodes);
      break;
  }
};

const shadowRootOf = (el: Element): ShadowRoot | null => {
  const anyEl = el as unknown as { shadowRoot?: ShadowRoot | null };
  return anyEl.shadowRoot ?? null;
};

const enhanceShadowRootsUnder = (
  root: ParentNode,
  options?: RuntimeOptions,
) => {
  const scope = root instanceof Document
    ? root
    : (root as unknown as ShadowRoot | Element);

  const all = (scope as Document | ShadowRoot | Element).querySelectorAll?.(
    "*",
  );
  if (!all) return;

  for (const el of all) {
    const sr = shadowRootOf(el);
    if (sr) {
      // Safe: runtimes WeakMap dedupes per root.
      enhance({ root: sr, options });
    }
  }
};

const rootDocumentOf = (root: ParentNode): Document => {
  if (root instanceof Document) return root;
  if (root instanceof ShadowRoot) return root.ownerDocument;
  return root.ownerDocument ?? document;
};

// Support:
//   data-target="self"
//   data-target="closest:tag"
// Otherwise selector lookup (shadow-scoped if possible).
const resolveTargetSpec = (
  spec: string,
  ev: Event | null,
  root: ParentNode,
): Element | null => {
  const doc = rootDocumentOf(root);
  const ct = (ev?.currentTarget instanceof Element) ? ev.currentTarget : null;
  const t = (ev?.target instanceof Element) ? ev.target : null;
  const base = ct ?? t;

  const s = spec.trim();
  if (!s) return null;

  if (s === "self") return base;

  if (s.startsWith("closest:")) {
    const sel = s.slice("closest:".length).trim();
    if (!sel) return null;
    return base?.closest?.(sel) ?? null;
  }

  // Selector: shadow scoped if root is ShadowRoot
  if (root instanceof ShadowRoot) return root.querySelector(s);

  return doc.querySelector(s);
};

type TargetSpec =
  | { kind: "self" }
  | { kind: "closest"; selector: string }
  | { kind: "selector"; selector: string };

const parseTargetSpec = (s: string | null): TargetSpec | null => {
  const t = (s ?? "").trim();
  if (!t) return null;
  if (t === "self") return { kind: "self" };
  if (t.startsWith("closest:")) {
    const sel = t.slice("closest:".length).trim();
    if (!sel) return null;
    return { kind: "closest", selector: sel };
  }
  return { kind: "selector", selector: t };
};

const resolveTargetFromSpec = (
  root: ParentNode,
  from: Element,
  spec: TargetSpec | null,
): Element | null => {
  if (!spec) return null;

  if (spec.kind === "self") return from;

  if (spec.kind === "closest") {
    // closest() works in shadow DOM too, but walks within the tree it’s in.
    // For your use case, that’s correct.
    return from.closest(spec.selector);
  }

  // selector
  try {
    if (root instanceof ShadowRoot) {
      return root.querySelector(spec.selector);
    }
    const doc = rootDocumentOf(root);
    return doc.querySelector(spec.selector);
  } catch {
    return null;
  }
};

const defaultSwapTarget = (event: Event | null, root: ParentNode): Element => {
  const doc = rootDocumentOf(root);
  const t = (event?.target instanceof Element) ? event.target : null;
  const ct = (event?.currentTarget instanceof Element)
    ? event.currentTarget
    : null;

  // Walk up from target/currentTarget looking for data-target
  const find = (start: Element | null) => {
    for (let el = start; el; el = el.parentElement) {
      const spec = el.getAttribute("data-target");
      if (spec) {
        const resolved = resolveTargetSpec(spec, event, root);
        if (resolved) return resolved;
      }
    }
    return null;
  };

  // If in shadow root, prefer shadow-scoped selectors
  if (root instanceof ShadowRoot) {
    const spec = ct?.getAttribute("data-target") ??
      t?.getAttribute("data-target");
    if (spec) {
      const resolved = resolveTargetSpec(spec, event, root);
      if (resolved) return resolved;
    }

    const f2 = find(t) ?? find(ct);
    if (f2) return f2;

    return root.host instanceof Element
      ? root.host
      : (doc.body ?? doc.documentElement);
  }

  return find(t) ?? find(ct) ?? ct ?? (doc.body ?? doc.documentElement);
};

type RuntimeState = {
  options: Required<RuntimeOptions>;
  signals: SignalStore;
  mo: MutationObserver | null;
  unsub: (() => void) | null;
  scheduled: boolean;
};

const createState = (options?: RuntimeOptions): RuntimeState => ({
  options: { ...DEFAULTS, ...(options ?? {}) },
  signals: new SignalStore(),
  mo: null,
  unsub: null,
  scheduled: false,
});

const scheduleUpdate = (root: ParentNode, state: RuntimeState) => {
  if (state.scheduled) return;
  state.scheduled = true;
  queueMicrotask(() => {
    state.scheduled = false;
    updateDirectives(root, state);
  });
};

const collectSignals = (root: ParentNode, signals: SignalStore) => {
  const scope = root instanceof Document
    ? root
    : (root as unknown as Element | ShadowRoot);
  const els = (scope as Document | Element | ShadowRoot).querySelectorAll?.(
    "[data-signals]",
  );
  if (!els) return;
  for (const el of els) {
    const txt = el.getAttribute("data-signals");
    if (!txt) continue;
    const obj = parseJsonObject(txt);
    if (obj) signals.merge(obj);
  }
};

const scanAndWireEvents = (root: ParentNode, state: RuntimeState) => {
  const scope = root instanceof Document
    ? root
    : (root as unknown as Element | ShadowRoot);
  const all = (scope as Document | Element | ShadowRoot).querySelectorAll?.(
    "*",
  );
  if (!all) return;

  for (const el of all) {
    for (const { name, value } of Array.from(el.attributes)) {
      const d = parseDirectiveName(name);
      if (!d || d.kind !== "on") continue;

      const eventName = d.arg;
      const exprText = value ?? "";

      const key = `__fluent_on_${eventName}_${exprText}`;
      const anyEl = el as unknown as Record<string, unknown>;
      if (anyEl[key]) continue;
      anyEl[key] = true;

      el.addEventListener(eventName, async (ev) => {
        const compiled = compileExpr(exprText, {
          signals: state.signals,
          allowExpressions: state.options.allowExpressions,
        });

        if (compiled.action) {
          await performAction(
            compiled.action.method,
            compiled.action.url,
            ev,
            el,
            root,
            state,
          );
          return;
        }

        if (compiled.kind === "expr" && compiled.fn) {
          try {
            compiled.fn(state.signals, ev, el);
          } catch (e) {
            console.warn("fluent runtime: expression failed:", e);
          } finally {
            scheduleUpdate(root, state);
          }
        } else {
          // If it wasn't an action and couldn't compile as JS, warn once.
          if (exprText.trim().startsWith("@")) {
            console.warn(
              "fluent runtime: unrecognized action syntax for",
              name,
              "=>",
              exprText,
            );
          }
        }
      });
    }

    for (const { name } of Array.from(el.attributes)) {
      const d = parseDirectiveName(name);
      if (!d || d.kind !== "bind") continue;

      const path = d.arg;
      const key = `__fluent_bind_${path}`;
      const anyEl = el as unknown as Record<string, unknown>;
      if (anyEl[key]) continue;
      anyEl[key] = true;

      const onInput = () => state.signals.setPath(path, readBoundValue(el));
      const eventName = isFormLike(el) ? "input" : "blur";
      el.addEventListener(eventName, onInput);
    }
  }
};

const updateDirectives = (root: ParentNode, state: RuntimeState) => {
  const scope = root instanceof Document
    ? root
    : (root as unknown as Element | ShadowRoot);
  const all = (scope as Document | Element | ShadowRoot).querySelectorAll?.(
    "*",
  );
  if (!all) return;

  for (const el of all) {
    if (el.hasAttribute("data-text")) {
      const expr = el.getAttribute("data-text") ?? "";
      const compiled = compileExpr(expr, {
        signals: state.signals,
        allowExpressions: state.options.allowExpressions,
      });
      if (compiled.kind === "expr" && compiled.fn) {
        try {
          const v = compiled.fn(state.signals, null, el);
          el.textContent = v == null ? "" : String(v);
        } catch {
          // ignore
        }
      }
    }

    if (el.hasAttribute("data-show")) {
      const expr = el.getAttribute("data-show") ?? "";
      const compiled = compileExpr(expr, {
        signals: state.signals,
        allowExpressions: state.options.allowExpressions,
      });
      if (compiled.kind === "expr" && compiled.fn) {
        try {
          const v = compiled.fn(state.signals, null, el);
          (el as HTMLElement).style.display = v ? "" : "none";
        } catch {
          // ignore
        }
      }
    }

    for (const { name } of Array.from(el.attributes)) {
      const d = parseDirectiveName(name);
      if (!d || d.kind !== "bind") continue;
      const path = d.arg;
      writeBoundValue(el, state.signals.getPath(path));
    }

    for (const { name, value } of Array.from(el.attributes)) {
      const d = parseDirectiveName(name);
      if (!d || d.kind !== "class") continue;

      const clsName = d.arg;
      const expr = value ?? "";
      const compiled = compileExpr(expr, {
        signals: state.signals,
        allowExpressions: state.options.allowExpressions,
      });
      if (compiled.kind === "expr" && compiled.fn) {
        try {
          el.classList.toggle(
            clsName,
            Boolean(compiled.fn(state.signals, null, el)),
          );
        } catch {
          // ignore
        }
      }
    }

    for (const { name, value } of Array.from(el.attributes)) {
      const d = parseDirectiveName(name);
      if (!d || d.kind !== "attr") continue;

      const attrName = d.arg;
      const expr = value ?? "";
      const compiled = compileExpr(expr, {
        signals: state.signals,
        allowExpressions: state.options.allowExpressions,
      });
      if (compiled.kind === "expr" && compiled.fn) {
        try {
          const v = compiled.fn(state.signals, null, el);
          if (v == null || v === false) el.removeAttribute(attrName);
          else if (v === true) el.setAttribute(attrName, "");
          else el.setAttribute(attrName, String(v));
        } catch {
          // ignore
        }
      }
    }
  }

  for (
    const el of Array.from(
      (scope as Document | Element | ShadowRoot).querySelectorAll?.(
        "[data-effect]",
      ) ?? [],
    )
  ) {
    const expr = el.getAttribute("data-effect") ?? "";
    const compiled = compileExpr(expr, {
      signals: state.signals,
      allowExpressions: state.options.allowExpressions,
    });
    if (compiled.kind === "expr" && compiled.fn) {
      try {
        compiled.fn(state.signals, null, el);
      } catch {
        // ignore
      }
    }
  }

  scanAndWireEvents(root, state);
};

const performAction = async (
  method: string,
  url: string,
  ev: Event,
  el: Element,
  root: ParentNode,
  state: RuntimeState,
) => {
  if (ev.type === "submit") ev.preventDefault();
  if (ev.type === "click" && el instanceof HTMLAnchorElement) {
    ev.preventDefault();
  }

  const headers = new Headers();
  headers.set(state.options.headerRequest, "true");

  let fetchUrl = url;
  let body: BodyInit | null = null;

  const doc = rootDocumentOf(root);
  const form = el instanceof HTMLFormElement ? el : el.closest?.("form");
  if (form instanceof HTMLFormElement) {
    const fd = new FormData(form);

    if (method === "GET") {
      const u = new URL(fetchUrl, doc.baseURI);
      for (const [k, v] of fd.entries()) {
        if (typeof v === "string") u.searchParams.set(k, v);
      }
      fetchUrl = u.toString();
    } else {
      body = fd;
    }
  }

  const res = await fetch(fetchUrl, {
    method,
    headers,
    body,
    credentials: state.options.credentials,
  });

  const selector = res.headers.get(state.options.headerSelector);
  const swapModeFromEl = (el: Element): Mode =>
    normalizeMode(el.getAttribute("data-swap"));
  const mode = normalizeMode(res.headers.get(state.options.headerMode));
  const onlyIfMissing = truthy(
    res.headers.get(state.options.headerOnlyIfMissing),
  );
  const useViewTransition = truthy(
    res.headers.get(state.options.headerUseViewTransition),
  );

  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  if (ct.includes("application/json")) {
    const json = await res.json().catch(() => null);
    if (json && typeof json === "object" && !Array.isArray(json)) {
      state.signals.merge(json as Record<string, unknown>);
      scheduleUpdate(root, state);
    }
    return;
  }

  const text = await res.text();

  const spec = parseTargetSpec(el.getAttribute("data-target"));
  const attrTarget = resolveTargetFromSpec(root, el, spec);

  const target = (selector
    ? (root instanceof ShadowRoot
      ? (() => {
        try {
          return root.querySelector(selector);
        } catch {
          return null;
        }
      })()
      : (() => {
        const doc2 = rootDocumentOf(root);
        try {
          return doc2.querySelector(selector);
        } catch {
          return null;
        }
      })())
    : null) ??
    attrTarget ??
    defaultSwapTarget(ev, root);

  if (!(target instanceof Element)) return;

  const modeToUse = selector
    ? mode // server/header-driven
    : swapModeFromEl(el); // attribute-driven when no header override

  if (onlyIfMissing && target.childNodes.length > 0) return;

  // deno-lint-ignore require-await
  const doUpdate = async () => {
    applyHtmlUpdate(text, target, modeToUse);
    collectSignals(root, state.signals);
    scheduleUpdate(root, state);
  };

  const startVT = (doc as unknown as {
    startViewTransition?: (cb: () => Promise<void> | void) => unknown;
  }).startViewTransition;

  if (useViewTransition && typeof startVT === "function") {
    try {
      startVT(() => void doUpdate());
    } catch {
      await doUpdate();
    }
  } else {
    await doUpdate();
  }
};

export type EnhanceOptions = {
  root?: ParentNode;
  options?: RuntimeOptions;
};

type RootRuntime = {
  state: RuntimeState;
  root: ParentNode;
};

const runtimes = new WeakMap<object, RootRuntime>();

const getOrCreateRootRuntime = (root: ParentNode, options?: RuntimeOptions) => {
  const key: object = root instanceof Document ? root : root;
  const existing = runtimes.get(key);
  if (existing) return existing;

  const rr: RootRuntime = { root, state: createState(options) };
  runtimes.set(key, rr);
  return rr;
};

export const enhance = ({ root, options }: EnhanceOptions = {}) => {
  const r = root ?? document;
  const rr = getOrCreateRootRuntime(r, options);

  collectSignals(r, rr.state.signals);
  scanAndWireEvents(r, rr.state);
  updateDirectives(r, rr.state);

  // IMPORTANT: also wire anything living in Shadow DOM under this root.
  enhanceShadowRootsUnder(r, options);

  if (!rr.state.mo) {
    rr.state.mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of Array.from(m.addedNodes)) {
          if (!(n instanceof Element)) continue;

          // If a custom element with a shadowRoot was added, wire its shadow tree.
          const sr = shadowRootOf(n);
          if (sr) enhance({ root: sr, options });

          if (n.hasAttribute("data-signals")) {
            const obj = parseJsonObject(n.getAttribute("data-signals") ?? "");
            if (obj) rr.state.signals.merge(obj);
          }
        }
      }

      scanAndWireEvents(r, rr.state);
      scheduleUpdate(r, rr.state);

      // Re-scan for newly created shadow roots.
      enhanceShadowRootsUnder(r, options);

      enhanceSse({ root: r });
    });

    const observeTarget = r instanceof Document
      ? r.documentElement
      : (r as ShadowRoot).host;

    rr.state.mo.observe(observeTarget, { subtree: true, childList: true });
  }

  if (!rr.state.unsub) {
    rr.state.unsub = rr.state.signals.subscribe(() =>
      scheduleUpdate(r, rr.state)
    );
  }

  enhanceSse({ root: r });
};

// ------------------------------
// SSE support
// ------------------------------

const SSE_KEY = Symbol.for("fluent.sse");

type SseRecord = {
  source: EventSource;
  root: ParentNode;
};

const getSseRecord = (el: Element): SseRecord | null =>
  (el as unknown as Record<string | symbol, unknown>)[SSE_KEY] as SseRecord ??
    null;

const setSseRecord = (el: Element, rec: SseRecord | null) => {
  const obj = el as unknown as Record<string | symbol, unknown>;
  if (!rec) delete obj[SSE_KEY];
  else obj[SSE_KEY] = rec;
};

const resolveSseTarget = (
  root: ParentNode,
  el: Element,
  selector: string | null,
): Element | null => {
  if (!selector) return el;

  if (selector === "self") return el;
  if (selector.startsWith("closest:")) {
    const s = selector.slice("closest:".length).trim();
    return s ? (el.closest?.(s) ?? null) : null;
  }

  const doc = rootDocumentOf(root);
  if (root instanceof ShadowRoot) return root.querySelector(selector);
  return doc.querySelector(selector);
};

const enhanceSse = ({ root }: { root: ParentNode }) => {
  const scope = root instanceof Document
    ? root
    : (root as unknown as Element | ShadowRoot);
  const els = (scope as Document | Element | ShadowRoot).querySelectorAll?.(
    "[data-sse]",
  );
  if (!els) return;

  for (const el of els) {
    const url = el.getAttribute("data-sse");
    if (!url) continue;

    const existing = getSseRecord(el);
    if (existing && existing.source.url === url) continue;

    if (existing) {
      try {
        existing.source.close();
      } catch {
        // ignore
      }
      setSseRecord(el, null);
    }

    const rr = getOrCreateRootRuntime(root);
    const eventName = el.getAttribute("data-sse-event") ?? "message";
    const mergeSignals = el.hasAttribute("data-sse-signals")
      ? truthy(el.getAttribute("data-sse-signals"))
      : true;

    const selector = el.getAttribute("data-sse-selector");
    const mode = normalizeMode(el.getAttribute("data-sse-mode"));
    const onlyIfMissing = truthy(el.getAttribute("data-sse-only-if-missing"));

    const src = new EventSource(url);

    const handler = (ev: MessageEvent) => {
      const dataText = typeof ev.data === "string" ? ev.data : "";

      if (mergeSignals) {
        const obj = parseJsonObject(dataText);
        if (obj) {
          rr.state.signals.merge(obj);
          scheduleUpdate(root, rr.state);
          return;
        }
      }

      const target = resolveSseTarget(root, el, selector);
      if (!target) return;

      if (onlyIfMissing && target.childNodes.length > 0) return;

      applyHtmlUpdate(dataText, target, mode);
      collectSignals(root, rr.state.signals);
      scheduleUpdate(root, rr.state);
    };

    src.addEventListener(eventName, handler as EventListener);

    setSseRecord(el, { source: src, root });
  }
};

export const closeSseIfPresent = (rootOrElement: ParentNode | Element) => {
  const base: ParentNode = rootOrElement instanceof Element
    ? rootOrElement
    : rootOrElement;

  const all = (base as unknown as Element | Document | ShadowRoot)
    .querySelectorAll?.("[data-sse]");
  if (all) {
    for (const el of all) {
      const rec = getSseRecord(el);
      if (!rec) continue;
      try {
        rec.source.close();
      } catch {
        // ignore
      }
      setSseRecord(el, null);
    }
  } else if (rootOrElement instanceof Element) {
    const rec = getSseRecord(rootOrElement);
    if (rec) {
      try {
        rec.source.close();
      } catch {
        // ignore
      }
      setSseRecord(rootOrElement, null);
    }
  }
};
