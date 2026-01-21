import {
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { type Content, renderContent, type RenderInput } from "./shared.ts";
import { contentStyles } from "./content-styles.ts";

export type ImageWithCaptionProps<Ctx extends object = RenderInput> = {
  readonly src: string;
  readonly alt?: string;
  readonly caption?: Content<Ctx, NamingStrategy>;
};

export const imageWithCaption = defineComponent<
  ImageWithCaptionProps,
  RenderInput
>(
  "ImageWithCaption",
  contentStyles,
  (ctx, props) =>
    h.figure(
      { class: ctx.cls("image-container") },
      h.img({ src: props.src, alt: props.alt ?? "" }),
      props.caption
        ? h.figcaption(
          { class: ctx.cls("image-caption") },
          renderContent(ctx, props.caption),
        )
        : null,
    ),
);
