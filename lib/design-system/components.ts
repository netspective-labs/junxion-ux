import {
  defineComponent,
  NamingStrategy,
  SlotBuilder,
} from "../universal/fluent-ds.ts";
import * as h from "../universal/fluent-html.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

export type CardProps<Ctx extends object = Record<PropertyKey, never>> = {
  readonly title?: string;
  readonly subtitle?: string;
  readonly headerRight?: SlotBuilder<Ctx, NamingStrategy>;
  readonly body: SlotBuilder<Ctx, NamingStrategy>;
  readonly footer?: SlotBuilder<Ctx, NamingStrategy>;
  readonly class?: string;
};

export const card = defineComponent<CardProps<Any>, Any, NamingStrategy>(
  "Card",
  (ctx, props) => {
    const head = props.title || props.subtitle || props.headerRight;
    const elementId = ctx.naming.elemIdValue("Card", "component");
    const elementIdAttr = ctx.naming.elemDataAttr(
      "element-id",
      elementId,
      "component",
    );
    return h.section(
      {
        class: ctx.cls("card", props.class),
        [elementIdAttr]: elementId,
      },
      head
        ? h.div(
          { class: ctx.cls("card__header") },
          h.div(
            { class: ctx.cls("card__heading") },
            props.title
              ? h.div({ class: ctx.cls("card__title") }, props.title)
              : null,
            props.subtitle
              ? h.div({ class: ctx.cls("card__subtitle") }, props.subtitle)
              : null,
          ),
          props.headerRight
            ? h.div(
              { class: ctx.cls("card__headerRight") },
              props.headerRight(ctx),
            )
            : null,
        )
        : null,
      h.div({ class: ctx.cls("card__body") }, props.body(ctx)),
      props.footer
        ? h.div({ class: ctx.cls("card__footer") }, props.footer(ctx))
        : null,
    );
  },
);

export type Breadcrumb = { readonly label: string; readonly href?: string };

export const breadcrumbs = defineComponent<
  { readonly items: readonly Breadcrumb[] },
  Any,
  NamingStrategy
>(
  "Breadcrumbs",
  (ctx, props) => {
    const elementId = ctx.naming.elemIdValue("Breadcrumbs", "component");
    const elementIdAttr = ctx.naming.elemDataAttr(
      "element-id",
      elementId,
      "component",
    );
    return h.nav(
      {
        class: ctx.cls("breadcrumbs"),
        "aria-label": "Breadcrumb",
        [elementIdAttr]: elementId,
      },
      h.ol(
        { class: ctx.cls("breadcrumbs__list") },
        h.each(props.items, (it, i) =>
          h.li(
            { class: ctx.cls("breadcrumbs__item") },
            it.href
              ? h.a(
                { href: it.href, class: ctx.cls("breadcrumbs__link") },
                it.label,
              )
              : h.span(it.label),
            i < props.items.length - 1
              ? h.span({ class: ctx.cls("breadcrumbs__sep") }, "/")
              : null,
          )),
      ),
    );
  },
);
