/**
 * Data-access layer. UI and scene only call these interfaces.
 * MockGameService works fully offline (localStorage). To go live, implement the
 * same interfaces against a real backend (e.g. Supabase) and validate EVERY
 * value server-side — client state must never be trusted for money.
 */
import Decimal from "decimal.js";
import { getConfig } from "./config";
import { D, cropById, fishingStatus, growMs, itemPrice, levelNeed, MIN, production } from "./logic";
import { getState, setState, resetState, type GameState, type Lang, type Tx } from "./store";
import { supabase } from "@/lib/supabase";
import { setWalletRevision } from "./cloud";

export type Vars = Record<string, string | number>;
export type Result = { ok: boolean; key: string; vars?: Vars; fx?: string; message?: string };
const ok = (key: string, vars?: Vars, fx?: string): Result => ({ ok: true, key, vars, fx });
const fail = (key: string, vars?: Vars): Result => ({ ok: false, key, vars });

export interface FarmService {
  buySeed(cropId: string, n: number): Result | Promise<Result>;
  plant(plot: number, cropId: string): Result;
  harvest(plot: number): Result;
  unlockPlot(plot: number): Result | Promise<Result>;
}
export interface FishingService {
  cast(): Result | Promise<Result>;
  collect(): Result;
  upgradeRod(): Result | Promise<Result>;
}
export interface ProductionService {
  collect(kind: "hive" | "coop"): Result;
  upgrade(kind: "hive" | "coop"): Result | Promise<Result>;
  setActive(kind: "hive" | "coop", active: boolean): Result;
}
export interface MarketService {
  sell(itemId: string, qty: string): Result | Promise<Result>;
}
export interface WalletService {
  transferSalesToPlay(amount: string): Promise<Result>;
  createDepositIntent(amount: string): Promise<Result>;
  requestDeposit(amount: string, paymentReference: string, intentId: string): Promise<Result>;
  requestWithdrawal(address: string, amount: string): Promise<Result>;
}
export interface AccountService {
  login(email: string, password: string): Promise<Result>;
  register(name: string, email: string, password: string, avatar?: number): Promise<Result>;
  recover(email: string): Promise<Result>;
  logout(): Promise<Result>;
  updateProfile(p: { name: string; avatar: number }): Promise<Result>;
}
export interface SettingsService {
  setLang(l: Lang): void;
  setSpeed(n: number): void;
  resetDemo(): void;
}

// ---------- helpers ----------
let txSeq = 0;
function addTx(s: GameState, t: Omit<Tx, "id" | "at" | "status"> & { status?: Tx["status"] }): GameState {
  const tx: Tx = { status: "confirmed", ...t, id: `${Date.now()}-${++txSeq}`, at: Date.now() };
  return { ...s, txs: [tx, ...s.txs].slice(0, 200) };
}
function addXp(s: GameState, n: number): GameState {
  let xp = s.xp + n;
  let level = s.level;
  while (xp >= levelNeed(level)) {
    xp -= levelNeed(level);
    level++;
  }
  return { ...s, xp, level };
}
function addInv(s: GameState, id: string, q: Decimal.Value): GameState {
  return { ...s, inventory: { ...s.inventory, [id]: D(s.inventory[id] ?? 0).plus(q).toString() } };
}
const locks = new Set<string>();
function guarded(key: string, fn: () => Result): Result {
  if (locks.has(key)) return fail("err.busy");
  locks.add(key);
  try {
    return fn();
  } finally {
    locks.delete(key);
  }
}
function pay(cost: Decimal.Value): Result | null {
  return D(getState().playBalance).lt(cost) ? fail("err.funds", { cost: D(cost).toString() }) : null;
}

