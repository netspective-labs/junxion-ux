import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContent, type RenderInput } from "./shared.ts";
import { sidebarStyles } from "./sidebar-styles.ts";

export type NavLinkProps<Ctx extends object = RenderInput> = {
  readonly label: string;
  readonly href?: string;
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly active?: boolean;
};

export const navLink = defineComponent<NavLinkProps, RenderInput>(
  "NavLink",
  sidebarStyles,
  (ctx, props) =>
    h.a(
      {
        class: ctx.cls(
          "nav-link",
          props.active ? "nav-link-active" : null,
          props.active ? "active" : null,
        ),
        href: props.href ?? "#",
      },
      renderContent(ctx, props.icon),
      h.span(props.label),
    ),
);
