import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getState, makeDefault, setState, type GameState } from "./store";

export type PlayerSession = { session: Session | null; user: User | null };

export async function loadPlayerState(user: User) {
  const [{ data: profile, error: profileError }, { data: save, error: saveError }] = await Promise.all([
    supabase.from("player_profiles").select("username, avatar").eq("id", user.id).maybeSingle(),
    supabase.from("game_saves").select("save_data").eq("user_id", user.id).maybeSingle(),
  ]);
  if (profileError) throw profileError;
  if (saveError) throw saveError;

  const fresh = makeDefault(Date.now());
  const saved = (save?.save_data ?? {}) as Partial<GameState>;
  const meta = user.user_metadata ?? {};
  const name = profile?.username || meta.name || user.email?.split("@")[0] || "Farmer";
  const avatarValue = Number(profile?.avatar ?? meta.avatar ?? 0);
  const next: GameState = {
    ...fresh,
    ...saved,
    playBalance: saved.playBalance ?? "0",
    salesBalance: saved.salesBalance ?? "0",
    speed: 1,
    lang: getState().lang,
    profile: {
      name: String(name),
      email: user.email ?? "",
      loggedIn: true,
      avatar: Number.isFinite(avatarValue) ? Math.max(0, Math.min(7, avatarValue)) : 0,
    },
    plots: (saved.plots ?? fresh.plots).map((plot) => {
      if (!plot.cropId) return plot;
      const hours = fresh.plots.length > 0
        ? (awaitCropHours(plot.cropId))
        : 1;
      return { ...plot, readyAt: plot.readyAt || plot.plantedAt + hours * 3_600_000 };
    }),
  };
  setState(() => next);
}

function awaitCropHours(cropId: string) {
  const state = getState();
  void state;
  // Crop timing is retained from the saved readyAt; this fallback is only for old saves.
  const known: Record<string, number> = {
    wheat: 1, carrot: 2, potato: 4, corn: 6, sunflower: 9,
    pumpkin: 12, strawberry: 18, watermelon: 27, rose: 36,
  };
  return known[cropId] ?? 1;
}

export async function savePlayerState(userId: string, state: GameState) {
  const { profile: _profile, speed: _speed, ...saveData } = state;
  const { error } = await supabase.from("game_saves").upsert(
    { user_id: userId, save_data: saveData, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}
