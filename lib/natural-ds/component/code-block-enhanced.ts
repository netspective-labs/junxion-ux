import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import {
  type Content,
  normalizeTabId,
  renderContent,
  type RenderInput,
} from "./shared.ts";
import { contentStyles } from "./content-styles.ts";

export type CodeBlockEnhancedProps<Ctx extends object = RenderInput> = {
  readonly filename: string;
  readonly language: string;
  readonly languageClass?: string;
  readonly content: Content<Ctx, NamingStrategy>;
  readonly copyLabel?: string;
  readonly copyIcon?: Content<Ctx, NamingStrategy>;
};

export const codeBlockEnhanced = defineComponent<
  CodeBlockEnhancedProps,
  RenderInput
>(
  "CodeBlockEnhanced",
  contentStyles,
  (ctx, props) => {
    const languageClass = props.languageClass ??
      normalizeTabId(props.language);
    return h.div(
      { class: ctx.cls("code-block-enhanced") },
      h.div(
        { class: ctx.cls("code-header") },
        h.div(
          { class: ctx.cls("code-header-left") },
          h.span({ class: ctx.cls("code-filename") }, props.filename),
          h.span(
            { class: ctx.cls("code-lang-badge", languageClass) },
            props.language,
          ),
        ),
        h.button(
          { class: ctx.cls("code-copy-btn") },
          renderContent(ctx, props.copyIcon),
          props.copyLabel ?? "Copy",
        ),
      ),
      h.div(
        { class: ctx.cls("code-content") },
        renderContent(ctx, props.content),
      ),
    );
  },
);
