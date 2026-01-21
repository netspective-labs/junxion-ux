import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import {
  combineHast,
  type Content,
  renderContent,
  renderContents,
  type RenderInput,
} from "./shared.ts";
import { contextHeaderStyles } from "./context-header-styles.ts";

export type ContextHeaderContentProps<Ctx extends object = RenderInput> = {
  readonly brand: Content<Ctx, NamingStrategy>;
  readonly nav: readonly Content<Ctx, NamingStrategy>[];
  readonly actions: readonly Content<Ctx, NamingStrategy>[];
  readonly user: Content<Ctx, NamingStrategy>;
};

export const contextHeaderContent = defineComponent<
  ContextHeaderContentProps,
  RenderInput
>(
  "ContextHeaderContent",
  contextHeaderStyles,
  (ctx, props) =>
    combineHast(
      h.div(
        { class: ctx.cls("context-header-left") },
        renderContent(ctx, props.brand),
        h.nav(
          { class: ctx.cls("context-nav") },
          ...renderContents(ctx, props.nav),
        ),
      ),
      h.div(
        { class: ctx.cls("context-header-right") },
        ...renderContents(ctx, props.actions),
        h.div({ class: ctx.cls("context-divider") }),
        renderContent(ctx, props.user),
      ),
    ),
);
