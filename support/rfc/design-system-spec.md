# Enterprise Design System Specification

> **AI Prompt Document**: This specification describes a complete enterprise
> design system built with React, TypeScript, Tailwind CSS, and shadcn/ui. Use
> this document to generate new pages, components, and features that are
> consistent with the established patterns.

---

## 1. Overview

### Technology Stack

- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with custom design tokens
- **Components**: shadcn/ui (Radix UI primitives)
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Routing**: React Router DOM v6
- **Forms**: React Hook Form + Zod validation
- **State**: React Context API

### Design Philosophy

- Modern SaaS aesthetic with enterprise-grade functionality
- Dark/light theme support via CSS custom properties
- Responsive layouts with mobile-first approach
- Accessible components following WCAG guidelines
- Consistent spacing, typography, and color usage

### Import Alias

All imports use the `@/` alias pointing to the `src/` directory:

```typescript
import { Button } from "@/components/ui/button";
import { MainLayout } from "@/components/layout/MainLayout";
import { useTheme } from "@/contexts/ThemeContext";
```

---

## 2. File Structure

```
src/
├── components/
│   ├── layout/           # Layout components
│   │   ├── Header.tsx    # Fixed header with nav, search, user menu
│   │   ├── Sidebar.tsx   # Collapsible navigation sidebar
│   │   ├── Footer.tsx    # Page footer
│   │   ├── MainLayout.tsx # Main page wrapper
│   │   └── RightRail.tsx # Optional right sidebar
│   └── ui/               # shadcn/ui components
├── config/
│   └── navigation.ts     # Navigation configuration
├── contexts/
│   ├── ThemeContext.tsx  # Theme state (light/dark)
│   └── SidebarContext.tsx # Sidebar state
├── hooks/
│   └── use-toast.ts      # Toast notifications
├── lib/
│   └── utils.ts          # Utility functions (cn)
├── pages/                # Page components
├── index.css             # Design tokens & base styles
├── App.tsx               # Root component with providers
└── main.tsx              # Entry point
```

---

## 3. Theme System

### CSS Custom Properties (HSL Format)

All colors are defined in `src/index.css` using HSL values without the `hsl()`
wrapper:

```css
:root {
  --primary: 239 84% 67%; /* Indigo */
  --primary-foreground: 0 0% 100%;
}
```

Reference colors in Tailwind/CSS:

```css
color: hsl(var(--primary));
background-color: hsl(var(--muted) / 0.5); /* With opacity */
```

### Color Token Categories

#### Core Semantic Colors

| Token           | Light Mode | Usage                  |
| --------------- | ---------- | ---------------------- |
| `--background`  | Near white | Page background        |
| `--foreground`  | Near black | Primary text           |
| `--card`        | White      | Card backgrounds       |
| `--primary`     | Indigo     | Primary actions, links |
| `--secondary`   | Light gray | Secondary actions      |
| `--muted`       | Light gray | Muted backgrounds      |
| `--accent`      | Teal       | Highlights, accents    |
| `--destructive` | Red        | Destructive actions    |
| `--border`      | Light gray | Borders                |
| `--ring`        | Indigo     | Focus rings            |

#### Status Colors

| Token       | Color | Usage          |
| ----------- | ----- | -------------- |
| `--success` | Green | Success states |
| `--warning` | Amber | Warning states |
| `--info`    | Blue  | Info states    |

#### Component-Specific Tokens

| Token                           | Usage                            |
| ------------------------------- | -------------------------------- |
| `--sidebar-*`                   | Sidebar colors (dark background) |
| `--header-*`                    | Header colors                    |
| `--chart-1` through `--chart-5` | Chart data colors                |

### Dark Mode

Dark mode is activated by adding the `.dark` class to the `<html>` element. All
tokens have dark mode variants defined in `index.css`.

```typescript
// Toggle theme
const { theme, toggleTheme } = useTheme();
document.documentElement.classList.toggle("dark");
```

---

## 4. Layout System

### MainLayout Component

