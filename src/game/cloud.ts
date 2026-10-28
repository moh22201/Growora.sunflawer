import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getState, makeDefault, setState, type GameState } from "./store";

const cropHours: Record<string, number> = {
  wheat: 1, carrot: 2, potato: 4, corn: 6, sunflower: 9,
  pumpkin: 12, strawberry: 18, watermelon: 27, rose: 36,
};

export async function loadPlayerState(user: User) {
  const [{ data: profile, error: profileError }, { data: save, error: saveError }] = await Promise.all([
    supabase.from("player_profiles").select("username, avatar").eq("id", user.id).maybeSingle(),
    supabase.from("game_saves").select("save_data").eq("user_id", user.id).maybeSingle(),
  ]);
  if (profileError) throw profileError;
  if (saveError) throw saveError;

  const fresh = makeDefault(Date.now());
  const saved = (save?.save_data ?? {}) as Partial<GameState>;
  const metadata = user.user_metadata ?? {};
  const avatar = Number(profile?.avatar ?? metadata.avatar ?? 0);
  const next: GameState = {
    ...fresh,
    ...saved,
    playBalance: saved.playBalance ?? "0",
    salesBalance: saved.salesBalance ?? "0",
    speed: 1,
    lang: getState().lang,
    profile: {
      name: String(profile?.username || metadata.name || user.email?.split("@")[0] || "Farmer"),
      email: user.email ?? "",
      loggedIn: true,
      avatar: Number.isFinite(avatar) ? Math.max(0, Math.min(7, avatar)) : 0,
    },
    hive: { ...fresh.hive, ...saved.hive, active: Boolean(saved.hive?.active) },
    coop: { ...fresh.coop, ...saved.coop, active: Boolean(saved.coop?.active) },
    plots: (saved.plots ?? fresh.plots).map((plot) => {
      if (!plot.cropId) return plot;
      return { ...plot, readyAt: plot.readyAt || plot.plantedAt + (cropHours[plot.cropId] ?? 1) * 3_600_000 };
    }),
  };
  setState(() => next);
}

export async function savePlayerState(userId: string, state: GameState) {
  const saveData: Partial<GameState> = { ...state };
  // Wallet balances are authoritative in the database; never send client copies back.
  delete saveData.playBalance;
  delete saveData.salesBalance;
  delete saveData.profile;
  delete saveData.speed;
  const { error } = await supabase.from("game_saves").upsert(
    { user_id: userId, save_data: saveData, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}
