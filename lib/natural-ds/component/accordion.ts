import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContent, type RenderInput } from "./shared.ts";
import { contentStyles } from "./content-styles.ts";

export type AccordionItemProps<Ctx extends object = RenderInput> = {
  readonly title: string;
  readonly content: Content<Ctx, NamingStrategy>;
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly open?: boolean;
};

export type AccordionProps<Ctx extends object = RenderInput> = {
  readonly items: readonly AccordionItemProps<Ctx>[];
};

export const accordion = defineComponent<AccordionProps, RenderInput>(
  "Accordion",
  contentStyles,
  (ctx, props) =>
    h.div(
      { class: ctx.cls("accordion") },
      ...props.items.map((item) =>
        h.div(
          { class: ctx.cls("accordion-item", item.open ? "open" : null) },
          h.div(
            { class: ctx.cls("accordion-header") },
            h.span({ class: ctx.cls("accordion-title") }, item.title),
            item.icon
              ? h.span(
                { class: ctx.cls("accordion-icon") },
                renderContent(ctx, item.icon),
              )
              : null,
          ),
          h.div(
            { class: ctx.cls("accordion-content") },
            renderContent(ctx, item.content),
          ),
        )
      ),
    ),
);
