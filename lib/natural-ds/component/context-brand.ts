import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContent, type RenderInput } from "./shared.ts";
import { contextHeaderStyles } from "./context-header-styles.ts";

export type ContextBrandProps<Ctx extends object = RenderInput> = {
  readonly label: string;
  readonly href?: string;
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly iconText?: string;
};

export const contextBrand = defineComponent<
  ContextBrandProps,
  RenderInput,
  NamingStrategy
>(
  "ContextBrand",
  contextHeaderStyles,
  (ctx, props) => {
    const icon = renderContent(ctx, props.icon) ??
      h.text(props.iconText ?? "DS");
    return h.a(
      { href: props.href ?? "#", class: ctx.cls("context-brand") },
      h.span({ class: ctx.cls("context-brand-icon") }, icon),
      h.span(props.label),
    );
  },
);
