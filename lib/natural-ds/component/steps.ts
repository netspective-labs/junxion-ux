import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContent, type RenderInput } from "./shared.ts";
import { contentStyles } from "./content-styles.ts";

export type StepsProps<Ctx extends object = RenderInput> = {
  readonly steps: readonly {
    readonly title: string;
    readonly description: Content<Ctx, NamingStrategy>;
  }[];
};

export const steps = defineComponent<StepsProps, RenderInput>(
  "Steps",
  contentStyles,
  (ctx, props) =>
    h.div(
      { class: ctx.cls("steps-container") },
      ...props.steps.map((step, index) =>
        h.div(
          { class: ctx.cls("step") },
          h.div(
            { class: ctx.cls("step-indicator") },
            h.div({ class: ctx.cls("step-number") }, String(index + 1)),
            h.div({ class: ctx.cls("step-line") }),
          ),
          h.div(
            { class: ctx.cls("step-content") },
            h.div({ class: ctx.cls("step-title") }, step.title),
            h.div(
              { class: ctx.cls("step-description") },
              renderContent(ctx, step.description),
            ),
          ),
        )
      ),
    ),
);
