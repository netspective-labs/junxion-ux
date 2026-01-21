import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContent, type RenderInput } from "./shared.ts";
import { sidebarStyles } from "./sidebar-styles.ts";

export type SearchBarProps<Ctx extends object = RenderInput> = {
  readonly placeholder: string;
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly shortcut?: readonly string[];
};

export const searchBar = defineComponent<SearchBarProps, RenderInput>(
  "SearchBar",
  sidebarStyles,
  (ctx, props) => {
    const shortcut = props.shortcut ?? ["Cmd", "K"];
    return h.div(
      { class: ctx.cls("search-bar") },
      h.div(
        { class: ctx.cls("search-left") },
        renderContent(ctx, props.icon),
        h.span({ class: ctx.cls("search-placeholder") }, props.placeholder),
      ),
      h.div(
        { class: ctx.cls("search-shortcut") },
        ...shortcut.map((key) => h.kbd({ class: ctx.cls("kbd") }, key)),
      ),
    );
  },
);
