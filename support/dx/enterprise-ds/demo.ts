#!/usr/bin/env -S deno run -A --watch --unstable-bundle --node-modules-dir=auto
// support/dx/enterprise-ds/demo.ts
/**
 * Enterprise design system demo app.
 *
 * Run:
 *   deno run -A --unstable-bundle support/dx/enterprise-ds/demo.ts
 *
 * Then open:
 *   http://127.0.0.1:8000
 */

import { fromFileUrl, isAbsolute } from "@std/path";
import { Application } from "../../../lib/continuux/http.ts";
import {
  a,
  defaultEnterpriseDesignSystem,
  enterpriseLayout,
  p,
  render,
  section,
  span,
} from "../../../lib/universal/fluent-ds-enterprise.ts";
import {
  div,
  form,
  h2,
  h3,
  input,
  label,
  li,
  option,
  select,
  table,
  tbody,
  td,
  th,
  thead,
  tr,
  ul,
} from "../../../lib/universal/fluent-html.ts";

type State = Record<string, never>;
type Vars = Record<string, never>;

const app = Application.sharedState<State, Vars>({});

const ds = defaultEnterpriseDesignSystem;

const headerNav = [
  { label: "Home", href: "/", active: true },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Users", href: "/users" },
  { label: "Settings", href: "/settings" },
];

const sidebarSubjects = [
  { id: "admin", label: "Administration", active: true },
  { id: "analytics", label: "Analytics" },
  { id: "operations", label: "Operations" },
  { id: "settings", label: "Settings" },
];

const sidebarSections = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", active: true },
      { label: "Workflows", href: "/workflows" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { label: "Requests", href: "/requests" },
      { label: "Approvals", href: "/approvals" },
      { label: "Audit Log", href: "/audit" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      { label: "Preferences", href: "/settings" },
      { label: "Integrations", href: "/integrations" },
    ],
  },
];

const footerLinks = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Support", href: "/support" },
];

const footerStatus = [
  { label: "API", value: "Healthy", tone: "success" as const },
  { label: "Latency", value: "124ms", tone: "info" as const },
  { label: "Queue", value: "Normal", tone: "muted" as const },
];

function pageLayout(args: {
  title: string;
  description?: string;
  actions?: ReturnType<typeof div>;
  body: ReturnType<typeof section> | ReturnType<typeof div>;
  pathname: string;
}) {
  return enterpriseLayout(
    {
      title: `${args.title} | Enterprise DS Demo`,
      shell: ({ header, sidebar, content, rightRail, footer }) => ({
        header: header.use("enterprise", {
          brand: {
            appName: "Junxion",
            href: "/",
            environment: "dev",
            logo: "J",
          },
          nav: headerNav.map((item) => ({
            ...item,
            active: item.href === args.pathname,
          })),
          actions: [
            form(
              { class: "eds-header-search", role: "search" },
              label({ class: "eds-sr-only", for: "header-search" }, "Search"),
              input({
                id: "header-search",
                type: "search",
                placeholder: "Search...",
              }),
            ),
            a({ href: "/notifications" }, "Notifications"),
            a({ href: "/profile", class: "eds-action-primary" }, "Profile"),
          ],
          breadcrumbs: [
            { label: "Home", href: "/" },
            { label: args.title },
          ],
        }),
        sidebar: sidebar.use("enterprise", {
          title: "Navigation",
          subjects: sidebarSubjects,
          sections: sidebarSections.map((section) => ({
            ...section,
            items: section.items.map((item) => ({
              ...item,
              active: item.href === args.pathname,
            })),
          })),
          footer: p("System status: nominal"),
        }),
        content: content.use("standard", {
          pageTitle: args.title,
          description: args.description ? p(args.description) : undefined,
          actions: args.actions ? [args.actions] : [
            a({ href: "/create", class: "eds-action-primary" }, "Create"),
            a({ href: "/help" }, "Help"),
          ],
          body: args.body,
        }),
        rightRail: rightRail.use("sections", {
          title: "On this page",
          items: [
            {
              id: "overview",
              label: "Overview",
              href: "#overview",
              active: true,
            },
            { id: "details", label: "Details", href: "#details" },
            { id: "activity", label: "Activity", href: "#activity" },
          ],
          body: p("Right rail content can include quick actions or status."),
        }),
        footer: footer.use("enterprise", {
          links: footerLinks,
          status: footerStatus,
          version: "v3.2.1",
          smallPrint: "(c) 2026 Junxion",
        }),
      }),
    },
    ds,
  );
}

