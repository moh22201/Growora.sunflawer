import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Leaf, LogIn, UserPlus, KeyRound } from "lucide-react";
import { accountService } from "@/game/services";
import { useGame } from "@/game/store";
import { useT } from "@/game/i18n";
import { AVATAR_COUNT, Avatar } from "./icons";
import type { Result } from "@/game/services";

type AuthTab = "login" | "register" | "recover";

export function AuthScreen() {
  const s = useGame();
  const t = useT();
  const [tab, setTab] = useState<AuthTab>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState(0);
  const [busy, setBusy] = useState(false);

  const finish = (result: Result) => {
    if (result.ok) toast.success(result.message || t(result.key, result.vars));
    else toast.error(result.message || t(result.key, result.vars));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      let result: Result;
      if (tab === "login") result = await accountService.login(email, password);
      else if (tab === "register") result = await accountService.register(name, email, password, avatar);
      else result = await accountService.recover(email);
      finish(result);
      if (result.ok && tab === "register" && result.message?.startsWith("Account request")) setTab("login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to contact the account service.");
    } finally {
      setBusy(false);
    }
  };

  const tabButton = (value: AuthTab, label: string, Icon: typeof LogIn) => (
    <button type="button" onClick={() => setTab(value)} className={"flex flex-1 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-sm font-semibold transition " + (tab === value ? "border-emerald-400 bg-emerald-400/15 text-emerald-100" : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10")}>
      <Icon className="size-4" />{label}
    </button>
  );

  return (
    <main className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#102d2a] px-4 py-6 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #8bd6a0 0, transparent 30%), radial-gradient(circle at 80% 75%, #d9b76b 0, transparent 28%)" }} />
      <section className="relative w-full max-w-md rounded-2xl border border-emerald-100/15 bg-[#173b35]/95 p-5 shadow-2xl sm:p-7">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-300/15 text-emerald-200"><Leaf className="size-7" /></div>
            <div>
              <h1 className="font-display text-2xl text-emerald-100">GROWORA</h1>
              <p className="mt-1 text-xs text-white/60">{s.lang === "fr" ? "Votre ferme vous attend" : "Your farm is waiting"}</p>
            </div>
          </div>
          <button type="button" onClick={() => import("@/game/services").then(({ settingsService }) => settingsService.setLang(s.lang === "en" ? "fr" : "en"))} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white/80">{s.lang === "en" ? "FR" : "EN"}</button>
        </div>

        <div className="mb-5 flex gap-2">
          {tabButton("login", t("acct.login"), LogIn)}
          {tabButton("register", t("acct.register"), UserPlus)}
          {tabButton("recover", t("acct.recover"), KeyRound)}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {tab === "register" && (
            <>
              <label className="block space-y-1.5 text-sm">
                <span className="text-white/75">{t("acct.name")}</span>
                <input required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-3 outline-none focus:border-emerald-300" autoComplete="name" />
              </label>
              <div className="space-y-2">
                <p className="text-sm text-white/75">{t("acct.avatar")}</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: AVATAR_COUNT }, (_, i) => (
                    <button key={i} type="button" onClick={() => setAvatar(i)} aria-label={`Choose avatar ${i + 1}`} className={"rounded-lg border-2 p-1 " + (avatar === i ? "border-emerald-300 bg-emerald-300/15" : "border-white/10")}>
                      <Avatar n={i} size={36} />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <label className="block space-y-1.5 text-sm">
            <span className="text-white/75">{t("acct.email")}</span>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-3 outline-none focus:border-emerald-300" autoComplete="email" />
          </label>
          {tab !== "recover" && (
            <label className="block space-y-1.5 text-sm">
              <span className="text-white/75">{t("acct.password")}</span>
              <input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-3 outline-none focus:border-emerald-300" autoComplete={tab === "login" ? "current-password" : "new-password"} />
            </label>
          )}
          <button disabled={busy} type="submit" className="w-full rounded-lg bg-emerald-300 px-4 py-3 font-bold text-[#10332d] transition hover:bg-emerald-200 disabled:opacity-50">
            {busy ? (s.lang === "fr" ? "Patientez…" : "Please wait…") : tab === "login" ? t("acct.login") : tab === "register" ? t("acct.register") : t("acct.sendLink")}
          </button>
        </form>
        <p className="mt-5 text-center text-xs leading-relaxed text-white/45">{s.lang === "fr" ? "Connectez-vous pour sauvegarder votre ferme sur votre compte." : "Sign in to save your farm progress to your account."}</p>
      </section>
    </main>
  );
}
