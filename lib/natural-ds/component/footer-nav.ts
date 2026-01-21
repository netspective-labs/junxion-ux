import { defineComponent } from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type RenderInput } from "./shared.ts";
import { contentStyles } from "./content-styles.ts";

export type FooterNavProps<Ctx extends object = RenderInput> = {
  readonly previous?: {
    readonly label: string;
    readonly title: string;
    readonly href?: string;
  };
  readonly next?: {
    readonly label: string;
    readonly title: string;
    readonly href?: string;
  };
};

export const footerNav = defineComponent<FooterNavProps, RenderInput>(
  "FooterNav",
  contentStyles,
  (_ctx, props) =>
    h.div(
      { class: "footer-nav" },
      props.previous
        ? h.a(
          { class: "footer-link prev", href: props.previous.href ?? "#" },
          h.span({ class: "footer-label" }, props.previous.label),
          h.span({ class: "footer-title" }, props.previous.title),
        )
        : null,
      props.next
        ? h.a(
          { class: "footer-link next", href: props.next.href ?? "#" },
          h.span({ class: "footer-label" }, props.next.label),
          h.span({ class: "footer-title" }, props.next.title),
        )
        : null,
    ),
);