Wrap all pages with `MainLayout` for consistent structure:

```tsx
import { MainLayout } from "@/components/layout/MainLayout";

export default function MyPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Page Title</h1>
          <p className="text-muted-foreground">Page description</p>
        </div>

        {/* Page Content */}
        <div className="grid gap-4">
          {/* Content here */}
        </div>
      </div>
    </MainLayout>
  );
}
```

### Layout Dimensions

| Element            | Value                                                  |
| ------------------ | ------------------------------------------------------ |
| Header height      | `h-14` (56px) + `h-10` (40px) breadcrumbs = 96px total |
| Content top margin | `mt-24` (96px)                                         |
| Sidebar expanded   | 260px                                                  |
| Sidebar collapsed  | 64px                                                   |
| Right rail width   | 224px (`w-56`)                                         |
| Content padding    | `p-6` (24px)                                           |

### Header Component

Fixed header with three regions:

1. **Left**: Menu toggle, logo, app name, environment badge
2. **Center**: Top-level navigation links
3. **Right**: Search, notifications, theme toggle, user menu

Plus a breadcrumbs row below.

### Sidebar Component

Collapsible left sidebar with:

- Subject selector dropdown (Admin, Analytics, Operations, Settings)
- Nested navigation sections
- Collapse/expand toggle
- Tooltips when collapsed

### RightRail Component

Optional right sidebar for in-page navigation or contextual content:

```tsx
import { RightRail } from "@/components/layout/RightRail";

const sections = [
  { id: "overview", label: "Overview" },
  { id: "details", label: "Details" },
];

<div className="flex gap-6">
  <div className="flex-1">{/* Main content */}</div>
  <RightRail
    sections={sections}
    activeSection={activeSection}
    onSectionClick={setActiveSection}
  >
    {/* Optional custom content */}
  </RightRail>
</div>;
```

### Footer Component

Minimal footer with copyright, version, quick links, and system status.

---

## 5. Context Providers

### ThemeProvider

Manages light/dark theme:

```tsx
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";

// In App.tsx
<ThemeProvider>
  <App />
</ThemeProvider>;

// In components
const { theme, toggleTheme, setTheme } = useTheme();
```

### SidebarProvider

Manages sidebar state:

```tsx
import { SidebarProvider, useSidebarContext } from "@/contexts/SidebarContext";

// In components
const {
  isOpen, // Whether sidebar is visible
  isCollapsed, // Whether sidebar is minimized
  activeSubject, // Current navigation subject
  toggleSidebar,
  setActiveSubject,
} = useSidebarContext();
```

---

## 6. Navigation Configuration

Navigation is defined in `src/config/navigation.ts`:

```typescript
export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  children?: NavItem[]; // Nested items
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

export interface SubjectConfig {
  id: SubjectType; // "admin" | "analytics" | "operations" | "settings"
  label: string;
  icon: LucideIcon;
  sections: NavSection[];
}

export const navigationConfig: SubjectConfig[] = [
  {
    id: "admin",
    label: "Administration",
    icon: Shield,
    sections: [
      {
        id: "overview",
        label: "Overview",
        items: [
          {
            id: "dashboard",
            label: "Dashboard",
            icon: LayoutDashboard,
            href: "/dashboard",
          },
        ],
      },
    ],
  },
];

// Top-level header navigation
export const topLevelNavItems = [
  { id: "home", label: "Home", href: "/" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
];
```

### Adding New Navigation

1. Add route in `App.tsx`
2. Add nav item to appropriate section in `navigationConfig`
3. Optionally add to `topLevelNavItems` for header nav

---

## 7. UI Components (shadcn/ui)

### Available Components

All components are in `src/components/ui/`:

