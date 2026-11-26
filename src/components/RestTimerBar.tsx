"use client";

import React, { useEffect, useState } from "react";
import { Timer, Volume2, VolumeX, FastForward, Plus } from "lucide-react";
import { playTimerCompleteChime, triggerLightHaptic } from "@/lib/sound-haptics";

export interface ActiveTimerState {
  id: number;
  label: string;
  totalSeconds: number;
  endTimeMs: number;
}

interface RestTimerBarProps {
  timer: ActiveTimerState | null;
  onAddSeconds: (sec: number) => void;
  onSkip: () => void;
  onStartPreset?: (sec: number, label: string) => void;
}

export function RestTimerBar({ timer, onAddSeconds, onSkip }: RestTimerBarProps) {
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [justFinished, setJustFinished] = useState<string | null>(null);

  useEffect(() => {
    if (!timer) {
      setRemainingSec(0);
      return;
    }

    setJustFinished(null);

    // Wake Lock para evitar que se apague la pantalla en medio del descanso de gym
    let wakeLock: { release: () => Promise<void> } | null = null;
    if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
      (
        navigator as unknown as {
          wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> };
        }
      ).wakeLock
        .request("screen")
        .then((wl) => {
          wakeLock = wl;
        })
        .catch(() => null);
    }

    const updateTick = () => {
      const diff = Math.ceil((timer.endTimeMs - Date.now()) / 1000);
      if (diff <= 0) {
        setRemainingSec(0);
        playTimerCompleteChime(soundOn);
        setJustFinished(timer.label);
        onSkip();
      } else {
        setRemainingSec(diff);
      }
    };

    updateTick();
    const interval = setInterval(updateTick, 250);

    return () => {
      clearInterval(interval);
      if (wakeLock) {
        wakeLock.release().catch(() => null);
      }
    };
  }, [timer, soundOn, onSkip]);

  useEffect(() => {
    if (!justFinished) return;
    const t = setTimeout(() => setJustFinished(null), 5000);
    return () => clearTimeout(t);
  }, [justFinished]);

  if (!timer && !justFinished) return null;

  if (!timer && justFinished) {
    return (
      <div className="fixed bottom-20 left-3 right-3 z-50 mx-auto max-w-xl md:bottom-6">
        <div className="flex items-center justify-between rounded-2xl border border-lime-400/50 bg-obsidian-900/95 px-4 py-3 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lime-400/20 text-lime-300">
              <Timer className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-lime-300">¡Listo para la siguiente serie!</p>
              <p className="text-xs text-zinc-400">{justFinished}</p>
            </div>
          </div>
          <button
            onClick={() => setJustFinished(null)}
            className="rounded-xl bg-obsidian-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-obsidian-700"
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  if (!timer) return null;

  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  const formatted = `${mins}:${String(secs).padStart(2, "0")}`;
  const pct = Math.min(100, Math.max(0, (remainingSec / timer.totalSeconds) * 100));

  return (
    <div className="fixed bottom-20 left-3 right-3 z-50 mx-auto max-w-xl md:bottom-6">
      <div className="overflow-hidden rounded-2xl border border-lime-400/40 bg-obsidian-900/95 shadow-2xl backdrop-blur-md">
        {/* Barra de progreso visual anticeguera temporal */}
        <div className="h-1.5 w-full bg-obsidian-800">
          <div
            className="h-full bg-lime-400 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSoundOn((prev) => !prev)}
              aria-label="Alternar sonido"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-obsidian-800 text-zinc-300 active:scale-95"
            >
              {soundOn ? <Volume2 className="h-5 w-5 text-lime-400" /> : <VolumeX className="h-5 w-5 text-zinc-500" />}
            </button>
            <div className="min-w-0">
              <div className="font-mono text-2xl font-bold tracking-tight text-white leading-none">
                {formatted}
              </div>
              <p className="truncate text-xs text-zinc-400 mt-1">{timer.label}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerLightHaptic();
                onAddSeconds(15);
              }}
              className="flex items-center gap-1 rounded-xl border border-obsidian-700 bg-obsidian-800 px-3.5 py-2.5 text-sm font-semibold text-zinc-100 active:scale-95"
            >
              <Plus className="h-4 w-4 text-lime-400" />
              15s
            </button>
            <button
              type="button"
              onClick={() => {
                triggerLightHaptic();
                onSkip();
              }}
              className="flex items-center gap-1.5 rounded-xl bg-lime-400 px-3.5 py-2.5 text-sm font-bold text-obsidian-950 active:scale-95"
            >
              <FastForward className="h-4 w-4" />
              Saltar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
