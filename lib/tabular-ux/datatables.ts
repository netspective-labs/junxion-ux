/**
 * @module lib/natural-html/tabular-ux.ts
 *
 * Tabular UX for Natural DS
 *
 * This module provides a single, core component: `TabularElement`, a type-safe,
 * SSR-friendly wrapper for the open source DataTables grid library, designed to
 * integrate cleanly with Natural DS layouts, regions, and head-slot composition.
 *
 * The goal is to make “advanced grids and enterprise tables” easy to adopt without
 * turning Natural DS into a front-end framework. The module stays true to the
 * Natural DS philosophy:
 *
 * - Structure is explicit (no hidden registries).
 * - Output is deterministic HAST (via Natural HTML).
 * - Dependencies are declared as data and contributed via head slots.
 * - The default experience is simple, but advanced configuration is available.
 *
 * How it works
 *
 * 1) Deterministic HTML (SSR-first)
 * `TabularElement` renders a normal `<table>` element with an optional `<caption>`,
 * a `<thead>` derived from your typed column definitions, and a `<tbody>` derived
 * from optional row data.
 *
 * The server always emits valid HTML and does not require a runtime DOM to build
 * the table. The browser enhancement step is optional and controlled by `autoInit`.
 *
 * 2) Progressive enhancement with DataTables
 * When `autoInit !== false`, the component emits a small initializer script that:
 * - Locates the table by its stable `id`
 * - Calls the DataTables constructor with your options
 *
 * This converts the static table into an interactive DataTables grid in the browser.
 *
 * 3) Type-safe usage patterns
 * `TabularElementProps<Row>` and `TabularColumn<Row>` provide compile-time safety:
 * - `columns[i].key` must exist on `Row`
 * - `columns[i].cell(ctx, row)` can render custom content safely using Natural HTML children
 * - `options` is a typed subset of DataTables settings, intentionally conservative, with
 *   a structured escape hatch for advanced objects (`Record<string, unknown>`) where needed
 *
 * For maximum ergonomics, use the helper:
 *
 *   const Tabular = tabular<MyRow>();
 *   Tabular(ctx, { columns: ..., data: ... })
 *
 * This gives you a strongly typed render function without having to cast `TabularElement`.
 *
 * 4) Head-slot dependency contribution (CSS/JS via CDN)
 * DataTables is a browser-side enhancement and requires CSS and JavaScript assets.
 * This module intentionally does not hide those dependencies.
 *
 * Instead it provides `tabularHeadSlots(deps)` which returns a `headSlots(...)` object
 * compatible with Natural DS layouts that declare head slots.
 *
 * A typical layout can accept head slots and include them in `<head>`:
 *
 *   const page = ds.page("AppShell", renderCtx, {
 *     headSlots: {
 *       ...tabularHeadSlots({ plugins: "enterprise" }),
 *       title: () => h.text("Patients"),
 *     },
 *     slots: { ... }
 *   });
 *
 * This keeps dependency management explicit, deterministic, and centralized at the page/layout level.
 *
 * 5) Plugins and enterprise features (OSS extensions)
 * DataTables has a number of open source extensions commonly used in “enterprise” tables:
 * - Buttons (export, print, column visibility)
 * - Responsive (mobile friendly layout)
 * - Select (row/cell selection)
 * - SearchPanes (faceted filtering)
 * - Scroller (virtual scrolling)
 * - FixedHeader, FixedColumns
 * - ColReorder, RowReorder
 * - KeyTable (keyboard navigation)
 *
 * This module models plugin selection as:
 *
 * - `TabularPluginBundle`: "minimal" | "enterprise"
 * - `TabularPlugins`: bundle name, explicit list, or `{ bundle, include }`
 *
 * The plugin list is normalized deterministically and expanded by a small “closure”
 * rule where helpful (for example, SearchPanes implies Select in many common setups).
 *
 * 6) CRUD and editing
 * DataTables “Editor” is a commercial product and is not included here.
 * This module supports OSS-based CRUD flows in typical enterprise ways:
 * - selection + action buttons/menus you render yourself
 * - Ajax configuration for loading data
 * - your own endpoints for create/update/delete
 *
 * The wrapper is designed so you can layer CRUD patterns on top without changing
 * the core component contract.
 *
 * What this module intentionally does NOT do
 * - It does not fetch assets itself.
 * - It does not mutate global DS registries.
 * - It does not introduce a client-side framework.
 * - It does not re-export or wrap every DataTables setting.
 *
 * Instead, it provides:
 * - a deterministic, inspectable `<table>` generator
 * - a minimal, safe initializer
 * - explicit head-slot dependency contributions
 * - a typed configuration surface that can be extended over time
 */
