import { defineComponent } from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type RenderInput } from "./shared.ts";
import { contentStyles } from "./content-styles.ts";

export type BadgeProps = {
  readonly label: string;
  readonly variant?: string;
};

export const badge = defineComponent<BadgeProps, RenderInput>(
  "Badge",
  contentStyles,
  (_ctx, props) =>
    h.span(
      {
        class: `badge${props.variant ? ` badge-${props.variant}` : ""}${
          props.variant ? ` ${props.variant}` : ""
        }`,
      },
      props.label,
    ),
);
