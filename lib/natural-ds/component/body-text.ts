import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContent, type RenderInput } from "./shared.ts";
import { contentStyles } from "./content-styles.ts";

export type BodyTextProps<Ctx extends object = RenderInput> = {
  readonly content: Content<Ctx, NamingStrategy>;
};

export const bodyText = defineComponent<BodyTextProps, RenderInput>(
  "BodyText",
  contentStyles,
  (ctx, props) =>
    h.p({ class: ctx.cls("body-text") }, renderContent(ctx, props.content)),
);