import {
  defineComponent,
  NamingStrategy,
  RenderCtx,
} from "../natural-html/design-system.ts";
import * as h from "../natural-html/elements.ts";
import { headSlots } from "../natural-html/patterns.ts";

/* -------------------------------------------------------------------------- */
/* CDN defaults                                                               */
/* -------------------------------------------------------------------------- */

export type TabularCdnVersions = Readonly<{
  readonly jquery: string; // jQuery v4
  readonly datatables: string; // DataTables core
  readonly buttons: string;
  readonly responsive: string;
  readonly select: string;
  readonly searchpanes: string;
  readonly scroller: string;
  readonly fixedheader: string;
  readonly colreorder: string;
  readonly rowreorder: string;
  readonly keytable: string;
  readonly fixedcolumns: string;
}>;

/**
 * Defaults: pinned for determinism.
 * Update these when you intentionally rev the CDN bundle.
 */
export const TABULAR_CDN_VERSIONS: TabularCdnVersions = {
  jquery: "3.6.4",
  datatables: "2.3.6",
  buttons: "3.2.5",
  responsive: "3.0.7",
  select: "3.1.3",
  searchpanes: "2.3.3",
  scroller: "2.4.3",
  fixedheader: "4.0.5",
  colreorder: "2.1.0",
  rowreorder: "1.5.0",
  keytable: "2.12.1",
  fixedcolumns: "5.0.4",
};

export type TabularCdn = Readonly<{
  readonly jqueryBase: string;
  readonly dtBase: string;
  readonly versions: TabularCdnVersions;
}>;

export const defaultTabularCdn = (
  versions: TabularCdnVersions = TABULAR_CDN_VERSIONS,
): TabularCdn => ({
  jqueryBase: "https://code.jquery.com",
  dtBase: "https://cdn.datatables.net",
  versions,
});

/* -------------------------------------------------------------------------- */
/* Plugin model                                                               */
/* -------------------------------------------------------------------------- */

export type TabularPluginId =
  | "buttons"
  | "responsive"
  | "select"
  | "searchpanes"
  | "scroller"
  | "fixedheader"
  | "colreorder"
  | "rowreorder"
  | "keytable"
  | "fixedcolumns";

export type TabularPluginBundle = "minimal" | "enterprise";

export type TabularPlugins =
  | TabularPluginBundle
  | readonly TabularPluginId[]
  | {
    readonly bundle?: TabularPluginBundle;
    readonly include?: readonly TabularPluginId[];
  }
  | undefined;

const isPluginObject = (
  p: unknown,
): p is {
  readonly bundle?: TabularPluginBundle;
  readonly include?: readonly TabularPluginId[];
} => !!p && typeof p === "object" && !Array.isArray(p);

function normalizePlugins(p: TabularPlugins): readonly TabularPluginId[] {
  if (!p) return [];

  if (typeof p === "string") {
    if (p === "minimal") return [];
    return [
      "buttons",
      "responsive",
      "select",
      "searchpanes",
      "scroller",
      "fixedheader",
      "colreorder",
      "rowreorder",
      "keytable",
    ];
  }

  if (Array.isArray(p)) return p;

  // object form (narrowed)
  if (isPluginObject(p)) {
    const bundle = p.bundle ?? "enterprise";
    const base = normalizePlugins(bundle);
    const extra = p.include ?? [];
    return Array.from(new Set([...base, ...extra]));
  }

  return [];
}

/**
 * Extension dependency hints: ensure implied deps are present.
 * Example: SearchPanes is typically used with Select.
 */
function pluginClosure(
  list: readonly TabularPluginId[],
): readonly TabularPluginId[] {
  const set = new Set<TabularPluginId>(list);
  if (set.has("searchpanes")) set.add("select");
  return Array.from(set);
}

/* -------------------------------------------------------------------------- */
/* DataTables options (typed subset, extensible)                              */
/* -------------------------------------------------------------------------- */

