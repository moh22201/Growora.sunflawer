// @lovable.dev/vite-tanstack-config already includes the required TanStack Start,
// React, Tailwind, path alias, and Nitro plugins. Do not add duplicate plugins.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // GitHub Pages uses a repository subpath; Netlify serves from the domain root.
  vite: {
    base: process.env.NETLIFY ? "/" : "/Growora.sunflawer/",
  },
  // The game is a client-rendered interactive SPA and does not require prerendering.
  tanstackStart: {
    spa: {
      enabled: true,
    },
    prerender: {
      enabled: false,
    },
    server: { entry: "server" },
  },
});
