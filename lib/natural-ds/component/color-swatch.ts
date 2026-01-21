import { defineComponent } from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { normalizeTabId, type RenderInput } from "./shared.ts";
import { contentStyles } from "./content-styles.ts";

export type ColorSwatchProps = {
  readonly name: string;
  readonly value: string;
};

export const colorSwatch = defineComponent<ColorSwatchProps, RenderInput>(
  "ColorSwatch",
  contentStyles,
  (ctx, props) => {
    const previewId = ctx.naming.elemIdValue(
      `color-preview-${normalizeTabId(props.name)}-${
        normalizeTabId(props.value)
      }`,
      "component",
    );
    return h.div(
      { class: "color-swatch" },
      h.div({
        class: "color-preview",
        id: previewId,
        style: `background: ${props.value}`,
      }),
      h.div(
        { class: "color-info" },
        h.div({ class: "color-name" }, props.name),
        h.div({ class: "color-value" }, props.value),
      ),
    );
  },
);
