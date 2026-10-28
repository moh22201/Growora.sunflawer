const SOUND_KEY = "growora-sounds-enabled";

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, String(enabled));
  } catch {
    // Sound preference remains available for this session.
  }
}

export function playGameSound(key: string, vars?: Record<string, string | number>) {
  if (!soundEnabled() || typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const item = String(vars?.item ?? "");
    const notes: { frequency: number; duration: number; wave?: OscillatorType; gain?: number; delay?: number }[] = [];
    if (key === "ok.harvest") {
      notes.push({ frequency: 980, duration: 0.07, wave: "sawtooth", gain: 0.035 }, { frequency: 660, duration: 0.12, wave: "triangle", gain: 0.045, delay: 0.07 });
    } else if (key === "ok.cast" || key === "ok.fish") {
      notes.push({ frequency: 420, duration: 0.2, wave: "sine", gain: 0.05 }, { frequency: 620, duration: 0.25, wave: "sine", gain: 0.04, delay: 0.12 });
      if (key === "ok.fish") notes.push({ frequency: 880, duration: 0.1, wave: "triangle", gain: 0.04, delay: 0.28 });
    } else if (key === "ok.collect" && item === "honey") {
      notes.push({ frequency: 520, duration: 0.07, wave: "sawtooth", gain: 0.018 }, { frequency: 590, duration: 0.08, wave: "sawtooth", gain: 0.018, delay: 0.09 }, { frequency: 540, duration: 0.1, wave: "sawtooth", gain: 0.018, delay: 0.19 });
    } else if (key === "ok.collect" && item === "egg") {
      notes.push({ frequency: 760, duration: 0.1, wave: "triangle", gain: 0.045 }, { frequency: 990, duration: 0.13, wave: "triangle", gain: 0.04, delay: 0.12 }, { frequency: 820, duration: 0.1, wave: "triangle", gain: 0.04, delay: 0.27 });
    } else if (key === "ok.sell" || key === "ok.transfer" || key === "ok.upgrade") {
      notes.push({ frequency: 660, duration: 0.08, wave: "triangle", gain: 0.04 }, { frequency: 880, duration: 0.12, wave: "triangle", gain: 0.045, delay: 0.09 });
    } else {
      return;
    }
    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + (note.delay ?? 0);
      osc.type = note.wave ?? "sine";
      osc.frequency.setValueAtTime(note.frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(note.gain ?? 0.035, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + note.duration + 0.02);
    }
    window.setTimeout(() => void ctx.close(), 700);
  } catch {
    // Audio is optional; never interrupt a game action.
  }
}
