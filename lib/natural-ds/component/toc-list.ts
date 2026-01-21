import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContent, type RenderInput } from "./shared.ts";
import { tocStyles } from "./toc-styles.ts";

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
