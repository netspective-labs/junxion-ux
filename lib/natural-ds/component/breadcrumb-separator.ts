import { defineComponent } from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type RenderInput } from "./shared.ts";
import { breadcrumbStyles } from "./breadcrumb-styles.ts";

export const breadcrumbSeparator = defineComponent<
  Record<PropertyKey, never>,
  RenderInput
>(
  "BreadcrumbSeparator",
  breadcrumbStyles,
  () => h.span({ class: "breadcrumb-separator", "aria-hidden": "true" }),
);