const dashboardBody = section(
  { id: "overview" },
  div(
    {
      style:
        "display:grid; gap:16px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));",
    },
    ...["Active Users", "Revenue", "Incidents", "SLA"].map((label, index) =>
      section(
        { class: "eds-section" },
        h3({}, label),
        p(`Metric ${index + 1}`),
        span({ style: "font-size: 1.4rem; font-weight: 700;" }, "128"),
      )
    ),
  ),
  div(
    {
      id: "details",
      style: "display:grid; gap:16px; grid-template-columns: 2fr 1fr;",
    },
    section(
      { class: "eds-section" },
      h3({}, "Usage Trend"),
      p("Chart placeholder for main usage trend."),
      div(
        {
          style:
            "height:180px; border-radius:10px; background: #eef2f7; display:flex; align-items:center; justify-content:center;",
        },
        "Chart Area",
      ),
    ),
    section(
      { class: "eds-section" },
      h3({}, "Pipeline"),
      p("Secondary chart or KPI list."),
      ul(
        {},
        [
          li({}, "Stage 1: 24 items"),
          li({}, "Stage 2: 12 items"),
          li({}, "Stage 3: 7 items"),
        ],
      ),
    ),
  ),
  section(
    { id: "activity", class: "eds-section" },
    h3({}, "Recent Activity"),
    ul(
      {},
      [
        li({}, "Alex approved change request CR-128."),
        li({}, "Sam updated the onboarding workflow."),
        li({}, "Jules created a new dashboard filter."),
      ],
    ),
  ),
);

const usersBody = section(
  { id: "overview" },
  section(
    { class: "eds-section" },
    div(
      { style: "display:flex; gap:12px; flex-wrap:wrap;" },
      div(
        { style: "display:flex; flex-direction:column; gap:6px;" },
        label({}, "Search"),
        input({ type: "search", placeholder: "Search users..." }),
      ),
      div(
        { style: "display:flex; flex-direction:column; gap:6px;" },
        label({}, "Status"),
        select(
          {},
          option({ value: "all" }, "All"),
          option({ value: "active" }, "Active"),
          option({ value: "inactive" }, "Inactive"),
        ),
      ),
      div(
        { style: "display:flex; flex-direction:column; gap:6px;" },
        label({}, "Role"),
        select(
          {},
          option({ value: "all" }, "All"),
          option({ value: "admin" }, "Admin"),
          option({ value: "analyst" }, "Analyst"),
        ),
      ),
    ),
  ),
  section(
    { class: "eds-section" },
    table(
      { style: "width:100%; border-collapse: collapse;" },
      thead(
        {},
        tr(
          {},
          th({ style: "text-align:left; padding:8px;" }, "Name"),
          th({ style: "text-align:left; padding:8px;" }, "Status"),
          th({ style: "text-align:left; padding:8px;" }, "Role"),
          th({ style: "text-align:left; padding:8px;" }, "Last Active"),
        ),
      ),
      tbody(
        {},
        [
          ["Jordan Lee", "Active", "Admin", "2 hours ago"],
          ["Casey Tran", "Active", "Analyst", "Yesterday"],
          ["Morgan Ellis", "Inactive", "Operator", "3 days ago"],
          ["Taylor Reed", "Active", "Viewer", "Today"],
        ].map((row) =>
          tr(
            {},
            row.map((cell) =>
              td({ style: "padding:8px; border-top: 1px solid #dbe1ea;" }, cell)
            ),
          )
        ),
      ),
    ),
  ),
);

const detailBody = section(
  { id: "overview" },
  section(
    { class: "eds-section" },
    div(
      { style: "display:flex; gap:16px; align-items:flex-start;" },
      span(
        {
          style:
            "display:inline-flex; width:56px; height:56px; border-radius:50%; background:#2563eb; color:#fff; align-items:center; justify-content:center; font-weight:700;",
        },
        "JD",
      ),
      div(
        {},
        h2({}, "Jordan Doe"),
        p("jordan.doe@example.com"),
        div(
          { style: "display:flex; gap:8px; flex-wrap:wrap;" },
          span({ style: "padding:4px 10px; background:#e0f2fe;" }, "Active"),
          span({ style: "padding:4px 10px; background:#fef3c7;" }, "Gold"),
        ),
      ),
    ),
  ),
  section(
    { id: "details", class: "eds-section" },
    h3({}, "Details"),
    ul(
      {},
      [
        li({}, "Region: North America"),
        li({}, "Account: Enterprise Plus"),
        li({}, "Last ticket: 4 days ago"),
      ],
    ),
  ),
  section(
    { id: "activity", class: "eds-section" },
    h3({}, "Activity"),
    ul(
      {},
      [
        li({}, "Submitted onboarding survey."),
        li({}, "Updated billing address."),
        li({}, "Requested API access."),
      ],
    ),
  ),
);

const formBody = section(
  { id: "overview" },
  form(
    {},
    section(
      { class: "eds-section" },
      h3({}, "Basic Information"),
      div(
        { style: "display:grid; gap:12px; grid-template-columns: 1fr 1fr;" },
        div(
          { style: "display:grid; gap:6px;" },
          label({}, "Project name"),
          input({ type: "text", placeholder: "New project" }),
        ),
        div(
          { style: "display:grid; gap:6px;" },
          label({}, "Owner"),
          input({ type: "text", placeholder: "Owner name" }),
        ),
      ),
    ),
    section(
      { class: "eds-section" },
      h3({}, "Settings"),
      div(
        { style: "display:grid; gap:12px; grid-template-columns: 1fr 1fr;" },
        div(
          { style: "display:grid; gap:6px;" },
          label({}, "Environment"),
          select(
            {},
            option({ value: "dev" }, "Development"),
            option({ value: "stage" }, "Staging"),
            option({ value: "prod" }, "Production"),
          ),
        ),
        div(
          { style: "display:grid; gap:6px;" },
          label({}, "Region"),
          select(
            {},
            option({ value: "na" }, "North America"),
            option({ value: "eu" }, "Europe"),
            option({ value: "apac" }, "APAC"),
          ),
        ),
      ),
    ),
    div(
      { style: "display:flex; justify-content:flex-end; gap:8px;" },
      a({ href: "#" }, "Cancel"),
      a({ href: "#" }, "Create"),
    ),
  ),
);

