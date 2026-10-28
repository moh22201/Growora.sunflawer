import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Backpack, Egg, Fish, Hexagon, Settings, Sprout, Store, Wallet } from "lucide-react";
import type { Area, GameController, Selectable } from "@/game/scene";
import { hydrate, setState, useGame } from "@/game/store";
import { supabase } from "@/lib/supabase";
import { loadPlayerState, savePlayerState } from "@/game/cloud";
import { AuthScreen } from "./AuthScreen";
import { useT } from "@/game/i18n";
import { fmtMoney, levelNeed } from "@/game/logic";
import { settingsService, type Result } from "@/game/services";
import { playGameSound } from "@/game/sound";
import { PanelHost, type Act, type Panel } from "./panels";
import { Avatar } from "./icons";

const toPanel = (s: Selectable): Panel => {
  switch (s.type) {
    case "plot":
      return { kind: "plot", index: s.index };
    case "house":
      return { kind: "inventory" };
    default:
      return { kind: s.type };
  }
};

export function GameShell() {
  const s = useGame();
  const t = useT();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const currentUserId = useRef<string | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const ctrl = useRef<GameController | null>(null);

  useEffect(() => {
    hydrate();
    let dead = false;
    const initialize = async (session: import("@supabase/supabase-js").Session | null) => {
      if (!session) {
        currentUserId.current = null;
        setDataReady(false);
        setState((st) => ({ ...st, profile: { ...st.profile, loggedIn: false, email: "", name: "Farmer" } }));
        setAuthLoading(false);
        return;
      }
      setAuthLoading(true);
      try {
        await loadPlayerState(session.user);
        currentUserId.current = session.user.id;
        if (!dead) setDataReady(true);
      } catch (error) {
        console.error("Unable to load Growora player data", error);
        toast.error(error instanceof Error ? error.message : "Could not load your saved farm.");
        currentUserId.current = null;
        setDataReady(false);
        setState((st) => ({ ...st, profile: { ...st.profile, loggedIn: false } }));
        await supabase.auth.signOut();
      } finally {
        if (!dead) setAuthLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) toast.error(error.message);
      void initialize(data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        queueMicrotask(() => { if (!dead) void initialize(session); });
      }
    });
    return () => {
      dead = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!s.profile.loggedIn || !dataReady) return;
    let dead = false;
    import("@/game/scene").then(({ createGame }) => {
      if (dead || !host.current) return;
      ctrl.current = createGame(host.current, { onSelect: (sel) => setPanel(toPanel(sel)) });
      setLoading(false);
    });
    return () => {
      dead = true;
      ctrl.current?.destroy();
      ctrl.current = null;
    };
  }, [s.profile.loggedIn, dataReady]);

  useEffect(() => {
    const userId = currentUserId.current;
    if (!dataReady || !s.profile.loggedIn || !userId) return;
    const timer = window.setTimeout(() => {
      void savePlayerState(userId, s).catch((error) => {
        console.error("Unable to save Growora progress", error);
        toast.error("Your latest progress could not be saved. Please check your connection.");
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [s, dataReady]);

  useEffect(() => {
    document.documentElement.lang = s.lang;
  }, [s.lang]);

  const act: Act = (r: Result | Promise<Result>, target) => {
    void Promise.resolve(r).then((result) => {
    const msg = result.message || t(result.key, result.vars);
    if (result.ok) { toast.success(msg); playGameSound(result.key, result.vars); }
    else toast.error(msg);
    if (result.ok && result.fx && target !== undefined) ctrl.current?.float(target, result.fx);
    }).catch((error) => toast.error(error instanceof Error ? error.message : "Action failed."));
  };

  const go = (a: Area, p: Panel | null) => {
    ctrl.current?.focus(a);
    setPanel(p);
  };

  const nav: { label: string; icon: React.ReactNode; on: () => void; active: boolean }[] = [
    { label: t("nav.farm"), icon: <Sprout />, on: () => go("farm", null), active: panel?.kind === "plot" },
    { label: t("nav.fishing"), icon: <Fish />, on: () => go("fishing", { kind: "fishing" }), active: panel?.kind === "fishing" },
    { label: t("nav.honey"), icon: <Hexagon />, on: () => go("hive", { kind: "hive" }), active: panel?.kind === "hive" },
    { label: t("nav.eggs"), icon: <Egg />, on: () => go("coop", { kind: "coop" }), active: panel?.kind === "coop" },
    { label: t("nav.market"), icon: <Store />, on: () => go("market", { kind: "market" }), active: panel?.kind === "market" },
    { label: t("nav.inventory"), icon: <Backpack />, on: () => setPanel({ kind: "inventory" }), active: panel?.kind === "inventory" },
    { label: t("nav.wallet"), icon: <Wallet />, on: () => setPanel({ kind: "wallet" }), active: panel?.kind === "wallet" },
  ];

  if (authLoading) {
    return <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-[#102d2a] text-emerald-100"><span className="font-display text-2xl">GROWORA</span><span className="text-sm text-white/60">{s.lang === "fr" ? "Chargement du compte…" : "Loading player account…"}</span></div>;
  }
  if (!s.profile.loggedIn || !dataReady) return <AuthScreen />;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-ocean">
      {/* Top HUD */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-2 p-2">
        <button onClick={() => setPanel({ kind: "account" })} className="hud-chip pointer-events-auto flex items-center gap-2 px-2 py-1.5" aria-label={t("nav.account")}>
          <Avatar n={s.profile.avatar} size={30} />
          <div className="w-20 text-left leading-none sm:w-28">
            <p className="truncate text-xs">{s.profile.name}</p>
            <p className="mt-1 font-display text-[8px] text-primary">
              {t("hud.level")} {s.level}
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-wood-dark">
              <div className="h-full bg-accent" style={{ width: `${(s.xp / levelNeed(s.level)) * 100}%` }} />
            </div>
          </div>
        </button>
        <div className="hud-chip pointer-events-auto hidden flex-col px-3 py-1.5 md:flex">
          <span className="font-display text-[13px] text-primary">GROWORA</span>
          <span className="text-[11px] opacity-80">{t("app.tagline")}</span>
        </div>
        <div className="flex-1" />
        <button onClick={() => setPanel({ kind: "wallet" })} className="hud-chip pointer-events-auto flex flex-col items-end px-2 py-1 leading-tight">
          <span className="text-[10px] opacity-80">
            {t("hud.play")}
          </span>
          <span className="font-display text-[10px] text-primary">{fmtMoney(s.playBalance)}</span>
          <span className="mt-0.5 text-[10px] opacity-80">{t("hud.sales")}</span>
          <span className="font-display text-[10px] text-accent">{fmtMoney(s.salesBalance)}</span>
        </button>
        <div className="pointer-events-auto flex flex-col gap-1">
          <button onClick={() => setPanel({ kind: "settings" })} className="hud-chip p-1.5" aria-label={t("nav.settings")}>
            <Settings className="size-4" />
          </button>
          <button onClick={() => settingsService.setLang(s.lang === "en" ? "fr" : "en")} className="hud-chip px-1 py-1 font-display text-[8px]" aria-label="Language">
            {s.lang.toUpperCase()}
          </button>
        </div>
      </header>

      {/* Game world */}
      <div className="relative flex-1">
        <div ref={host} className="absolute inset-0" />
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <span className="font-display text-xl text-primary">GROWORA</span>
            <span className="text-sm">{t("app.loading")}</span>
          </div>
        )}
        {panel && <PanelHost panel={panel} close={() => setPanel(null)} act={act} />}
        <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-2">
          <button onClick={() => ctrl.current?.zoom(1.2)} aria-label="Zoom in" title="Zoom in" className="hud-chip flex size-10 items-center justify-center font-display text-xl text-primary">+</button>
          <button onClick={() => ctrl.current?.zoom(1 / 1.2)} aria-label="Zoom out" title="Zoom out" className="hud-chip flex size-10 items-center justify-center font-display text-xl text-primary">−</button>
        </div>
      </div>

      {/* Bottom nav */}
      <nav className="z-20 border-t-4 border-wood-dark bg-wood px-1 pb-[max(env(safe-area-inset-bottom),4px)] pt-1">
        <div className="mx-auto flex max-w-2xl justify-between">
          {nav.map((n) => (
            <button
              key={n.label}
              onClick={n.on}
              className={
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded px-0.5 py-1 text-hud-foreground [&_svg]:size-5 " +
                (n.active ? "bg-wood-dark text-primary" : "hover:bg-wood-dark/50")
              }
            >
              {n.icon}
              <span className="w-full truncate text-center text-[10px]">{n.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
