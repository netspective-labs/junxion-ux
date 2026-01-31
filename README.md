# AgentX: an AI-first, hypermedia-native UX + MX family

AgentX is the user experience (`UX`) and machine experience (`MX`) substrate for
AI agents and other microservices: the interaction, presentation, hypermedia,
and operational interface layer that lets humans and agentic systems safely
operate, interact, and maintain server-centric hypermedia systems. It covers
both the screens, interactions, and content humans use and the APIs, MCPs, and
programmatic surfaces that fleets of agents require.

AgentX is positioned for regulated environments. The AI Workforce™ is a group of
AI agents that cooperate under compliance, auditability, accountability, and
human oversight. AgentX is the interface substrate those agents (and humans) use
to act safely, deterministically, and traceably, with built-in audit trails,
open diagnostics, and governance-friendly patterns.

AgentX is a family of vertically integrated, dependency-free (or deliberately
dependency-light) UX and MX libraries and services for modern server-centric
Deno applications. It is not a framework; it is a set of tightly scoped,
composable modules that work together to support progressive enhancement, typed
hypermedia interactions, AI-first maintenance, and a complete design system for
Deno microservices and CLIs.

AgentX is designed to stand on its own. Its core layers are implemented directly
in TypeScript, rely on native platform capabilities where possible, and avoid
external frameworks, templating DSLs, and build-time ecosystems that fragment
behavior across tools.

The core promise: teams can build compelling web-based interfaces with “natural”
HTML authoring (functions, not tags) without inventing templating DSLs or
assembling a patchwork of dependencies, while still getting a cohesive,
production-grade design system that produces polished UIs without every engineer
becoming a designer.

AgentX ships with an integrated CSS framework through its design systems, so
teams can deliver complete UI experiences without pulling in Tailwind or other
external CSS libraries.

At a high level, AgentX brings together four ideas:

- Server-first HTML as the default UX substrate
- Typed hypermedia interactions instead of opaque client frameworks
- Progressive client complexity, added only when needed
- A codebase structured so AI systems can safely maintain it end to end

AgentX is not trying to be Ruby on Rails, Express, Next.js, Astro, Hono, jQuery,
or a general-purpose web framework. Those ecosystems solve broad problems across
many runtimes and rely on layered dependency stacks. AgentX is intentionally
narrower: a self-contained, AI-maintainable family of UX libraries for type-safe
Deno services, Deno microservices, and Deno CLIs that need rich, server-directed
web interfaces without external orchestration frameworks.

Our focus is different:

- Type-safe Deno services end to end (routing, HTML, interactions, schemas)
- Server-first hypermedia as the default UX substrate
- Progressive enhancement rather than a forced SPA model
- Deterministic behavior and tests so AI systems can maintain the stack
- Small, explicit libraries over opaque frameworks
- Vertical integration of the typical necessities for production-grade
  enterprise micro-UIs (HTML, CSS, HTTP, SSE, proxying, and routing)
- A single-language, type-safe TypeScript stack instead of a patchwork of
  templating engines, CSS frameworks, and build-time tooling

_Continuux_ is the interaction engine. _Natural HTML_ is the rendering substrate
(no DSLs or templates). _Natural DS_ supplies the CSS framework and page chrome
with no external CSS dependencies. _Web Components_ are the scaling mechanism
for client-side complexity. Deterministic testing is the enforcement layer.

Together, these form AgentX: a pragmatic, AI-first family of UX libraries that
is vertically integrated by design, dependency-free at its core, and intended to
remain understandable long after the original authors, human or otherwise, have
moved on.

## Quick Start

To test:

```bash
# first time in your workspace
$ deno task test:install-deps            # playwright, et. al.

# every time you change code
$ deno task test                         # runs Deno unit tests
```

Get a flavor for the code in the initial developer experience (DX) entry points:

```bash
$ ./support/learn/index.ts                     # launch the "Learning Resources Server"
```

If you run `support/learn/index.ts` it will let you run each of the example
learning resources in the integrated Learning Resources Server (`LRS`). Each
example can also be run independently without using the LRS:

```bash
$ ./support/learn/01-hello/counter.ts          # interactive counter (SSR + SSE)
$ ./support/learn/01-hello/counter-ce.ts       # SSR + Web Component + SSE
$ ./support/learn/01-hello/markdown.ts         # client-side markdown preview with custom HTML

$ ./support/learn/02-starter-ds/starter-ds.ts  # markdown preview with Starter DS

$ ./support/learn/03-natural-ds/hello.ts       # static text with Natural DS
$ ./support/learn/03-natural-ds/hello-fancy.ts # markdown preview with Natural DS
$ ./support/learn/03-natural-ds/guide.ts       # full Natural Design System demo
```

## Modules

AgentX is organized intentionally by concern, not by runtime.

### `lib/natural-html`

