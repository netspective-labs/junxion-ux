/**
 * @module lib/tabular-ux/grid.ts
 *
 * Server-side authoring for a tiny, type-safe grid web component.
 *
 * This file defines:
 * - The smallest useful set of grid data structures (columns, rows, tree rows)
 * - A middleware-style data source contract (static, fetch, SSE)
 * - A plugin reference model (client-side extensibility, non-core features)
 * - A deterministic renderer that emits a <natural-grid> custom element plus a JSON config payload
 * - A builder API for ergonomic construction without losing type-safety
 *
 * Design goals and philosophy
 *
 * 1) Tiny core, infinite extension
 * The core intentionally does not implement heavy features associated with DataTables or AG Grid,
 * such as sorting UX, filtering UX, pagination, virtualization, column resizing, etc.
 * Those belong in plugins so the core remains predictable and easy to reason about.
 *
 * 2) Server-side is TypeScript-first and type-safe
 * The TypeScript side is meant to be type-safe and composable using generics and type inference
 * where possible, so most usage does not require explicit generic annotations.
 *
 * The types are designed to:
 * - Encourage stable identifiers (column keys, row ids)
 * - Preserve determinism (config JSON is emitted in a stable order)
 * - Make illegal states harder to represent (missing columns, missing data sources)
 *
 * 3) Client-side is minimal, modern JavaScript with JSDoc types
 * The client web component lives in grid.js. It:
 * - Parses server-emitted JSON config
 * - Loads data using middleware (static/fetch/SSE)
 * - Renders a simple table (optionally tree rows)
 * - Loads and runs plugins that add non-core behaviors
 *
 * JavaScript is written to be readable and maintainable, with JSDoc-based types to enable
 * editor tooling and to make intent explicit without TypeScript build steps for the browser.
 *
 * 4) Both codebases are designed to be maintained by AI
 * This means:
 * - Clear contracts and small interfaces
 * - Predictable, deterministic behavior
 * - Stable naming and structure
 * - Minimal hidden state and fewer implicit side effects
 * - Localized complexity (plugins/middleware rather than sprawling core)
 *
 * In other words: the code should be easy for humans to follow, but also structured in a way
 * that AI tools can safely refactor, extend, and generate compatible additions.
 *
 * Integration expectations
 *
 * - The server emits <natural-grid data-config-id="..."> and a sibling JSON <script type="application/json">.
 * - grid.js finds the config by id, hydrates itself, loads plugins, then loads data.
 * - UA dependencies can be mounted and exposed by your server, then linked via ds.uaHeadTags().
 */
import type {
  Attrs,
  RawHtml,
  UaDependency,
  UaDependencyReference,
} from "../natural-html/elements.ts";
import * as h from "../natural-html/elements.ts";

/**
 * A stable identifier for the grid instance in the DOM.
 * This should be unique on a page, similar to an HTML id.
 */
export type GridId = string;

/**
 * The union of values supported by the core grid cell model.
 *
 * Notes:
 * - The core supports basic primitives and minimal tagged values for HTML/text.
 * - Rendering decisions are mostly delegated to client plugins via column.renderer hints.
 * - Keep this small; extend rendering behavior via plugins rather than adding new core variants.
 */
export type GridCellValue =
  | string
  | number
  | boolean
  | null
  | { readonly kind: "html"; readonly html: string }
  | { readonly kind: "text"; readonly text: string };

/**
 * Stable identifier for a row.
 * Used by plugins and incremental updates (e.g., SSE upserts).
 */
export type GridRowId = string;

/**
 * A single grid row, optionally containing hierarchical children.
 *
 * - `cells` is a dictionary keyed by column keys.
 * - `children` enables hierarchical grids (tree data).
 * - `meta` provides optional row-level attributes for plugins
 *   (e.g., selection state, row class hints, tags, etc.).
 */
