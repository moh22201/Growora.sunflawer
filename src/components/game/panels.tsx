import { useEffect, useState } from "react";

import Decimal from "decimal.js";
import { Backpack, Egg, Fish, Hexagon, Settings, Sprout, Store, User, Wallet } from "lucide-react";
import { DEPOSIT_ADDRESS, getConfig } from "@/game/config";
import { D, fishingStatus, fmtDuration, fmtMoney, fmtSalesMoney, fmtQty, itemKind, itemPrice, levelNeed, plotInfo, production, MIN } from "@/game/logic";
import { accountService, farmService, fishingService, marketService, productionService, settingsService, walletService, type Result } from "@/game/services";
import { useGame, type Tx } from "@/game/store";
import { useT } from "@/game/i18n";
import { soundEnabled, setSoundEnabled } from "@/game/sound";
import { Bar, DemoNote, Field, PixelButton, Row, Sheet, Tabs } from "./ui";
import { AVATAR_COUNT, Avatar, ItemIcon } from "./icons";

export type Panel =
  | { kind: "plot"; index: number }
  | { kind: "fishing" }
  | { kind: "hive" }
  | { kind: "coop" }
  | { kind: "market" }
  | { kind: "inventory" }
  | { kind: "wallet" }
  | { kind: "account" }
  | { kind: "settings" };

export type Act = (r: Result | Promise<Result>, fxTarget?: "farm" | "fishing" | "hive" | "coop" | "market" | number) => void;

export function useNow(ms = 500) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function PanelHost({ panel, close, act }: { panel: Panel; close: () => void; act: Act }) {
  switch (panel.kind) {
    case "plot":
      return <PlotPanel index={panel.index} close={close} act={act} />;
    case "fishing":
      return <FishingPanel close={close} act={act} />;
    case "hive":
    case "coop":
      return <ProdPanel kind={panel.kind} close={close} act={act} />;
    case "market":
      return <MarketPanel close={close} act={act} />;
    case "inventory":
      return <InventoryPanel close={close} />;
    case "wallet":
      return <WalletPanel close={close} act={act} />;
    case "account":
      return <AccountPanel close={close} act={act} />;
    case "settings":
      return <SettingsPanel close={close} />;
  }
}

function PlotPanel({ index, close, act }: { index: number; close: () => void; act: Act }) {
  const s = useGame();
  const t = useT();
  const now = useNow();
  const cfg = getConfig();
  const info = plotInfo(s.plots[index], now);
  const title = t("plot.title", { n: index + 1 });
  if (!s.unlocked[index]) {
    const req = cfg.plots[index];
    return (
      <Sheet title={title} onClose={close} icon={<Sprout className="size-4" />}>
        <p>{t("plot.locked")}</p>
        <p className="text-muted-foreground">{t("plot.requires", { level: req.level, cost: fmtMoney(req.cost) })}</p>
        <PixelButton onClick={() => act(farmService.unlockPlot(index), index)}>{t("plot.unlock")}</PixelButton>
      </Sheet>
    );
  }
  if (info.state !== "empty") {
    return (
      <Sheet title={title} onClose={close} icon={<Sprout className="size-4" />}>
        <div className="flex items-center gap-3">
          <ItemIcon id={info.cropId} size={40} />
          <div className="flex-1 space-y-1">
            <p className="font-semibold">{info.state === "ready" ? t("common.ready") : t("plot.growing", { item: info.cropId })}</p>
            <Bar pct={info.pct} />
            {info.state === "growing" && (
              <p className="text-sm text-muted-foreground">
                {t("common.remaining")}: {fmtDuration(info.remaining)}
              </p>
            )}
          </div>
        </div>
        <PixelButton
          variant="green"
          className="w-full"
          disabled={info.state !== "ready"}
          onClick={() => {
            act(farmService.harvest(index), index);
          }}
        >
          {t("plot.harvest")}
        </PixelButton>
      </Sheet>
    );
  }
  return (
    <Sheet title={title} onClose={close} icon={<Sprout className="size-4" />}>
      <p className="text-muted-foreground">{t("plot.choose")}</p>
      <SeedList
        act={act}
        onPlant={(id) => {
          const r = farmService.plant(index, id);
          act(r, index);
          if (r.ok) close();
        }}
      />
    </Sheet>
  );
}

