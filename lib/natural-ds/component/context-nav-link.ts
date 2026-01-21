import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContent, type RenderInput } from "./shared.ts";
import { contextHeaderStyles } from "./context-header-styles.ts";

export type ContextNavLinkProps<Ctx extends object = RenderInput> = {
  readonly label: string;
  readonly href?: string;
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly active?: boolean;
};

export const contextNavLink = defineComponent<
  ContextNavLinkProps,
  RenderInput,
  NamingStrategy
>(
  "ContextNavLink",
  contextHeaderStyles,
  (ctx, props) => {
    const icon = renderContent(ctx, props.icon);
    return h.a(
      {
        href: props.href ?? "#",
        class: ctx.cls(
          "context-nav-link",
          props.active ? "context-nav-link-active" : null,
          props.active ? "active" : null,
        ),
      },
      icon,
      h.span(props.label),
    );
  },
);
