TODO:

- [ ] add playwright tests to validate custom element
- [ ] resizable columns with cookies to remember by URL, params, ID
- [ ] cookies should remember sort setting
- [ ] per column sorting like in DataTable

---

Most common grid features (as seen across AG Grid, DataTables, TanStack Table,
Handsontable, and the usual “serious grid” ecosystem) cluster into a pretty
repeatable set. You can treat these as plugin-pack candidates and keep core
extremely small. ([TanStack][1])

Typical grid pack (what almost everyone expects)

1. Sorting (single, multi-column). Often type-aware. ([TanStack][1])
2. Filtering: column filters + global search, plus “fuzzy search” as a nicer
   upgrade. ([TanStack][2])
3. Pagination (client and server/manual). ([TanStack][2])
4. Column controls: visibility toggles, reordering, resizing, pinning/sticky.
   (DataTables does this via extensions; TanStack has dedicated features.)
   ([TanStack][2])
5. Row selection (single/multi), including “select all visible” patterns.
   ([TanStack][2])
6. Virtualization for large row counts and/or many columns (performance becomes
   table-stakes once you claim “grid”). ([TanStack][2])
7. Export: CSV is “typical”, Excel tends to be “enterprise”. ([Handsontable][3])
8. Responsive behavior: collapsing columns or switching to a “row details”
   presentation on small screens. ([rstudio.github.io][4])
9. Fixed header/footer and scrolling. ([DataTables][5])

Enterprise grid pack (things that usually justify paid tiers or heavier
engineering)

1. Grouping, aggregation, subtotals, group expand/collapse (and group-aware
   sort/filter). ([TanStack][1])
2. Pivoting (and pivot-aware aggregation). (AG Grid puts this in the “big grid”
   category.) ([AG Grid][6])
3. Multiple row models / server-side data model integration patterns
   (client-side vs server-side/infinite). ([AG Grid][6])
4. Master-detail rows (row expansion showing nested grids or detail panes).
   ([AG Grid][7])
5. Advanced export: Excel export with fidelity and options like “export selected
   rows”, preserving sort/filter/visibility state. ([AG Grid][8])
6. Advanced editing: rich editors, validation, copy/paste, clipboard, fill
   handle, undo/redo. (Handsontable lives here.) ([Handsontable][9])
7. Spreadsheet-like capabilities: formulas/calculation engines.
   ([Handsontable][10])
8. Row/column pinning, row pinning, “row details” panels, and stateful UI
   customization. ([TanStack][2])
9. Column faceting and analytics-style helpers (facets, counts, quick filters).
   ([TanStack][2])

A clean plugin-pack plan for your architecture “Typical Pack”

- sort (client-side, multi-sort)
- filter (global + per-column basic)
- pagination (client + “manual” server mode)
- column tools (visibility toggle + resizing; reordering optional)
- selection
- virtualization (rows first; columns later)
- csv export
- responsive + fixed header (either in one “layout” plugin or separate)

“Enterprise Pack”

- grouping + aggregations
- pivot mode
- server-side row model adapters (cursor/infinite, and “server-side grouping”
  later)
- master-detail
- excel export
- advanced editing + validation + clipboard
- formulas (optional separate “spreadsheet pack”)

Tree/hierarchical data: core vs plugin You already have a simple tree flatten +
indentation and an expander glyph. That’s fine to keep in core if you define
“tree support” as: render nested children with indent, and allow
expand/collapse. It’s also aligned with what many grids treat as a first-class
display mode (tree data and master/detail coexist in enterprise grids).
([AG Grid][7])

What I’d do in your system:

- Keep hierarchical rendering in core (because it’s mostly a render concern and
  your data model already supports children).
- Make “tree behavior” a grid-functionality plugin: expand/collapse state, click
  handlers, “expand all/collapse all” toolbar items, optional lazy-loading of
  children (which becomes content-supplier integration). That split keeps core
  small but ensures trees feel fully featured without hardwiring interactions
  into the base renderer.

So: core handles nested rows structurally; plugins handle interaction, state
management, and advanced tree features (keyboard nav, lazy child fetch, tree
filtering semantics, “show only matches with ancestors”, etc.).

[1]: https://tanstack.com/table?utm_source=chatgpt.com "TanStack Table"
[2]: https://tanstack.com/table/v8/docs/guide/features?utm_source=chatgpt.com "Features Guide | TanStack Table Docs"
[3]: https://handsontable.com/docs/javascript-data-grid/export-to-csv/?utm_source=chatgpt.com "Export to CSV - JavaScript Data Grid"
[4]: https://rstudio.github.io/DT/extensions.html?utm_source=chatgpt.com "DataTables Extensions"
[5]: https://datatables.net/extensions/fixedheader/?utm_source=chatgpt.com "FixedHeader"
[6]: https://www.ag-grid.com/javascript-data-grid/row-models/?utm_source=chatgpt.com "JavaScript Grid: Row Models"
[7]: https://www.ag-grid.com/javascript-data-grid/master-detail-other/?utm_source=chatgpt.com "JavaScript Grid: Master / Detail - Other"
[8]: https://www.ag-grid.com/javascript-data-grid/excel-export/?utm_source=chatgpt.com "JavaScript Grid: Excel Export"
[9]: https://handsontable.com/docs/14.6/react-data-grid/cell-editor/?utm_source=chatgpt.com "React Data Grid - Cell editor"
[10]: https://handsontable.com/docs/react-data-grid/formula-calculation/?utm_source=chatgpt.com "React Data Grid - Formula calculation"
