import { defineComponent } from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type RenderInput } from "./shared.ts";
import { contentStyles } from "./content-styles.ts";

export type KeyboardShortcutProps = {
  readonly keys: readonly string[];
};

export const keyboardShortcut = defineComponent<
  KeyboardShortcutProps,
  RenderInput
>(
  "KeyboardShortcut",
  contentStyles,
  (_ctx, props) =>
    h.span(
      { class: "keyboard-shortcut" },
      ...props.keys.map((key) => h.kbd({ class: "key" }, key)),
    ),
);
