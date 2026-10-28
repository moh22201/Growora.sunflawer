// Central, editable game configuration. Every price / duration / rule lives here.
// The admin mockup (/admin) can override it locally; a real backend should own it later.

export interface CropDef {
  id: string;
  seedPrice: string;
  growHours: number;
  harvestQty: string;
  salePrice: string;
  xp: number;
  color: number;
}
export interface ProdLevel {
  cost: string;
  perHour: string;
  capacity: string;
}
export interface FishDef {
  id: string;
  chance: number;
  qty: string;
  price: string;
  color: number;
}
export interface RodDef {
  cost: string;
  castMinutes: number;
  rareBonus: number;
}
export interface GameConfig {
  startingPlayBalance: string;
  xpPerLevel: number;
  crops: CropDef[];
  plots: { level: number; cost: string }[];
  fishing: { castCost: string; expireMinutes: number; missChance: number; xp: number; fish: FishDef[]; rods: RodDef[] };
  hive: { honeyPrice: string; xp: number; levels: ProdLevel[] };
  coop: { eggPrice: string; xp: number; levels: ProdLevel[] };
  wallet: { network: string; minWithdrawal: string; feePercent: string; networkFee: string };
  ticker: { enabled: boolean; maxItems: number };
}

export const DEPOSIT_ADDRESS = "0xb5070306324dd921242a431492cc4fdd8f245e21";

export const DEFAULT_CONFIG: GameConfig = {
  startingPlayBalance: "0",
  xpPerLevel: 100,
  crops: [
    { id: "wheat", seedPrice: "1", growHours: 1, harvestQty: "100.4167", salePrice: "0.01", xp: 5, color: 0xf2c94c },
    { id: "carrot", seedPrice: "2", growHours: 2, harvestQty: "100.8333", salePrice: "0.02", xp: 8, color: 0xf07a2a },
    { id: "potato", seedPrice: "4", growHours: 4, harvestQty: "101.6667", salePrice: "0.04", xp: 12, color: 0xc89a5a },
    { id: "corn", seedPrice: "7", growHours: 6, harvestQty: "102.5", salePrice: "0.07", xp: 18, color: 0xffe14a },
    { id: "sunflower", seedPrice: "12", growHours: 9, harvestQty: "103.75", salePrice: "0.12", xp: 25, color: 0xffb81a },
    { id: "pumpkin", seedPrice: "20", growHours: 12, harvestQty: "105", salePrice: "0.20", xp: 35, color: 0xf08a1e },
    { id: "strawberry", seedPrice: "35", growHours: 18, harvestQty: "107.5", salePrice: "0.35", xp: 50, color: 0xe8384a },
    { id: "watermelon", seedPrice: "60", growHours: 27, harvestQty: "111.25", salePrice: "0.60", xp: 70, color: 0x2f9e44 },
    { id: "rose", seedPrice: "100", growHours: 36, harvestQty: "115", salePrice: "1.00", xp: 100, color: 0xd8285a },
  ],
  plots: [
    { level: 1, cost: "0" },
    { level: 1, cost: "0.50" },
    { level: 2, cost: "1" },
    { level: 3, cost: "2" },
    { level: 4, cost: "4" },
    { level: 5, cost: "7" },
    { level: 6, cost: "12" },
    { level: 8, cost: "20" },
    { level: 10, cost: "35" },
  ],
  fishing: {
    castCost: "0.05",
    expireMinutes: 30,
    missChance: 0.1,
    xp: 6,
    fish: [
      { id: "sardine", chance: 0.5, qty: "1", price: "0.30", color: 0x9fb8c8 },
      { id: "trout", chance: 0.3, qty: "1", price: "0.80", color: 0x7aa86a },
      { id: "salmon", chance: 0.15, qty: "1", price: "2.00", color: 0xf08a6a },
      { id: "goldfish", chance: 0.05, qty: "1", price: "8.00", color: 0xffc21a },
    ],
    rods: [
      { cost: "0", castMinutes: 5, rareBonus: 0 },
      { cost: "15", castMinutes: 3, rareBonus: 0.05 },
      { cost: "40", castMinutes: 2, rareBonus: 0.1 },
    ],
  },
  hive: {
    honeyPrice: "0.50",
    xp: 4,
    levels: [
      { cost: "0", perHour: "0.5", capacity: "4" },
      { cost: "20", perHour: "1", capacity: "10" },
      { cost: "60", perHour: "2", capacity: "24" },
    ],
  },
  coop: {
    eggPrice: "0.15",
    xp: 3,
    levels: [
      { cost: "0", perHour: "1", capacity: "6" },
      { cost: "15", perHour: "2", capacity: "16" },
      { cost: "45", perHour: "4", capacity: "40" },
    ],
  },
  wallet: { network: "USDT · BNB Smart Chain (BEP-20)", minWithdrawal: "10", feePercent: "5", networkFee: "0" },
  ticker: { enabled: true, maxItems: 10 },
};

const KEY = "growora-config";
let current: GameConfig = DEFAULT_CONFIG;

export function getConfig(): GameConfig {
  return current;
}
export function loadConfig() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<GameConfig>;
      current = {
        ...DEFAULT_CONFIG,
        ...saved,
        startingPlayBalance: DEFAULT_CONFIG.startingPlayBalance,
        crops: DEFAULT_CONFIG.crops,
        plots: DEFAULT_CONFIG.plots,
        fishing: DEFAULT_CONFIG.fishing,
        wallet: DEFAULT_CONFIG.wallet,
        hive: DEFAULT_CONFIG.hive,
        coop: DEFAULT_CONFIG.coop,
        ticker: { ...DEFAULT_CONFIG.ticker, ...saved.ticker },
      };
    } else {
      current = DEFAULT_CONFIG;
    }
  } catch {
    current = DEFAULT_CONFIG;
  }
}
export function saveConfig(c: GameConfig) {
  current = c;
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}
export function resetConfig() {
  current = DEFAULT_CONFIG;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