Modules that are broadly useful across server and client contexts, independent
of Continuux itself.

- `elements.ts` is a dependency-free, type-safe HTML builder that emits HAST for
  deterministic server-side rendering and tests. It replaces JSX, templating
  engines, and DOM mutation with explicit HTML generation, safe raw content
  handling, and stable attribute ordering. It is the foundation for all SSR in
  AgentX.
- Universal helpers that are safe to use anywhere and have no browser- or
  server-specific assumptions.
- `design-system.ts` is the highly opinionated, full-stack UI contract. It
  models layouts, regions, slots, and components with strict typing so illegal
  UI states are unrepresentable at compile time and validated at runtime in
  development. It is SSR-first, deterministic, and designed to be the backbone
  for design systems that compile down to Natural HTML. It also carries
  integrated UA dependencies (CSS and JS) so design systems ship a cohesive
  visual framework without external libraries.

#### Dialog system (`dialog.ts`, `dialog-zod.ts`, `dialog-lform.ts`)

AgentX includes a schema-driven dialog and form infrastructure built on Natural
HTML and Zod.

At its core, dialogs are projections of schemas. A dialog is defined against a
Zod object schema, and every field, value, and validation rule flows directly
from that contract. There is no parallel “form model” to keep in sync.

- `dialog.ts` The foundational dialog builder. It provides a fluent API for
  composing `<dialog>` and `<form>` structures using Natural HTML primitives.

  Capabilities include:

  - Type-safe field registration derived from Zod schemas
  - Built-in renderers for inputs, textareas, checkboxes, and selects
  - Deterministic wiring of labels, descriptions, errors, ARIA attributes, and
    IDs
  - Modal or inline rendering modes
  - Integrated dialog CSS, scripts, and UA dependencies
  - Pure server-side rendering with no DOM dependency

  Dialogs expose explicit methods such as `render()` and `headTags()` so HTML
  emission and required assets remain inspectable and testable.

- `dialog-zod.ts` A schema-centric convenience layer that allows dialog metadata
  to live alongside the Zod schema itself.

  This module lets you attach UI metadata to schemas and fields using Zod’s
  `.meta()` mechanism:

  - Field labels, descriptions, placeholders, renderers, and wrappers
  - Dialog-level defaults such as titles, submit/cancel labels, field ordering,
    default data, and attributes

  From an annotated schema, dialogs can be generated automatically with
  deterministic merging of schema defaults and per-render overrides. The schema
  becomes the single source of truth for data shape, validation, and default UI
  projection.

- `dialog-lform.ts` An interoperability adapter that converts LHC-Forms style
  questionnaire JSON into Natural HTML dialogs.

  It:

  - Loads questionnaires from local files or remote URLs
  - Flattens nested group items into a stable field order
  - Infers Zod schema types and dialog field renderers from item definitions
  - Maps answer options to selects and initial values to default form data
  - Produces a fully functional `Dialog` instance

  This allows external, declarative questionnaire formats to be rendered as
  deterministic, server-rendered HTML forms without introducing a client-side
  framework.

### `lib/continuux`

The hypermedia interaction layer. This is where server and browser “know” how to
talk to each other using typed contracts.

- `http.ts`, `bundle.ts`, and related helpers provide infrastructure for SSE
  sessions, HTTP responses, and optional on-the-fly bundling of browser modules,
  kept minimal and auditable.

- `http-fs-routes.ts` provides dynamic, file-based routing for TypeScript and
  HTML assets, with mount points, index resolution, and content transforms.

- `http-proxy.ts` provides a typed reverse proxy layer for enterprise micro-UIs
  that need to bridge upstream services without adding another runtime.

- `interaction.ts` defines the canonical interaction envelope, event metadata,
  schema decoding, routing, and diagnostics. This is the server-side foundation
  of SSE-based interactivity.

- `interaction-browser-ua.js` is a thin browser user agent runtime that:
  - Delegates DOM events
  - Builds structured interaction envelopes
  - Posts them to the server
  - Maintains an SSE connection
  - Executes server-sent JavaScript instructions It is intentionally simple,
    explicit, and not tuned for extreme performance or bundle size.

- `interaction-html.ts` is a type-safe HTML and server wiring helpers that
  provide the ergonomic surface area similar to HTMX or Datastar, but without
  stringly-typed attributes. It bridges Natural HTML with Continuux interactions
  so developers write functions, not attribute names.

Together, these form Continuux: the server-directed interaction layer inside
AgentX.

### `lib/natural-ds`

Natural DS is the canonical “Natural Design System” built on the Natural HTML
design-system runtime. It provides a concrete, opinionated set of layouts,
regions, and components (for example `NaturalDoc` and its header/sidebar/toc
regions) that power real pages and demos in this repo. It is the reference
design system for AgentX, but it is not the only option: other design systems
can be created that look completely different while retaining the same
type-safe, deterministic contract.

