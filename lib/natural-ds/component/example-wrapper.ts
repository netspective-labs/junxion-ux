import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContent, type RenderInput } from "./shared.ts";
import { contentStyles } from "./content-styles.ts";

export type ExampleWrapperProps<Ctx extends object = RenderInput> = {
  readonly label: string;
  readonly content: Content<Ctx, NamingStrategy>;
};

export const exampleWrapper = defineComponent<
  ExampleWrapperProps,
  RenderInput
>(
  "ExampleWrapper",
  contentStyles,
  (ctx, props) =>
    h.div(
      { class: ctx.cls("example-wrapper") },
      h.div({ class: ctx.cls("example-label") }, props.label),
      h.div(
        { class: ctx.cls("example-content") },
        renderContent(ctx, props.content),
      ),
    ),
);