| Category         | Components                                                                 |
| ---------------- | -------------------------------------------------------------------------- |
| **Layout**       | Card, Separator, ScrollArea, Tabs                                          |
| **Forms**        | Input, Textarea, Select, Checkbox, Switch, Slider, RadioGroup, Label, Form |
| **Buttons**      | Button, Toggle, ToggleGroup                                                |
| **Overlays**     | Dialog, AlertDialog, Sheet, Drawer, Popover, HoverCard, Tooltip            |
| **Navigation**   | NavigationMenu, Breadcrumb, Menubar, DropdownMenu, ContextMenu             |
| **Feedback**     | Alert, Toast, Progress, Skeleton, Badge                                    |
| **Data Display** | Table, Avatar, Calendar, Accordion, Collapsible                            |

### Button Variants

```tsx
<Button>Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="link">Link</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>
```

### Card Pattern

```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description text</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>;
```

### Form Pattern with Validation

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
});

const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: { name: "", email: "" },
});

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Name</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </form>
</Form>;
```

### Toast Notifications

```tsx
import { useToast } from "@/hooks/use-toast";

const { toast } = useToast();

toast({
  title: "Success",
  description: "Action completed.",
  variant: "default", // or "destructive"
});
```

---

## 8. Animation Patterns

### Framer Motion Standard Variants

```tsx
import { motion } from "framer-motion";

// Container with staggered children
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

<motion.div
  variants={containerVariants}
  initial="hidden"
  animate="visible"
>
  {items.map((item) => (
    <motion.div key={item.id} variants={itemVariants}>
      {/* Content */}
    </motion.div>
  ))}
</motion.div>;
```

### Common Animation Patterns

```tsx
// Fade in
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.2 }}
/>

// Slide in from right
<motion.aside
  initial={{ opacity: 0, x: 20 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ duration: 0.2 }}
/>

