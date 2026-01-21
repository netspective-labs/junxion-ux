import {
  type ComponentStylesheets,
  defineComponent,
  NamingStrategy,
} from "../../natural-html/design-system.ts";
import * as h from "../../natural-html/elements.ts";
import {
  type Content,
  renderContent,
  renderContents,
  type RenderInput,
} from "../../natural-html/patterns.ts";

const sidebarStyles: ComponentStylesheets = [
  {
    "sidebar-header": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      paddingBottom: "16px",
      borderBottom: "1px solid #e5e5e5",
    },
    logo: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontWeight: 600,
      fontSize: "15px",
      color: "#0a0a0a",
      textDecoration: "none",
    },
    "logo-icon": {
      width: "24px",
      height: "24px",
      background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
      borderRadius: "6px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      fontSize: "12px",
      fontWeight: "bold",
    },
    "theme-toggle": {
      width: "32px",
      height: "32px",
      border: "1px solid #e5e5e5",
      borderRadius: "6px",
      background: "transparent",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#737373",
      transition: "all 0.15s ease",
    },
    "search-bar": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 12px",
      background: "#f5f5f5",
      border: "1px solid #e5e5e5",
      borderRadius: "8px",
      cursor: "pointer",
      transition: "all 0.15s ease",
    },
    "search-left": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      color: "#737373",
    },
    "search-icon": {
      width: "16px",
      height: "16px",
    },
    "search-placeholder": {
      fontSize: "13px",
    },
    "search-shortcut": {
      display: "flex",
      gap: "4px",
    },
    kbd: {
      padding: "2px 6px",
      background: "#ffffff",
      border: "1px solid #e5e5e5",
      borderRadius: "4px",
      fontSize: "11px",
      fontFamily: "inherit",
      color: "#737373",
    },
    "subject-selector-wrapper": {
      position: "relative",
      marginBottom: "0",
    },
    "subject-selector": {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "8px 12px",
      background: "#ffffff",
      border: "1px solid #e5e5e5",
      borderRadius: "8px",
      cursor: "pointer",
      transition: "all 0.15s ease",
      width: "100%",
      textAlign: "left",
    },
    "subject-selector-icon": {
      width: "24px",
      height: "24px",
      background: "linear-gradient(135deg, #f59e0b, #d97706)",
      borderRadius: "6px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    "subject-selector-name": {
      flex: "1",
      fontSize: "14px",
      fontWeight: 500,
      color: "#0a0a0a",
    },
    "selector-chevrons": {
      width: "16px",
      height: "16px",
      color: "#737373",
      flexShrink: 0,
    },
    "subject-popup": {
      position: "absolute",
      top: "calc(100% + 8px)",
      left: 0,
      right: 0,
      background: "#ffffff",
      border: "1px solid #e5e5e5",
      borderRadius: "12px",
      boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
      zIndex: 100,
      overflow: "hidden",
      opacity: 0,
      visibility: "hidden",
      transform: "translateY(-8px)",
      transition: "all 0.2s ease",
    },
    "subject-option": {
      display: "flex",
      alignItems: "flex-start",
      gap: "12px",
      padding: "12px 16px",
      cursor: "pointer",
      transition: "background 0.15s ease",
    },
    "option-icon": {
      width: "28px",
      height: "28px",
      borderRadius: "6px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      background: "#f3f4f6",
    },
    "option-info": {
      flex: "1",
    },
    "option-title": {
      fontSize: "14px",
      fontWeight: 500,
      color: "#0a0a0a",
    },
    "option-description": {
      fontSize: "12px",
      color: "#737373",
      marginTop: "2px",
    },
    "option-checkmark": {
      width: "16px",
      height: "16px",
      color: "#f97316",
      opacity: 0,
      marginTop: "4px",
    },
    "nav-section": {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    },
    "nav-category": {
      fontSize: "11px",
      fontWeight: 600,
      color: "#737373",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      padding: "8px 0 4px 0",
      marginTop: "8px",
    },
    "nav-link": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 12px",
      borderRadius: "6px",
      textDecoration: "none",
      color: "#525252",
      fontSize: "13px",
      position: "relative",
      transition: "all 0.15s ease",
    },
    "nav-link-active": {
      background: "#fff7ed",
      color: "#ea580c",
      fontWeight: 500,
    },
    "nav-link-indicator": {
      position: "absolute",
      left: 0,
      width: "3px",
      height: "24px",
      background: "#f97316",
      borderRadius: "0 2px 2px 0",
      top: "50%",
      transform: "translateY(-50%)",
    },
    "nav-icon": {
      width: "16px",
      height: "16px",
      opacity: 0.7,
    },
    "nav-expandable": {
      display: "flex",
      flexDirection: "column",
    },
    "nav-toggle": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 12px",
      borderRadius: "6px",
      textDecoration: "none",
      color: "#525252",
      fontSize: "13px",
      cursor: "pointer",
      background: "none",
      border: "none",
      width: "100%",
      textAlign: "left",
      fontFamily: "inherit",
      transition: "all 0.15s ease",
    },
    "nav-chevron": {
      width: "14px",
      height: "14px",
      marginLeft: "auto",
      opacity: 0.6,
      transition: "transform 0.2s ease",
    },
    "nav-children": {
      marginLeft: "20px",
      paddingLeft: "12px",
      borderLeft: "1px solid #e5e5e5",
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      marginTop: "2px",
    },
    "nav-child-link": {
      display: "block",
      padding: "6px 12px",
      fontSize: "13px",
      color: "#525252",
      textDecoration: "none",
      borderRadius: "4px",
      transition: "all 0.15s ease",
    },
    "nav-child-link-active": {
      color: "#ea580c",
      background: "#fff7ed",
    },
  },
];