export type GridRow = {
  readonly id: GridRowId;
  readonly cells: Readonly<Record<string, GridCellValue>>;
  readonly meta?: Readonly<Record<string, string | number | boolean | null>>;
  readonly children?: readonly GridRow[];
};

/**
 * Coarse column “type” hint.
 * This is intentionally small and declarative; advanced behavior belongs in plugins.
 */
export type GridColumnType =
  | "text"
  | "number"
  | "bool"
  | "date"
  | "badge"
  | "json"
  | "custom";

/**
 * Column definition.
 *
 * Column keys should be stable and correspond to row.cells[key].
 * The client can use these hints to render, align, and expose UI affordances.
 */
export type GridColumnDef = {
  readonly key: string;
  readonly title: string;

  readonly type?: GridColumnType;
  readonly widthPx?: number;
  readonly align?: "left" | "center" | "right";

  readonly sortable?: boolean;
  readonly filterable?: boolean;

  /**
   * Declarative formatter hint, typically interpreted by plugins.
   * Examples: "date:YYYY-MM-DD", "badge:risk", "currency:USD"
   */
  readonly formatter?: string;

  /**
   * Declarative renderer id, typically mapped to a plugin.
   * Examples: "link", "pill", "sparkline"
   */
  readonly renderer?: string;
};

/**
 * Sort directive.
 * Sorting UX is plugin territory; this type just captures the desired state.
 */
export type GridSort = { readonly key: string; readonly dir: "asc" | "desc" };

/**
 * Filter directive.
 * Filtering UX is plugin territory; this type just captures the desired state.
 */
export type GridFilter = {
  readonly key: string;
  readonly op?: "contains" | "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
  readonly value: string | number | boolean;
};

/**
 * Snapshot of the grid's data state at a moment in time.
 *
 * Data sources can deliver snapshots:
 * - statically (embedded JSON)
 * - dynamically (fetch response)
 * - incrementally (SSE messages that apply changes)
 */
export type GridDataSnapshot = {
  readonly columns: readonly GridColumnDef[];
  readonly rows: readonly GridRow[];
  readonly sort?: readonly GridSort[];
  readonly filters?: readonly GridFilter[];
};

/**
 * Data middleware contract. The core supports three data source modes:
 *
 * - static: embed a snapshot directly in page HTML
 * - fetch: retrieve snapshot-like JSON via HTTP
 * - sse: receive incremental changes (or snapshots) via Server-Sent Events
 *
 * This contract is intentionally small; more complex strategies can be implemented
 * by client plugins that override/augment the default middleware.
 */
export type GridDataSource =
  | {
    readonly kind: "static";
    readonly snapshot: GridDataSnapshot;
  }
  | {
    readonly kind: "fetch";
    readonly url: string;
    readonly method?: "GET" | "POST";
    readonly headers?: Readonly<Record<string, string>>;
    readonly bodyJson?: unknown;
    readonly pollMs?: number;
  }
  | {
    readonly kind: "sse";
    readonly url: string;
    readonly withCredentials?: boolean;
    readonly eventName?: string;
  };

/**
 * Reference to a client-side plugin.
 *
 * A plugin is typically a JavaScript module that is imported by grid.js.
 * The plugin then hooks into the grid via a tiny Plugin API (defined client-side).
 *
 * - `id` is a logical identifier for referencing the plugin in config and debugging.
 * - `moduleUrl` is an ES module URL used with dynamic import().
 * - `options` is arbitrary plugin configuration JSON.
 */
export type GridPluginRef = {
  readonly id: string;
  readonly moduleUrl?: string;
  readonly options?: unknown;
};

/**
 * Declarative UI hints for the client renderer.
 * Advanced behavior should still live in plugins; these flags are small and predictable.
 */
export type GridUiOptions = {
  readonly density?: "compact" | "comfortable";
  readonly zebra?: boolean;
  readonly rowSelection?: "none" | "single" | "multi";
  readonly tree?: {
    readonly enabled?: boolean;
    readonly expandByDefault?: boolean;
  };
  readonly toolbar?: {
    readonly enabled?: boolean;
  };
};

