import { defineComponent } from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import { renderContent, type RenderInput } from "./shared.ts";
import { contentStyles } from "./content-styles.ts";

export type ApiTableCell = h.RawHtml | string;

export type ApiTableProps = {
  readonly head: readonly ApiTableCell[];
  readonly rows: readonly (readonly ApiTableCell[])[];
};

export const apiTable = defineComponent<ApiTableProps, RenderInput>(
  "ApiTable",
  contentStyles,
  (ctx, props) =>
    h.table(
      { class: "api-table" },
      h.thead(
        h.tr(
          ...props.head.map((label) =>
            h.th({ class: "api-table-header" }, renderContent(ctx, label))
          ),
        ),
      ),
      h.tbody(
        ...props.rows.map((row) =>
          h.tr(
            ...row.map((cell) =>
              h.td(
                { class: "api-table-cell" },
                renderContent(ctx, cell),
              )
            ),
          )
        ),
      ),
    ),
);
