import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContent, type RenderInput } from "./shared.ts";
import { sidebarStyles } from "./sidebar-styles.ts";

export type SubjectOptionProps<Ctx extends object = RenderInput> = {
  readonly title: string;
  readonly description: string;
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly checkmark?: Content<Ctx, NamingStrategy>;
  readonly value?: string;
  readonly selected?: boolean;
};

export const subjectOption = defineComponent<SubjectOptionProps, RenderInput>(
  "SubjectOption",
  sidebarStyles,
  (ctx, props) =>
    h.div(
      {
        class: ctx.cls("subject-option", props.selected ? "selected" : null),
        "data-value": props.value,
      },
      h.div(
        {
          class: ctx.cls(
            "option-icon",
            props.selected ? "active" : null,
          ),
        },
        renderContent(ctx, props.icon),
      ),
      h.div(
        { class: ctx.cls("option-info") },
        h.div({ class: ctx.cls("option-title") }, props.title),
        h.div({ class: ctx.cls("option-description") }, props.description),
      ),
      props.checkmark
        ? h.span(
          { class: ctx.cls("option-checkmark") },
          renderContent(ctx, props.checkmark),
        )
        : null,
    ),
);
