import {
  type ComponentStylesheets,
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import {
  type Content,
  renderContent,
  type RenderInput,
} from "../../natural-html/patterns.ts";

const breadcrumbStyles: ComponentStylesheets = [
  {
    "breadcrumb-item": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "13px",
      color: "#525252",
      textDecoration: "none",
      transition: "color 0.15s ease",
    },
    "breadcrumb-separator-icon": {
      width: "14px",
      height: "14px",
    },
    "breadcrumb-item-home": {
      color: "#737373",
    },
    "breadcrumb-item-current": {
      color: "#0a0a0a",
      fontWeight: 500,
      cursor: "default",
    },
    "breadcrumb-separator": {
      color: "#d4d4d4",
      display: "flex",
      alignItems: "center",
    },
  },
];

export type BreadcrumbItemProps<Ctx extends object = RenderInput> = {
  readonly label?: string;
  readonly href?: string;
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly current?: boolean;
  readonly home?: boolean;
};

export const breadcrumbItem = defineComponent<
  BreadcrumbItemProps,
  RenderInput
>(
  "BreadcrumbItem",
  breadcrumbStyles,
  (ctx, props) => {
    const icon = renderContent(ctx, props.icon);
    const className = ctx.cls(
      "breadcrumb-item",
      props.home ? "breadcrumb-item-home" : null,
      props.current ? "breadcrumb-item-current" : null,
    );
    if (props.current) {
      return h.span(
        { class: className, "aria-current": "page" },
        icon,
        props.label,
      );
    }
    return h.a(
      { class: className, href: props.href ?? "#" },
      icon,
      props.label,
    );
  },
);

export const breadcrumbSeparator = defineComponent<
  Record<PropertyKey, never>,
  RenderInput
>(
  "BreadcrumbSeparator",
  breadcrumbStyles,
  () => h.span({ class: "breadcrumb-separator", "aria-hidden": "true" }),
);
