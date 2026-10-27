// @lovable.dev/vite-tanstack-config already includes the required TanStack Start,
// React, Tailwind, path alias, and Nitro plugins. Do not add duplicate plugins.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // GitHub Pages serves this project from a repository subpath.
  vite: {
    base: "/Growora.sunflawer/",
  },
  // The game is a client-rendered interactive SPA; it does not need SSR
  // for its current local/mock gameplay.
  tanstackStart: {
    spa: {
      enabled: true,
    },
    server: { entry: "server" },
  },
});
