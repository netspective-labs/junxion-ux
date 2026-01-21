import { defineComponent } from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type RenderInput } from "./shared.ts";
import { sidebarStyles } from "./sidebar-styles.ts";

export type NavCategoryProps = {
  readonly label: string;
};

export const navCategory = defineComponent<NavCategoryProps, RenderInput>(
  "NavCategory",
  sidebarStyles,
  (_ctx, props) => h.div({ class: "nav-category" }, props.label),
);