/**
 * Complete server-authored grid configuration.
 *
 * The server emits this configuration as JSON adjacent to the custom element.
 * The client reads it, loads plugins, loads data, then renders.
 */
export type GridSpec = {
  readonly id: GridId;
  readonly title?: string;
  readonly columns: readonly GridColumnDef[];
  readonly data: GridDataSource;
  readonly plugins?: readonly GridPluginRef[];
  readonly ui?: GridUiOptions;
  readonly attrs?: Attrs;
};

/**
 * UA dependency mount points for the grid client assets.
 *
 * You can mount these routes in your server and include them via ds.uaDependencies().
 * Keeping mount points stable helps caching and minimizes layout churn.
 */
export type GridMounts = {
  readonly jsMountPoint: string;
  readonly jsCanonicalSource: string;

  readonly cssMountPoint?: string;
  readonly cssCanonicalSource?: string;
};

/**
 * Normalize a grid id into a DOM-safe identifier.
 */
function stableGridId(id: string): string {
  return id.trim().replace(/\s+/g, "-");
}

/**
 * Deterministic id for the JSON config <script> element associated with the grid.
 */
function configScriptId(gridId: string): string {
  return `${gridId}__natural_grid_config`;
}

/**
 * Serialize the config payload in a stable way.
 * The object literal is built in a fixed field order to keep output predictable.
 */
function jsonForConfig(spec: GridSpec): string {
  const cfg = {
    id: spec.id,
    title: spec.title ?? "",
    ui: spec.ui ?? {},
    columns: spec.columns,
    data: spec.data,
    plugins: spec.plugins ?? [],
  };
  return JSON.stringify(cfg);
}

/**
 * Build UA dependency objects for the grid.
 *
 * Expected usage:
 * - Add these dependencies to your design system builder via ds.uaDependencies([...])
 * - Emit ds.uaHeadTags() in the page head
 *
 * grid.js must be loaded as a module so that the custom element can register itself.
 */
export function gridUaDependencies(
  mounts: GridMounts,
): readonly UaDependency[] {
  const deps: UaDependencyReference[] = [
    h.uaDepJsRef(mounts.jsMountPoint, mounts.jsCanonicalSource, {
      as: "module",
    }),
  ];
  if (mounts.cssMountPoint && mounts.cssCanonicalSource) {
    deps.unshift(
      h.uaDepCssRef(mounts.cssMountPoint, mounts.cssCanonicalSource, {
        as: "style",
      }),
    );
  }
  return deps;
}

/**
 * Render a grid custom element plus its config payload.
 *
 * Output structure (conceptually):
 * - <script id="{cfgId}" type="application/json">{...}</script>
 * - <natural-grid id="{gridId}" data-config-id="{cfgId}" ...></natural-grid>
 *
 * grid.js locates the config using the data-config-id attribute.
 */
export function grid(spec: GridSpec): RawHtml {
  const id = stableGridId(spec.id);
  const cfgId = configScriptId(id);

  const a: Attrs = h.attrs(
    { id, "data-natural-grid": "1", "data-config-id": cfgId },
    spec.title ? { "aria-label": spec.title } : null,
    spec.ui?.density ? { "data-density": spec.ui.density } : null,
    spec.ui?.zebra ? { "data-zebra": "1" } : null,
    spec.ui?.rowSelection ? { "data-selection": spec.ui.rowSelection } : null,
    spec.ui?.tree?.enabled ? { "data-tree": "1" } : null,
    spec.attrs ?? null,
  );

  const cfgJson = jsonForConfig(spec);
  const cfgScript = h.script(
    { id: cfgId, type: "application/json" },
    h.trustedRawFriendly`
${cfgJson}`,
  );

  const element = h.customElement("natural-grid")(
    a,
    spec.title ? h.div({ slot: "fallback" }, spec.title) : null,
  );
  return combineHast(cfgScript, element);
}

