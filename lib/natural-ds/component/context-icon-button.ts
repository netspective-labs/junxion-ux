import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContent, type RenderInput } from "./shared.ts";
import { contextHeaderStyles } from "./context-header-styles.ts";

export type ContextIconButtonProps<Ctx extends object = RenderInput> = {
  readonly label: string;
  readonly icon: Content<Ctx, NamingStrategy>;
  readonly badge?: boolean;
};

export const contextIconButton = defineComponent<
  ContextIconButtonProps,
  RenderInput,
  NamingStrategy
>(
  "ContextIconButton",
  contextHeaderStyles,
  (ctx, props) =>
    h.button(
      { class: ctx.cls("context-icon-btn"), "aria-label": props.label },
      renderContent(ctx, props.icon),
      props.badge ? h.span({ class: ctx.cls("notification-badge") }) : null,
    ),
);