// Scale in
<motion.div
  initial={{ scale: 0.95, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
/>

// Animated layout changes
<motion.main
  initial={false}
  animate={{ marginLeft: isOpen ? 260 : 64 }}
  transition={{ duration: 0.2 }}
/>

// AnimatePresence for exit animations
<AnimatePresence mode="wait">
  <motion.div
    key={activeTab}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  />
</AnimatePresence>
```

### Tailwind Animation Classes

```css
animate-fade-in       /* Fade in */
animate-scale-in      /* Scale in */
animate-slide-in-right /* Slide from right */
animate-shimmer       /* Loading shimmer */
animate-accordion-down /* Accordion expand */
```

---

## 9. Page Templates

### Dashboard Page

KPI cards + charts + activity feed:

```tsx
export default function Dashboard() {
  return (
    <MainLayout>
      <div className="flex gap-6">
        <div className="flex-1 space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Dashboard
              </h1>
              <p className="text-muted-foreground">Welcome message</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline">Secondary Action</Button>
              <Button>Primary Action</Button>
            </div>
          </div>

          {/* KPI Cards Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi) => (
              <Card key={kpi.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {kpi.title}
                  </CardTitle>
                  <kpi.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.value}</div>
                  <p className="text-xs text-muted-foreground">
                    <TrendingUp className="inline h-3 w-3 text-success" />
                    <span className="text-success">{kpi.change}</span>{" "}
                    from last month
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">{/* Main chart */}</Card>
            <Card className="col-span-3">{/* Secondary chart */}</Card>
          </div>
        </div>

        <RightRail sections={sections}>
          {/* Quick actions */}
        </RightRail>
      </div>
    </MainLayout>
  );
}
```

### Data Table Page

Search + filters + sortable table + pagination:

```tsx
export default function DataTable() {
  const [search, setSearch] = useState("");
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header with actions */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Users</h1>
          <Button>Add New</Button>
        </div>

        {/* Filters bar */}
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Checkbox />
                  </TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={row.status === "active"
                        ? "default"
                        : "secondary"}
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Showing 1-10 of 100</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>Previous</Button>
            <Button variant="outline" size="sm">Next</Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
```

### Detail View Page

Header + tabs + content sections:

```tsx
export default function DetailView() {
  return (
    <MainLayout>
      <div className="flex gap-6">
        <div className="flex-1 space-y-6">
          {/* Detail Header */}
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">John Doe</h1>
                <Badge>Active</Badge>
              </div>
              <p className="text-muted-foreground">john@example.com</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">Edit</Button>
              <Button>Contact</Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Content */}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <RightRail sections={[...]} />
      </div>
    </MainLayout>
  );
}
```

### Form Page

Sectioned form with validation:

```tsx
export default function FormPage() {
  const form = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <MainLayout>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Create Record</h1>
          <p className="text-muted-foreground">Fill in the details below</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Section */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField ... />
              </CardContent>
            </Card>

            {/* Another Section */}
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField ... />
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline">Cancel</Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </Form>
      </div>
    </MainLayout>
  );
}
```

### Settings Page

Side navigation + content sections:

```tsx
const settingsSections = [
  { id: "profile", label: "Profile", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState("profile");

  return (
    <MainLayout>
      <div className="flex gap-6">
        {/* Side Navigation */}
        <nav className="w-48 shrink-0">
          <div className="space-y-1">
            {settingsSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm transition-colors",
                  activeSection === section.id
                    ? "bg-muted font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <section.icon className="h-4 w-4" />
                {section.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 max-w-2xl space-y-6">
          {activeSection === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
              </CardHeader>
              <CardContent>{/* Content */}</CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
```

---

## 10. Styling Conventions

### Tailwind Class Ordering

Follow this order for consistency:

1. Layout: `flex`, `grid`, `block`
2. Positioning: `relative`, `absolute`, `fixed`
3. Box model: `w-`, `h-`, `p-`, `m-`, `gap-`
4. Typography: `text-`, `font-`
5. Visual: `bg-`, `border-`, `rounded-`, `shadow-`
6. States: `hover:`, `focus:`, `disabled:`
7. Transitions: `transition-`, `duration-`

### Custom Utility Classes

```css
/* Surface utilities */
.surface-elevated  /* Card-like elevated background */
.surface-sunken    /* Inset/recessed background */

/* Text hierarchy */
.text-primary      /* Primary text color */
.text-secondary    /* Secondary/muted text */
.text-tertiary     /* Tertiary/disabled text */

/* Status colors */
.bg-success, .text-success
.bg-warning, .text-warning
.bg-info, .text-info

/* Effects */
.glass             /* Frosted glass effect */
.gradient-subtle   /* Subtle gradient background */
.focus-ring        /* Consistent focus ring */
```

### Shadow Elevation System

```tsx
shadow - elevation - 1; /* Subtle - cards */
shadow - elevation - 2; /* Default - dropdowns */
shadow - elevation - 3; /* Medium - modals */
shadow - elevation - 4; /* High - popovers */
shadow - elevation - 5; /* Highest - toasts */
```

### Spacing Scale

```css
/* Standard Tailwind + custom tokens */
4.5: "1.125rem"   /* 18px */
13: "3.25rem"     /* 52px */
15: "3.75rem"     /* 60px */
18: "4.5rem"      /* 72px */
```

---

## 11. Charts & Data Visualization

### Recharts Integration

Always use theme-aware colors via CSS variables:

```tsx
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

<ResponsiveContainer width="100%" height={300}>
  <AreaChart data={data}>
    <defs>
      <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
      </linearGradient>
    </defs>
    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
    <Tooltip
      contentStyle={{
        backgroundColor: "hsl(var(--popover))",
        border: "1px solid hsl(var(--border))",
        borderRadius: "var(--radius)",
      }}
    />
    <Area
      type="monotone"
      dataKey="value"
      stroke="hsl(var(--primary))"
      fillOpacity={1}
      fill="url(#colorPrimary)"
    />
  </AreaChart>
</ResponsiveContainer>;
```

### Chart Color Tokens

```css
--chart-1: /* Primary - Indigo */ --chart-2: /* Accent - Teal */ --chart-3:
  /* Warning - Amber */ --chart-4: /* Purple */
  --chart-5:; /* Destructive - Red */
```

---

## 12. Enterprise Patterns

### Status Badges

```tsx
<Badge>Default</Badge>
<Badge variant="secondary">Inactive</Badge>
<Badge variant="destructive">Error</Badge>
<Badge className="bg-success text-success-foreground">Active</Badge>
<Badge className="bg-warning text-warning-foreground">Pending</Badge>
<Badge className="bg-info text-info-foreground">Info</Badge>
```

### Environment Badge

```tsx
<Badge variant="secondary" className="text-2xs font-medium">
  DEV
</Badge>;
```

### Progress with Status

```tsx
<div className="space-y-2">
  <div className="flex items-center justify-between text-sm">
    <span className="font-medium">{task.label}</span>
    <Badge variant={task.status === "at-risk" ? "destructive" : "secondary"}>
      {task.status}
    </Badge>
  </div>
  <Progress value={task.progress} className="h-2" />
</div>;
```

### Activity Feed Item

```tsx
<div className="flex items-center gap-4">
  <Avatar className="h-9 w-9">
    <AvatarFallback className="bg-muted text-xs">{initials}</AvatarFallback>
  </Avatar>
  <div className="flex-1 space-y-1">
    <p className="text-sm">
      <span className="font-medium">{user}</span>{" "}
      <span className="text-muted-foreground">{action}</span>{" "}
      <span className="font-medium text-primary">{target}</span>
    </p>
    <p className="text-xs text-muted-foreground">{time}</p>
  </div>
  <DropdownMenu>{/* Actions */}</DropdownMenu>
</div>;
```

### KPI Card

```tsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium">{title}</CardTitle>
    <Icon className="h-4 w-4 text-muted-foreground" />
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">{value}</div>
    <p className="text-xs text-muted-foreground flex items-center gap-1">
      {trend === "up"
        ? <TrendingUp className="h-3 w-3 text-success" />
        : <TrendingDown className="h-3 w-3 text-destructive" />}
      <span className={trend === "up" ? "text-success" : "text-destructive"}>
        {change}
      </span>{" "}
      {description}
    </p>
  </CardContent>
</Card>;
```

---

## 13. Quick Reference

### Creating a New Page

1. Create file in `src/pages/NewPage.tsx`:

```tsx
import { MainLayout } from "@/components/layout/MainLayout";

export default function NewPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">New Page</h1>
        {/* Content */}
      </div>
    </MainLayout>
  );
}
```

2. Add route in `App.tsx`:

```tsx
<Route path="/new-page" element={<NewPage />} />;
```

3. Add to navigation in `src/config/navigation.ts`

### Common Imports

```tsx
// Layout
import { MainLayout } from "@/components/layout/MainLayout";
import { RightRail } from "@/components/layout/RightRail";

// UI Components
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Contexts
import { useTheme } from "@/contexts/ThemeContext";
import { useSidebarContext } from "@/contexts/SidebarContext";

// Utilities
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
```

### Color Usage Rules

1. **NEVER** use raw colors like `text-white`, `bg-black`, `text-blue-500`
2. **ALWAYS** use semantic tokens: `text-foreground`, `bg-background`,
   `text-primary`
3. For opacity: `bg-muted/50`, `text-muted-foreground/70`
4. For status: `text-success`, `bg-warning`, `text-destructive`

---

## 14. Appendix: Full Token Reference

### Light Mode Tokens

```css
--background: 0 0% 99% --foreground: 224 71% 4% --card: 0 0% 100% --primary: 239
  84% 67% --secondary: 220 14% 96% --muted: 220 14% 96% --accent: 173 80% 40%
  --destructive: 0 84% 60% --border: 220 13% 91% --success: 142 76% 36%
  --warning: 38 92% 50% --info: 199 89% 48%;
```

### Dark Mode Tokens

```css
--background: 224 71% 4% --foreground: 213 31% 91% --card: 222 47% 11%
  --primary: 239 84% 67% --secondary: 217 33% 17% --muted: 217 33% 17% --accent:
  173 80% 40% --destructive: 0 62% 50% --border: 217 33% 17% --success: 142 70%
  45% --warning: 38 92% 50% --info: 199 89% 48%;
```

---

_End of Enterprise Design System Specification_
