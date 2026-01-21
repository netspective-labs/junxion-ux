import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContent, type RenderInput } from "./shared.ts";
import { contentStyles } from "./content-styles.ts";

export type DefinitionItemProps<Ctx extends object = RenderInput> = {
  readonly term: string;
  readonly description: Content<Ctx, NamingStrategy>;
};

export const definitionItem = defineComponent<
  DefinitionItemProps,
  RenderInput
>(
  "DefinitionItem",
  contentStyles,
  (ctx, props) =>
    h.div(
      { class: ctx.cls("definition-item") },
      h.div({ class: ctx.cls("definition-term") }, props.term),
      h.div(
        { class: ctx.cls("definition-desc") },
        renderContent(ctx, props.description),
      ),
    ),
);
