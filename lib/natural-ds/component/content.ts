import {
  type ComponentStylesheets,
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import {
  type Content,
  normalizeTabId,
  renderContent,
  renderContents,
  type RenderInput,
} from "../../natural-html/patterns.ts";

const contentStyles: ComponentStylesheets = [
  {
    "content-wrapper": {
      maxWidth: "100%",
    },
    "page-header": {
      marginBottom: "40px",
      paddingTop: "16px",
    },
    "page-title": {
      fontSize: "32px",
      fontWeight: 700,
      color: "#0a0a0a",
      marginBottom: "12px",
      letterSpacing: "-0.5px",
    },
    "page-description": {
      fontSize: "16px",
      color: "#525252",
      lineHeight: 1.7,
      marginBottom: "20px",
    },
    "page-actions": {
      display: "flex",
      gap: "8px",
    },
    "action-btn": {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "8px 14px",
      background: "#ffffff",
      border: "1px solid #e5e5e5",
      borderRadius: "6px",
      fontSize: "13px",
      fontWeight: 500,
      color: "#525252",
      cursor: "pointer",
      transition: "all 0.15s ease",
    },
    "action-btn-primary": {
      background: "#0a0a0a",
      borderColor: "#0a0a0a",
      color: "#ffffff",
    },
    "section-heading": {
      fontSize: "22px",
      fontWeight: 600,
      color: "#0a0a0a",
      marginTop: "48px",
      marginBottom: "16px",
      paddingBottom: "8px",
      borderBottom: "1px solid #e5e5e5",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    "anchor-link": {
      color: "#737373",
      textDecoration: "none",
      opacity: 0,
      transition: "opacity 0.15s ease",
    },
    "subsection-heading": {
      fontSize: "18px",
      fontWeight: 600,
      color: "#0a0a0a",
      marginTop: "32px",
      marginBottom: "12px",
    },
    "body-text": {
      fontSize: "15px",
      color: "#404040",
      lineHeight: 1.8,
      marginBottom: "20px",
    },
    "type-scale-title": {
      fontSize: "32px",
      fontWeight: 700,
      marginBottom: "8px",
      display: "block",
    },
    "type-scale-section": {
      fontSize: "22px",
      fontWeight: 600,
      marginBottom: "8px",
      display: "block",
    },
    "type-scale-subsection": {
      fontSize: "18px",
      fontWeight: 600,
      marginBottom: "8px",
      display: "block",
    },
    "type-scale-body": {
      fontSize: "15px",
      marginBottom: "8px",
      display: "block",
    },
    "type-scale-small": {
      fontSize: "13px",
      color: "#737373",
      display: "block",
    },
    "feature-grid": {
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: "16px",
      margin: "24px 0",
    },
    "feature-card": {
      background: "#ffffff",
      border: "1px solid #e5e5e5",
      borderRadius: "12px",
      padding: "20px",
      cursor: "pointer",
      transition: "all 0.2s ease",
    },
    "feature-icon": {
      width: "40px",
      height: "40px",
      background: "#f5f5f5",
      borderRadius: "8px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: "12px",
      fontSize: "18px",
    },
    "feature-title": {
      fontSize: "15px",
      fontWeight: 600,
      color: "#0a0a0a",
      marginBottom: "6px",
    },
    "feature-desc": {
      fontSize: "13px",
      color: "#737373",
      lineHeight: 1.6,
    },
    callout: {
      background: "#fffbeb",
      border: "1px solid #fde68a",
      borderLeft: "4px solid #f59e0b",
      borderRadius: "8px",
      padding: "16px 20px",
      margin: "24px 0",
    },
    "callout-header": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontWeight: 600,
      fontSize: "14px",
      color: "#0a0a0a",
      marginBottom: "8px",
    },
    "callout-content": {
      fontSize: "14px",
      color: "#404040",
      lineHeight: 1.7,
    },
    "definition-list": {
      margin: "24px 0",
    },
    "definition-item": {
      padding: "16px 0",
      borderBottom: "1px solid #e5e5e5",
    },
    "definition-term": {
      fontWeight: 600,
      fontSize: "15px",
      color: "#0a0a0a",
      marginBottom: "4px",
    },
    "definition-desc": {
      fontSize: "14px",
      color: "#525252",
      lineHeight: 1.7,
    },
    "code-block": {
      background: "#1e1e1e",
      borderRadius: "8px",
      padding: "16px 20px",
      margin: "16px 0",
      overflowX: "auto",
    },
    "code-block-enhanced": {
      background: "#1e1e1e",
      borderRadius: "10px",
      margin: "20px 0",
      overflow: "hidden",
      border: "1px solid #333",
    },
    "code-header": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 16px",
      background: "#2d2d2d",
      borderBottom: "1px solid #404040",
    },
    "code-header-left": {
      display: "flex",
      alignItems: "center",
      gap: "10px",
    },
    "code-filename": {
      fontSize: "13px",
      fontWeight: 500,
      color: "#e0e0e0",
      fontFamily: "SF Mono, Monaco, monospace",
    },
    "code-lang-badge": {
      fontSize: "10px",
      fontWeight: 600,
      textTransform: "uppercase",
      padding: "2px 8px",
      borderRadius: "4px",
      background: "#404040",
      color: "#a0a0a0",
    },
    "code-copy-btn": {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 10px",
      background: "transparent",
      border: "1px solid #404040",
      borderRadius: "6px",
      color: "#a0a0a0",
      fontSize: "12px",
      cursor: "pointer",
      transition: "all 0.15s ease",
    },
    "code-content": {
      padding: "16px 20px",
      overflowX: "auto",
    },
    "code-line": {
      display: "flex",
    },
    "line-number": {
      color: "#505050",
      textAlign: "right",
      paddingRight: "16px",
      minWidth: "32px",
      userSelect: "none",
    },
    "line-content": {
      flex: "1",
    },
    "tabs-container": {
      margin: "24px 0",
      border: "1px solid #e5e5e5",
      borderRadius: "10px",
      overflow: "hidden",
      background: "#fff",
    },
    "tabs-header": {
      display: "flex",
      background: "#f5f5f5",
      borderBottom: "1px solid #e5e5e5",
    },
    "tab-button": {
      padding: "12px 20px",
      fontSize: "13px",
      fontWeight: 500,
      color: "#525252",
      background: "transparent",
      border: "none",
      cursor: "pointer",
      position: "relative",
      transition: "all 0.15s ease",
    },
    "tab-content": {
      padding: "0",
      display: "none",
    },
    "steps-container": {
      margin: "24px 0",
      position: "relative",
    },
    step: {
      display: "flex",
      gap: "20px",
      paddingBottom: "32px",
      position: "relative",
    },
    "step-indicator": {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      flexShrink: 0,
    },
    "step-number": {
      width: "32px",
      height: "32px",
      background: "#f97316",
      color: "white",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "14px",
      fontWeight: 600,
      position: "relative",
      zIndex: 1,
    },
    "step-line": {
      width: "2px",
      flex: 1,
      background: "#e5e5e5",
      marginTop: "8px",
    },
    "step-content": {
      flex: 1,
      paddingTop: "4px",
    },
    "step-title": {
      fontSize: "16px",
      fontWeight: 600,
      color: "#0a0a0a",
      marginBottom: "8px",
    },
    "step-description": {
      fontSize: "14px",
      color: "#525252",
      lineHeight: 1.7,
    },
    "file-tree": {
      background: "#fafafa",
      border: "1px solid #e5e5e5",
      borderRadius: "10px",
      padding: "16px 20px",
      margin: "20px 0",
      fontFamily: "SF Mono, Monaco, monospace",
      fontSize: "13px",
    },
    "file-tree-item": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "4px 0",
      color: "#404040",
    },
    "file-tree-children": {
      paddingLeft: "24px",
      borderLeft: "1px dashed #d4d4d4",
      marginLeft: "7px",
    },
    accordion: {
      margin: "20px 0",
      border: "1px solid #e5e5e5",
      borderRadius: "10px",
      overflow: "hidden",
    },
    "accordion-item": {
      borderBottom: "1px solid #e5e5e5",
    },
    "accordion-header": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "16px 20px",
      background: "#fff",
      cursor: "pointer",
    },
    "accordion-icon": {
      width: "20px",
      height: "20px",
      color: "#737373",
      transition: "transform 0.2s ease",
    },
    "accordion-title": {
      fontSize: "15px",
      fontWeight: 500,
      color: "#0a0a0a",
    },
    "accordion-content": {
      padding: "0 20px 16px",
      fontSize: "14px",
      color: "#525252",
      lineHeight: 1.7,
      display: "none",
    },
    "api-table": {
      width: "100%",
      margin: "20px 0",
      border: "1px solid #e5e5e5",
      borderRadius: "10px",
      overflow: "hidden",
      borderCollapse: "separate",
      borderSpacing: "0",
    },
    "api-table-header": {
      textAlign: "left",
      padding: "12px 16px",
      background: "#f5f5f5",
      fontSize: "12px",
      fontWeight: 600,
      color: "#525252",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      borderBottom: "1px solid #e5e5e5",
    },
    "api-table-cell": {
      padding: "12px 16px",
      fontSize: "14px",
      color: "#404040",
      borderBottom: "1px solid #e5e5e5",
      verticalAlign: "top",
    },
    "prop-name": {
      fontFamily: "SF Mono, Monaco, monospace",
      fontSize: "13px",
      color: "#e11d48",
      background: "#fef2f2",
      padding: "2px 6px",
      borderRadius: "4px",
    },
    "prop-type": {
      fontFamily: "SF Mono, Monaco, monospace",
      fontSize: "12px",
      color: "#3b82f6",
    },
    "prop-default": {
      fontFamily: "SF Mono, Monaco, monospace",
      fontSize: "12px",
      color: "#737373",
    },
    "prop-required": {
      fontFamily: "SF Mono, Monaco, monospace",
      fontSize: "11px",
      color: "#dc2626",
      background: "#fef2f2",
      padding: "2px 6px",
      borderRadius: "4px",
      marginLeft: "6px",
    },
    badge: {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      padding: "3px 8px",
      fontSize: "11px",
      fontWeight: 600,
      borderRadius: "6px",
      textTransform: "uppercase",
      letterSpacing: "0.3px",
    },
    "badge-default": {
      background: "#f5f5f5",
      color: "#525252",
    },
    "badge-primary": {
      background: "#fff7ed",
      color: "#ea580c",
    },
    "badge-success": {
      background: "#f0fdf4",
      color: "#16a34a",
    },
    "badge-warning": {
      background: "#fffbeb",
      color: "#d97706",
    },
    "badge-error": {
      background: "#fef2f2",
      color: "#dc2626",
    },
    "badge-info": {
      background: "#eff6ff",
      color: "#2563eb",
    },
    "image-container": {
      margin: "24px 0",
      border: "1px solid #e5e5e5",
      borderRadius: "10px",
      overflow: "hidden",
      background: "#fafafa",
    },
    "image-caption": {
      padding: "12px 16px",
      fontSize: "13px",
      color: "#737373",
      textAlign: "center",
      borderTop: "1px solid #e5e5e5",
      background: "#fff",
    },
    "keyboard-shortcut": {
      display: "inline-flex",
      gap: "4px",
    },
    key: {
      padding: "4px 8px",
      background: "#f5f5f5",
      border: "1px solid #d4d4d4",
      borderRadius: "6px",
      fontSize: "12px",
      fontFamily: "SF Mono, Monaco, monospace",
      color: "#404040",
      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
    },
    "example-wrapper": {
      margin: "20px 0",
      border: "1px solid #e5e5e5",
      borderRadius: "10px",
      overflow: "hidden",
    },
    "example-label": {
      padding: "8px 16px",
      background: "#f5f5f5",
      borderBottom: "1px solid #e5e5e5",
      fontSize: "11px",
      fontWeight: 600,
      color: "#737373",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    "example-content": {
      padding: "20px",
      background: "#fff",
      display: "block",
    },
    "badge-row": {
      display: "flex",
      gap: "8px",
      flexWrap: "wrap",
    },
    "keyboard-row": {
      display: "flex",
      gap: "24px",
      flexWrap: "wrap",
    },
    "keyboard-label": {
      color: "#737373",
      fontSize: "13px",
      marginRight: "8px",
    },
    "color-grid": {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "16px",
      margin: "20px 0",
    },
    "color-swatch": {
      border: "1px solid #e5e5e5",
      borderRadius: "10px",
      overflow: "hidden",
    },
    "color-preview": {
      height: "64px",
    },
    "color-info": {
      padding: "12px",
      background: "#fff",
    },
    "color-name": {
      fontSize: "13px",
      fontWeight: 600,
      color: "#0a0a0a",
      marginBottom: "4px",
    },
    "color-value": {
      fontSize: "12px",
      fontFamily: "SF Mono, Monaco, monospace",
      color: "#737373",
    },
    "footer-nav": {
      display: "flex",
      justifyContent: "space-between",
      marginTop: "60px",
      paddingTop: "24px",
      borderTop: "1px solid #e5e5e5",
    },
    "footer-link": {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      textDecoration: "none",
      padding: "12px 16px",
      border: "1px solid #e5e5e5",
      borderRadius: "8px",
      minWidth: "180px",
    },
    "footer-label": {
      fontSize: "11px",
      color: "#737373",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    "footer-title": {
      fontSize: "14px",
      fontWeight: 500,
      color: "#0a0a0a",
    },
  },
];

