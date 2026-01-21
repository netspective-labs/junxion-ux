import { defineComponent } from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type RenderInput } from "./shared.ts";
import { contextHeaderStyles } from "./context-header-styles.ts";

export type ContextUserProps = {
  readonly initials: string;
  readonly name: string;
  readonly chevron?: h.RawHtml;
};

export const contextUser = defineComponent<ContextUserProps, RenderInput>(
  "ContextUser",
  contextHeaderStyles,
  (_ctx, props) =>
    h.div(
      { class: "context-user" },
      h.div({ class: "context-avatar" }, props.initials),
      h.span({ class: "context-user-name" }, props.name),
      props.chevron
        ? h.span({ class: "context-user-chevron" }, props.chevron)
        : null,
    ),
);
