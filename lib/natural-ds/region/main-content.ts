import {
  defineRegion,
  NamingStrategy,
  RenderCtx,
  slots,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import type { RenderInput } from "../shared.ts";

export const mainContentRegion = defineRegion({
  name: "MainContent",
  slots: slots({
    required: ["content"] as const,
  }),
  render: (ctx: RenderCtx<RenderInput, NamingStrategy>, s) =>
    h.main(
      {
        class: "main-content",
        style: ctx.css({
          gridColumn: "2",
          gridRow: "3",
          padding: "24px 24px 40px 24px",
        }),
      },
      h.div({ class: "content-wrapper" }, s.content(ctx)),
    ),
});