export type PageHeaderProps<Ctx extends object = RenderInput> = {
  readonly title: string;
  readonly description: Content<Ctx, NamingStrategy>;
  readonly actions?: readonly Content<Ctx, NamingStrategy>[];
};

export const pageHeader = defineComponent<PageHeaderProps, RenderInput>(
  "PageHeader",
  contentStyles,
  (ctx, props) =>
    h.header(
      { class: ctx.cls("page-header") },
      h.h1({ class: ctx.cls("page-title") }, props.title),
      h.p(
        { class: ctx.cls("page-description") },
        renderContent(ctx, props.description),
      ),
      props.actions
        ? h.div(
          { class: ctx.cls("page-actions") },
          ...renderContents(ctx, props.actions),
        )
        : null,
    ),
);

export type SectionHeadingProps = {
  readonly title: string;
  readonly href?: string;
};

export const sectionHeading = defineComponent<SectionHeadingProps, RenderInput>(
  "SectionHeading",
  contentStyles,
  (ctx, props) =>
    h.h2(
      { class: ctx.cls("section-heading") },
      props.title,
      h.a(
        { class: ctx.cls("anchor-link"), href: props.href ?? "#" },
        "#",
      ),
    ),
);

export const subsectionHeading = defineComponent<
  SectionHeadingProps,
  RenderInput
