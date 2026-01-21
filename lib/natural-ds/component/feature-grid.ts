import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContents, type RenderInput } from "./shared.ts";
import { contentStyles } from "./content-styles.ts";

export type FeatureGridProps<Ctx extends object = RenderInput> = {
  readonly cards: readonly Content<Ctx, NamingStrategy>[];
};

export const featureGrid = defineComponent<FeatureGridProps, RenderInput>(
  "FeatureGrid",
  contentStyles,
  (ctx, props) =>
    h.div(
      { class: ctx.cls("feature-grid") },
      ...renderContents(ctx, props.cards),
    ),
);