export type DtOrderDir = "asc" | "desc";
export type DtOrder = readonly [number, DtOrderDir];

export type DtLanguage = Readonly<{
  readonly search?: string;
  readonly lengthMenu?: string;
  readonly info?: string;
  readonly infoEmpty?: string;
  readonly emptyTable?: string;
}>;

export type DtButtonsConfig =
  | "copy"
  | "csv"
  | "excel"
  | "pdf"
  | "print"
  | "colvis"
  | Readonly<
    {
      readonly extend: string;
      readonly text?: string;
      readonly className?: string;
    }
  >;

export type DataTableOptions = Readonly<{
  readonly paging?: boolean;
  readonly pageLength?: number;
  readonly lengthMenu?:
    | readonly number[]
    | readonly (readonly [number, string])[];
  readonly searching?: boolean;
  readonly ordering?: boolean;
  readonly order?: readonly DtOrder[];
  readonly info?: boolean;
  readonly lengthChange?: boolean;
  readonly autoWidth?: boolean;
  readonly deferRender?: boolean;

  readonly responsive?: boolean | Readonly<Record<string, unknown>>;
  readonly select?: boolean | Readonly<Record<string, unknown>>;
  readonly searchPanes?: boolean | Readonly<Record<string, unknown>>;
  readonly scrollY?: string | number;
  readonly scroller?: boolean | Readonly<Record<string, unknown>>;
  readonly fixedHeader?: boolean | Readonly<Record<string, unknown>>;
  readonly colReorder?: boolean | Readonly<Record<string, unknown>>;
  readonly rowReorder?: boolean | Readonly<Record<string, unknown>>;
  readonly keys?: boolean | Readonly<Record<string, unknown>>;
  readonly fixedColumns?: boolean | Readonly<Record<string, unknown>>;

  readonly dom?: string;
  readonly buttons?: readonly DtButtonsConfig[];
  readonly language?: DtLanguage;

  readonly columns?: readonly Readonly<{
    readonly data?: string;
    readonly title?: string;
    readonly className?: string;
  }>[];

  // Ajax mode (optional)
  readonly ajax?:
    | string
    | Readonly<
      {
        readonly url: string;
        readonly method?: string;
        readonly dataSrc?: string;
      }
    >;

  // Column config passthrough (advanced)
  readonly columnDefs?: readonly Readonly<Record<string, unknown>>[];
}>;

/* -------------------------------------------------------------------------- */
/* Head slot contributions (CSS/JS tags)                                      */
/* -------------------------------------------------------------------------- */

export type TabularHeadDeps = Readonly<{
  readonly cdn?: TabularCdn;
  readonly plugins?: TabularPlugins;
  readonly includeJquery?: boolean; // default true
  readonly includeCore?: boolean; // default true
}>;

function dtCssCore(cdn: TabularCdn): string {
  return `${cdn.dtBase}/${cdn.versions.datatables}/css/dataTables.dataTables.min.css`;
}
function dtJsCore(cdn: TabularCdn): string {
  return `${cdn.dtBase}/${cdn.versions.datatables}/js/dataTables.min.js`;
}
function jqueryJs(cdn: TabularCdn): string {
  return `${cdn.jqueryBase}/jquery-${cdn.versions.jquery}.min.js`;
}

type ExtAsset = Readonly<{ readonly css?: string; readonly js?: string }>;

