// Keep the Lovable TanStack Start defaults; they configure Nitro for Netlify.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    base: process.env.NETLIFY ? "/" : "/Growora.sunflawer/",
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