>(
  "SubsectionHeading",
  contentStyles,
  (ctx, props) => h.h3({ class: ctx.cls("subsection-heading") }, props.title),
);

export type BodyTextProps<Ctx extends object = RenderInput> = {
  readonly content: Content<Ctx, NamingStrategy>;
};

export const bodyText = defineComponent<BodyTextProps, RenderInput>(
  "BodyText",
  contentStyles,
  (ctx, props) =>
    h.p({ class: ctx.cls("body-text") }, renderContent(ctx, props.content)),
);

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

export type FeatureGridProps<Ctx extends object = RenderInput> = {
  readonly cards: readonly Content<Ctx, NamingStrategy>[];
};

export const featureGrid = defineComponent<FeatureGridProps, RenderInput>(
  "FeatureGrid",
  contentStyles,
  (ctx, props) =>
    h.div(
      { class: ctx.cls("feature-grid") },
      ...renderContents(ctx, props.cards),
    ),
);

export type CalloutProps<Ctx extends object = RenderInput> = {
  readonly title: string;
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly content: Content<Ctx, NamingStrategy>;
  readonly variant?: "info" | "tip" | "default";
};

export const callout = defineComponent<CalloutProps, RenderInput>(
  "Callout",
  contentStyles,
  (ctx, props) =>
    h.div(
      {
        class: ctx.cls(
          "callout",
          props.variant && props.variant !== "default" ? props.variant : null,
        ),
      },
      h.div(
        { class: ctx.cls("callout-header") },
        renderContent(ctx, props.icon),
        h.span(props.title),
      ),
      h.div(
        { class: ctx.cls("callout-content") },
        renderContent(ctx, props.content),
      ),
    ),
);

