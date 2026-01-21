import {
  defineRegion,
  NamingStrategy,
  RenderCtx,
  slots,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import type { RenderInput } from "../shared.ts";

export const contextHeaderRegion = defineRegion({
  name: "ContextHeader",
  slots: slots({
    required: ["content"] as const,
  }),
  render: (ctx: RenderCtx<RenderInput, NamingStrategy>, s) =>
    h.header(
      {
        class: "context-header",
        style: ctx.css({
          gridColumn: "1 / -1",
          gridRow: "1",
          position: "sticky",
          top: 0,
          zIndex: 200,
          background: "#0a0a0a",
          height: "48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          borderBottom: "1px solid #262626",
        }),
      },
      s.content(ctx),
    ),
});
