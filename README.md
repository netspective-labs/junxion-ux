# Junxion UX: an AI-first, hypermedia-native UX family

Junxion UX is a family of integrated user experience (UX) libraries and services
for modern server-centric web applications. It is not a framework. It is a set
of tightly scoped libraries that work together to support progressive
enhancement, typed hypermedia interactions, AI-first maintenance, and a full
design system for Deno microservices and CLIs.

The core promise: teams can build compelling web-based UIs with “natural” HTML
authoring (functions, not tags), without inventing templating DSLs, while
getting a cohesive design system that produces good-looking UIs without every
developer becoming a designer.

Junxion UX also ships an integrated CSS framework through its design systems, so
you can deliver outstanding UI without pulling in Tailwind or other external CSS
libraries.

At a high level, Junxion UX brings together four ideas:

- Server-first HTML as the default UX substrate
- Typed hypermedia interactions instead of opaque client frameworks
- Progressive client complexity, added only when needed
- A codebase structured so AI systems can safely maintain it end to end

Junxion UX is not trying to be Ruby on Rails, Express, Next.js, Astro, Hono,
jQuery, or a general-purpose web framework. Those ecosystems solve broad web
application problems across many runtimes. Junxion UX is intentionally narrower:
a special-purpose, AI-maintainable family of UX libraries for type-safe Deno
services, Deno microservices, and Deno CLIs that need rich, server-directed web
interfaces.

Our focus is different:

- Type-safe Deno services end to end (routing, HTML, interactions, schemas)
- Server-first hypermedia as the default UX substrate
- Progressive enhancement rather than a forced SPA model
- Deterministic behavior and tests so AI systems can maintain the stack
- Small, explicit libraries over opaque frameworks
- Vertical integration of the typical necessities for production-grade
  enterprise micro-UIs (HTML, CSS, HTTP, SSE, proxying, and routing)
- A single-language, type-safe TypeScript stack instead of a patchwork of
  templating engines, CSS frameworks, and build-time ecosystems

_Continuux_ is the interaction engine. _Natural HTML_ is the rendering substrate
(no DSLs or templates). _Natural DS_ supplies the CSS framework and page chrome
without external dependencies. _Web Components_ are the scaling mechanism for
client complexity. Deterministic testing is the enforcement layer.

Together, these form Junxion UX: a pragmatic, AI-first family of libraries for
building modern web UIs that remain understandable long after the original
authors, human or otherwise, have moved on.

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
learning resources in the integrate "Learning Resources Server" (`LRS`).
However, you can also run each one individually without using the `LRS`:

```bash
$ ./support/learn/01-hello/counter.ts          # interactive counter (SSR + SSE) increment app
$ ./support/learn/01-hello/counter-ce.ts       # interactive counter (SSR + Web Component + SSE) increment app
$ ./support/learn/01-hello/markdown.ts         # client-side markdown preview app with custom HTML

$ ./support/learn/02-starter-ds/starter-ds.ts  # client-side markdown preview app with Starter DS

$ ./support/learn/03-natural-ds/hello.ts       # static text with Natural DS
$ ./support/learn/03-natural-ds/hello-fancy.ts # client-side markdown preview app with Natural DS
$ ./support/learn/03-natural-ds/guide.ts       # demo of full Natural Design System
```

## Modules

Junxion UX is organized intentionally by concern, not by runtime.

### `lib/natural-html`

Modules that are broadly useful across server and client contexts, independent
of Continuux itself.

- `elements.ts` is a dependency-free, type-safe HTML builder that emits HAST for
  deterministic server-side rendering and tests. It replaces JSX, templating
  engines, and DOM mutation with explicit HTML generation, safe raw content
  handling, and stable attribute ordering. It is the foundation for all SSR in
  Junxion UX.
- `elements-dom.js` is a twin of `elements.ts` for web browser user agents.
- Other universal helpers Utilities that are safe to use anywhere and have no
  browser- or server-specific assumptions.
- `design-system.ts` is the highly opinionated, full-stack UI contract. It
  models layouts, regions, slots, and components with strict typing so illegal
  UI states are unrepresentable at compile time and validated at runtime in dev.
  It is SSR-first, deterministic, and designed to be the backbone for design
  systems that compile down to Natural HTML. It also carries integrated UA
  dependencies (CSS and JS) so design systems can ship a cohesive visual
  framework without external CSS libraries.

### `lib/continuux`

The hypermedia interaction layer. This is where server and browser “know” how to
talk to each other using typed contracts.

- `http.ts`, `bundle.ts`, and related helpers provide Infrastructure for SSE
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
Junxion UX.

### `lib/natural-ds`

Natural DS is the canonical “Natural Design System” built on the Natural HTML
design-system runtime. It provides a concrete, opinionated set of layouts,
regions, and components (for example `NaturalDoc` and its header/sidebar/toc
regions) that power real pages and demos in this repo. It is the reference
design system for Junxion UX, but it is not the only option: other design
systems can be created that look completely different while retaining the same
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

Junxion UX treats HTML and hypermedia as the primary interface between server
and browser. The browser is not a co-equal application runtime by default. It is
a progressively enhanced client that becomes more capable only when necessary.

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

Junxion UX explicitly supports a progression model rather than a single client
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
UI problems require local client state. Junxion UX supports this without forcing
a full SPA architecture.

Client complexity rules of thumb:

If the server can describe the UI change without encoding component state, stay
in Continuux.

If the client must own complex state transitions, move that part into a Custom
Element with a proper API.

## AI-first maintainability

Junxion UX is explicitly designed to be maintainable by AI systems, not just
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