Natural DS also delivers an integrated CSS framework so teams can get
production-grade UI styling without adopting Tailwind or other external CSS
libraries.

## Learning resources

The `support/learn` area is the guided on-ramp. It is both human documentation
and AI-readable specs for the system.

- `support/learn/index.ts` runs the Learning Resources Server, a single UI that
  launches each example on demand.
- `support/learn/01-hello/*` demonstrates the Continuux interaction model with
  plain Natural HTML (SSR, SSE, typed events).
- `support/learn/02-starter-ds/*` shows how to layer in a starter design system
  without introducing a template DSL.
- `support/learn/03-natural-ds/*` walks through the full Natural DS experience,
  from a minimal layout to the full reference guide.

## Core architectural concepts

AgentX treats HTML and hypermedia as the primary interface between server and
browser. The browser is not a co-equal application runtime by default. It is a
progressively enhanced client that becomes more capable only when necessary.

This can be visualized as layers:

```
Server
|
+-- Natural HTML (SSR)
|
+-- Continuux actions (typed hypermedia)
|
+-- JSON APIs (only when client state demands it)
```

```
Browser
|
+-- Native HTML rendering (with Natural HTML DOM for helpers)
|
+-- Continuux browser UA (events + SSE)
|
+-- Custom Elements (isolated islands, when needed)
```

## Progressive client complexity

AgentX explicitly supports a progression model rather than a single client
architecture.

**Stage 1**: SSR only Most pages should live here.

- Server renders HTML with Natural HTML
- Links and forms drive navigation
- Full page reloads are acceptable
- State lives in URLs and server-side logic

This stage is maximally simple, maximally testable, and ideal for AI
maintenance.

**Stage 2**: SSR plus lightweight SSE interactivity This is the Continuux sweet
spot.

- HTML is still server-rendered
- DOM events post typed interaction envelopes
- Server dispatches actions and pushes updates via SSE
- Browser executes small, server-directed instructions

This is analogous in spirit to HTMX or Datastar, but with explicit typing,
schemas, and server-side routing.

**Stage 3**: Web Components with JSON APIs Used when client-side complexity
becomes real application logic.

- SSR still composes the page
- Custom Elements act as bounded client-side islands
- JSON APIs define explicit query and command contracts
- Optional SSE streams support live updates

This stage is not a failure of SSR or Continuux. It is a recognition that some
UI problems require local client state. AgentX supports this without forcing a
full SPA architecture.

Client complexity rules of thumb:

If the server can describe the UI change without encoding component state, stay
in Continuux.

If the client must own complex state transitions, move that part into a Custom
Element with a proper API.

## AI-first maintainability

AgentX is explicitly designed to be maintainable by AI systems, not just
assisted by them.

This influences several core decisions:

Small surface area There are no large frameworks or deep dependency graphs. Most
behavior is expressed directly in code within the repository.

Explicit contracts Interaction envelopes, schemas, SSE events, and APIs are all
typed and validated.

Deterministic behavior HTML output, interaction handling, and SSE messaging are
designed to be reproducible. This allows tests to assert exact outcomes.

End-to-end testing as a hard requirement Every feature must be fully testable
using:

- Deno unit tests on the server
- Playwright tests in a real browser

If a feature cannot be deterministically tested end to end, it should not be
added.

This is essential for AI maintenance. AI systems iterate by running tests,
observing failures, and refining behavior. Without deterministic tests, safe
autonomous maintenance is not possible.

## Why AgentX for AI Workforce™?

- AI Workforce™ is multiple AI agents collaborating under compliance,
  auditability, accountability, and human oversight rather than a single
  chatbot.
- Regulated settings demand traceable actions, deterministic responses, and
  auditable conversation trails; AgentX keeps logs, diagnostics, and
  schema-driven interactions in the open so reviews and forensics are
  straightforward.
- AgentX’s deterministic, server-first, typed hypermedia approach keeps behavior
  testable, maintainable (including AI maintenance), and compatible with
  compliance workflows because every interaction is explicit and observable.
- AgentX balances automation with human oversight; it lets the workforce run
  autonomously when safe and invite human review or intervention when needed.

## Where does the name come from?

AgentX is named for the interaction (UX) and machine (MX) experience layer it
provides. It is designed as a vertically integrated, dependency-free UX + MX
system that stands on its own rather than assembling behavior from external
frameworks, templating engines, or build-time ecosystems. HTML, interactions,
styling, and testing are treated as a single coherent surface, implemented
directly in TypeScript and grounded in native platform capabilities. By keeping
the stack explicit, minimal, and internally complete, AgentX remains
deterministic, inspectable, and maintainable over time, including by AI systems,
without relying on hidden dependencies or emergent behavior from layered tools.
