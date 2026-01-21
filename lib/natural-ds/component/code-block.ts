import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContent, type RenderInput } from "./shared.ts";
import { contentStyles } from "./content-styles.ts";

export type CodeBlockProps<Ctx extends object = RenderInput> = {
  readonly content: Content<Ctx, NamingStrategy>;
};

export const codeBlock = defineComponent<CodeBlockProps, RenderInput>(
  "CodeBlock",
  contentStyles,
  (ctx, props) =>
    h.div({ class: ctx.cls("code-block") }, renderContent(ctx, props.content)),
);
