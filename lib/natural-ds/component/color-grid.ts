import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContents, type RenderInput } from "./shared.ts";
import { contentStyles } from "./content-styles.ts";

export type ColorGridProps<Ctx extends object = RenderInput> = {
  readonly swatches: readonly Content<Ctx, NamingStrategy>[];
};

export const colorGrid = defineComponent<ColorGridProps, RenderInput>(
  "ColorGrid",
  contentStyles,
  (ctx, props) =>
    h.div(
      { class: ctx.cls("color-grid") },
      ...renderContents(ctx, props.swatches),
    ),
);
