"use client";

import React from "react";
import { Droplets, Footprints, Flame, Beef, Wheat } from "lucide-react";
import { AppStateDTO } from "@/lib/store-service";
import { triggerLightHaptic } from "@/lib/sound-haptics";

interface NutritionTrafficLightProps {
  state: AppStateDTO;
  onAddWater: (ml: number) => void;
  onToggleWalk: (val: boolean) => void;
  compact?: boolean;
}

export function NutritionTrafficLight({
  state,
  onAddWater,
  onToggleWalk,
  compact = false,
}: NutritionTrafficLightProps) {
  const totals = state.mealsToday.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      proteina: acc.proteina + m.proteina,
      fibra: acc.fibra + m.fibra,
    }),
    { kcal: 0, proteina: 0, fibra: 0 }
  );

  const metaKcal = state.config.calorias_meta;
  const metaProt = state.config.proteina_meta;
  const metaFibra = state.config.fibra_meta;
  const metaAgua = state.config.agua_meta;
  const aguaActual = state.dailyLog.agua_ml;

  const ratioKcal = metaKcal > 0 ? totals.kcal / metaKcal : 0;
  const ratioProt = metaProt > 0 ? totals.proteina / metaProt : 0;

  // Determinar estado visual constructivo (CERO CULPA / CERO ROJO PUNITIVO)
  let statusBadge = {
    label: "En rango",
    bg: "bg-lime-400/15 text-lime-300 border-lime-400/30",
    hint: `Disponibles ${Math.max(0, metaKcal - totals.kcal)} kcal hoy.`,
  };

  if (ratioKcal > 1.05) {
    const excess = Math.round(totals.kcal - metaKcal);
    const faltaP = Math.max(0, Math.round(metaProt - totals.proteina));
    statusBadge = {
      label: "Excedido — ver ajuste",
      bg: "bg-amber-400/15 text-amber-300 border-amber-400/35",
      hint:
        faltaP > 15
          ? `+${excess} kcal hoy · Si cenas, usa solo proteína magra (${faltaP}g pendientes) + verdes y suma 15 min de caminata.`
          : `+${excess} kcal hoy · Paso práctico: hidrata con +400ml de agua y activa la caminata digestiva de 15 min.`,
    };
  } else if (ratioKcal >= 0.88 && ratioProt < 0.72) {
    const faltaP = Math.max(0, Math.round(metaProt - totals.proteina));
    statusBadge = {
      label: "Falta proteína",
      bg: "bg-sky-400/15 text-sky-300 border-sky-400/35",
      hint: `Quedan ${Math.max(0, metaKcal - totals.kcal)} kcal y faltan ${faltaP}g de proteína · Prioriza pechuga, claras o atún.`,
    };
  } else if (ratioKcal >= 0.9) {
    statusBadge = {
      label: "Cerca del límite",
      bg: "bg-indigo-400/15 text-indigo-300 border-indigo-400/35",
      hint: `Margen de ${Math.max(0, metaKcal - totals.kcal)} kcal para cerrar el día con precisión.`,
    };
  } else if (totals.kcal > 0 && ratioProt < 0.45 && ratioKcal > 0.5) {
    const faltaP = Math.max(0, Math.round(metaProt - totals.proteina));
    statusBadge = {
      label: "Falta proteína",
      bg: "bg-sky-400/15 text-sky-300 border-sky-400/35",
      hint: `Asegura proteína en tu siguiente bloque (faltan ${faltaP}g para llegar a ${metaProt}g).`,
    };
  }

  const bars = [
    {
      key: "kcal",
      label: "Calorías",
      icon: Flame,
      current: Math.round(totals.kcal),
      target: metaKcal,
      unit: "kcal",
      color: ratioKcal > 1.05 ? "bg-amber-400" : "bg-lime-400",
    },
    {
      key: "prot",
      label: "Proteína",
      icon: Beef,
      current: Math.round(totals.proteina),
      target: metaProt,
      unit: "g",
      color: "bg-sky-400",
    },
    {
      key: "fibra",
      label: "Fibra",
      icon: Wheat,
      current: Number(totals.fibra.toFixed(1)),
      target: metaFibra,
      unit: "g",
      color: "bg-emerald-400",
    },
    {
      key: "agua",
      label: "Agua",
      icon: Droplets,
      current: Number((aguaActual / 1000).toFixed(2)),
      target: Number((metaAgua / 1000).toFixed(1)),
      unit: "L",
      color: "bg-cyan-400",
    },
  ];

  return (
    <div className="rounded-2xl border border-obsidian-700 bg-obsidian-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Semáforo Diario
        </span>
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge.bg}`}
        >
          {statusBadge.label}
        </span>
      </div>

      <p className="text-xs text-zinc-300 mb-4 leading-relaxed">{statusBadge.hint}</p>

      <div className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        {bars.map((b) => {
          const Icon = b.icon;
          const pct = Math.min(100, Math.round((b.current / Math.max(1, b.target)) * 100));
          return (
            <div
              key={b.key}
              className="rounded-xl border border-obsidian-800 bg-obsidian-950/70 p-3"
            >
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <Icon className="h-3.5 w-3.5 text-zinc-400" />
                  {b.label}
                </span>
                <span className="font-mono text-[11px] text-zinc-500">{pct}%</span>
              </div>
              <div className="font-mono text-base font-bold text-white">
                {b.current}
                <span className="text-xs font-normal text-zinc-400">
                  /{b.target}
                  {b.unit}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-obsidian-800">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${b.color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Acciones rápidas de 1 toque: Agua + Caminata post-comida */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-obsidian-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              triggerLightHaptic();
              onAddWater(250);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 active:scale-95"
          >
            <Droplets className="h-3.5 w-3.5" />
            +250 ml
          </button>
          <button
            type="button"
            onClick={() => {
              triggerLightHaptic();
              onAddWater(500);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 active:scale-95"
          >
            +500 ml
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerLightHaptic();
            onToggleWalk(!state.dailyLog.caminata_post_comida);
          }}
          className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition active:scale-95 ${
            state.dailyLog.caminata_post_comida
              ? "border-lime-400/50 bg-lime-400/15 text-lime-300"
              : "border-obsidian-700 bg-obsidian-800 text-zinc-300 hover:border-obsidian-700"
          }`}
        >
          <Footprints className="h-4 w-4" />
          {state.dailyLog.caminata_post_comida
            ? "Caminata post-comida hecha ✓"
            : "Caminata post-comida (10-15 min)"}
        </button>
      </div>
    </div>
  );
}
