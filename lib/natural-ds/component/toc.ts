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

const tocStyles: ComponentStylesheets = [
  {
    "toc-title": {
      fontSize: "11px",
      fontWeight: 600,
      color: "#737373",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      marginBottom: "16px",
    },
    "toc-list": {
      listStyle: "none",
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      position: "relative",
      paddingLeft: "0",
      marginLeft: "0",
    },
    "toc-link": {
      display: "block",
      fontSize: "13px",
      color: "#525252",
      textDecoration: "none",
      padding: "6px 0 6px 16px",
      position: "relative",
      borderLeft: "1px solid #e5e5e5",
      marginLeft: "0",
    },
    "toc-link-active": {
      color: "#d97706",
      fontWeight: 500,
      borderLeft: "2px solid #f97316",
      paddingLeft: "15px",
    },
    "toc-link-nested": {
      paddingLeft: "28px",
      fontSize: "12px",
      color: "#737373",
    },
    "toc-link-nested-active": {
      color: "#d97706",
      paddingLeft: "27px",
    },
  },
];

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

export type TocListProps<Ctx extends object = RenderInput> = {
  readonly title: string;
  readonly items: readonly Content<Ctx, NamingStrategy>[];
};

export const tocList = defineComponent<TocListProps, RenderInput>(
  "TocList",
  tocStyles,
  (ctx, props) =>
    h.div(
      {},
      h.div({ class: ctx.cls("toc-title") }, props.title),
      h.ul(
        { class: ctx.cls("toc-list") },
        ...props.items.map((item) => h.li(renderContent(ctx, item))),
      ),
    ),
);
