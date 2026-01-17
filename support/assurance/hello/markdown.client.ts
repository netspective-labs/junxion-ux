/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// support/assurance/hello/markdown.client.ts
/**
 * Browser client for the ContinuUX Markdown example.
 *
 * Characteristics:
 * - Static ESM imports from CDN (no dynamic import, no eval strings)
 * - Strong TypeScript typing
 * - Browser-native execution (no framework)
 * - Bundler-friendly but does not require bundling
 *
 * Dependencies are resolved via ESM CDN.
 */

// deno-lint-ignore no-import-prefix
import { remark } from "https://esm.sh/remark@15?bundle";
// deno-lint-ignore no-import-prefix
import remarkHtml from "https://esm.sh/remark-html@16?bundle";

type MaybeEl<T extends HTMLElement> = T | null;

const byId = <T extends HTMLElement>(id: string): MaybeEl<T> =>
  document.getElementById(id) as MaybeEl<T>;

function setStatus(text: string, busy = false) {
  const el = byId<HTMLElement>("status");
  if (!el) return;
  el.textContent = text;
  el.toggleAttribute("aria-busy", busy);
}

function setContent(html: string) {
  const el = byId<HTMLElement>("content");
  if (!el) return;
  el.innerHTML = html;
}

async function fetchMarkdown() {
  const r = await fetch("/example.md", {
    headers: { accept: "text/markdown" },
  });
  if (!r.ok) {
    throw new Error(`Failed to fetch markdown (${r.status})`);
  }
  return await r.text();
}

async function markdownToHtml(markdown: string) {
  const file = await remark()
    .use(remarkHtml)
    .process(markdown);

  return String(file);
}

async function run() {
  try {
    setStatus("Loading markdown…", true);

    const markdown = await fetchMarkdown();

    setStatus("Rendering markdown…", true);

    const html = await markdownToHtml(markdown);

    setContent(html);
    setStatus("Done");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(`Error: ${msg}`);
    setContent("");
    console.error(err);
  }
}

// Deterministic startup
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void run();
  });
} else {
  void run();
}
