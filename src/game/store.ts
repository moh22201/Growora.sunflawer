import { useSyncExternalStore } from "react";
import { getConfig, loadConfig } from "./config";

export type Lang = "en" | "fr";
export interface Tx {
  id: string;
  kind: string;
  labelKey: string;
  vars?: Record<string, string | number>;
  amount: string;
  currency: "play" | "sales";
  at: number;
  status: "confirmed" | "pending" | "rejected";
  demo?: boolean;
}
export interface Plot {
  cropId: string | null;
  plantedAt: number;
  readyAt: number;
}
export interface Production {
  level: number;
  active: boolean;
  last: number;
  stored: string;
}
export interface GameState {
  v: 1;
  playBalance: string;
  salesBalance: string;
  xp: number;
  level: number;
  unlocked: boolean[];
  plots: Plot[];
  seeds: Record<string, number>;
  inventory: Record<string, string>;
  rodLevel: number;
  fishing: { castAt: number; readyAt: number; expiresAt: number } | null;
  hive: Production;
  coop: Production;
  txs: Tx[];
  lang: Lang;
  speed: number;
  profile: { name: string; email: string; loggedIn: boolean; avatar: number };
}

export function makeDefault(now: number): GameState {
  const cfg = getConfig();
  return {
    v: 1,
    playBalance: cfg.startingPlayBalance,
    salesBalance: "0",
    xp: 0,
    level: 1,
    unlocked: cfg.plots.map((_, i) => i === 0),
    plots: cfg.plots.map(() => ({ cropId: null, plantedAt: 0, readyAt: 0 })),
    seeds: { wheat: 1 },
    inventory: {},
    rodLevel: 0,
    fishing: null,
    hive: { level: 0, active: false, last: now, stored: "0" },
    coop: { level: 0, active: false, last: now, stored: "0" },
    txs: [],
    lang: "en",
    speed: 1,
    profile: { name: "Demo Farmer", email: "", loggedIn: false, avatar: 0 },
  };
}

const KEY = "growora-save-v1";
let state: GameState = makeDefault(0);
let hydrated = false;
const listeners = new Set<() => void>();

export const getState = () => state;
export function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function setState(fn: (s: GameState) => GameState) {
  state = fn(state);
  if (hydrated) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l());
}
export function hydrate() {
  if (hydrated) return;
  loadConfig();
  state = makeDefault(Date.now());
  try {
    const saved = localStorage.getItem("growora-lang");
    if (saved === "en" || saved === "fr") state.lang = saved;
  } catch {
    /* ignore */
  }
  hydrated = true;
  listeners.forEach((l) => l());
}

export function resetState() {
  const lang = state.lang;
  state = { ...makeDefault(Date.now()), lang };
  setState((s) => s);
}

export function useGame() {
  return useSyncExternalStore(subscribe, getState, getState);
}
