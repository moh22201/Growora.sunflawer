import Decimal from "decimal.js";
import { getConfig } from "./config";
import type { GameState, Plot } from "./store";

export const D = (v: Decimal.Value) => new Decimal(v);
export const HOUR = 3_600_000;
export const MIN = 60_000;

export const cropById = (id: string) => getConfig().crops.find((c) => c.id === id);
export const fishById = (id: string) => getConfig().fishing.fish.find((f) => f.id === id);

export function fmtMoney(v: Decimal.Value) {
  const s = D(v).toDecimalPlaces(4).toFixed(4).replace(/(\.\d\d\d*?)0+$/, "$1");
  return "$" + s;
}
export function fmtSalesMoney(v: Decimal.Value) {
  const s = D(v).toDecimalPlaces(4).toString();
  return s + " GRW";
}
export function fmtQty(v: Decimal.Value) {
  return D(v).toDecimalPlaces(4).toString();
}
export function fmtDuration(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

export type PlotInfo =
  | { state: "empty" }
  | { state: "growing" | "ready"; pct: number; stage: number; remaining: number; cropId: string };

export function plotInfo(p: Plot, now: number): PlotInfo {
  if (!p.cropId) return { state: "empty" };
  const total = Math.max(1, p.readyAt - p.plantedAt);
  const pct = Math.min(1, Math.max(0, (now - p.plantedAt) / total));
  const stage = pct >= 1 ? 3 : pct > 0.6 ? 2 : pct > 0.25 ? 1 : 0;
  return { state: pct >= 1 ? "ready" : "growing", pct, stage, remaining: Math.max(0, p.readyAt - now), cropId: p.cropId };
}

/** Growth duration in ms for a crop, scaled by the demo speed multiplier. */
export function growMs(hours: number, speed: number) {
  return (hours * HOUR) / Math.max(1, speed);
}

export function production(kind: "hive" | "coop", s: GameState, now: number) {
  const lv = getConfig()[kind].levels[s[kind].level];
  const elapsedH = Math.max(0, now - s[kind].last) / HOUR;
  const rate = s[kind].active ? D(lv.perHour) : D(0);
  const amt = Decimal.min(D(lv.capacity), D(s[kind].stored).plus(rate.mul(elapsedH).mul(s.speed)));
  return { amount: amt.toDecimalPlaces(4), capacity: D(lv.capacity), perHour: rate, level: lv };
}

export type FishStatus = "idle" | "waiting" | "ready" | "expired";
export function fishingStatus(s: GameState, now: number): FishStatus {
  if (!s.fishing) return "idle";
  if (now < s.fishing.readyAt) return "waiting";
  if (now <= s.fishing.expiresAt) return "ready";
  return "expired";
}

export const levelNeed = (level: number) => getConfig().xpPerLevel * level;

export function itemPrice(id: string): string | null {
  const c = getConfig();
  if (id === "honey") return c.hive.honeyPrice;
  if (id === "egg") return c.coop.eggPrice;
  return cropById(id)?.salePrice ?? fishById(id)?.price ?? null;
}
export function itemKind(id: string): "crop" | "fish" | "honey" | "egg" | null {
  if (id === "honey") return "honey";
  if (id === "egg") return "egg";
  if (cropById(id)) return "crop";
  if (fishById(id)) return "fish";
  return null;
}
