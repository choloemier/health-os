"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Timer,
  Trash2,
  Zap,
  CalendarClock,
  TrendingUp,
  Equal,
  ArrowDownCircle,
  Link2,
} from "lucide-react";
import { AppStateDTO, EnrichedExerciseDTO } from "@/lib/store-service";
import { RirSensation } from "@/lib/progression";
import { triggerLightHaptic } from "@/lib/sound-haptics";

interface GymViewProps {
  state: AppStateDTO;
  onLogSet: (payload: {
    workoutTemplateId: string;
    exerciseTemplateId: string;
    varianteUsada: "A" | "B";
    pesoAsignadoKg: number;
    pesoRealKg: number;
    reps: number;
    sensacionRir: RirSensation;
    esExpress: boolean;
    descansoSeg: number;
    exerciseLabel: string;
  }) => Promise<void>;
  onDeleteSet: (setId: string) => Promise<void>;
  onContingency: (payload: {
    action: "SKIP_TODAY" | "RESUME_TODAY" | "TOGGLE_EXPRESS" | "COMPLETE_SESSION" | "SET_ROUTINE";
    workoutTemplateId?: string;
    routineIndex?: number;
  }) => Promise<void>;
  onStartTimer: (seconds: number, label: string) => void;
}

const RIR_OPTIONS: { value: RirSensation; label: string; short: string; style: string }[] = [
  {
    value: "FACIL",
    label: "Fácil",
    short: "RIR 3+",
    style: "border-emerald-400/40 bg-emerald-400/15 text-emerald-200",
  },
  {
    value: "JUSTO",
    label: "Justo (RIR 1-2)",
    short: "Óptimo",
    style: "border-lime-400/50 bg-lime-400/15 text-lime-200",
  },
  {
    value: "AL_LIMITE",
    label: "Al límite",
    short: "RIR 0",
    style: "border-indigo-400/40 bg-indigo-400/15 text-indigo-200",
  },
  {
    value: "MUY_PESADO",
    label: "Muy pesado / Bajé peso",
    short: "Recalibrar",
    style: "border-amber-400/50 bg-amber-400/15 text-amber-200",
  },
];

interface ExerciseCardProps {
  exercise: EnrichedExerciseDTO;
  workoutTemplateId: string;
  isExpress: boolean;
  defaultExpanded: boolean;
  onLogSet: GymViewProps["onLogSet"];
  onDeleteSet: GymViewProps["onDeleteSet"];
}

