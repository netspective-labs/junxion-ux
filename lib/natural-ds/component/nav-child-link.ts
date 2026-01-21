import { defineComponent } from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type RenderInput } from "./shared.ts";
import { sidebarStyles } from "./sidebar-styles.ts";

export type NavChildLinkProps = {
  readonly label: string;
  readonly href?: string;
  readonly active?: boolean;
};

export const navChildLink = defineComponent<NavChildLinkProps, RenderInput>(
  "NavChildLink",
  sidebarStyles,
  (_ctx, props) =>
    h.a(
      {
        class: props.active
          ? "nav-child-link nav-child-link-active active"
          : "nav-child-link",
        href: props.href ?? "#",
      },
      props.label,
    ),
);
