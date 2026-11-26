"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Zap,
  Dumbbell,
  Utensils,
  LineChart,
  RefreshCw,
  Cloud,
  Database,
} from "lucide-react";
import { AppStateDTO } from "@/lib/store-service";
import { getLocalDateISO } from "@/lib/date-utils";
import { ActiveTimerState, RestTimerBar } from "@/components/RestTimerBar";
import { HoyView } from "@/components/HoyView";
import { GymView } from "@/components/GymView";
import { ComidasView } from "@/components/ComidasView";
import { ProgresoView } from "@/components/ProgresoView";
import { triggerLightHaptic } from "@/lib/sound-haptics";
import { useRouter } from "next/navigation";

type NavTab = "hoy" | "gym" | "comidas" | "progreso";

export function HealthOsDashboard({ initialState }: { initialState: AppStateDTO }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<NavTab>("hoy");
  const [state, setState] = useState<AppStateDTO>(initialState);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [activeTimer, setActiveTimer] = useState<ActiveTimerState | null>(null);

  const refreshState = useCallback(async (customFecha?: string) => {
    setSyncing(true);
    try {
      const targetFecha = customFecha || getLocalDateISO();
      const res = await fetch(`/api/state?fecha=${encodeURIComponent(targetFecha)}`, {
        cache: "no-store",
      });
      if (res.status === 401) {
        router.push("/unlock");
        return;
      }
      if (res.ok) {
        const next: AppStateDTO = await res.json();
        setState(next);
      }
    } finally {
      setSyncing(false);
    }
  }, [router]);

  // Al montar: alinear con la fecha local del dispositivo y registrar Service Worker PWA
  useEffect(() => {
    const clientFecha = getLocalDateISO();
    if (clientFecha !== initialState.fecha) {
      refreshState(clientFecha);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => null);
    }

    // Sincronización automática al volver a abrir la app en celular o PC
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshState(getLocalDateISO());
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [initialState.fecha, refreshState]);

  const startTimer = useCallback((seconds: number, label: string) => {
    triggerLightHaptic();
    setActiveTimer({
      id: Date.now(),
      label,
      totalSeconds: seconds,
      endTimeMs: Date.now() + seconds * 1000,
    });
  }, []);

  const addTimerSeconds = useCallback((sec: number) => {
    setActiveTimer((prev) =>
      prev
        ? {
            ...prev,
            totalSeconds: prev.totalSeconds + sec,
            endTimeMs: prev.endTimeMs + sec * 1000,
          }
        : null
    );
  }, []);

  const skipTimer = useCallback(() => {
    setActiveTimer(null);
  }, []);

  const handleUpdateDaily = async (patch: Record<string, unknown>) => {
    setSyncing(true);
    try {
      const res = await fetch("/api/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha: state.fecha, ...patch }),
      });
      if (res.ok) setState(await res.json());
    } finally {
      setSyncing(false);
    }
  };

  const handleLogSet: React.ComponentProps<typeof GymView>["onLogSet"] = async (payload) => {
    // Disparar temporizador inmediatamente sin esperar latencia de red (Anticeguera temporal inmediata)
    startTimer(payload.descansoSeg, payload.exerciseLabel);
    setSyncing(true);
    try {
      const res = await fetch("/api/gym/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: state.fecha,
          workoutTemplateId: payload.workoutTemplateId,
          exerciseTemplateId: payload.exerciseTemplateId,
          varianteUsada: payload.varianteUsada,
          pesoAsignadoKg: payload.pesoAsignadoKg,
          pesoRealKg: payload.pesoRealKg,
          reps: payload.reps,
          sensacionRir: payload.sensacionRir,
          esExpress: payload.esExpress,
        }),
      });
      if (res.ok) setState(await res.json());
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteSet = async (setId: string) => {
    setSyncing(true);
    try {
      const res = await fetch(
        `/api/gym/set?id=${encodeURIComponent(setId)}&fecha=${encodeURIComponent(state.fecha)}`,
        { method: "DELETE" }
      );
      if (res.ok) setState(await res.json());
    } finally {
      setSyncing(false);
    }
  };

  const handleContingency: React.ComponentProps<typeof GymView>["onContingency"] = async (
    payload
  ) => {
    setSyncing(true);
    try {
      const res = await fetch("/api/gym/contingency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha: state.fecha, ...payload }),
      });
      if (res.ok) setState(await res.json());
    } finally {
      setSyncing(false);
    }
  };

  const handleAddMeal: React.ComponentProps<typeof ComidasView>["onAddMeal"] = async (payload) => {
    setSyncing(true);
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha: state.fecha, ...payload }),
      });
      if (res.ok) setState(await res.json());
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteMeal = async (mealId: string) => {
    setSyncing(true);
    try {
      const res = await fetch(
        `/api/meals?id=${encodeURIComponent(mealId)}&fecha=${encodeURIComponent(state.fecha)}`,
        { method: "DELETE" }
      );
      if (res.ok) setState(await res.json());
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateConfig: React.ComponentProps<typeof ProgresoView>["onUpdateConfig"] = async (
    patch
  ) => {
    setSyncing(true);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha: state.fecha, ...patch }),
      });
      if (res.ok) setState(await res.json());
    } finally {
      setSyncing(false);
    }
  };

  const handleLockScreen = async () => {
    await fetch("/api/auth/pin", { method: "DELETE" });
    router.push("/unlock");
    router.refresh();
  };

  const navItems: { id: NavTab; label: string; icon: React.ElementType }[] = [
    { id: "hoy", label: "Hoy", icon: Zap },
    { id: "gym", label: "Gym", icon: Dumbbell },
    { id: "comidas", label: "Comidas", icon: Utensils },
    { id: "progreso", label: "Progreso", icon: LineChart },
  ];

  return (
    <div className="min-h-screen bg-obsidian-950 text-zinc-100 pb-28 md:pb-12">
      {/* Cabecera Superior Industrial Minimalista */}
      <header className="sticky top-0 z-30 border-b border-obsidian-800 bg-obsidian-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400 text-obsidian-950 font-black">
              H
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-white leading-none">
                HEALTH OS
              </h1>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-400">
                {state.dbConnected ? (
                  <span className="inline-flex items-center gap-1 text-emerald-300">
                    <Cloud className="h-3 w-3" /> Cloud Sync
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <Database className="h-3 w-3" /> Modo Local (Configura DATABASE_URL)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Navegación Desktop + Botón Refrescar */}
          <div className="flex items-center gap-2">
            <nav className="hidden md:flex items-center gap-1 rounded-xl border border-obsidian-800 bg-obsidian-900 p-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? "bg-lime-400 text-obsidian-950"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={() => refreshState()}
              aria-label="Sincronizar"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-obsidian-800 bg-obsidian-900 text-zinc-300 hover:text-white active:scale-95"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin text-lime-400" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Contenedor Principal */}
      <main className="mx-auto max-w-3xl px-4 pt-4">
        {activeTab === "hoy" && (
          <HoyView
            state={state}
            onUpdateDaily={handleUpdateDaily}
            onStartTimer={startTimer}
            onNavigateTab={(t) => {
              triggerLightHaptic();
              setActiveTab(t);
            }}
          />
        )}

        {activeTab === "gym" && (
          <GymView
            state={state}
            onLogSet={handleLogSet}
            onDeleteSet={handleDeleteSet}
            onContingency={handleContingency}
            onStartTimer={startTimer}
          />
        )}

        {activeTab === "comidas" && (
          <ComidasView
            state={state}
            onAddMeal={handleAddMeal}
            onDeleteMeal={handleDeleteMeal}
            onUpdateDaily={handleUpdateDaily}
          />
        )}

        {activeTab === "progreso" && (
          <ProgresoView
            state={state}
            onUpdateDaily={handleUpdateDaily}
            onUpdateConfig={handleUpdateConfig}
            onLockScreen={handleLockScreen}
          />
        )}
      </main>

      {/* Barra Flotante de Temporizador de Descanso (Anticeguera Temporal) */}
      <RestTimerBar
        timer={activeTimer}
        onAddSeconds={addTimerSeconds}
        onSkip={skipTimer}
      />

      {/* Navegación Inferior Móvil Táctil (Una Mano) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-obsidian-800 bg-obsidian-950/95 pb-safe backdrop-blur-lg md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  triggerLightHaptic();
                  setActiveTab(item.id);
                }}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 transition active:scale-95 ${
                  active ? "text-lime-400" : "text-zinc-400"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
                <span className="text-[11px] font-bold">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
