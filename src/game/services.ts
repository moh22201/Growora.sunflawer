/**
 * Data-access layer. UI and scene only call these interfaces.
 * MockGameService works fully offline (localStorage). To go live, implement the
 * same interfaces against a real backend (e.g. Supabase) and validate EVERY
 * value server-side — client state must never be trusted for money.
 */
import Decimal from "decimal.js";
import { DEPOSIT_ADDRESS, getConfig } from "./config";
import { D, cropById, fishingStatus, growMs, itemPrice, levelNeed, MIN, production } from "./logic";
import { getState, setState, resetState, type GameState, type Lang, type Tx } from "./store";
import { supabase } from "@/lib/supabase";

export type Vars = Record<string, string | number>;
export type Result = { ok: boolean; key: string; vars?: Vars; fx?: string; message?: string };
const ok = (key: string, vars?: Vars, fx?: string): Result => ({ ok: true, key, vars, fx });
const fail = (key: string, vars?: Vars): Result => ({ ok: false, key, vars });

export interface FarmService {
  buySeed(cropId: string, n: number): Result;
  plant(plot: number, cropId: string): Result;
  harvest(plot: number): Result;
  unlockPlot(plot: number): Result;
}
export interface FishingService {
  cast(): Result;
  collect(): Result;
  upgradeRod(): Result;
}
export interface ProductionService {
  collect(kind: "hive" | "coop"): Result;
  upgrade(kind: "hive" | "coop"): Result;
  setActive(kind: "hive" | "coop", active: boolean): Result;
}
export interface MarketService {
  sell(itemId: string, qty: string): Result;
}
export interface WalletService {
  transferSalesToPlay(amount: string): Result;
  requestDeposit(amount: string, paymentReference: string): Promise<Result>;
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
  buySeed(cropId: string, n: number) {
    const c = cropById(cropId);
    if (!c || n < 1) return fail("err.generic");
    const cost = D(c.seedPrice).mul(n);
    const e = pay(cost);
    if (e) return e;
    setState((s) =>
      addTx(
        { ...s, playBalance: D(s.playBalance).minus(cost).toString(), seeds: { ...s.seeds, [cropId]: (s.seeds[cropId] ?? 0) + n } },
        { kind: "seed", labelKey: "tx.seed", vars: { n, item: cropId }, amount: cost.neg().toString(), currency: "play" },
      ),
    );
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
  unlockPlot(plot: number) {
    const s = getState();
    const req = getConfig().plots[plot];
    if (!req || s.unlocked[plot]) return fail("err.generic");
    if (plot > 0 && !s.unlocked[plot - 1]) return fail("err.prevPlot");
    if (s.level < req.level) return fail("err.level", { level: req.level });
    const e = pay(req.cost);
    if (e) return e;
    setState((st) =>
      addTx(
        { ...st, playBalance: D(st.playBalance).minus(req.cost).toString(), unlocked: st.unlocked.map((u, i) => u || i === plot) },
        { kind: "unlock", labelKey: "tx.unlock", vars: { n: plot + 1 }, amount: D(req.cost).neg().toString(), currency: "play" },
      ),
    );
    return ok("ok.unlock", { n: plot + 1 }, "🔓");
  }
  cast() {
    const s = getState();
    if (s.fishing && fishingStatus(s, Date.now()) !== "expired") return fail("err.alreadyFishing");
    const cfg = getConfig().fishing;
    const cost = D(cfg.castCost);
    const e = pay(cost);
    if (e) return e;
    const rod = cfg.rods[s.rodLevel];
    const now = Date.now();
    const wait = rod.castMinutes * MIN;
    const expire = cfg.expireMinutes * MIN;
    setState((st) => addTx(
      { ...st, playBalance: D(st.playBalance).minus(cost).toString(), fishing: { castAt: now, readyAt: now + wait, expiresAt: now + wait + expire } },
      { kind: "upgrade", labelKey: "tx.fishingCast", vars: { cost: cost.toString() }, amount: cost.neg().toString(), currency: "play" },
    ));
    return ok("ok.cast", { cost: cost.toString() }, "〰");
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
  upgradeRod() {
    const s = getState();
    const next = getConfig().fishing.rods[s.rodLevel + 1];
    if (!next) return fail("err.maxLevel");
    const e = pay(next.cost);
    if (e) return e;
    setState((st) =>
      addTx(
        { ...st, rodLevel: st.rodLevel + 1, playBalance: D(st.playBalance).minus(next.cost).toString() },
        { kind: "upgrade", labelKey: "tx.upgrade", vars: { item: "rod" }, amount: D(next.cost).neg().toString(), currency: "play" },
      ),
    );
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
  upgradeProd(kind: "hive" | "coop") {
    const s = getState();
    const next = getConfig()[kind].levels[s[kind].level + 1];
    if (!next) return fail("err.maxLevel");
    const e = pay(next.cost);
    if (e) return e;
    const now = Date.now();
    const { amount } = production(kind, s, now);
    setState((st) =>
      addTx(
        { ...st, playBalance: D(st.playBalance).minus(next.cost).toString(), [kind]: { level: st[kind].level + 1, active: true, last: now, stored: amount.toString() } },
        { kind: "upgrade", labelKey: "tx.upgrade", vars: { item: kind }, amount: D(next.cost).neg().toString(), currency: "play" },
      ),
    );
    return ok("ok.upgrade");
  }
  sell(itemId: string, qty: string) {
    return guarded(`sell-${itemId}`, () => {
      let q: Decimal;
      try {
        q = D(qty).toDecimalPlaces(4, Decimal.ROUND_DOWN);
      } catch {
        return fail("err.qty");
      }
      if (q.lte(0)) return fail("err.qty");
      const price = itemPrice(itemId);
      const have = D(getState().inventory[itemId] ?? 0);
      if (!price) return fail("err.generic");
      if (have.lt(q)) return fail("err.inventory");
      const total = q.mul(price).toDecimalPlaces(4, Decimal.ROUND_DOWN);
      setState((s) =>
        addTx(
          {
            ...s,
            inventory: { ...s.inventory, [itemId]: D(s.inventory[itemId] ?? 0).minus(q).toString() },
            salesBalance: D(s.salesBalance).plus(total).toString(),
          },
          { kind: "sale", labelKey: "tx.sale", vars: { qty: q.toString(), item: itemId }, amount: total.toString(), currency: "sales" },
        ),
      );
      return ok("ok.sell", { qty: q.toString(), item: itemId, total: total.toString() });
    });
  }
  transferSalesToPlay(amount: string) {
    let a: Decimal;
    try {
      a = D(amount);
    } catch {
      return fail("err.qty");
    }
    if (a.lte(0)) return fail("err.qty");
    if (D(getState().salesBalance).lt(a)) return fail("err.salesFunds");
    setState((s) =>
      addTx(
        { ...s, salesBalance: D(s.salesBalance).minus(a).toString(), playBalance: D(s.playBalance).plus(a).toString() },
        { kind: "transfer", labelKey: "tx.transfer", amount: a.toString(), currency: "play" },
      ),
    );
    return ok("ok.transfer");
  }
  async requestDeposit(amount: string, paymentReference: string): Promise<Result> {
    let a: Decimal;
    try { a = D(amount); } catch { return fail("err.qty"); }
    if (a.lt(1)) return fail("err.minDeposit", { min: "1" });
    const reference = paymentReference.trim();
    if (reference.length < 8) return fail("err.txReference");
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { ...fail("err.credentials"), message: "Log in to submit a deposit request." };
    const { data, error } = await supabase.from("deposit_requests").insert({
      user_id: auth.user.id,
      amount: a.toString(),
      currency: "USDT",
      payment_method: "manual",
      payment_reference: reference,
      status: "pending",
    }).select("id,amount,status,submitted_at").single();
    if (error) return { ...fail("err.generic"), message: error.message };
    setState((s) => addTx(s, {
      kind: "deposit", labelKey: "tx.depositPending", amount: a.toString(),
      currency: "play", status: "pending", demo: false,
    }));
    return { ...ok("ok.depositPending", { amount: a.toString() }), message: "Request submitted. Play balance is credited only after admin verification." };
  }
  async requestWithdrawal(address: string, amount: string): Promise<Result> {
    const w = getConfig().wallet;
    const destination = address.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(destination)) return fail("err.address");
    let a: Decimal;
    try { a = D(amount); } catch { return fail("err.qty"); }
    if (a.lt(w.minWithdrawal)) return fail("err.minWithdraw", { min: w.minWithdrawal });
    if (D(getState().salesBalance).lt(a)) return fail("err.salesFunds");
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { ...fail("err.credentials"), message: "Log in to request a withdrawal." };
    const { data, error } = await supabase.from("withdrawal_requests").insert({
      user_id: auth.user.id,
      amount: a.toString(),
      currency: "USDT",
      network: "BNB Smart Chain (BEP-20)",
      destination,
      status: "pending",
    }).select("id,amount,fee_amount,payout_amount,status,requested_at").single();
    if (error) return { ...fail("err.generic"), message: error.message };
    setState((s) => addTx(s, {
      kind: "withdraw", labelKey: "tx.withdrawPending", amount: a.neg().toString(),
      currency: "sales", status: "pending", demo: false,
    }));
    return { ...ok("ok.withdrawPending", { amount: a.toString() }), message: "Withdrawal request submitted. The requested amount is reserved only when an admin approves it; payout is manual." };
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
};
export const marketService: MarketService = mock;
export const walletService: WalletService = mock;
export const accountService: AccountService = mock;
export const settingsService: SettingsService = mock;