export type DefinitionItemProps<Ctx extends object = RenderInput> = {
  readonly term: string;
  readonly description: Content<Ctx, NamingStrategy>;
};

export const definitionItem = defineComponent<
  DefinitionItemProps,
  RenderInput
>(
  "DefinitionItem",
  contentStyles,
  (ctx, props) =>
    h.div(
      { class: ctx.cls("definition-item") },
      h.div({ class: ctx.cls("definition-term") }, props.term),
      h.div(
        { class: ctx.cls("definition-desc") },
        renderContent(ctx, props.description),
      ),
    ),
);

export type DefinitionListProps<Ctx extends object = RenderInput> = {
  readonly items: readonly Content<Ctx, NamingStrategy>[];
};

export const definitionList = defineComponent<
  DefinitionListProps,
  RenderInput
>(
  "DefinitionList",
  contentStyles,
  (ctx, props) =>
    h.div(
      { class: ctx.cls("definition-list") },
      ...renderContents(ctx, props.items),
    ),
);

export type CodeBlockProps<Ctx extends object = RenderInput> = {
  readonly content: Content<Ctx, NamingStrategy>;
};

export const codeBlock = defineComponent<CodeBlockProps, RenderInput>(
  "CodeBlock",
  contentStyles,
  (ctx, props) =>
    h.div({ class: ctx.cls("code-block") }, renderContent(ctx, props.content)),
);

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

