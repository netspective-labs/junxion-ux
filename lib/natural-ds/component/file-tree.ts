import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContents, type RenderInput } from "./shared.ts";
import { contentStyles } from "./content-styles.ts";

export type FileTreeProps<Ctx extends object = RenderInput> = {
  readonly items: readonly Content<Ctx, NamingStrategy>[];
};

export const fileTree = defineComponent<FileTreeProps, RenderInput>(
  "FileTree",
  contentStyles,
  (ctx, props) =>
    h.div({ class: ctx.cls("file-tree") }, ...renderContents(ctx, props.items)),
);
