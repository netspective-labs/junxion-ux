// lib/html/shared.ts
// Shared runtime + types safe for server and client.
// Pure shape expansion only: no environment-specific strictness.

export type AttrValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export type Attrs = Record<string, AttrValue>;

export type RawHtml = { readonly __rawHtml: string };

// Structural “DOM Node” shape, safe to reference without lib=dom.
export type DomNodeLike = { readonly nodeType: number };

// Builder support (usable anywhere a child can appear)
export type ChildAdder = (...children: Child[]) => void;
export type ChildBuilder = (e: ChildAdder) => void;

// A "Child" is recursive and can include builder functions.
export type Child =
  | string
  | number
  | boolean
  | null
  | undefined
  | RawHtml
  | DomNodeLike
  | Child[]
  | ChildBuilder;

// Optional dev-time raw policy (defaults to permissive)
export type RawPolicy = {
  mode?: "permissive" | "dev-strict";
};

let rawPolicy: RawPolicy = { mode: "permissive" };

export function setRawPolicy(policy: RawPolicy): void {
  rawPolicy = { ...rawPolicy, ...policy };
}

const isDev = (): boolean => {
  const deno = (globalThis as unknown as {
    Deno?: { env?: { get?: (k: string) => string | undefined } };
  }).Deno;
  const env = deno?.env?.get?.("DENO_ENV");
  return env !== "production";
};

export function raw(html: string): RawHtml {
  if (rawPolicy.mode === "dev-strict" && isDev()) {
    throw new Error(
      `raw() is disabled in dev-strict mode. Use trustedRaw(...) or setRawPolicy({ mode: "permissive" }).`,
    );
  }
  return { __rawHtml: html };
}

export function trustedRaw(html: string, _hint?: string): RawHtml {
  return { __rawHtml: html };
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeAttr(value: string): string {
  return escapeHtml(value);
}

const isDomNodeLike = (v: unknown): v is DomNodeLike => {
  return typeof v === "object" && v !== null &&
    "nodeType" in (v as Record<string, unknown>) &&
    typeof (v as Record<string, unknown>).nodeType === "number";
};

/**
 * Flattens children into a linear list of (string | RawHtml | DomNodeLike),
 * executing any builder callbacks as it walks the structure.
 *
 * Rules:
 * - null/undefined/false are skipped
 * - true is skipped (use boolean attrs for boolean semantics)
 * - arrays are recursively expanded
 * - builder functions are executed, and whatever they emit is recursively expanded
 * - RawHtml is passed through as-is
 * - DomNodeLike is passed through as-is (endpoint decides what to do)
 * - other primitives become strings
 */
export function flattenChildren(
  children: readonly Child[],
): (string | RawHtml | DomNodeLike)[] {
  const out: (string | RawHtml | DomNodeLike)[] = [];

  const visit = (c: Child): void => {
    if (c == null || c === false) return;

    // Builder callback
    if (typeof c === "function") {
      const emit: ChildAdder = (...xs) => {
        for (const x of xs) visit(x);
      };
      (c as ChildBuilder)(emit);
      return;
    }

    // Nested arrays
    if (Array.isArray(c)) {
      for (const x of c) visit(x);
      return;
    }

    // RawHtml passthrough
    if (typeof c === "object" && c && "__rawHtml" in c) {
      out.push(c as RawHtml);
      return;
    }

    // DomNodeLike passthrough
    if (isDomNodeLike(c)) {
      out.push(c);
      return;
    }

    // Skip boolean true as a child
    if (c === true) return;

    out.push(String(c));
  };

  for (const c of children) visit(c);
  return out;
}

export function serializeAttrs(attrs?: Attrs): string {
  if (!attrs) return "";

  const keys = Object.keys(attrs).sort();
  let s = "";
  for (const k of keys) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (v === true) {
      s += ` ${k}`;
      continue;
    }
    s += ` ${k}="${escapeAttr(String(v))}"`;
  }
  return s;
}

// DX helpers shared by server + client

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (value == null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function attrs(
  ...parts: Array<Attrs | null | undefined | false>
): Attrs {
  const out: Attrs = {};
  for (const p of parts) {
    if (!p) continue;
    for (const [k, v] of Object.entries(p)) out[k] = v;
  }
  return out;
}

export type ClassSpec =
  | string
  | null
  | undefined
  | false
  | ClassSpec[]
  | Record<string, boolean>;

export function classNames(...parts: ClassSpec[]): string {
  const out: string[] = [];
  const visit = (p: ClassSpec): void => {
    if (!p) return;
    if (Array.isArray(p)) {
      for (const x of p) visit(x);
      return;
    }
    if (typeof p === "object") {
      for (const [k, v] of Object.entries(p)) if (v) out.push(k);
      return;
    }
    const s = String(p).trim();
    if (s) out.push(s);
  };
  for (const p of parts) visit(p);
  return out.join(" ");
}

export function styleText(
  style: Record<string, string | number | null | undefined | false>,
): string {
  const toKebab = (s: string) =>
    s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

  const keys = Object.keys(style).sort();
  let s = "";
  for (const k of keys) {
    const v = style[k];
    if (v == null || v === false) continue;
    s += `${toKebab(k)}:${String(v)};`;
  }
  return s;
}

// Explicit wrapper for readability in call sites.
export function children(builder: ChildBuilder): ChildBuilder {
  return builder;
}

export function each<T>(
  items: Iterable<T>,
  fn: (item: T, index: number) => Child,
): ChildBuilder {
  return (e) => {
    let i = 0;
    for (const it of items) e(fn(it, i++));
  };
}
