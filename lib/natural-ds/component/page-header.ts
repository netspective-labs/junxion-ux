import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import {
  type Content,
  renderContent,
  renderContents,
  type RenderInput,
} from "./shared.ts";
import { contentStyles } from "./content-styles.ts";

export type PageHeaderProps<Ctx extends object = RenderInput> = {
  readonly title: string;
  readonly description: Content<Ctx, NamingStrategy>;
  readonly actions?: readonly Content<Ctx, NamingStrategy>[];
};

export const pageHeader = defineComponent<PageHeaderProps, RenderInput>(
  "PageHeader",
  contentStyles,
  (ctx, props) =>
    h.header(
      { class: ctx.cls("page-header") },
      h.h1({ class: ctx.cls("page-title") }, props.title),
      h.p(
        { class: ctx.cls("page-description") },
        renderContent(ctx, props.description),
      ),
      props.actions
        ? h.div(
          { class: ctx.cls("page-actions") },
          ...renderContents(ctx, props.actions),
        )
        : null,
    ),
);
