import { defineComponent } from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type RenderInput } from "./shared.ts";
import { contentStyles } from "./content-styles.ts";

export type SectionHeadingProps = {
  readonly title: string;
  readonly href?: string;
};

export const sectionHeading = defineComponent<SectionHeadingProps, RenderInput>(
  "SectionHeading",
  contentStyles,
  (ctx, props) =>
    h.h2(
      { class: ctx.cls("section-heading") },
      props.title,
      h.a(
        { class: ctx.cls("anchor-link"), href: props.href ?? "#" },
        "#",
      ),
    ),
);
