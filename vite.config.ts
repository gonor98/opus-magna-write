// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // COMPAT: @tanstack/start-plugin-core >= 1.171 (pulled in by @tanstack/react-start
  // 1.169.5, the CVE-2026-102989 fix) writes the client/server entry ONLY into
  // build.rolldownOptions, which the installed vite 7.3.2 (Rollup-based) never
  // reads — it only honors build.rollupOptions.input, so the build fell back to
  // the default "index.html" entry and failed. Mirror the same virtual entries
  // into rollupOptions (exactly what start-plugin-core <= 1.169.6 did) until
  // vite is upgraded to >= 8. No dependencies changed by this workaround.
  // NOTE: the SSR environment is named "ssr" (START_ENVIRONMENT_NAMES.server),
  // not "server".
  vite: {
    environments: {
      client: {
        build: {
          rollupOptions: {
            input: { index: "virtual:tanstack-start-client-entry" },
          },
        },
      },
      ssr: {
        build: {
          rollupOptions: {
            input: "virtual:tanstack-start-server-entry",
          },
        },
      },
    },
  },
});