function SeedList({ act, onPlant }: { act: Act; onPlant?: (id: string) => void }) {
  const s = useGame();
  const t = useT();
  return (
    <div className="space-y-1.5">
      {getConfig().crops.map((c) => {
        const owned = s.seeds[c.id] ?? 0;
        return (
          <Row key={c.id}>
            <ItemIcon id={c.id} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="font-semibold">
                {t(`item.${c.id}`)} <span className="text-sm text-muted-foreground">· {fmtMoney(c.seedPrice)}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {t("plot.seedInfo", { time: `${c.growHours}h`, qty: fmtQty(c.harvestQty), price: fmtMoney(c.salePrice) })}
              </p>
              <p className="text-xs">
                {t("common.owned")}: {owned}
              </p>
            </div>
            <PixelButton size="sm" variant="blue" onClick={() => act(farmService.buySeed(c.id, 1))}>
              {t("common.buy")}
            </PixelButton>
            {onPlant && (
              <PixelButton size="sm" variant="green" disabled={owned < 1} onClick={() => onPlant(c.id)}>
                {t("plot.plant")}
              </PixelButton>
            )}
          </Row>
        );
      })}
    </div>
  );
}

function FishingPanel({ close, act }: { close: () => void; act: Act }) {
  const s = useGame();
  const t = useT();
  const now = useNow();
  const cfg = getConfig().fishing;
  const st = fishingStatus(s, now);
  const rod = cfg.rods[s.rodLevel];
  const next = cfg.rods[s.rodLevel + 1];
  return (
    <Sheet title={t("fish.title")} onClose={close} icon={<Fish className="size-4" />}>
      <Row>
        <div className="flex-1">
          <p className="font-semibold">
            {t("fish.rod")} · {t("common.level")} {s.rodLevel + 1}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("fish.castTime")}: {rod.castMinutes}m · +{Math.round(rod.rareBonus * 100)}% · {fmtMoney(cfg.castCost)}/{t("fish.cast")}
          </p>
        </div>
        <PixelButton size="sm" variant="blue" disabled={!next} onClick={() => act(fishingService.upgradeRod())}>
          {next ? `${t("common.upgrade")} ${fmtMoney(next.cost)}` : t("common.max")}
        </PixelButton>
      </Row>
      <div className="space-y-1.5">
        <p className="font-display text-[10px]">{t("fish.rod")} · {t("common.cost")}</p>
        {cfg.rods.map((r, i) => (
          <Row key={i} className={i === s.rodLevel ? "border border-primary/60" : ""}>
            <Fish className="size-4 text-primary" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="font-semibold">{t("fish.rod")} {i + 1}{i === s.rodLevel ? " · ✓" : ""}</p>
              <p className="text-xs text-muted-foreground">
                {fmtMoney(r.cost)} · {r.castMinutes}m · +{Math.round(r.rareBonus * 100)}% {t("fish.rareBonus")}
              </p>
            </div>
            {i > s.rodLevel && i === s.rodLevel + 1 && (
              <PixelButton size="sm" variant="blue" onClick={() => act(fishingService.upgradeRod())}>
                {t("common.buy")} {fmtMoney(r.cost)}
              </PixelButton>
            )}
          </Row>
        ))}
      </div>
      <div className="pixel-inset space-y-2 bg-secondary/30 p-3">
        {st === "idle" && <p>{t("fish.idle")}</p>}
        {st === "waiting" && s.fishing && (
          <>
            <p>{t("fish.waiting")}</p>
            <Bar pct={(now - s.fishing.castAt) / (s.fishing.readyAt - s.fishing.castAt)} />
            <p className="text-sm">{fmtDuration(s.fishing.readyAt - now)}</p>
          </>
        )}
        {st === "ready" && s.fishing && (
          <>
            <p className="font-semibold">{t("fish.ready")}</p>
            <p className="text-sm text-destructive">{t("fish.expires", { time: fmtDuration(s.fishing.expiresAt - now) })}</p>
          </>
        )}
        {st === "expired" && <p className="text-destructive">{t("fish.expired")}</p>}
        <div className="flex gap-2">
          <PixelButton variant="blue" disabled={st === "waiting" || st === "ready"} onClick={() => act(fishingService.cast(), "fishing")}>
            {t("fish.cast")}
          </PixelButton>
          <PixelButton variant="green" disabled={st !== "ready" && st !== "expired"} onClick={() => act(fishingService.collect(), "fishing")}>
            {t("fish.reel")}
          </PixelButton>
        </div>
      </div>
      <div className="space-y-1">
        {cfg.fish.map((f) => (
          <Row key={f.id}>
            <ItemIcon id={f.id} />
            <span className="flex-1">{t(`item.${f.id}`)}</span>
            <span className="text-sm text-muted-foreground">
              {Math.round(f.chance * 100)}% · {fmtMoney(f.price)}
            </span>
          </Row>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">⏱ {t("fish.expires", { time: `${cfg.expireMinutes}m` })}</p>
    </Sheet>
  );
}

function ProdPanel({ kind, close, act }: { kind: "hive" | "coop"; close: () => void; act: Act }) {
  const s = useGame();
  const t = useT();
  const now = useNow();
  const p = production(kind, s, now);
  const next = getConfig()[kind].levels[s[kind].level + 1];
  const item = kind === "hive" ? "honey" : "egg";
  return (
    <Sheet title={t(`${kind}.title`)} onClose={close} icon={kind === "hive" ? <Hexagon className="size-4" /> : <Egg className="size-4" />}>
      <div className="flex items-center gap-3">
        <ItemIcon id={item} size={44} />
        <div className="flex-1 space-y-1">
          <p className="font-semibold">
            {t("common.level")} {s[kind].level + 1} · {t("prod.rate", { rate: p.perHour.mul(s.speed > 1 ? 1 : 1).toString() })}
          </p>
          <Bar pct={p.amount.div(p.capacity).toNumber()} />
          <p className="text-sm text-muted-foreground">
            {t("prod.stored")}: {fmtQty(p.amount)} / {p.capacity.toString()} {t(`item.${item}`)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <PixelButton variant="green" disabled={p.amount.lt(1)} onClick={() => act(productionService.collect(kind), kind)}>
          {t("common.collect")}
        </PixelButton>
        <PixelButton variant="blue" disabled={!next} onClick={() => act(productionService.upgrade(kind))}>
          {next ? `${t("common.upgrade")} ${fmtMoney(next.cost)}` : t("common.max")}
        </PixelButton>
      </div>
      {next && (
        <p className="text-xs text-muted-foreground">
          → {t("prod.rate", { rate: next.perHour })} · {t("prod.capacity")} {next.capacity}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {t("common.price")}: {fmtMoney(itemPrice(item) ?? 0)} / {t(`item.${item}`)}
      </p>
    </Sheet>
  );
}

function MarketPanel({ close, act }: { close: () => void; act: Act }) {
  const t = useT();
  const [tab, setTab] = useState<"crop" | "fish" | "honey" | "egg" | "seeds">("crop");
  return (
    <Sheet title={t("market.title")} onClose={close} icon={<Store className="size-4" />}>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "crop", label: t("nav.farm") },
          { id: "fish", label: t("market.fish") },
          { id: "honey", label: t("nav.honey") },
          { id: "egg", label: t("nav.eggs") },
          { id: "seeds", label: t("market.seeds") },
        ]}
      />
      {tab === "fish" ? <FishMarketList act={act} /> : tab === "seeds" ? <SeedList act={act} /> : <SellList kind={tab} act={act} />}
    </Sheet>
  );
}

function FishMarketList({ act }: { act: Act }) {
  const s = useGame();
  const t = useT();
  const fish = getConfig().fishing.fish;
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<{ id: string; qty: string } | null>(null);
  const totalQty = fish.reduce((sum, f) => sum.plus(s.inventory[f.id] ?? 0), D(0));
  const totalValue = fish.reduce((sum, f) => sum.plus(D(s.inventory[f.id] ?? 0).mul(f.price)), D(0));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Row className="flex-col items-start gap-1">
          <span className="text-xs text-muted-foreground">{t("common.owned")} · {t("market.fish")}</span>
          <strong className="text-lg">{fmtQty(totalQty)}</strong>
        </Row>
        <Row className="flex-col items-start gap-1">
          <span className="text-xs text-muted-foreground">{t("common.price")} · {t("market.fish")}</span>
          <strong className="text-lg">{fmtMoney(totalValue)}</strong>
        </Row>
      </div>
      <p className="font-display text-[10px]">{t("market.fish")} · {fish.length}</p>
      {confirm && <ConfirmSell {...confirm} onDone={() => setConfirm(null)} act={act} />}
      {fish.map((f) => {
        const have = D(s.inventory[f.id] ?? 0);
        const q = qtys[f.id] ?? "";
        return (
          <Row key={f.id} className="flex-wrap">
            <ItemIcon id={f.id} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="font-semibold">{t(`item.${f.id}`)}</p>
              <p className="text-xs text-muted-foreground">
                {t("common.owned")}: {fmtQty(have)} · {fmtMoney(f.price)} / {t("common.unit") || "unit"}
              </p>
              <p className="text-xs text-muted-foreground">{Math.round(f.chance * 100)}% {t("fish.chance") || "catch chance"}</p>
            </div>
            <input
              inputMode="decimal"
              placeholder="0"
              value={q}
              onChange={(e) => setQtys({ ...qtys, [f.id]: e.target.value })}
              className="pixel-inset w-16 bg-input px-1.5 py-1 text-card-foreground outline-none"
              aria-label={t("common.qty")}
            />
            <PixelButton size="sm" disabled={have.lte(0)} onClick={() => setConfirm({ id: f.id, qty: q || "0" })}>
              {t("common.sell")}
            </PixelButton>
            <PixelButton size="sm" variant="wood" disabled={have.lte(0)} onClick={() => setConfirm({ id: f.id, qty: have.toString() })}>
              {t("common.sellAll")}
            </PixelButton>
          </Row>
        );
      })}
    </div>
  );
}

function SellList({ kind, act }: { kind: "crop" | "fish" | "honey" | "egg"; act: Act }) {
  const s = useGame();
  const t = useT();
  const cfg = getConfig();
  const ids = kind === "crop" ? cfg.crops.map((c) => c.id) : kind === "fish" ? cfg.fishing.fish.map((f) => f.id) : [kind];
  const [confirm, setConfirm] = useState<{ id: string; qty: string } | null>(null);
  const [qtys, setQtys] = useState<Record<string, string>>({});
  return (
    <div className="space-y-1.5">
      {kind === "fish" && <p className="font-display text-[10px]">{t("market.fish")} · {ids.length}</p>}
      {confirm && <ConfirmSell {...confirm} onDone={() => setConfirm(null)} act={act} />}
      {ids.map((id) => {
        const have = D(s.inventory[id] ?? 0);
        const price = itemPrice(id) ?? "0";
        const q = qtys[id] ?? "";
        return (
          <Row key={id} className="flex-wrap">
            <ItemIcon id={id} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="font-semibold">{t(`item.${id}`)}</p>
              <p className="text-xs text-muted-foreground">
                {t("common.owned")}: {fmtQty(have)} · {fmtMoney(price)}
              </p>
            </div>
            <input
              inputMode="decimal"
              placeholder="0"
              value={q}
              onChange={(e) => setQtys({ ...qtys, [id]: e.target.value })}
              className="pixel-inset w-20 bg-input px-1.5 py-1 text-card-foreground outline-none"
              aria-label={t("common.qty")}
            />
            <PixelButton size="sm" disabled={have.lte(0)} onClick={() => setConfirm({ id, qty: q || "0" })}>
              {t("common.sell")}
            </PixelButton>
            <PixelButton size="sm" variant="wood" disabled={have.lte(0)} onClick={() => setConfirm({ id, qty: have.toString() })}>
              {t("common.sellAll")}
            </PixelButton>
          </Row>
        );
      })}
    </div>
  );
}

function ConfirmSell({ id, qty, onDone, act }: { id: string; qty: string; onDone: () => void; act: Act }) {
  const t = useT();
  let total = "0";
  try {
    total = D(qty).mul(itemPrice(id) ?? 0).toDecimalPlaces(4, Decimal.ROUND_DOWN).toString();
  } catch {
    /* invalid */
  }
  return (
    <div className="pixel-inset space-y-2 bg-primary/25 p-2">
      <p>{t("market.confirmSell", { qty: fmtQtySafe(qty), item: id, total: fmtMoney(total) })}</p>
      <div className="flex gap-2">
        <PixelButton
          variant="green"
          size="sm"
          onClick={() => {
            act(marketService.sell(id, qty), "market");
            onDone();
          }}
        >
          {t("common.confirm")}
        </PixelButton>
        <PixelButton variant="ghost" size="sm" onClick={onDone}>
          {t("common.cancel")}
        </PixelButton>
      </div>
    </div>
  );
}
const fmtQtySafe = (q: string) => {
  try {
    return fmtQty(q);
  } catch {
    return q;
  }
};

function InventoryPanel({ close }: { close: () => void }) {
  const s = useGame();
  const t = useT();
  const seeds = Object.entries(s.seeds).filter(([, n]) => n > 0);
  const items = Object.entries(s.inventory).filter(([id, q]) => D(q).gt(0) && itemKind(id));
  return (
    <Sheet title={t("inv.title")} onClose={close} icon={<Backpack className="size-4" />}>
      <h3 className="font-display text-[10px]">{t("inv.seeds")}</h3>
      {seeds.length === 0 && <p className="text-muted-foreground">{t("common.empty")}</p>}
      <div className="grid grid-cols-3 gap-1.5">
        {seeds.map(([id, n]) => (
          <Row key={id} className="flex-col text-center">
            <ItemIcon id={id} />
            <span className="text-xs">{t(`item.${id}`)}</span>
            <span className="font-semibold">×{n}</span>
          </Row>
        ))}
      </div>
      <h3 className="font-display text-[10px]">{t("inv.produce")}</h3>
      {items.length === 0 && <p className="text-muted-foreground">{t("common.empty")}</p>}
      <div className="grid grid-cols-3 gap-1.5">
        {items.map(([id, q]) => (
          <Row key={id} className="flex-col text-center">
            <ItemIcon id={id} />
            <span className="text-xs">{t(`item.${id}`)}</span>
            <span className="font-semibold">{fmtQty(q)}</span>
          </Row>
        ))}
      </div>
    </Sheet>
  );
}

const SAMPLE_TXS: Tx[] = [
  { id: "s1", kind: "deposit", labelKey: "tx.depositDemo", amount: "25", currency: "play", at: 0, status: "confirmed", demo: true },
  { id: "s2", kind: "withdraw", labelKey: "tx.withdrawDemo", amount: "-12", currency: "sales", at: 0, status: "pending", demo: true },
  { id: "s3", kind: "withdraw", labelKey: "tx.withdrawDemo", amount: "-40", currency: "sales", at: 0, status: "rejected", demo: true },
];

function TxList({ txs }: { txs: Tx[] }) {
  const t = useT();
  if (!txs.length) return <p className="text-muted-foreground">{t("common.empty")}</p>;
  return (
    <div className="space-y-1">
      {txs.map((x) => (
        <Row key={x.id} className="text-sm">
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate">{t(x.labelKey, x.vars)}</p>
            <p className="text-xs text-muted-foreground">
              {x.at ? new Date(x.at).toLocaleString() : t("wallet.sample")} · {t(`hud.${x.currency}`)}
              {x.demo ? ` · ${t("app.demo")}` : ""}
            </p>
          </div>
          <span className="font-semibold">{fmtMoney(x.amount)}</span>
          <span
            className={
              "rounded px-1.5 text-xs " +
              (x.status === "confirmed" ? "bg-accent text-accent-foreground" : x.status === "pending" ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground")
            }
          >
            {t(`status.${x.status}`)}
          </span>
        </Row>
      ))}
    </div>
  );
}

function WalletPanel({ close, act }: { close: () => void; act: Act }) {
  const s = useGame();
  const t = useT();
  const w = getConfig().wallet;
  const [tab, setTab] = useState<"overview" | "deposit" | "withdraw" | "history">("overview");
  const [amt, setAmt] = useState("");
  const [addr, setAddr] = useState("");
  const [wAmt, setWAmt] = useState("");
  const [depositAmt, setDepositAmt] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  let fee = D(0);
  let receive = D(0);
  try {
    const a = D(wAmt || 0);
    fee = a.mul(w.feePercent).div(100);
    receive = Decimal.max(0, a.minus(fee).minus(w.networkFee));
  } catch {
    /* ignore */
  }
  return (
    <Sheet title={t("wallet.title")} onClose={close} icon={<Wallet className="size-4" />}>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "overview", label: t("wallet.overview") },
          { id: "deposit", label: t("wallet.deposit") },
          { id: "withdraw", label: t("wallet.withdraw") },
          { id: "history", label: t("wallet.history") },
        ]}
      />
      {tab === "overview" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Row className="flex-col items-start">
              <span className="font-display text-[9px]">{t("hud.play")}</span>
              <span className="text-xl font-bold">{fmtMoney(s.playBalance)}</span>
              <span className="text-xs text-muted-foreground">{t("wallet.playDesc")}</span>
            </Row>
            <Row className="flex-col items-start">
              <span className="font-display text-[9px]">{t("hud.sales")}</span>
              <span className="text-xl font-bold">{fmtMoney(s.salesBalance)}</span>
              <span className="text-xs text-muted-foreground">{t("wallet.salesDesc")}</span>
            </Row>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label={t("wallet.amount")} value={amt} inputMode="decimal" onChange={(e) => setAmt(e.target.value)} placeholder="0.00" />
            </div>
            <PixelButton
              variant="blue"
              onClick={() => {
                act(walletService.transferSalesToPlay(amt || "0"));
                setAmt("");
              }}
            >
              {t("wallet.transfer")}
            </PixelButton>
          </div>
        </>
      )}
      {tab === "deposit" && (
        <>
          <Row className="flex-col items-start">
            <span className="text-xs text-muted-foreground">{t("wallet.network")}</span>
            <span>{w.network}</span>
          </Row>
          <Row className="flex-col items-start">
            <span className="text-xs text-muted-foreground">{t("wallet.depositAddr")}</span>
            <span className="break-all font-mono text-xs">{DEPOSIT_ADDRESS}</span>
          </Row>
          <DemoNote>{t("wallet.depositNote")}</DemoNote>
          <Field label={t("wallet.amount")} value={depositAmt} inputMode="decimal" onChange={(e) => setDepositAmt(e.target.value)} placeholder="1.00" />
          <Field label={t("wallet.txReference")} value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder={t("wallet.txReferenceHint")} />
          <PixelButton className="w-full" onClick={() => {
            act(walletService.requestDeposit(depositAmt || "0", paymentReference));
            setDepositAmt("");
            setPaymentReference("");
          }}>
            {t("wallet.submitDeposit")}
          </PixelButton>
        </>
      )}
      {tab === "withdraw" && (
        <>
          <Field label={t("wallet.address")} value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="0x…" />
          <Field label={t("wallet.amount")} value={wAmt} inputMode="decimal" onChange={(e) => setWAmt(e.target.value)} placeholder="0.00" />
          <div className="pixel-inset space-y-0.5 bg-muted/60 p-2 text-sm">
            <p className="flex justify-between"><span>{t("wallet.network")}</span><span>{w.network}</span></p>
            <p className="flex justify-between"><span>{t("wallet.min")}</span><span>{fmtMoney(w.minWithdrawal)}</span></p>
            <p className="flex justify-between"><span>{t("wallet.fee")} ({w.feePercent}%)</span><span>{fmtMoney(fee)}</span></p>
            <p className="flex justify-between"><span>{t("wallet.netFee")}</span><span>{fmtMoney(w.networkFee)}</span></p>
            <p className="flex justify-between font-semibold"><span>{t("wallet.receive")}</span><span>{fmtMoney(receive)}</span></p>
          </div>
          <DemoNote>{t("wallet.withdrawNote")}</DemoNote>
          <PixelButton className="w-full" onClick={() => act(walletService.requestWithdrawal(addr, wAmt || "0"))}>
            {t("wallet.submit")}
          </PixelButton>
        </>
      )}
      {tab === "history" && <TxList txs={s.txs} />}
    </Sheet>
  );
}