const settingsBody = section(
  { id: "overview", style: "display:flex; gap:24px;" },
  section(
    { class: "eds-section", style: "width:220px; flex-shrink:0;" },
    ul(
      {},
      [
        li({}, a({ href: "/settings#profile" }, "Profile")),
        li({}, a({ href: "/settings#appearance" }, "Appearance")),
        li({}, a({ href: "/settings#notifications" }, "Notifications")),
      ],
    ),
  ),
  div(
    { style: "display:grid; gap:16px; flex:1;" },
    section(
      { id: "profile", class: "eds-section" },
      h3({}, "Profile Settings"),
      p("Update personal information and role assignments."),
    ),
    section(
      { id: "appearance", class: "eds-section" },
      h3({}, "Appearance"),
      p("Adjust theme preferences and density."),
    ),
    section(
      { id: "notifications", class: "eds-section" },
      h3({}, "Notifications"),
      p("Configure alerts for activity and system events."),
    ),
  ),
);

const marketingBody = section(
  { id: "overview" },
  section(
    { class: "eds-section" },
    h2({}, "Enterprise Operations, Unified"),
    p(
      "Build workflows, monitor operations, and align teams with a single enterprise workspace.",
    ),
    div(
      { style: "display:flex; gap:8px; flex-wrap:wrap;" },
      a({ href: "/demo" }, "Request demo"),
      a({ href: "/pricing" }, "View pricing"),
    ),
  ),
  div(
    {
      style:
        "display:grid; gap:16px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));",
    },
    ...["Visibility", "Governance", "Automation"].map((titleText) =>
      section(
        { class: "eds-section" },
        h3({}, titleText),
        p("Short value statement for enterprise teams."),
      )
    ),
  ),
);

function htmlFor(pathname: string) {
  switch (pathname) {
    case "/":
    case "/dashboard":
      return render(
        pageLayout({
          title: "Dashboard",
          description: "Overview of key operational metrics.",
          body: dashboardBody,
          pathname,
        }).html,
      );
    case "/users":
      return render(
        pageLayout({
          title: "Users",
          description: "Search, filter, and manage enterprise users.",
          body: usersBody,
          pathname,
        }).html,
      );
    case "/details":
      return render(
        pageLayout({
          title: "Account Details",
          description: "Customer profile and engagement insights.",
          body: detailBody,
          pathname,
        }).html,
      );
    case "/form":
      return render(
        pageLayout({
          title: "Create Project",
          description: "Capture the details for a new enterprise project.",
          body: formBody,
          pathname,
        }).html,
      );
    case "/settings":
      return render(
        pageLayout({
          title: "Settings",
          description: "Manage profile, theme, and notification settings.",
          body: settingsBody,
          pathname,
        }).html,
      );
    case "/marketing":
      return render(
        pageLayout({
          title: "Overview",
          description: "Marketing variant content in the enterprise shell.",
          body: marketingBody,
          pathname,
        }).html,
      );
    default:
      return render(
        pageLayout({
          title: "Not Found",
          description: "The requested page could not be found.",
          body: section(
            { class: "eds-section" },
            h3({}, "404"),
            p("Try the dashboard, users, or settings pages."),
          ),
          pathname,
        }).html,
      );
  }
}

const fileResponse = async (
  path: string,
  contentType: string,
  headers?: HeadersInit,
) =>
  new Response(await Deno.readTextFile(path), {
    headers: { "content-type": contentType, ...(headers ?? {}) },
  });

app.use(async (c, next) => {
  const u = new URL(c.req.url);
  console.log("[req]", c.req.method, u.pathname);
  return await next();
});

const layoutDeps = Array.from(
  pageLayout({ title: "Dashboard", body: dashboardBody, pathname: "/" })
    .dependencies,
);
for (const dep of layoutDeps) {
  if (dep.source.startsWith("http://") || dep.source.startsWith("https://")) {
    continue;
  }
  const mountPath = dep.mount;
  const filePath = dep.source.startsWith("file://")
    ? fromFileUrl(dep.source)
    : isAbsolute(dep.source)
    ? dep.source
    : "";
  if (!filePath) continue;
  const contentType = dep.contentType ?? "application/octet-stream";
  app.get(mountPath, () => fileResponse(filePath, contentType, dep.headers));
}

app.get("*", (c) =>
  new Response(htmlFor(new URL(c.req.url).pathname), {
    headers: { "content-type": "text/html; charset=utf-8" },
  }));

app.serve();
