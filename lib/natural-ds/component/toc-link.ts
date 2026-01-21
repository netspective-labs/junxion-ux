import { defineComponent } from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type RenderInput } from "./shared.ts";
import { tocStyles } from "./toc-styles.ts";

export type TocLinkProps = {
  readonly label: string;
  readonly href?: string;
  readonly nested?: boolean;
  readonly active?: boolean;
};

export const tocLink = defineComponent<TocLinkProps, RenderInput>(
  "TocLink",
  tocStyles,
  (ctx, props) =>
    h.a(
      {
        class: ctx.cls(
          "toc-link",
          props.nested ? "nested" : null,
          props.nested ? "toc-link-nested" : null,
          props.active ? "active" : null,
        ),
        href: props.href ?? "#",
      },
      props.label,
    ),
);
