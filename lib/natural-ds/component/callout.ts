import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContent, type RenderInput } from "./shared.ts";
import { contentStyles } from "./content-styles.ts";

export type CalloutProps<Ctx extends object = RenderInput> = {
  readonly title: string;
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly content: Content<Ctx, NamingStrategy>;
  readonly variant?: "info" | "tip" | "default";
};

export const callout = defineComponent<CalloutProps, RenderInput>(
  "Callout",
  contentStyles,
  (ctx, props) =>
    h.div(
      {
        class: ctx.cls(
          "callout",
          props.variant && props.variant !== "default" ? props.variant : null,
        ),
      },
      h.div(
        { class: ctx.cls("callout-header") },
        renderContent(ctx, props.icon),
        h.span(props.title),
      ),
      h.div(
        { class: ctx.cls("callout-content") },
        renderContent(ctx, props.content),
      ),
    ),
);
