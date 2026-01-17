// lib/continuux/bundle_test.ts
import { assert, assertEquals, assertMatch } from "@std/assert";
import { autoTsJsBundler, InMemoryBundler } from "./bundle.ts";
import { Application } from "./http.ts";

const hasDenoBundle = (): boolean => {
  const d = Deno as unknown as { bundle?: unknown };
  return typeof d.bundle === "function";
};

Deno.test(
  "InMemoryBundler bundles (or fails predictably), caches, primes, and clears",
  async (t) => {
    const dir = await Deno.makeTempDir({ prefix: "jx-bundler-test-" });
    try {
      const entry = `${dir}/entry.ts`;
      const dep = `${dir}/dep.ts`;

      await Deno.writeTextFile(dep, `export const msg = "bundled-ok";\n`);
      await Deno.writeTextFile(
        entry,
        [
          `import { msg } from "./dep.ts";`,
          `console.log(msg);`,
          `export const value = msg;`,
          ``,
        ].join("\n"),
      );

      const bundler = new InMemoryBundler({ defaultMinify: false });
      const bundleEnabled = hasDenoBundle();

      await t.step("bundle()", async () => {
        const r = await bundler.bundle(entry, {
          cacheKey: "k1",
          minify: false,
        });

        if (bundleEnabled) {
          assert(r.ok);
          assertMatch(r.js, /bundled-ok/);
          assertEquals(bundler.cacheSize, 1);
        } else {
          assert(!r.ok);
          assertEquals(r.status, 500);
          assertMatch(r.message, /Deno\.bundle failed/);
        }
      });

      await t.step("bundle cache hit", async () => {
        const r = await bundler.bundle(entry, { cacheKey: "k1" });

        if (bundleEnabled) {
          assert(r.ok);
          assertEquals(bundler.cacheSize, 1);
        } else {
          assert(!r.ok);
        }
      });

      await t.step("prime / peek", () => {
        bundler.prime("k2", "console.log('primed')");
        assertEquals(bundler.peek("k2"), "console.log('primed')");
      });

      await t.step("clearCache", () => {
        bundler.clearCache();
        assertEquals(bundler.cacheSize, 0);
      });

      await t.step("jsModuleResponse()", async () => {
        const r = await bundler.jsModuleResponse(entry, {
          cacheControl: "no-store",
          minify: false,
        });

        if (bundleEnabled) {
          assertEquals(r.status, 200);
          assertEquals(
            r.headers.get("content-type"),
            "text/javascript; charset=utf-8",
          );
          const body = await r.text();
          assertMatch(body, /bundled-ok/);
        } else {
          assertEquals(r.status, 500);
          const body = await r.text();
          assertMatch(body, /Deno\.bundle/);
        }
      });
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  },
);

Deno.test("autoTsJsBundler middleware bundles client modules", async () => {
  const dir = await Deno.makeTempDir({ prefix: "jx-bundler-mw-" });
  try {
    const entry = `${dir}/client.ts`;
    await Deno.writeTextFile(
      entry,
      `export const hello = "hello-from-client";`,
    );

    const app = Application.sharedState({}).use(
      autoTsJsBundler({
        isCandidate: (url) => url.pathname === "/client.js" ? entry : false,
      }),
    );

    const res = await app.fetch(
      new Request("http://localhost/client.js"),
    );

    if (hasDenoBundle()) {
      assertEquals(res.status, 200);
      assertEquals(
        res.headers.get("content-type"),
        "text/javascript; charset=utf-8",
      );
      const body = await res.text();
      assertMatch(body, /hello-from-client/);
    } else {
      console.error("Deno.bundle() not found!?");
    }
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});