function extAssets(cdn: TabularCdn, id: TabularPluginId): ExtAsset {
  const b = cdn.dtBase;
  const v = cdn.versions;

  switch (id) {
    case "buttons":
      return {
        css: `${b}/buttons/${v.buttons}/css/buttons.dataTables.min.css`,
        js: `${b}/buttons/${v.buttons}/js/dataTables.buttons.min.js`,
      };
    case "responsive":
      return {
        css:
          `${b}/responsive/${v.responsive}/css/responsive.dataTables.min.css`,
        js: `${b}/responsive/${v.responsive}/js/dataTables.responsive.min.js`,
      };
    case "select":
      return {
        css: `${b}/select/${v.select}/css/select.dataTables.min.css`,
        js: `${b}/select/${v.select}/js/dataTables.select.min.js`,
      };
    case "searchpanes":
      return {
        css:
          `${b}/searchpanes/${v.searchpanes}/css/searchPanes.dataTables.min.css`,
        js:
          `${b}/searchpanes/${v.searchpanes}/js/dataTables.searchPanes.min.js`,
      };
    case "scroller":
      return {
        css: `${b}/scroller/${v.scroller}/css/scroller.dataTables.min.css`,
        js: `${b}/scroller/${v.scroller}/js/dataTables.scroller.min.js`,
      };
    case "fixedheader":
      return {
        css:
          `${b}/fixedheader/${v.fixedheader}/css/fixedHeader.dataTables.min.css`,
        js:
          `${b}/fixedheader/${v.fixedheader}/js/dataTables.fixedHeader.min.js`,
      };
    case "colreorder":
      return {
        css:
          `${b}/colreorder/${v.colreorder}/css/colReorder.dataTables.min.css`,
        js: `${b}/colreorder/${v.colreorder}/js/dataTables.colReorder.min.js`,
      };
    case "rowreorder":
      return {
        css:
          `${b}/rowreorder/${v.rowreorder}/css/rowReorder.dataTables.min.css`,
        js: `${b}/rowreorder/${v.rowreorder}/js/dataTables.rowReorder.min.js`,
      };
    case "keytable":
      return {
        css: `${b}/keytable/${v.keytable}/css/keyTable.dataTables.min.css`,
        js: `${b}/keytable/${v.keytable}/js/dataTables.keyTable.min.js`,
      };
    case "fixedcolumns":
      return {
        css:
          `${b}/fixedcolumns/${v.fixedcolumns}/css/fixedColumns.dataTables.min.css`,
        js:
          `${b}/fixedcolumns/${v.fixedcolumns}/js/dataTables.fixedColumns.min.js`,
      };
  }
}

/**
 * Returns Natural DS headSlots() contribution with the correct <link>/<script> tags.
 */
export function tabularHeadSlots(deps: TabularHeadDeps = {}) {
  const cdn = deps.cdn ?? defaultTabularCdn();
  const includeJquery = deps.includeJquery ?? true;
  const includeCore = deps.includeCore ?? true;

  const plugins = pluginClosure(normalizePlugins(deps.plugins ?? "enterprise"));

  const links: h.RawHtml[] = [];
  const scripts: h.RawHtml[] = [];

  if (includeCore) {
    links.push(h.link({ rel: "stylesheet", href: dtCssCore(cdn) }));
  }
  for (const p of plugins) {
    const a = extAssets(cdn, p);
    if (a.css) links.push(h.link({ rel: "stylesheet", href: a.css }));
  }

  if (includeJquery) scripts.push(h.script({ src: jqueryJs(cdn) }));
  if (includeCore) scripts.push(h.script({ src: dtJsCore(cdn) }));
  for (const p of plugins) {
    const a = extAssets(cdn, p);
    if (a.js) scripts.push(h.script({ src: a.js }));
  }

  return headSlots({
    links,
    scripts,
  });
}

/* -------------------------------------------------------------------------- */
/* TabularElement component                                                   */
/* -------------------------------------------------------------------------- */

type EmptyCtx = Record<PropertyKey, never>;

export type TabularColumn<Row extends Record<string, unknown>> = Readonly<{
  readonly key: keyof Row & string;
  readonly header: string;
  readonly class?: string;
  readonly cell?: (
    ctx: RenderCtx<EmptyCtx, NamingStrategy>,
    row: Row,
  ) => h.Child;
}>;

export type TabularElementProps<Row extends Record<string, unknown>> = Readonly<
  {
    readonly id?: string;
    readonly class?: string;
    readonly caption?: string;

    // Data mode: either provide rows OR provide ajax in options.
    readonly data?: readonly Row[];

    readonly columns: readonly TabularColumn<Row>[];

    // DataTables options (typed subset)
    readonly options?: DataTableOptions;

    // Head contribution settings (optional)
    readonly headDeps?: TabularHeadDeps;

    // If false, do not emit an initializer script.
    readonly autoInit?: boolean;
  }
>;

function stableJsonStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  const walk = (v: unknown): unknown => {
    if (v == null) return v;
    if (typeof v !== "object") return v;
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(walk);

    const obj = v as Record<string, unknown>;
    if (seen.has(obj)) {
      throw new Error("tabular-ux: cyclic options are not supported");
    }
    seen.add(obj);

    const out: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort();
    for (const k of keys) out[k] = walk(obj[k]);
    return out;
  };

  return JSON.stringify(walk(value));
}

