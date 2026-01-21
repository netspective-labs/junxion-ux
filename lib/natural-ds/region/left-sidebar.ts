import {
  defineRegion,
  NamingStrategy,
  RenderCtx,
  slots,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import type { RenderInput } from "../shared.ts";

export const leftSidebarRegion = defineRegion({
  name: "LeftSidebar",
  slots: slots({
    required: ["content"] as const,
  }),
  render: (ctx: RenderCtx<RenderInput, NamingStrategy>, s) =>
    h.aside(
      {
        class: "left-sidebar",
        style: ctx.css({
          position: "fixed",
          top: "var(--context-header-height)",
          left: 0,
          width: "280px",
          height: "calc(100vh - var(--context-header-height))",
          background: "#ffffff",
          borderRight: "1px solid #e5e5e5",
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }),
      },
      s.content(ctx),
    ),
});