export type SidebarHeaderProps<Ctx extends object = RenderInput> = {
  readonly label: string;
  readonly href?: string;
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly iconText?: string;
  readonly toggleIcon?: Content<Ctx, NamingStrategy>;
};

export const sidebarHeader = defineComponent<
  SidebarHeaderProps,
  RenderInput
>(
  "SidebarHeader",
  sidebarStyles,
  (ctx, props) =>
    h.div(
      { class: ctx.cls("sidebar-header") },
      h.a(
        { class: ctx.cls("logo"), href: props.href ?? "#" },
        h.span(
          { class: ctx.cls("logo-icon") },
          renderContent(ctx, props.icon) ?? h.text(props.iconText ?? "DS"),
        ),
        h.span(props.label),
      ),
      h.button(
        { class: ctx.cls("theme-toggle"), "aria-label": "Toggle theme" },
        renderContent(ctx, props.toggleIcon),
      ),
    ),
);

export type SearchBarProps<Ctx extends object = RenderInput> = {
  readonly placeholder: string;
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly shortcut?: readonly string[];
};

export const searchBar = defineComponent<SearchBarProps, RenderInput>(
  "SearchBar",
  sidebarStyles,
  (ctx, props) => {
    const shortcut = props.shortcut ?? ["Cmd", "K"];
    return h.div(
      { class: ctx.cls("search-bar") },
      h.div(
        { class: ctx.cls("search-left") },
        renderContent(ctx, props.icon),
        h.span({ class: ctx.cls("search-placeholder") }, props.placeholder),
      ),
      h.div(
        { class: ctx.cls("search-shortcut") },
        ...shortcut.map((key) => h.kbd({ class: ctx.cls("kbd") }, key)),
      ),
    );
  },
);

export type SubjectOptionProps<Ctx extends object = RenderInput> = {
  readonly title: string;
  readonly description: string;
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly checkmark?: Content<Ctx, NamingStrategy>;
  readonly value?: string;
  readonly selected?: boolean;
};

export const subjectOption = defineComponent<SubjectOptionProps, RenderInput>(
  "SubjectOption",
  sidebarStyles,
  (ctx, props) =>
    h.div(
      {
        class: ctx.cls("subject-option", props.selected ? "selected" : null),
        "data-value": props.value,
      },
      h.div(
        {
          class: ctx.cls(
            "option-icon",
            props.selected ? "active" : null,
          ),
        },
        renderContent(ctx, props.icon),
      ),
      h.div(
        { class: ctx.cls("option-info") },
        h.div({ class: ctx.cls("option-title") }, props.title),
        h.div({ class: ctx.cls("option-description") }, props.description),
      ),
      props.checkmark
        ? h.span(
          { class: ctx.cls("option-checkmark") },
          renderContent(ctx, props.checkmark),
        )
        : null,
    ),
);

