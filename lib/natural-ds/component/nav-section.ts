import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContents, type RenderInput } from "./shared.ts";
import { sidebarStyles } from "./sidebar-styles.ts";

export type NavSectionProps<Ctx extends object = RenderInput> = {
  readonly children: readonly Content<Ctx, NamingStrategy>[];
};

export const navSection = defineComponent<NavSectionProps, RenderInput>(
  "NavSection",
  sidebarStyles,
  (ctx, props) =>
    h.nav(
      { class: ctx.cls("nav-section") },
      ...renderContents(ctx, props.children),
    ),
);
