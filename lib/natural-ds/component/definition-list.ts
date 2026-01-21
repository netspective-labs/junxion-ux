import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContents, type RenderInput } from "./shared.ts";
import { contentStyles } from "./content-styles.ts";

export type DefinitionListProps<Ctx extends object = RenderInput> = {
  readonly items: readonly Content<Ctx, NamingStrategy>[];
};

export const definitionList = defineComponent<
  DefinitionListProps,
  RenderInput
>(
  "DefinitionList",
  contentStyles,
  (ctx, props) =>
    h.div(
      { class: ctx.cls("definition-list") },
      ...renderContents(ctx, props.items),
    ),
);