// ---------- mock implementation ----------
class MockGameService
  implements FarmService, FishingService, MarketService, WalletService, AccountService, SettingsService
{
  async buySeed(cropId: string, n: number): Promise<Result> {
    const crop = cropById(cropId);
    if (!crop || !Number.isInteger(n) || n < 1 || n > 1000) return fail("err.generic");
    const { data, error } = await supabase.rpc("growora_game_action", {
      p_action: "buy_seed",
      p_payload: { crop_id: cropId, quantity: n },
      p_request_id: crypto.randomUUID(),
    });
    if (error) return { ...fail("err.generic"), message: error.message };
    if (data.walletRevision !== undefined) setWalletRevision(Number(data.walletRevision));
    setState((s) => addTx({
      ...s,
      playBalance: String(data.playBalance),
      seeds: data.seeds ?? s.seeds,
    }, {
      kind: "seed", labelKey: "tx.seed", vars: { n, item: cropId },
      amount: D(data.cost).neg().toString(), currency: "play",
    }));
    return ok("ok.seed", { n, item: cropId });
  }
  plant(plot: number, cropId: string) {
    return guarded(`plot${plot}`, () => {
      const s = getState();
      const c = cropById(cropId);
      if (!c || !s.unlocked[plot]) return fail("err.locked");
      if (s.plots[plot].cropId) return fail("err.occupied");
      if ((s.seeds[cropId] ?? 0) < 1) return fail("err.noSeed");
      const now = Date.now();
      setState((st) => ({
        ...st,
        seeds: { ...st.seeds, [cropId]: st.seeds[cropId] - 1 },
        plots: st.plots.map((p, i) => (i === plot ? { cropId, plantedAt: now, readyAt: now + growMs(c.growHours, 1) } : p)),
      }));
      return ok("ok.plant", { item: cropId }, "🌱");
    });
  }
  harvest(plot: number) {
    return guarded(`plot${plot}`, () => {
      const s = getState();
      const p = s.plots[plot];
      const c = p?.cropId ? cropById(p.cropId) : undefined;
      if (!p || !c) return fail("err.nothingToHarvest");
      if (Date.now() < p.readyAt) return fail("err.notReady");
      setState((st) =>
        addXp(
          addInv({ ...st, plots: st.plots.map((x, i) => (i === plot ? { cropId: null, plantedAt: 0, readyAt: 0 } : x)) }, c.id, c.harvestQty),
          c.xp,
        ),
      );
      return ok("ok.harvest", { qty: c.harvestQty, item: c.id }, `+${D(c.harvestQty).toFixed(2)}`);
    });
  }
  async unlockPlot(plot: number): Promise<Result> {
    const s = getState();
    const req = getConfig().plots[plot];
    if (!req || s.unlocked[plot]) return fail("err.generic");
    if (plot > 0 && !s.unlocked[plot - 1]) return fail("err.prevPlot");
    if (s.level < req.level) return fail("err.level", { level: req.level });
    const { data, error } = await supabase.rpc("growora_spend_action", {
      p_action: "unlock_plot", p_payload: { plot_index: plot }, p_request_id: crypto.randomUUID(),
    });
    if (error) {
      if (error.message.includes("insufficient_play_balance")) return fail("err.funds", { cost: req.cost });
      return { ...fail("err.generic"), message: error.message };
    }
    if (data.walletRevision !== undefined) setWalletRevision(Number(data.walletRevision));
    setState((st) => addTx({
      ...st, playBalance: String(data.playBalance), unlocked: data.saveData?.unlocked ?? st.unlocked,
    }, { kind: "unlock", labelKey: "tx.unlock", vars: { n: plot + 1 }, amount: D(data.cost).neg().toString(), currency: "play" }));
    return ok("ok.unlock", { n: plot + 1 }, "🔓");
  }
  async cast(): Promise<Result> {
    const s = getState();
    if (s.fishing && fishingStatus(s, Date.now()) !== "expired") return fail("err.alreadyFishing");
    const cfg = getConfig().fishing;
    const { data, error } = await supabase.rpc("growora_spend_action", {
      p_action: "cast_fishing", p_payload: {}, p_request_id: crypto.randomUUID(),
    });
    if (error) {
      if (error.message.includes("insufficient_play_balance")) return fail("err.funds", { cost: cfg.castCost });
      if (error.message.includes("already_fishing")) return fail("err.alreadyFishing");
      return { ...fail("err.generic"), message: error.message };
    }
    if (data.walletRevision !== undefined) setWalletRevision(Number(data.walletRevision));
    setState((st) => addTx({
      ...st, playBalance: String(data.playBalance), fishing: data.saveData?.fishing ?? st.fishing,
    }, { kind: "upgrade", labelKey: "tx.fishingCast", vars: { cost: cfg.castCost }, amount: D(data.cost).neg().toString(), currency: "play" }));
    return ok("ok.cast", { cost: cfg.castCost }, "〰");
  }
  collect() {
    return guarded("fish", () => {
      const s = getState();
      const st = fishingStatus(s, Date.now());
      if (st === "idle") return fail("err.notFishing");
      if (st === "waiting") return fail("err.notReady");
      if (st === "expired") {
        setState((x) => ({ ...x, fishing: null }));
        return fail("err.fishEscaped");
      }
      const cfg = getConfig().fishing;
      const rod = cfg.rods[s.rodLevel];
      if (Math.random() < cfg.missChance) {
        setState((x) => ({ ...x, fishing: null }));
        return fail("err.miss");
      }
      // Rarer fish get the rod bonus added to their weight.
      const weights = cfg.fish.map((f) => f.chance + (f.chance < 0.3 ? rod.rareBonus : 0));
      const total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      let fish = cfg.fish[0];
      for (let i = 0; i < cfg.fish.length; i++) {
        r -= weights[i];
        if (r <= 0) {
          fish = cfg.fish[i];
          break;
        }
      }
      setState((x) => addXp(addInv({ ...x, fishing: null }, fish.id, fish.qty), cfg.xp));
      return ok("ok.fish", { qty: fish.qty, item: fish.id }, `+${fish.qty} 🐟`);
    });
  }
  async upgradeRod(): Promise<Result> {
    const s = getState();
    const next = getConfig().fishing.rods[s.rodLevel + 1];
    if (!next) return fail("err.maxLevel");
    const { data, error } = await supabase.rpc("growora_spend_action", {
      p_action: "upgrade_rod", p_payload: {}, p_request_id: crypto.randomUUID(),
    });
    if (error) {
      if (error.message.includes("insufficient_play_balance")) return fail("err.funds", { cost: next.cost });
      if (error.message.includes("max_level")) return fail("err.maxLevel");
      return { ...fail("err.generic"), message: error.message };
    }
    if (data.walletRevision !== undefined) setWalletRevision(Number(data.walletRevision));
    setState((st) => addTx({
      ...st, playBalance: String(data.playBalance), rodLevel: Number(data.saveData?.rodLevel ?? st.rodLevel),
    }, { kind: "upgrade", labelKey: "tx.upgrade", vars: { item: "rod" }, amount: D(data.cost).neg().toString(), currency: "play" }));
    return ok("ok.upgrade");
  }
  collectProd(kind: "hive" | "coop") {
    return guarded(kind, () => {
      const s = getState();
      const now = Date.now();
      const { amount } = production(kind, s, now);
      const whole = amount.floor();
      if (whole.lt(1)) return fail("err.notReady");
      const item = kind === "hive" ? "honey" : "egg";
      setState((st) =>
        addXp(addInv({ ...st, [kind]: { ...st[kind], last: now, stored: amount.minus(whole).toString() } }, item, whole), getConfig()[kind].xp),
      );
      return ok("ok.collect", { qty: whole.toString(), item }, `+${whole.toString()}`);
    });
  }
  async upgradeProd(kind: "hive" | "coop"): Promise<Result> {
    const s = getState();
    const next = getConfig()[kind].levels[s[kind].level + 1];
    if (!next) return fail("err.maxLevel");
    const now = Date.now();
    const { amount } = production(kind, s, now);
    const { data, error } = await supabase.rpc("growora_spend_action", {
      p_action: "upgrade_production", p_payload: { kind }, p_request_id: crypto.randomUUID(),
    });
    if (error) {
      if (error.message.includes("insufficient_play_balance")) return fail("err.funds", { cost: next.cost });
      if (error.message.includes("max_level")) return fail("err.maxLevel");
      return { ...fail("err.generic"), message: error.message };
    }
    if (data.walletRevision !== undefined) setWalletRevision(Number(data.walletRevision));
    setState((st) => addTx({
      ...st, playBalance: String(data.playBalance),
      [kind]: { ...st[kind], level: Number(data.saveData?.[kind]?.level ?? st[kind].level + 1), active: true, last: now, stored: amount.toString() },
    }, { kind: "upgrade", labelKey: "tx.upgrade", vars: { item: kind }, amount: D(data.cost).neg().toString(), currency: "play" }));
    return ok("ok.upgrade");
  }
  setActive(kind: "hive" | "coop", active: boolean): Result {
    const current = getState()[kind];
    if (current.active === active) return ok("ok.saved");
    const now = Date.now();
    const elapsed = Math.max(0, now - current.last) / MIN / 60;
    const level = getConfig()[kind].levels[current.level];
    const stored = active ? current.stored : D(current.stored).plus(D(level.perHour).mul(elapsed)).toString();
    setState((s) => ({ ...s, [kind]: { ...s[kind], active, last: now, stored } }));
    return ok("ok.saved");
  }
  async sell(itemId: string, qty: string): Promise<Result> {
    let q: Decimal;
    try { q = D(qty).toDecimalPlaces(4, Decimal.ROUND_DOWN); } catch { return fail("err.qty"); }
    if (q.lte(0)) return fail("err.qty");
    if (!itemPrice(itemId)) return fail("err.generic");
    const { data, error } = await supabase.rpc("growora_game_action", {
      p_action: "sell_item",
      p_payload: { item_id: itemId, quantity: q.toString() },
      p_request_id: crypto.randomUUID(),
    });
    if (error) {
      if (error.message.includes("insufficient_inventory")) return fail("err.inventory");
      return { ...fail("err.generic"), message: error.message };
    }
    if (data.walletRevision !== undefined) setWalletRevision(Number(data.walletRevision));
    setState((s) => addTx({
      ...s,
      salesBalance: String(data.salesBalance),
      inventory: data.inventory ?? s.inventory,
    }, {
      kind: "sale", labelKey: "tx.sale",
      vars: { qty: q.toString(), item: itemId }, amount: String(data.total), currency: "sales",
    }));
    return ok("ok.sell", { qty: q.toString(), item: itemId, total: String(data.total) });
  }
  async transferSalesToPlay(amount: string): Promise<Result> {
    let a: Decimal;
    try { a = D(amount); } catch { return fail("err.qty"); }
    if (a.lte(0) || !a.eq(a.toDecimalPlaces(4, Decimal.ROUND_DOWN))) return fail("err.qty");
    const { data, error } = await supabase.rpc("growora_game_action", {
      p_action: "transfer_sales_to_play",
      p_payload: { amount: a.toString() },
      p_request_id: crypto.randomUUID(),
    });
    if (error) {
      if (error.message.includes("insufficient_sales_balance")) return fail("err.salesFunds");
      return { ...fail("err.generic"), message: error.message };
    }
    if (data.walletRevision !== undefined) setWalletRevision(Number(data.walletRevision));
    setState((s) => addTx({
      ...s,
      playBalance: String(data.playBalance),
      salesBalance: String(data.salesBalance),
    }, { kind: "transfer", labelKey: "tx.transfer", amount: a.toString(), currency: "play" }));
    return ok("ok.transfer");
  }
  async createDepositIntent(amount: string): Promise<Result> {
    let a: Decimal;
    try { a = D(amount); } catch { return fail("err.qty"); }
    if (a.lt(1) || !a.eq(a.toDecimalPlaces(2, Decimal.ROUND_DOWN))) {
      return { ...fail("err.minDeposit", { min: "1" }), message: "Enter a deposit amount of at least 1 USDT with no more than 2 decimal places." };
    }
    const { data, error } = await supabase.rpc("create_deposit_intent", { p_amount: a.toString() });
    if (error) return { ...fail("err.generic"), message: error.message };
    return {
      ...ok("ok.depositIntent", { amount: String(data.amount), id: String(data.request_id) }),
      message: `Deposit instruction created. Send exactly ${data.amount} USDT to the address shown, then paste the transaction hash.`,
    };
  }
  async requestDeposit(amount: string, paymentReference: string, intentId: string): Promise<Result> {
    let a: Decimal;
    try { a = D(amount); } catch { return fail("err.qty"); }
    const txHash = paymentReference.trim();
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) return { ...fail("err.txReference"), message: "Paste the full transaction hash from your BEP-20 USDT transfer." };
    if (!intentId) return { ...fail("err.generic"), message: "Create a deposit instruction first." };
    const { data, error } = await supabase.functions.invoke("verify-deposit", {
      body: { amount: a.toString(), txHash, intentId },
    });
    if (error || data?.error) return { ...fail("err.generic"), message: data?.error || error?.message || "Could not verify the transfer." };
    setState((s) => addTx({
      ...s,
      playBalance: String(data.playBalance),
    }, {
      kind: "deposit", labelKey: "tx.deposit", amount: String(data.amount),
      currency: "play", status: "confirmed", demo: false,
    }));
    return { ...ok("ok.deposit", { amount: String(data.amount) }), message: `Deposit verified. ${data.amount} USDT has been added to your Play Balance.` };
  }
  async requestWithdrawal(address: string, amount: string): Promise<Result> {
    const destination = address.trim();
    let a: Decimal;
    try { a = D(amount); } catch { return fail("err.qty"); }
    if (a.lt(5)) return fail("err.minWithdraw", { min: "5" });
    if (D(getState().salesBalance).lt(a)) return fail("err.salesFunds");
    const { data, error } = await supabase.rpc("request_withdrawal", {
      p_amount: a.toString(),
      p_destination: destination,
    });
    if (error) {
      const message = error.message || "Unable to submit withdrawal.";
      if (message.includes("invalid_destination")) return fail("err.address");
      if (message.includes("minimum_withdrawal_5")) return fail("err.minWithdraw", { min: "5" });
      if (message.includes("insufficient_sales_balance")) return fail("err.salesFunds");
      return { ...fail("err.generic"), message };
    }
    if (data.wallet_revision !== undefined) setWalletRevision(Number(data.wallet_revision));
    setState((s) => addTx({ ...s, salesBalance: String(data.sales_balance) }, {
      kind: "withdraw", labelKey: "tx.withdrawPending", amount: a.neg().toString(),
      currency: "sales", status: "pending", demo: false,
    }));
    return { ...ok("ok.withdrawPending", { amount: a.toString() }), message: `Withdrawal request received. ${a.toString()} USDT has been reserved from your Sales Balance. You will receive ${data.payout_amount} USDT after the manual transfer is sent (10% fee).` };
  }
  async login(email: string, password: string): Promise<Result> {
    if (!email.includes("@") || password.length < 6) return fail("err.credentials");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ...fail("err.credentials"), message: error.message };
    return ok("ok.login");
  }
  async register(name: string, email: string, password: string, avatar = 0): Promise<Result> {
    if (!name.trim() || !email.includes("@") || password.length < 6) return fail("err.register");
    const redirectTo = "https://moh22201.github.io/Growora.sunflawer/";
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: redirectTo, data: { name: name.trim(), avatar } },
    });
    if (error) return { ...fail("err.register"), message: error.message };
    if (!data.session) {
      return { ...ok("ok.register"), message: "Account request sent. Check your email to confirm the account, then log in." };
    }
    return ok("ok.register");
  }
  async recover(email: string): Promise<Result> {
    if (!email.includes("@")) return fail("err.email");
    const redirectTo = "https://moh22201.github.io/Growora.sunflawer/";
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) return { ...fail("err.email"), message: error.message };
    return { ...ok("ok.recover"), message: "If this email is registered, a password reset link will be sent." };
  }
  async logout(): Promise<Result> {
    const { error } = await supabase.auth.signOut();
    if (error) return { ...fail("err.generic"), message: error.message };
    setState((s) => ({ ...s, profile: { ...s.profile, loggedIn: false } }));
    return ok("ok.logout");
  }
  async updateProfile(p: { name: string; avatar: number }): Promise<Result> {
    if (!p.name.trim()) return fail("err.generic");
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { ...fail("err.credentials"), message: authError?.message ?? "Please log in again." };
    const { error } = await supabase.from("player_profiles").update({
      username: p.name.trim(),
      avatar: p.avatar,
    }).eq("id", auth.user.id);
    if (error) return { ...fail("err.generic"), message: error.message };
    setState((s) => ({ ...s, profile: { ...s.profile, name: p.name.trim(), avatar: p.avatar } }));
    return ok("ok.saved");
  }
  setLang(l: Lang) {
    try {
      localStorage.setItem("growora-lang", l);
    } catch {
      /* ignore */
    }
    setState((s) => ({ ...s, lang: l }));
  }
  setSpeed(_n: number) {
    // Player-controlled time acceleration is disabled; production runs at normal speed.
    setState((s) => ({ ...s, speed: 1 }));
  }
  resetDemo() {
    resetState();
  }
}

const mock = new MockGameService();
export const farmService: FarmService = mock;
export const fishingService: FishingService = mock;
export const productionService: ProductionService = {
  collect: (k) => mock.collectProd(k),
  upgrade: (k) => mock.upgradeProd(k),
  setActive: (k, active) => mock.setActive(k, active),
};
export const marketService: MarketService = mock;
export const walletService: WalletService = mock;
export const accountService: AccountService = mock;
export const settingsService: SettingsService = mock;
