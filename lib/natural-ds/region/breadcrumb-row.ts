import {
  defineRegion,
  NamingStrategy,
  RenderCtx,
  slots,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import type { RenderInput } from "../../natural-html/patterns.ts";

export const breadcrumbRowRegion = defineRegion({
  name: "BreadcrumbRow",
  slots: slots({
    required: ["crumbs"] as const,
  }),
  render: (ctx: RenderCtx<RenderInput, NamingStrategy>, s) =>
    h.nav(
      {
        class: "breadcrumb-row",
        "aria-label": "Breadcrumb",
        style: ctx.css({
          gridColumn: "2 / 4",
          gridRow: "2",
          position: "sticky",
          top: "var(--context-header-height)",
          zIndex: 100,
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderBottom: "1px solid #e5e5e5",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }),
      },
      s.crumbs(ctx),
    ),
});
