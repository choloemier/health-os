"use client";

let sharedAudioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => null);
  }
  return sharedAudioCtx;
}

export function playTimerCompleteChime(soundEnabled: boolean = true) {
  if (typeof window === "undefined") return;

  // Vibración háptica en Android / móviles compatibles
  if ("vibrate" in navigator) {
    try {
      navigator.vibrate([180, 90, 220]);
    } catch {
      // Ignorar si el navegador bloquea vibración
    }
  }

  if (!soundEnabled) return;

  try {
    const ctx = getAudioCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [587.33, 880]; // D5 -> A5 acorde limpio no estridente

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.16);

      gain.gain.setValueAtTime(0.001, now + idx * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.16 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.16 + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.16);
      osc.stop(now + idx * 0.16 + 0.3);
    });
  } catch {
    // Fallback silencioso
  }
}

export function triggerLightHaptic() {
  if (typeof window !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(25);
    } catch {
      // Ignorar
    }
  }
}
