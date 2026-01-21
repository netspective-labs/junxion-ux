import { defineComponent } from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type RenderInput } from "./shared.ts";
import { contentStyles } from "./content-styles.ts";
import { type SectionHeadingProps } from "./section-heading.ts";

export const subsectionHeading = defineComponent<
  SectionHeadingProps,
  RenderInput
>(
  "SubsectionHeading",
  contentStyles,
  (ctx, props) => h.h3({ class: ctx.cls("subsection-heading") }, props.title),
);
