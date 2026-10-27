import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { GameShell } from "@/components/game/GameShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Growora — Pixel Island Farming Game" },
      { name: "description", content: "Grow crops, fish, collect honey and eggs on a pixel-art island. Grow. Upgrade. Build Your Fortune." },
      { property: "og:title", content: "Growora — Pixel Island Farming Game" },
      { property: "og:description", content: "Farm, fish, keep bees and raise chickens on your own pixel island." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ClientOnly fallback={<div className="fixed inset-0 flex items-center justify-center bg-ocean font-display text-primary">GROWORA</div>}>
      <GameShell />
    </ClientOnly>
  ),
});
