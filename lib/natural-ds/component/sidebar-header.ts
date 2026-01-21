import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContent, type RenderInput } from "./shared.ts";
import { sidebarStyles } from "./sidebar-styles.ts";

export type SidebarHeaderProps<Ctx extends object = RenderInput> = {
  readonly label: string;
  readonly href?: string;
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly iconText?: string;
  readonly toggleIcon?: Content<Ctx, NamingStrategy>;
};

export const sidebarHeader = defineComponent<
  SidebarHeaderProps,
  RenderInput
>(
  "SidebarHeader",
  sidebarStyles,
  (ctx, props) =>
    h.div(
      { class: ctx.cls("sidebar-header") },
      h.a(
        { class: ctx.cls("logo"), href: props.href ?? "#" },
        h.span(
          { class: ctx.cls("logo-icon") },
          renderContent(ctx, props.icon) ?? h.text(props.iconText ?? "DS"),
        ),
        h.span(props.label),
      ),
      h.button(
        { class: ctx.cls("theme-toggle"), "aria-label": "Toggle theme" },
        renderContent(ctx, props.toggleIcon),
      ),
    ),
);
