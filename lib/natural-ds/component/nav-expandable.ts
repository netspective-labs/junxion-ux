import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import {
  type Content,
  renderContent,
  renderContents,
  type RenderInput,
} from "./shared.ts";
import { sidebarStyles } from "./sidebar-styles.ts";

export type NavExpandableProps<Ctx extends object = RenderInput> = {
  readonly label: string;
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly chevron?: Content<Ctx, NamingStrategy>;
  readonly expanded?: boolean;
  readonly children: readonly Content<Ctx, NamingStrategy>[];
};

export const navExpandable = defineComponent<
  NavExpandableProps,
  RenderInput
>(
  "NavExpandable",
  sidebarStyles,
  (ctx, props) =>
    h.div(
      { class: ctx.cls("nav-expandable") },
      h.button(
        {
          class: ctx.cls("nav-toggle"),
          "aria-expanded": props.expanded ? "true" : "false",
        },
        renderContent(ctx, props.icon),
        h.span(props.label),
        renderContent(ctx, props.chevron),
      ),
      h.div(
        {
          class: ctx.cls("nav-children"),
          style: ctx.css({ display: props.expanded ? "flex" : "none" }),
        },
        ...renderContents(ctx, props.children),
      ),
    ),
);