/**
 * Local RawHtml combiner to avoid importing patterns.ts.
 * Produces a single RawHtml with merged node lists and concatenated raw HTML.
 */
function combineHast(...parts: RawHtml[]): RawHtml {
  const nodes = parts.flatMap((p) => p.__nodes ?? []);
  const raw = parts.map((p) => p.__rawHtml).join("");
  return { __rawHtml: raw, __nodes: nodes };
}

/**
 * Fluent grid builder.
 *
 * Why a builder:
 * - Keeps usage ergonomic and readable
 * - Enforces basic validity before render/build
 * - Still preserves type-safety since the output is a plain GridSpec
 *
 * This intentionally does not attempt to become a “DSL” or hide the underlying model.
 */
export class GridBuilder {
  #id: string;
  #title?: string;
  #columns: GridColumnDef[] = [];
  #data?: GridDataSource;
  #plugins: GridPluginRef[] = [];
  #ui: GridUiOptions = {};
  #attrs: Attrs = {};

  /** Create a builder for a given grid id. */
  constructor(id: string) {
    this.#id = stableGridId(id);
  }

  /** Optional display title. */
  title(value: string): this {
    this.#title = value;
    return this;
  }

  /** Replace all columns at once. */
  columns(cols: readonly GridColumnDef[]): this {
    this.#columns = [...cols];
    return this;
  }

  /** Add a single column. */
  addColumn(col: GridColumnDef): this {
    this.#columns.push(col);
    return this;
  }

  /** Use a static, server-provided snapshot (embedded JSON). */
  staticData(snapshot: GridDataSnapshot): this {
    this.#data = { kind: "static", snapshot };
    return this;
  }

  /** Use an HTTP endpoint that returns a snapshot-like JSON payload. */
  fetchData(
    url: string,
    opts: Omit<Extract<GridDataSource, { kind: "fetch" }>, "kind" | "url"> = {},
  ): this {
    this.#data = { kind: "fetch", url, ...opts };
    return this;
  }

  /** Use an SSE endpoint emitting snapshots or incremental update messages. */
  sseData(
    url: string,
    opts: Omit<Extract<GridDataSource, { kind: "sse" }>, "kind" | "url"> = {},
  ): this {
    this.#data = { kind: "sse", url, ...opts };
    return this;
  }

  /** Merge UI hints. Nested objects merge shallowly. */
  ui(ui: GridUiOptions): this {
    this.#ui = {
      ...this.#ui,
      ...ui,
      tree: { ...this.#ui.tree, ...ui.tree },
      toolbar: { ...this.#ui.toolbar, ...ui.toolbar },
    };
    return this;
  }

  /** Add a plugin reference. */
  plugin(p: GridPluginRef): this {
    this.#plugins.push(p);
    return this;
  }

  /** Merge extra attributes onto the <natural-grid> element. */
  attrs(a: Attrs): this {
    this.#attrs = h.attrs(this.#attrs, a);
    return this;
  }

  /**
   * Build the final GridSpec.
   * Throws for missing required fields to keep illegal states out of runtime.
   */
  build(): GridSpec {
    if (this.#columns.length === 0) throw new Error("grid: missing columns");
    if (!this.#data) throw new Error("grid: missing data source");
    return {
      id: this.#id,
      title: this.#title,
      columns: this.#columns,
      data: this.#data,
      plugins: this.#plugins,
      ui: this.#ui,
      attrs: this.#attrs,
    };
  }

  /** Convenience: build + render to RawHtml in one call. */
  render(): RawHtml {
    return grid(this.build());
  }
}

/**
 * Create a fluent GridBuilder.
 * This is the preferred ergonomic entrypoint for server-side construction.
 */
export function createGrid(id: string): GridBuilder {
  return new GridBuilder(id);
}
