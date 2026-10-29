// Use the repository subpath only for GitHub Pages builds; standalone hosts use root.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    base: process.env.GITHUB_ACTIONS ? "/Growora.sunflawer/" : "/",
  },
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