export type SubjectSelectorProps<Ctx extends object = RenderInput> = {
  readonly name: string;
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly chevron?: Content<Ctx, NamingStrategy>;
  readonly options?: readonly Content<Ctx, NamingStrategy>[];
  readonly triggerId?: string;
  readonly popupId?: string;
};

export const subjectSelector = defineComponent<
  SubjectSelectorProps,
  RenderInput
>(
  "SubjectSelector",
  sidebarStyles,
  (ctx, props) =>
    h.div(
      { class: ctx.cls("subject-selector-wrapper") },
      h.button(
        {
          class: ctx.cls("subject-selector"),
          "aria-haspopup": "listbox",
          "aria-expanded": "false",
          id: props.triggerId,
        },
        h.div(
          { class: ctx.cls("subject-selector-icon") },
          renderContent(ctx, props.icon),
        ),
        h.span({ class: ctx.cls("subject-selector-name") }, props.name),
        renderContent(ctx, props.chevron),
      ),
      props.options && props.options.length > 0
        ? h.div(
          { class: ctx.cls("subject-popup"), id: props.popupId },
          ...renderContents(ctx, props.options),
        )
        : null,
    ),
);

export type NavCategoryProps = {
  readonly label: string;
};

export const navCategory = defineComponent<NavCategoryProps, RenderInput>(
  "NavCategory",
  sidebarStyles,
  (_ctx, props) => h.div({ class: "nav-category" }, props.label),
);

export type NavLinkProps<Ctx extends object = RenderInput> = {
  readonly label: string;
  readonly href?: string;
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly active?: boolean;
};

export const navLink = defineComponent<NavLinkProps, RenderInput>(
  "NavLink",
  sidebarStyles,
  (ctx, props) =>
    h.a(
      {
        class: ctx.cls(
          "nav-link",
          props.active ? "nav-link-active" : null,
          props.active ? "active" : null,
        ),
        href: props.href ?? "#",
      },
      renderContent(ctx, props.icon),
      h.span(props.label),
    ),
);

export type NavChildLinkProps = {
  readonly label: string;
  readonly href?: string;
  readonly active?: boolean;
};

export const navChildLink = defineComponent<NavChildLinkProps, RenderInput>(
  "NavChildLink",
  sidebarStyles,
  (_ctx, props) =>
    h.a(
      {
        class: props.active
          ? "nav-child-link nav-child-link-active active"
          : "nav-child-link",
        href: props.href ?? "#",
      },
      props.label,
    ),
);

export type NavExpandableProps<Ctx extends object = RenderInput> = {
  readonly label: string;
  readonly icon?: Content<Ctx, NamingStrategy>;
  readonly chevron?: Content<Ctx, NamingStrategy>;
  readonly expanded?: boolean;
  readonly children: readonly Content<Ctx, NamingStrategy>[];
};

export const navExpandable = defineComponent<
  NavExpandableProps,
  RenderInput
>(
  "NavExpandable",
  sidebarStyles,
  (ctx, props) =>
    h.div(
      { class: ctx.cls("nav-expandable") },
      h.button(
        {
          class: ctx.cls("nav-toggle"),
          "aria-expanded": props.expanded ? "true" : "false",
        },
        renderContent(ctx, props.icon),
        h.span(props.label),
        renderContent(ctx, props.chevron),
      ),
      h.div(
        {
          class: ctx.cls("nav-children"),
          style: ctx.css({ display: props.expanded ? "flex" : "none" }),
        },
        ...renderContents(ctx, props.children),
      ),
    ),
);

export type NavSectionProps<Ctx extends object = RenderInput> = {
  readonly children: readonly Content<Ctx, NamingStrategy>[];
};

export const navSection = defineComponent<NavSectionProps, RenderInput>(
  "NavSection",
  sidebarStyles,
  (ctx, props) =>
    h.nav(
      { class: ctx.cls("nav-section") },
      ...renderContents(ctx, props.children),
    ),
);
