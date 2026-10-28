// @lovable.dev/vite-tanstack-config includes the TanStack Start, React,
// Tailwind, path alias and Nitro plugins.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    base: process.env.NETLIFY ? "/" : "/Growora.sunflawer/",
  },
  tanstackStart: {
    server: { entry: "server" },
  },
  // This option belongs at the top level, not inside tanstackStart.
  prerender: {
    enabled: false,
  },
  nitro: {
    preset: "netlify",
    output: {
      dir: ".netlify",
      serverDir: ".netlify/functions-internal/server",
      publicDir: "dist/client",
    },
  },
});
