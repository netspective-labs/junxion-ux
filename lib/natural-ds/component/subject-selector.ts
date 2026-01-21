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
import { sidebarStyles } from "./sidebar-styles.ts";

export type SubjectSelectorProps<Ctx extends object = RenderInput> = {
  readonly name: string;
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly chevron?: Content<Ctx, NamingStrategy>;
  readonly options?: readonly Content<Ctx, NamingStrategy>[];
  readonly triggerId?: string;
  readonly popupId?: string;
};

export const subjectSelector = defineComponent<
  SubjectSelectorProps,
  RenderInput
>(
  "SubjectSelector",
  sidebarStyles,
  (ctx, props) =>
    h.div(
      { class: ctx.cls("subject-selector-wrapper") },
      h.button(
        {
          class: ctx.cls("subject-selector"),
          "aria-haspopup": "listbox",
          "aria-expanded": "false",
          id: props.triggerId,
        },
        h.div(
          { class: ctx.cls("subject-selector-icon") },
          renderContent(ctx, props.icon),
        ),
        h.span({ class: ctx.cls("subject-selector-name") }, props.name),
        renderContent(ctx, props.chevron),
      ),
      props.options && props.options.length > 0
        ? h.div(
          { class: ctx.cls("subject-popup"), id: props.popupId },
          ...renderContents(ctx, props.options),
        )
        : null,
    ),
);
