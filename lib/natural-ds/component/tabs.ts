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

export type TabsProps<Ctx extends object = RenderInput> = {
  readonly activeId?: string;
  readonly tabs: readonly {
    readonly label: string;
    readonly content: Content<Ctx, NamingStrategy>;
    readonly id?: string;
  }[];
};

export const tabs = defineComponent<TabsProps, RenderInput>(
  "Tabs",
  contentStyles,
  (ctx, props) => {
    const tabIds = props.tabs.map((tab) =>
      tab.id ? normalizeTabId(tab.id) : normalizeTabId(tab.label)
    );
    const activeId = props.activeId
      ? normalizeTabId(props.activeId)
      : tabIds[0];
    return h.div(
      { class: ctx.cls("tabs-container") },
      h.div(
        { class: ctx.cls("tabs-header") },
        ...props.tabs.map((tab, index) => {
          const tabId = tabIds[index] ?? normalizeTabId(tab.label);
          const isActive = tabId === activeId;
          return h.button(
            {
              class: ctx.cls("tab-button", isActive ? "active" : null),
              "data-tab": tabId,
            },
            tab.label,
          );
        }),
      ),
      ...props.tabs.map((tab, index) => {
        const tabId = tabIds[index] ?? normalizeTabId(tab.label);
        const isActive = tabId === activeId;
        return h.div(
          {
            class: ctx.cls("tab-content", isActive ? "active" : null),
            id: `tab-${tabId}`,
          },
          renderContent(ctx, tab.content),
        );
      }),
    );
  },
);