function AccountPanel({ close, act }: { close: () => void; act: Act }) {
  const s = useGame();
  const t = useT();
  const [tab, setTab] = useState<string>(s.profile.loggedIn ? "profile" : "login");
  const [f, setF] = useState({ name: s.profile.name, email: s.profile.email, pw: "", avatar: s.profile.avatar });
  useEffect(() => setTab(s.profile.loggedIn ? "profile" : "login"), [s.profile.loggedIn]);
  const tabs = s.profile.loggedIn
    ? [{ id: "profile", label: t("acct.profile") }, { id: "progress", label: t("acct.progress") }, { id: "history", label: t("wallet.history") }, { id: "settings", label: t("acct.settings") }]
    : [{ id: "login", label: t("acct.login") }, { id: "register", label: t("acct.register") }, { id: "recover", label: t("acct.recover") }];
  return (
    <Sheet title={t("acct.title")} onClose={close} icon={<User className="size-4" />}>
      <div className="flex items-center gap-3">
        <Avatar n={s.profile.avatar} size={44} />
        <div>
          <p className="font-semibold">{s.profile.name}</p>
          <p className="text-sm text-muted-foreground">{s.profile.loggedIn ? s.profile.email : t("acct.guest")}</p>
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} items={tabs} />
      {tab === "login" && (
        <>
          <Field label={t("acct.email")} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <Field label={t("acct.password")} type="password" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} />
          <PixelButton className="w-full" onClick={() => act(accountService.login(f.email, f.pw))}>{t("acct.login")}</PixelButton>
        </>
      )}
      {tab === "register" && (
        <>
          <Field label={t("acct.name")} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <Field label={t("acct.email")} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <Field label={t("acct.password")} type="password" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} />
          <PixelButton className="w-full" onClick={() => act(accountService.register(f.name, f.email, f.pw, f.avatar))}>{t("acct.register")}</PixelButton>
        </>
      )}
      {tab === "recover" && (
        <>
          <Field label={t("acct.email")} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <PixelButton className="w-full" onClick={() => act(accountService.recover(f.email))}>{t("acct.sendLink")}</PixelButton>
        </>
      )}
      {tab === "profile" && (
        <>
          <Field label={t("acct.name")} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <p className="text-sm text-muted-foreground">{t("acct.avatar")}</p>
          <div className="flex gap-2">
            {Array.from({ length: AVATAR_COUNT }, (_, i) => (
              <button key={i} onClick={() => setF({ ...f, avatar: i })} className={"rounded border-2 p-1 " + (f.avatar === i ? "border-primary bg-primary/30" : "border-wood")}>
                <Avatar n={i} />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <PixelButton onClick={() => act(accountService.updateProfile({ name: f.name, avatar: f.avatar }))}>{t("common.save")}</PixelButton>
            <PixelButton variant="danger" onClick={() => act(accountService.logout())}>{t("acct.logout")}</PixelButton>
          </div>
        </>
      )}
      {tab === "progress" && (
        <>
          <p className="font-display text-[10px]">
            {t("common.level")} {s.level}
          </p>
          <Bar pct={s.xp / levelNeed(s.level)} />
          <p className="text-sm">{t("acct.xp", { xp: s.xp, need: levelNeed(s.level) })}</p>
          <p className="text-sm">
            {t("acct.stats")}: {s.unlocked.filter(Boolean).length} / {s.unlocked.length}
          </p>
        </>
      )}
      {tab === "history" && <TxList txs={s.txs} />}
      {tab === "settings" && <LangSpeed />}
    </Sheet>
  );
}

function LangSpeed() {
  const s = useGame();
  const t = useT();
  return (
    <>
      <p className="font-display text-[10px]">{t("set.language")}</p>
      <div className="flex gap-2">
        {(["en", "fr"] as const).map((l) => (
          <PixelButton key={l} size="sm" variant={s.lang === l ? "gold" : "ghost"} onClick={() => settingsService.setLang(l)}>
            {l === "en" ? "English" : "Français"}
          </PixelButton>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t("set.speedNote")}</p>
    </>
  );
}

function SettingsPanel({ close }: { close: () => void }) {
  const t = useT();
  const [confirm, setConfirm] = useState(false);
  const [soundOn, setSoundOn] = useState(soundEnabled());
  return (
    <Sheet title={t("set.title")} onClose={close} icon={<Settings className="size-4" />}>
      <LangSpeed />
      <div className="flex items-center justify-between border-t-2 border-dashed border-wood pt-3">
        <span className="font-display text-[10px]">{t("set.sound")}</span>
        <PixelButton size="sm" variant={soundOn ? "gold" : "ghost"} onClick={() => { const next = !soundOn; setSoundOn(next); setSoundEnabled(next); }}>{soundOn ? t("set.soundOn") : t("set.soundOff")}</PixelButton>
      </div>
      <div className="space-y-2 border-t-2 border-dashed border-wood pt-3">
        {confirm ? (
          <div className="space-y-2">
            <p>{t("set.resetConfirm")}</p>
            <div className="flex gap-2">
              <PixelButton variant="danger" size="sm" onClick={() => { settingsService.resetDemo(); setConfirm(false); close(); }}>{t("common.confirm")}</PixelButton>
              <PixelButton variant="ghost" size="sm" onClick={() => setConfirm(false)}>{t("common.cancel")}</PixelButton>
            </div>
          </div>
        ) : (
          <PixelButton variant="danger" size="sm" onClick={() => setConfirm(true)}>{t("set.reset")}</PixelButton>
        )}
        <a href={`${import.meta.env.BASE_URL}admin`} className="block text-sm underline">{t("set.admin")} →</a>
      </div>
    </Sheet>
  );
}

export { MIN };