function ExerciseCard({
  exercise,
  workoutTemplateId,
  isExpress,
  defaultExpanded,
  onLogSet,
  onDeleteSet,
}: ExerciseCardProps) {
  const lastTodayVariant =
    exercise.todaySets.length > 0
      ? exercise.todaySets[exercise.todaySets.length - 1].variante_usada
      : "A";

  const [variant, setVariant] = useState<"A" | "B">(lastTodayVariant);
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);

  const activeProg = variant === "A" ? exercise.progressionA : exercise.progressionB;
  const activeName = variant === "A" ? exercise.nombre_plan_a : exercise.nombre_plan_b;
  const effectiveSeriesMeta = isExpress ? 2 : exercise.series_meta;

  const [pesoInput, setPesoInput] = useState<string>(String(activeProg.objetivoHoyPesoKg));
  const [repsInput, setRepsInput] = useState<string>(String(activeProg.repsSugeridasPorSerie));
  const [rir, setRir] = useState<RirSensation>("JUSTO");
  const [submitting, setSubmitting] = useState(false);

  // Sincronizar peso y reps sugeridos cuando cambia entre Plan A <-> Plan B
  useEffect(() => {
    const draftKey = `hos_draft_${exercise.slug}_${variant}`;
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.peso !== undefined) setPesoInput(String(parsed.peso));
        if (parsed.reps !== undefined) setRepsInput(String(parsed.reps));
        return;
      }
    } catch {
      // ignore
    }

    // Si hoy ya hizo una serie en este mismo variante, precargar el último peso real usado hoy
    const sameVariantToday = exercise.todaySets.filter((s) => s.variante_usada === variant);
    if (sameVariantToday.length > 0) {
      const last = sameVariantToday[sameVariantToday.length - 1];
      setPesoInput(String(last.peso_real_kg));
      setRepsInput(String(last.reps));
    } else {
      setPesoInput(String(activeProg.objetivoHoyPesoKg));
      setRepsInput(String(activeProg.repsSugeridasPorSerie));
    }
  }, [variant, exercise.slug, activeProg.objetivoHoyPesoKg, activeProg.repsSugeridasPorSerie, exercise.todaySets]);

  const persistDraft = (nextPeso: string, nextReps: string) => {
    try {
      sessionStorage.setItem(
        `hos_draft_${exercise.slug}_${variant}`,
        JSON.stringify({ peso: nextPeso, reps: nextReps })
      );
    } catch {
      // ignore
    }
  };

  const adjustPeso = (delta: number) => {
    triggerLightHaptic();
    const cur = parseFloat(pesoInput) || 0;
    const next = String(Math.max(0, Number((cur + delta).toFixed(2))));
    setPesoInput(next);
    persistDraft(next, repsInput);
  };

  const adjustReps = (delta: number) => {
    triggerLightHaptic();
    const cur = parseInt(repsInput, 10) || 0;
    const next = String(Math.max(1, cur + delta));
    setRepsInput(next);
    persistDraft(pesoInput, next);
  };

  const handleSaveSet = async () => {
    const pesoReal = Math.max(0, parseFloat(pesoInput.replace(",", ".")) || 0);
    const repsVal = Math.max(0, parseInt(repsInput, 10) || 0);
    setSubmitting(true);
    triggerLightHaptic();

    // Si el usuario bajó el peso significativamente respecto al objetivo, no da error; guarda limpio
    await onLogSet({
      workoutTemplateId,
      exerciseTemplateId: exercise.id,
      varianteUsada: variant,
      pesoAsignadoKg: activeProg.objetivoHoyPesoKg,
      pesoRealKg: pesoReal,
      reps: repsVal,
      sensacionRir: rir,
      esExpress: isExpress,
      descansoSeg: exercise.descanso_seg,
      exerciseLabel: `Descanso · ${activeName}`,
    });

    setSubmitting(false);
  };

  const completedSets = exercise.todaySets.length;
  const isExerciseComplete = completedSets >= effectiveSeriesMeta;

  const badgeStyle =
    activeProg.accion === "SUBIR"
      ? "border-lime-400/40 bg-lime-400/15 text-lime-300"
      : activeProg.accion === "RECALIBRAR"
      ? "border-amber-400/40 bg-amber-400/15 text-amber-300"
      : "border-sky-400/30 bg-sky-400/10 text-sky-300";

  return (
    <div
      className={`rounded-2xl border transition ${
        isExerciseComplete
          ? "border-lime-400/40 bg-obsidian-900/90"
          : "border-obsidian-700 bg-obsidian-900"
      }`}
    >
      {/* Cabecera Táctil del Ejercicio */}
      <div className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-lg bg-obsidian-800 px-2 py-0.5 font-mono text-xs font-bold text-zinc-300">
              #{exercise.orden}
            </span>
            {exercise.es_superserie && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-violet-400/40 bg-violet-400/15 px-2 py-0.5 text-[11px] font-bold text-violet-300">
                <Link2 className="h-3 w-3" />
                Superserie
              </span>
            )}
            <span className="rounded-lg bg-obsidian-800 px-2 py-0.5 text-[11px] text-zinc-400">
              {exercise.es_compuesto ? "Compuesto" : "Aislamiento"} · {exercise.descanso_seg}s
            </span>
          </div>

          {/* Toggle 1-Toque Plan A <-> Plan B ("Máquina ocupada") */}
          <button
            type="button"
            onClick={() => {
              triggerLightHaptic();
              setVariant((prev) => (prev === "A" ? "B" : "A"));
              if (!expanded) setExpanded(true);
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
              variant === "B"
                ? "border-amber-400/50 bg-amber-400/15 text-amber-200"
                : "border-obsidian-700 bg-obsidian-800 text-zinc-200 hover:border-zinc-600"
            }`}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Plan {variant} {variant === "B" ? "(Sustituto)" : "↔ Plan B"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
              {activeName}
            </h3>
            <p className="mt-0.5 text-xs text-zinc-400">
              Meta hoy: <strong className="text-zinc-200">{effectiveSeriesMeta} series</strong> ×{" "}
              {exercise.reps_min}–{exercise.reps_max} reps
              {exercise.es_unilateral ? " c/u" : ""} · Hechas:{" "}
              <span className={isExerciseComplete ? "font-bold text-lime-400" : "text-zinc-200"}>
                {completedSets}/{effectiveSeriesMeta}
              </span>
            </p>
          </div>
          {expanded ? (
            <ChevronUp className="h-5 w-5 shrink-0 text-zinc-400" />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0 text-zinc-400" />
          )}
        </button>

        {/* Bloque Inteligente: Última vez + Objetivo hoy */}
        <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-obsidian-800 bg-obsidian-950 p-3 sm:grid-cols-2">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-zinc-500">
              Última vez (Plan {variant})
            </span>
            <p className="font-mono text-sm font-semibold text-zinc-200">
              {activeProg.ultimaVezTexto}
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                Objetivo hoy
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeStyle}`}
              >
                {activeProg.accion === "SUBIR" && <TrendingUp className="h-3 w-3" />}
                {activeProg.accion === "CONSOLIDAR" && <Equal className="h-3 w-3" />}
                {activeProg.accion === "RECALIBRAR" && <ArrowDownCircle className="h-3 w-3" />}
                {activeProg.etiquetaAccion}
              </span>
            </div>
            <p className="font-mono text-sm font-bold text-lime-300">
              {activeProg.objetivoHoyTexto}
            </p>
          </div>
          {activeProg.notaTecnica && (
            <p className="sm:col-span-2 text-xs text-zinc-400 border-t border-obsidian-800 pt-2">
              {activeProg.notaTecnica}
            </p>
          )}
        </div>
      </div>

      {/* Cuerpo Expandido: Controles Grandes para Una Mano + Historial de Hoy */}
      {expanded && (
        <div className="space-y-4 border-t border-obsidian-800 p-4">
          {/* Controles de Peso y Reps Táctiles */}
          <div className="grid grid-cols-2 gap-3">
            {/* Peso Real (kg) */}
            <div className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-3">
              <label className="block text-xs font-medium text-zinc-400 mb-2">
                Peso real (kg)
              </label>
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => adjustPeso(-2.5)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-obsidian-800 font-mono text-base font-bold text-zinc-200 active:scale-95"
                >
                  -2.5
                </button>
                <input
                  type="number"
                  step="0.5"
                  inputMode="decimal"
                  value={pesoInput}
                  onChange={(e) => {
                    setPesoInput(e.target.value);
                    persistDraft(e.target.value, repsInput);
                  }}
                  className="w-full min-w-0 bg-transparent text-center font-mono text-xl font-bold text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => adjustPeso(2.5)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-obsidian-800 font-mono text-base font-bold text-lime-300 active:scale-95"
                >
                  +2.5
                </button>
              </div>
            </div>

            {/* Repeticiones Logradas */}
            <div className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-3">
              <label className="block text-xs font-medium text-zinc-400 mb-2">
                Reps logradas
              </label>
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => adjustReps(-1)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-obsidian-800 font-mono text-lg font-bold text-zinc-200 active:scale-95"
                >
                  -1
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  value={repsInput}
                  onChange={(e) => {
                    setRepsInput(e.target.value);
                    persistDraft(pesoInput, e.target.value);
                  }}
                  className="w-full min-w-0 bg-transparent text-center font-mono text-xl font-bold text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => adjustReps(1)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-obsidian-800 font-mono text-lg font-bold text-lime-300 active:scale-95"
                >
                  +1
                </button>
              </div>
            </div>
          </div>

          {/* Selector Rápido de 1 Toque: Sensación / RIR */}
          <div>
            <span className="block text-xs font-medium text-zinc-400 mb-2">
              Sensación / RIR (1 toque)
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RIR_OPTIONS.map((opt) => {
                const active = rir === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      triggerLightHaptic();
                      setRir(opt.value);
                    }}
                    className={`rounded-xl border px-3 py-2.5 text-left transition active:scale-95 ${
                      active
                        ? opt.style
                        : "border-obsidian-800 bg-obsidian-950 text-zinc-400 hover:border-obsidian-700"
                    }`}
                  >
                    <p className="text-xs font-bold leading-tight">{opt.label}</p>
                    <p className="text-[10px] opacity-75 mt-0.5">{opt.short}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Botón Grande Táctil para Registrar Serie + Disparar Descanso Automático */}
          <button
            type="button"
            disabled={submitting}
            onClick={handleSaveSet}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-lime-400 py-4 text-base font-extrabold text-obsidian-950 shadow-lg shadow-lime-400/10 transition active:scale-98 disabled:opacity-50"
          >
            <Check className="h-5 w-5 stroke-[2.5]" />
            {submitting
              ? "Guardando..."
              : `Marcar Serie #${completedSets + 1} · Descanso ${exercise.descanso_seg}s`}
          </button>

          {/* Series Registradas Hoy */}
          {exercise.todaySets.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Series de hoy
              </p>
              {exercise.todaySets.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-obsidian-800 bg-obsidian-950/80 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-lime-400">
                      S{s.numero_serie}
                    </span>
                    <span className="rounded bg-obsidian-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">
                      Plan {s.variante_usada}
                    </span>
                    <span className="font-mono font-bold text-white">
                      {s.peso_real_kg} kg × {s.reps} reps
                    </span>
                    <span className="text-xs text-zinc-400">
                      ({s.sensacion_rir.replace("_", " ").toLowerCase()})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteSet(s.id)}
                    aria-label="Eliminar serie"
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-obsidian-800 hover:text-amber-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function GymView({
  state,
  onLogSet,
  onDeleteSet,
  onContingency,
  onStartTimer,
}: GymViewProps) {
  const [showContingencies, setShowContingencies] = useState(false);

  const activeIndex = state.config.rutina_actual_index;
  const activeWorkout = state.workouts[activeIndex] ?? state.workouts[0];
  const isExpress = state.dailyLog.modo_express;
  const isPostponed = state.dailyLog.gym_postergado;

  if (!activeWorkout) {
    return (
      <div className="rounded-2xl border border-obsidian-800 bg-obsidian-900 p-6 text-center text-zinc-400">
        Cargando plantillas de entrenamiento...
      </div>
    );
  }

  // Filtro Modo Express (20 min): Toma los 3 primeros ejercicios priorizando compuestos (2 series efectivas)
  let visibleExercises = activeWorkout.ejercicios;
  if (isExpress) {
    const compounds = activeWorkout.ejercicios.filter((e) => e.es_compuesto);
    if (compounds.length >= 3) {
      visibleExercises = compounds.slice(0, 3);
    } else {
      const others = activeWorkout.ejercicios.filter((e) => !e.es_compuesto);
      visibleExercises = [...compounds, ...others]
        .slice(0, 3)
        .sort((a, b) => a.orden - b.orden);
    }
  }

  return (
    <div className="space-y-4">
      {/* Cabecera de Rutina + Botón "Ajustar mi día" */}
      <div className="rounded-2xl border border-obsidian-700 bg-obsidian-900 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-lime-400">
                Ciclo Torso / Pierna (4 días)
              </span>
              {isExpress && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                  <Zap className="h-3.5 w-3.5" /> Express 20 min
                </span>
              )}
            </div>
            <h2 className="mt-1 text-2xl font-extrabold text-white">{activeWorkout.nombre}</h2>
            <p className="text-xs text-zinc-400 mt-0.5">{activeWorkout.enfoque}</p>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerLightHaptic();
              setShowContingencies((prev) => !prev);
            }}
            className="flex items-center gap-2 rounded-xl border border-obsidian-700 bg-obsidian-800 px-3.5 py-2.5 text-xs font-bold text-zinc-100 active:scale-95"
          >
            <SlidersHorizontal className="h-4 w-4 text-lime-400" />
            Ajustar mi día
          </button>
        </div>

        {/* Selector rápido de las 4 sesiones del ciclo */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {state.workouts.map((wt, idx) => {
            const selected = idx === activeIndex;
            return (
              <button
                key={wt.id}
                type="button"
                onClick={() =>
                  onContingency({ action: "SET_ROUTINE", routineIndex: idx })
                }
                className={`rounded-xl py-2 text-xs font-bold transition active:scale-95 ${
                  selected
                    ? "bg-lime-400 text-obsidian-950"
                    : "border border-obsidian-800 bg-obsidian-950 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {wt.nombre}
              </button>
            );
          })}
        </div>

        {/* Panel Desplegable de Contingencias Rápidas (Cero Culpa) */}
        {showContingencies && (
          <div className="mt-4 space-y-2.5 rounded-xl border border-obsidian-700 bg-obsidian-950 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Contingencias sin fricción
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  onContingency({
                    action: isPostponed ? "RESUME_TODAY" : "SKIP_TODAY",
                  });
                  setShowContingencies(false);
                }}
                className="flex items-start gap-3 rounded-xl border border-obsidian-800 bg-obsidian-900 p-3 text-left hover:border-obsidian-700 active:scale-98"
              >
                <CalendarClock className="h-5 w-5 shrink-0 text-sky-400 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-white">
                    {isPostponed ? "Retomar entreno hoy" : "Hoy no puedo ir al gym"}
                  </p>
                  <p className="text-xs text-zinc-400">
                    Corre el calendario +1 día manteniendo {activeWorkout.nombre} intacto para mañana.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onContingency({ action: "TOGGLE_EXPRESS" });
                  setShowContingencies(false);
                }}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left active:scale-98 ${
                  isExpress
                    ? "border-amber-400/50 bg-amber-400/10"
                    : "border-obsidian-800 bg-obsidian-900 hover:border-obsidian-700"
                }`}
              >
                <Zap className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-white">
                    {isExpress ? "Volver a rutina completa" : "Solo tengo 20 min (Express)"}
                  </p>
                  <p className="text-xs text-zinc-400">
                    Filtra a los 3 primeros ejercicios principales × 2 series efectivas.
                  </p>
                </div>
              </button>
            </div>
            <p className="text-[11px] text-zinc-400 pt-1">
              💡 <strong>¿Máquina ocupada?</strong> Toca el botón{" "}
              <span className="font-mono text-zinc-200">Plan A ↔ Plan B</span> en cualquier tarjeta para cambiar al sustituto con su propio historial independiente.
            </p>
          </div>
        )}

        {/* Temporizadores Manuales Rápidos (Anticeguera temporal) */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-obsidian-800 pt-3">
          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Timer className="h-4 w-4 text-lime-400" />
            Timer manual:
          </span>
          <div className="flex gap-1.5">
            {[60, 90, 120, 150].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => onStartTimer(sec, `Descanso libre (${sec}s)`)}
                className="rounded-lg border border-obsidian-700 bg-obsidian-800 px-2.5 py-1.5 font-mono text-xs font-semibold text-zinc-200 active:scale-95"
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Estado de Día Postergado */}
      {isPostponed ? (
        <div className="rounded-2xl border border-sky-400/30 bg-sky-400/10 p-5 text-center">
          <CalendarClock className="mx-auto h-8 w-8 text-sky-300" />
          <h3 className="mt-2 text-lg font-bold text-white">
            Sesión corrida 1 día sin penalización
          </h3>
          <p className="mt-1 text-sm text-zinc-300">
            <strong>{activeWorkout.nombre}</strong> te espera lista para tu próxima visita al gym. Hoy prioriza proteína, hidratación y pasos.
          </p>
          <button
            type="button"
            onClick={() => onContingency({ action: "RESUME_TODAY" })}
            className="mt-4 rounded-xl bg-obsidian-900 px-4 py-2.5 text-xs font-bold text-sky-300 border border-sky-400/30"
          >
            Cambié de idea, entrenaré hoy
          </button>
        </div>
      ) : (
        <>
          {/* Lista de Ejercicios */}
          <div className="space-y-3">
            {visibleExercises.map((ex, idx) => (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                workoutTemplateId={activeWorkout.id}
                isExpress={isExpress}
                defaultExpanded={idx === 0}
                onLogSet={onLogSet}
                onDeleteSet={onDeleteSet}
              />
            ))}
          </div>

          {/* Cierre de Sesión -> Avanza índice de rutina automáticamente */}
          <div className="rounded-2xl border border-obsidian-700 bg-obsidian-900 p-4 text-center">
            {state.todaySessionCompleted ? (
              <p className="text-sm font-semibold text-lime-300">
                ✓ Sesión cerrada hoy. El ciclo ya avanzó para tu siguiente día de entrenamiento.
              </p>
            ) : (
              <>
                <p className="text-xs text-zinc-400 mb-3">
                  Al cerrar la sesión, el próximo entrenamiento pasará automáticamente a{" "}
                  <strong className="text-zinc-200">
                    {state.workouts[(activeIndex + 1) % 4]?.nombre}
                  </strong>
                  .
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onContingency({
                      action: "COMPLETE_SESSION",
                      workoutTemplateId: activeWorkout.id,
                    })
                  }
                  className="w-full rounded-2xl border border-lime-400/50 bg-lime-400/15 py-3.5 text-sm font-extrabold text-lime-300 hover:bg-lime-400/20 active:scale-98"
                >
                  Finalizar {activeWorkout.nombre} y avanzar ciclo →
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
