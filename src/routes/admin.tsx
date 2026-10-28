import { createFileRoute, Link } from "@tanstack/react-router";
import { getConfig } from "@/game/config";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Growora — Admin" }] }),
  component: AdminPage,
});

function AdminPage() {
  const config = getConfig();
  return (
    <main className="min-h-screen bg-ocean p-4 text-foreground sm:p-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex items-center justify-between gap-3">
          <h1 className="font-display text-xl text-primary">GROWORA · ADMIN</h1>
          <Link to="/" className="hud-chip px-3 py-2 text-sm underline">Back to game</Link>
        </header>
        <p className="text-sm opacity-80">Admin configuration preview. Values are currently read-only and stored in the game configuration.</p>
        <section className="grid gap-3 sm:grid-cols-2">
          <article className="hud-chip space-y-2 p-4">
            <h2 className="font-display text-xs text-primary">Economy</h2>
            <p>Starting play balance: ${config.startingPlayBalance}</p>
            <p>Minimum withdrawal: ${config.wallet.minWithdrawal}</p>
            <p>Withdrawal fee: {config.wallet.feePercent}%</p>
          </article>
          <article className="hud-chip space-y-2 p-4">
            <h2 className="font-display text-xs text-primary">Fishing</h2>
            <p>Cast cost: ${config.fishing.castCost}</p>
            <p>Miss chance: {Math.round(config.fishing.missChance * 100)}%</p>
            <p>Catch expiry: {config.fishing.expireMinutes} minutes</p>
          </article>
        </section>
        <section className="hud-chip space-y-2 p-4">
          <h2 className="font-display text-xs text-primary">Crops</h2>
          <div className="space-y-1">
            {config.crops.map((crop) => (
              <div key={crop.id} className="flex flex-wrap justify-between gap-2 border-b border-wood/40 py-2 text-sm">
                <span className="capitalize">{crop.id}</span>
                <span>${crop.seedPrice} seed · {crop.growHours}h · ${crop.salePrice} sale/unit</span>
              </div>
            ))}
          </div>
        </section>
        <p className="text-xs opacity-70">This page is a configuration preview, not a secured production admin panel.</p>
      </div>
    </main>
  );
}
