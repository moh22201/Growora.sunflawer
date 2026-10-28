import { ArrowRight, Egg, Fish, Hexagon, Sprout } from "lucide-react";
import { useGame } from "@/game/store";
import { settingsService } from "@/game/services";

type WelcomeScreenProps = {
  isReady: boolean;
  onEnter: () => void;
};

export function WelcomeScreen({ isReady, onEnter }: WelcomeScreenProps) {
  const s = useGame();
  const fr = s.lang === "fr";

  return (
    <main className="fixed inset-0 isolate flex min-h-screen flex-col overflow-auto bg-[#173b35] text-[#fff4d4]">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[60%] bg-gradient-to-b from-[#173b35] via-[#276b57] to-[#8abf76]" />
        <div className="absolute -left-16 top-[30%] size-64 rounded-full bg-[#f6d879]/20 blur-3xl" />
        <div className="absolute -right-20 top-[18%] size-72 rounded-full bg-[#75d9c4]/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-[10%] h-[38%] w-[75%] rounded-[50%] border-t-[18px] border-[#3d8a52] bg-[#285d3e] shadow-[0_-12px_0_#6cae62]" />
        <div className="absolute -bottom-24 -right-[15%] h-[43%] w-[80%] rounded-[50%] border-t-[18px] border-[#6cae62] bg-[#397849] shadow-[0_-12px_0_#a2c96e]" />
        <div className="absolute bottom-0 left-0 right-0 h-[18%] bg-[#684b32] opacity-70" />
        <div className="absolute bottom-[3%] left-0 right-0 flex justify-center gap-3 opacity-50">
          {Array.from({ length: 9 }, (_, i) => <span key={i} className="h-12 w-2 rotate-[18deg] bg-[#d7b36a]" />)}
        </div>
      </div>

      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="pixel-frame flex size-11 items-center justify-center bg-[#f2d36d] text-[#254b37]">
            <Sprout className="size-7" strokeWidth={2.8} />
          </div>
          <span className="font-display text-sm tracking-wide text-[#fff1b7]">GROWORA</span>
        </div>
        <button
          type="button"
          onClick={() => settingsService.setLang(fr ? "en" : "fr")}
          className="hud-chip flex items-center gap-2 px-3 py-2 text-xs font-bold"
          aria-label={fr ? "Switch to English" : "Passer en français"}
        >
          {fr ? "EN" : "FR"}
        </button>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 pb-10 pt-2 text-center sm:px-8">
        <div className="pixel-frame mb-5 flex size-36 flex-col items-center justify-center gap-1 bg-[#f2d36d] text-[#254b37] shadow-[0_10px_0_rgba(13,36,30,0.35)] sm:size-44">
          <Sprout className="size-[4.5rem] sm:size-24" strokeWidth={2.5} />
          <span className="font-display text-2xl tracking-[0.18em] sm:text-3xl">GRW</span>
        </div>
        <p className="mb-3 font-display text-[9px] tracking-[0.24em] text-[#f7dc83] sm:text-xs">
          {fr ? "VOTRE ÎLE, VOTRE AVENTURE" : "YOUR ISLAND, YOUR ADVENTURE"}
        </p>
        <h1 className="font-display text-2xl leading-relaxed text-[#fff2c4] drop-shadow-[0_4px_0_#244632] sm:text-4xl">
          GROWORA
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-white/90 sm:text-lg">
          {fr
            ? "Cultivez votre ferme, pêchez au bord de l’eau et prenez soin de vos abeilles et de vos poules."
            : "Grow your farm, fish by the sea, and care for your bees and chickens."}
        </p>

        <div className="mt-7 grid w-full max-w-lg grid-cols-4 gap-2 sm:gap-3">
          {[
            { icon: Sprout, en: "Farming", fr: "Culture" },
            { icon: Fish, en: "Fishing", fr: "Pêche" },
            { icon: Hexagon, en: "Honey", fr: "Miel" },
            { icon: Egg, en: "Eggs", fr: "Œufs" },
          ].map(({ icon: Icon, en, fr: label }) => (
            <div key={en} className="pixel-inset flex min-w-0 flex-col items-center gap-2 bg-[#173b35]/90 px-1 py-3 sm:py-4">
              <Icon className="size-6 text-[#f2d36d] sm:size-7" strokeWidth={2.4} />
              <span className="text-[10px] font-bold text-white/90 sm:text-xs">{fr ? label : en}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onEnter}
          className="pixel-frame mt-8 flex min-h-14 w-full max-w-sm items-center justify-center gap-3 bg-[#f2d36d] px-6 py-4 font-display text-[10px] leading-relaxed text-[#244632] transition hover:brightness-105 active:translate-y-1 active:shadow-none sm:text-xs"
        >
          {isReady
            ? (fr ? "CONTINUER LA FERME" : "CONTINUE TO FARM")
            : (fr ? "COMMENCER À JOUER" : "START PLAYING")}
          <ArrowRight className="size-5 shrink-0" />
        </button>
        <p className="mt-4 text-xs text-white/65">
          {isReady
            ? (fr ? "Votre progression sauvegardée vous attend." : "Your saved farm is ready when you are.")
            : (fr ? "Connectez-vous ou créez votre compte pour sauvegarder votre ferme." : "Sign in or create an account to save your farm.")}
        </p>
      </section>

      <footer className="relative z-10 px-4 pb-4 text-center text-[10px] text-white/55">
        © GROWORA · {fr ? "Cultivez. Explorez. Progressez." : "Grow. Explore. Progress."}
      </footer>
    </main>
  );
}
