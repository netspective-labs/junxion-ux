// lib/html/hypermedia.ts
// Dependency-free hypermedia helpers shared by server + browser Fluent.
//
// Goal: juniors never hand-write '@get("/x")' strings.
// They call functions that produce the right attributes deterministically.

import type { Attrs } from "./shared.ts";

export type HxMethod = "get" | "post" | "put" | "patch" | "delete";
export type HxEventName =
  | "click"
  | "submit"
  | "load"
  | "change"
  | "input"
  | "blur"
  | "focus"
  | "keydown"
  | "keyup"
  | "pointerdown"
  | "pointerup";

export type HxAction = Readonly<{
  __hxAction: true;
  method: HxMethod;
  uri: string;
}>;

const action = (method: HxMethod, uri: string): HxAction => ({
  __hxAction: true,
  method,
  uri,
});

const q = (s: string) => JSON.stringify(s);

export const toActionExpr = (a: HxAction): string =>
  `@${a.method}(${q(a.uri)})`;

export const on = (eventName: string, a: HxAction): Attrs => ({
  [`data-on:${eventName}`]: toActionExpr(a),
});

export const onClick = (a: HxAction): Attrs => on("click", a);
export const onSubmit = (a: HxAction): Attrs => on("submit", a);
export const onLoad = (a: HxAction): Attrs => on("load", a);

export const get = (uri: string): HxAction => action("get", uri);
export const post = (uri: string): HxAction => action("post", uri);
export const put = (uri: string): HxAction => action("put", uri);
export const patch = (uri: string): HxAction => action("patch", uri);
export const del = (uri: string): HxAction => action("delete", uri);

// Convenience “common cases” so juniors don’t even think about events.
export const clickGet = (uri: string): Attrs => onClick(get(uri));
export const clickPost = (uri: string): Attrs => onClick(post(uri));
export const loadGet = (uri: string): Attrs => onLoad(get(uri));

// Signals + binding helpers (also string-free at call sites)
export const signals = (obj: Record<string, unknown>): Attrs => ({
  "data-signals": JSON.stringify(obj),
});

export const bind = (path: string): Attrs => ({
  [`data-bind:${path}`]: "",
});

// Optional directive helpers (string-free attribute names; expression still a string if you use it)
export const text = (expr: string): Attrs => ({ "data-text": expr });
export const show = (expr: string): Attrs => ({ "data-show": expr });
export const effect = (expr: string): Attrs => ({ "data-effect": expr });
export const classIf = (clsName: string, expr: string): Attrs => ({
  [`data-class:${clsName}`]: expr,
});
export const attr = (attrName: string, expr: string): Attrs => ({
  [`data-attr:${attrName}`]: expr,
});

// Response header names (kept for compatibility with prior conventions)
export const headers = {
  selector: "datastar-selector",
  mode: "datastar-mode",
  useViewTransition: "datastar-use-view-transition",
  onlyIfMissing: "datastar-only-if-missing",
  request: "Datastar-Request",
} as const;

// One object to export from Fluent modules
export const JunxionUX = {
  on,
  onClick,
  onSubmit,
  onLoad,
  get,
  post,
  put,
  patch,
  delete: del,
  clickGet,
  clickPost,
  loadGet,
  signals,
  bind,
  text,
  show,
  effect,
  classIf,
  attr,
  headers,
} as const;