export type StepsProps<Ctx extends object = RenderInput> = {
  readonly steps: readonly {
    readonly title: string;
    readonly description: Content<Ctx, NamingStrategy>;
  }[];
};

export const steps = defineComponent<StepsProps, RenderInput>(
  "Steps",
  contentStyles,
  (ctx, props) =>
    h.div(
      { class: ctx.cls("steps-container") },
      ...props.steps.map((step, index) =>
        h.div(
          { class: ctx.cls("step") },
          h.div(
            { class: ctx.cls("step-indicator") },
            h.div({ class: ctx.cls("step-number") }, String(index + 1)),
            h.div({ class: ctx.cls("step-line") }),
          ),
          h.div(
            { class: ctx.cls("step-content") },
            h.div({ class: ctx.cls("step-title") }, step.title),
            h.div(
              { class: ctx.cls("step-description") },
              renderContent(ctx, step.description),
            ),
          ),
        )
      ),
    ),
);

export type FileTreeProps<Ctx extends object = RenderInput> = {
  readonly items: readonly Content<Ctx, NamingStrategy>[];
};

export const fileTree = defineComponent<FileTreeProps, RenderInput>(
  "FileTree",
  contentStyles,
  (ctx, props) =>
    h.div({ class: ctx.cls("file-tree") }, ...renderContents(ctx, props.items)),
);

export type AccordionItemProps<Ctx extends object = RenderInput> = {
  readonly title: string;
  readonly content: Content<Ctx, NamingStrategy>;
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly open?: boolean;
};

export type AccordionProps<Ctx extends object = RenderInput> = {
  readonly items: readonly AccordionItemProps<Ctx>[];
};

