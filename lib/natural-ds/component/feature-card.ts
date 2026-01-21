import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContent, type RenderInput } from "./shared.ts";
import { contentStyles } from "./content-styles.ts";

export type FeatureCardProps<Ctx extends object = RenderInput> = {
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly title: string;
  readonly description: string;
};

export const featureCard = defineComponent<FeatureCardProps, RenderInput>(
  "FeatureCard",
  contentStyles,
  (ctx, props) =>
    h.div(
      { class: ctx.cls("feature-card") },
      h.div({ class: ctx.cls("feature-icon") }, renderContent(ctx, props.icon)),
      h.div({ class: ctx.cls("feature-title") }, props.title),
      h.div({ class: ctx.cls("feature-desc") }, props.description),
    ),
);