export const TabularElement = defineComponent<
  TabularElementProps<Record<string, unknown>>,
  EmptyCtx,
  NamingStrategy
>(
  "TabularElement",
  (ctx, props) => {
    void props.headDeps;

    const elementId = props.id ??
      ctx.naming.elemIdValue("TabularElement", "component");
    const elementIdAttr = ctx.naming.elemDataAttr(
      "element-id",
      elementId,
      "component",
    );

    const columns = props.columns;

    const thead = h.thead(
      h.tr(
        h.each(columns, (c) =>
          h.th(
            c.class
              ? { class: ctx.cls("tabular__th", c.class) }
              : { class: ctx.cls("tabular__th") },
            c.header,
          )),
      ),
    );

    const tbody = props.data
      ? h.tbody(
        h.each(props.data, (row) =>
          h.tr(
            h.each(columns, (c) => {
              const content = c.cell
                ? c.cell(ctx, row)
                : String(row[c.key] ?? "");
              return h.td(
                c.class
                  ? { class: ctx.cls("tabular__td", c.class) }
                  : { class: ctx.cls("tabular__td") },
                content,
              );
            }),
          )),
      )
      : h.tbody();

    const tableClassList = [
      ctx.cls("tabular", props.class),
      "dataTable",
      "display",
    ]
      .filter(Boolean)
      .join(" ");

    const table = h.table(
      {
        id: elementId,
        class: tableClassList,
        [elementIdAttr]: elementId,
      },
      props.caption ? h.caption(props.caption) : null,
      thead,
      tbody,
    );

    if (props.autoInit === false) {
      return h.div({ class: ctx.cls("tabular__wrap") }, table);
    }

    const opts = props.options ?? {};
    const dtOptions: Record<string, unknown> = { ...opts };

    const hasProp = (key: keyof DataTableOptions): boolean =>
      Object.prototype.hasOwnProperty.call(opts, key);

    const defaultPageLength = 5;
    const computedPageLength = hasProp("pageLength")
      ? (opts.pageLength ?? defaultPageLength)
      : defaultPageLength;

    if (!hasProp("pageLength")) {
      dtOptions.pageLength = computedPageLength;
    }

    if (props.data) dtOptions.data = props.data;

    const dataLength = props.data?.length ?? 0;
    const needsPaging = dataLength > computedPageLength;

    if (!hasProp("paging")) {
      dtOptions.paging = needsPaging;
    }

    if (!hasProp("info")) {
      dtOptions.info = needsPaging;
    }

    if (!hasProp("lengthChange")) {
      dtOptions.lengthChange = false;
    }

    if (!hasProp("searching")) {
      dtOptions.searching = false;
    }

    if (!("columns" in dtOptions)) {
      dtOptions.columns = columns.map((col) => ({
        data: col.key,
        title: col.header,
        className: col.class,
      }));
    }

    const optionsJson = stableJsonStringify(dtOptions);

    const initScript = h.javaScript`

      (() => {
        const init = () => {
          const el = document.getElementById(${JSON.stringify(elementId)});
          if (!el) return;

          const globalObj = globalThis;
          const jQuery = globalObj.jQuery;
          const plugin = jQuery?.fn?.DataTable ?? jQuery?.fn?.dataTable;
          if (typeof plugin === "function" && typeof jQuery === "function") {
            plugin.call(jQuery(el), ${optionsJson});
            return;
          }

          const ctor = globalObj.DataTable;
          if (typeof ctor !== "function") return;

          ctor(el, ${optionsJson});
        };

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', init, { once: true });
        } else {
          init();
        }
      })();
    `;

    return h.div(
      { class: ctx.cls("tabular__wrap") },
      table,
      h.script({ type: "module" }, initScript),
    );
  },
);

/* -------------------------------------------------------------------------- */
/* Ergonomic typed wrapper (recommended)                                      */
/* -------------------------------------------------------------------------- */

export function tabular<Row extends Record<string, unknown>>() {
  type Fn = (
    ctx: RenderCtx<EmptyCtx, NamingStrategy>,
    props: TabularElementProps<Row>,
  ) => h.RawHtml;

  return TabularElement as unknown as Fn;
}