export const accordion = defineComponent<AccordionProps, RenderInput>(
  "Accordion",
  contentStyles,
  (ctx, props) =>
    h.div(
      { class: ctx.cls("accordion") },
      ...props.items.map((item) =>
        h.div(
          { class: ctx.cls("accordion-item", item.open ? "open" : null) },
          h.div(
            { class: ctx.cls("accordion-header") },
            h.span({ class: ctx.cls("accordion-title") }, item.title),
            item.icon
              ? h.span(
                { class: ctx.cls("accordion-icon") },
                renderContent(ctx, item.icon),
              )
              : null,
          ),
          h.div(
            { class: ctx.cls("accordion-content") },
            renderContent(ctx, item.content),
          ),
        )
      ),
    ),
);

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

export type BadgeProps = {
  readonly label: string;
  readonly variant?: string;
};

export const badge = defineComponent<BadgeProps, RenderInput>(
  "Badge",
  contentStyles,
  (_ctx, props) =>
    h.span(
      {
        class: `badge${props.variant ? ` badge-${props.variant}` : ""}${
          props.variant ? ` ${props.variant}` : ""
        }`,
      },
      props.label,
    ),
);

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

export type ExampleWrapperProps<Ctx extends object = RenderInput> = {
  readonly label: string;
  readonly content: Content<Ctx, NamingStrategy>;
};

export const exampleWrapper = defineComponent<
  ExampleWrapperProps,
  RenderInput
>(
  "ExampleWrapper",
  contentStyles,
  (ctx, props) =>
    h.div(
      { class: ctx.cls("example-wrapper") },
      h.div({ class: ctx.cls("example-label") }, props.label),
      h.div(
        { class: ctx.cls("example-content") },
        renderContent(ctx, props.content),
      ),
    ),
);

export type ColorSwatchProps = {
  readonly name: string;
  readonly value: string;
};

export const colorSwatch = defineComponent<ColorSwatchProps, RenderInput>(
  "ColorSwatch",
  contentStyles,
  (ctx, props) => {
    const previewId = ctx.naming.elemIdValue(
      `color-preview-${normalizeTabId(props.name)}-${
        normalizeTabId(props.value)
      }`,
      "component",
    );
    return h.div(
      { class: "color-swatch" },
      h.div({
        class: "color-preview",
        id: previewId,
        style: `background: ${props.value}`,
      }),
      h.div(
        { class: "color-info" },
        h.div({ class: "color-name" }, props.name),
        h.div({ class: "color-value" }, props.value),
      ),
    );
  },
);

export type ColorGridProps<Ctx extends object = RenderInput> = {
  readonly swatches: readonly Content<Ctx, NamingStrategy>[];
};

export const colorGrid = defineComponent<ColorGridProps, RenderInput>(
  "ColorGrid",
  contentStyles,
  (ctx, props) =>
    h.div(
      { class: ctx.cls("color-grid") },
      ...renderContents(ctx, props.swatches),
    ),
);

export type FooterNavProps<Ctx extends object = RenderInput> = {
  readonly previous?: {
    readonly label: string;
    readonly title: string;
    readonly href?: string;
  };
  readonly next?: {
    readonly label: string;
    readonly title: string;
    readonly href?: string;
  };
};

export const footerNav = defineComponent<FooterNavProps, RenderInput>(
  "FooterNav",
  contentStyles,
  (_ctx, props) =>
    h.div(
      { class: "footer-nav" },
      props.previous
        ? h.a(
          { class: "footer-link prev", href: props.previous.href ?? "#" },
          h.span({ class: "footer-label" }, props.previous.label),
          h.span({ class: "footer-title" }, props.previous.title),
        )
        : null,
      props.next
        ? h.a(
          { class: "footer-link next", href: props.next.href ?? "#" },
          h.span({ class: "footer-label" }, props.next.label),
          h.span({ class: "footer-title" }, props.next.title),
        )
        : null,
    ),
);
