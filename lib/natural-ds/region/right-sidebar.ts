import {
  defineRegion,
  NamingStrategy,
  RenderCtx,
  slots,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import type { RenderInput } from "../../natural-html/patterns.ts";

export const rightSidebarRegion = defineRegion({
  name: "RightSidebar",
  slots: slots({
    required: ["content"] as const,
  }),
  render: (ctx: RenderCtx<RenderInput, NamingStrategy>, s) =>
    h.aside(
      {
        class: "right-sidebar",
        style: ctx.css({
          position: "fixed",
          top:
            "calc(var(--context-header-height) + var(--breadcrumb-row-height))",
          right: 0,
          width: "200px",
          height:
            "calc(100vh - (var(--context-header-height) + var(--breadcrumb-row-height)))",
          padding: "24px 20px",
          overflowY: "auto",
        }),
      },
      s.content(ctx),
    ),
});
