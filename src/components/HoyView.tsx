"use client";

import React, { useEffect, useState } from "react";
import {
  Sun,
  Sunset,
  Moon,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Timer,
  Dumbbell,
  Utensils,
  Scale,
  BedDouble,
  Sparkles,
  Zap,
  ShieldAlert,
  Calendar,
  Pill,
} from "lucide-react";
import { AppStateDTO } from "@/lib/store-service";
import { MORNING_ROUTINE_ITEMS } from "@/lib/seed-data";
import { getNowTimeContext, TimeBlock } from "@/lib/date-utils";
import { NutritionTrafficLight } from "@/components/NutritionTrafficLight";
import { triggerLightHaptic } from "@/lib/sound-haptics";

interface HoyViewProps {
  state: AppStateDTO;
  onUpdateDaily: (patch: Record<string, unknown>) => Promise<void>;
  onStartTimer: (seconds: number, label: string) => void;
  onNavigateTab: (tab: "hoy" | "gym" | "comidas" | "progreso") => void;
}

export function HoyView({
  state,
  onUpdateDaily,
  onStartTimer,
  onNavigateTab,
}: HoyViewProps) {
  const [timeCtx, setTimeCtx] = useState(() => getNowTimeContext());
  const [expandedBlocks, setExpandedBlocks] = useState<Record<TimeBlock, boolean>>({
    MANANA: true,
    TARDE: false,
    NOCHE: false,
  });
  const [pesoInput, setPesoInput] = useState<string>(
    state.dailyLog.peso_kg ? String(state.dailyLog.peso_kg) : ""
  );
  const [savingPeso, setSavingPeso] = useState(false);

  useEffect(() => {
    const now = getNowTimeContext();
    setTimeCtx(now);
    setExpandedBlocks({
      MANANA: now.block === "MANANA",
      TARDE: now.block === "TARDE",
      NOCHE: now.block === "NOCHE",
    });
  }, []);

  useEffect(() => {
    if (state.dailyLog.peso_kg !== null) {
      setPesoInput(String(state.dailyLog.peso_kg));
    }
  }, [state.dailyLog.peso_kg]);

  const toggleBlock = (block: TimeBlock) => {
    triggerLightHaptic();
    setExpandedBlocks((prev) => ({ ...prev, [block]: !prev[block] }));
  };

  const morningDoneMap = state.dailyLog.rutina_matutina || {};
  const completedMorningCount = MORNING_ROUTINE_ITEMS.filter(
    (i) => morningDoneMap[i.id]
  ).length;

  const handleToggleMorningHabit = async (habitId: string) => {
    triggerLightHaptic();
    const nextMap = {
      ...morningDoneMap,
      [habitId]: !morningDoneMap[habitId],
    };
    const extraPatch: Record<string, unknown> = { rutina_matutina: nextMap };
    if (habitId === "jamaica" && !morningDoneMap[habitId] && state.dailyLog.agua_ml === 0) {
      extraPatch.agua_delta = 400;
    }
    await onUpdateDaily(extraPatch);
  };

  const handleSavePeso = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(pesoInput.replace(",", "."));
    if (isNaN(val) || val < 30 || val > 250) return;
    setSavingPeso(true);
    triggerLightHaptic();
    await onUpdateDaily({ peso_kg: Number(val.toFixed(1)) });
    setSavingPeso(false);
  };

  const activeWorkout =
    state.workouts[state.config.rutina_actual_index] ?? state.workouts[0];
  const todaySetsTotal =
    activeWorkout?.ejercicios.reduce((acc, ex) => acc + ex.todaySets.length, 0) ?? 0;

  const totals = state.mealsToday.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      proteina: acc.proteina + m.proteina,
      fibra: acc.fibra + m.fibra,
    }),
    { kcal: 0, proteina: 0, fibra: 0 }
  );

  const restanKcal = state.config.calorias_meta - totals.kcal;
  const faltaProt = Math.max(0, Math.round(state.config.proteina_meta - totals.proteina));
  const rp = state.recoveryPlan;
  const bio = state.biometrics;

  const orderedBlocks: TimeBlock[] =
    timeCtx.block === "MANANA"
      ? ["MANANA", "TARDE", "NOCHE"]
      : timeCtx.block === "TARDE"
      ? ["TARDE", "MANANA", "NOCHE"]
      : ["NOCHE", "TARDE", "MANANA"];

  return (
    <div className="space-y-4">
      {/* Cabecera Modo Ahora + Registro Rápido de Peso Siempre Visible (Cero Fricción a cualquier hora) */}
      <div className="rounded-2xl border border-lime-400/30 bg-gradient-to-br from-obsidian-900 via-obsidian-900 to-obsidian-850 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-400/15 px-3 py-1 text-xs font-bold text-lime-300">
            <Sparkles className="h-3.5 w-3.5" />
            {timeCtx.label} · {timeCtx.timeRange}
          </span>
          <span className="font-mono text-xs text-zinc-400">{state.fecha}</span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{timeCtx.greeting}</h2>
            <p className="text-xs text-zinc-400">{timeCtx.focusSummary}</p>
          </div>

          {/* Input directo de peso corporal siempre accesible */}
          <form onSubmit={handleSavePeso} className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 rounded-xl border border-obsidian-700 bg-obsidian-950 px-2.5 py-1.5">
              <Scale className="h-4 w-4 text-lime-400 shrink-0" />
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder={`${bio.pesoUsadoKg} kg`}
                value={pesoInput}
                onChange={(e) => setPesoInput(e.target.value)}
                className="w-16 bg-transparent text-right font-mono text-sm font-bold text-white focus:outline-none"
              />
              <span className="text-xs text-zinc-500">kg</span>
            </div>
            <button
              type="submit"
              disabled={savingPeso}
              className="rounded-xl bg-lime-400 px-3 py-2 text-xs font-extrabold text-obsidian-950 active:scale-95"
            >
              {state.dailyLog.peso_kg ? "Peso ✓" : "Guardar"}
            </button>
          </form>
        </div>

        {/* Guía Calórica Dinámica del Día (Ciclado Automático Entreno vs Descanso) */}
        <div className="rounded-xl border border-obsidian-700 bg-obsidian-950/90 p-3 text-xs text-zinc-300 leading-relaxed">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <span className="font-bold text-lime-300">
              Cálculo Dinámico Hoy (-{state.config.deficit_pct}% sobre TDEE {bio.tdeeHoyRealKcal} kcal)
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab("progreso")}
              className="text-[11px] font-semibold text-sky-300 hover:underline"
            >
              Editar altura/edad/% déficit →
            </button>
          </div>
          <p>{bio.guiaAlimentacionHoy}</p>
        </div>
      </div>

      {/* Planificador Inteligente de Descanso y Recuperación SNC (Tira de 7 días) */}
      <div
        className={`rounded-2xl border p-4 space-y-3 ${
          rp.recomiendaDescansoHoy
            ? "border-sky-400/40 bg-obsidian-900"
            : "border-obsidian-700 bg-obsidian-900"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-300">
              <Calendar className="h-3.5 w-3.5" />
              Motor Inteligente de Recuperación ({rp.sesionesUltimos7Dias}/4 sesiones últimos 7d)
            </span>
            <h3 className="mt-1 text-base font-bold text-white">{rp.tituloEstado}</h3>
            <p className="mt-0.5 text-xs text-zinc-400 leading-relaxed">{rp.razonCientifica}</p>
          </div>

          <button
            type="button"
            onClick={() => onUpdateDaily({ creatina_ok: !state.dailyLog.creatina_ok })}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
              state.dailyLog.creatina_ok
                ? "border-lime-400/40 bg-lime-400/15 text-lime-300"
                : "border-obsidian-700 bg-obsidian-800 text-zinc-300"
            }`}
          >
            <Pill className="h-3.5 w-3.5" />
            {state.dailyLog.creatina_ok ? "Creatina 5g ✓" : "Creatina 5g"}
          </button>
        </div>

        {/* Tira Visual de 7 Días (Pasado + Hoy + Proyección Inteligente) */}
        <div className="grid grid-cols-7 gap-1.5">
          {rp.calendario7Dias.map((slot) => {
            const isDone = slot.estado === "ENTRENO_HECHO";
            const isTodayRest = slot.estado === "HOY_DESCANSAR";
            const isTodayTrain = slot.estado === "HOY_ENTRENAR";
            const isProjTrain = slot.estado === "PROYECTADO_ENTRENAR";

            return (
              <div
                key={slot.fecha}
                className={`rounded-xl border p-2 text-center ${
                  slot.esHoy
                    ? isTodayRest
                      ? "border-sky-400 bg-sky-400/15"
                      : "border-lime-400 bg-lime-400/15"
                    : isDone
                    ? "border-emerald-400/30 bg-emerald-400/10"
                    : "border-obsidian-800 bg-obsidian-950/70"
                }`}
              >
                <p className="text-[10px] font-bold uppercase text-zinc-400">{slot.diaCorto}</p>
                <p
                  className={`mt-1 truncate text-[10px] font-extrabold ${
                    isDone
                      ? "text-emerald-300"
                      : isTodayRest
                      ? "text-sky-300"
                      : isTodayTrain
                      ? "text-lime-300"
                      : isProjTrain
                      ? "text-zinc-200"
                      : "text-zinc-500"
                  }`}
                >
                  {isDone ? "✓ " : ""}
                  {slot.etiqueta}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Semáforo Diario en Tiempo Real */}
      <NutritionTrafficLight
        state={state}
        compact
        onAddWater={(ml) => onUpdateDaily({ agua_delta: ml })}
        onToggleWalk={(val) => onUpdateDaily({ caminata_post_comida: val })}
      />

      {/* Bloques Contextuales por Hora */}
      {orderedBlocks.map((blockKey) => {
        const isCurrent = timeCtx.block === blockKey;
        const isOpen = expandedBlocks[blockKey];

        if (blockKey === "MANANA") {
          return (
            <section
              key="MANANA"
              className={`rounded-2xl border transition ${
                isCurrent
                  ? "border-lime-400/40 bg-obsidian-900"
                  : "border-obsidian-800 bg-obsidian-900/70"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleBlock("MANANA")}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      isCurrent
                        ? "bg-lime-400/20 text-lime-300"
                        : "bg-obsidian-800 text-zinc-400"
                    }`}
                  >
                    <Sun className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white">Mañana (05:00 – 11:30)</h3>
                      {isCurrent && (
                        <span className="rounded-md bg-lime-400 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-obsidian-950">
                          Ahora
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">
                      Rutina cervical {completedMorningCount}/{MORNING_ROUTINE_ITEMS.length} ·{" "}
                      {state.dailyLog.peso_kg
                        ? `Peso hoy: ${state.dailyLog.peso_kg} kg`
                        : "Peso en ayunas"}
                    </p>
                  </div>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-zinc-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-zinc-400" />
                )}
              </button>

              {isOpen && (
                <div className="space-y-2.5 border-t border-obsidian-800 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Checklist Matutino & Postura (5–8 min)
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => onStartTimer(5, "Pulso Cervical · 5 seg")}
                        className="flex items-center gap-1 rounded-lg border border-obsidian-700 bg-obsidian-800 px-2.5 py-1 text-xs font-semibold text-lime-300 active:scale-95"
                      >
                        <Timer className="h-3.5 w-3.5" />
                        5s
                      </button>
                      <button
                        type="button"
                        onClick={() => onStartTimer(15, "Isométrico / Estiramiento · 15 seg")}
                        className="flex items-center gap-1 rounded-lg border border-obsidian-700 bg-obsidian-800 px-2.5 py-1 text-xs font-semibold text-lime-300 active:scale-95"
                      >
                        <Timer className="h-3.5 w-3.5" />
                        15s
                      </button>
                    </div>
                  </div>

                  {MORNING_ROUTINE_ITEMS.map((item) => {
                    const done = Boolean(morningDoneMap[item.id]);
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between gap-2 rounded-xl border p-3 transition ${
                          done
                            ? "border-lime-400/30 bg-lime-400/5"
                            : "border-obsidian-800 bg-obsidian-950/60"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleMorningHabit(item.id)}
                          className="flex flex-1 items-start gap-3 text-left"
                        >
                          {done ? (
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lime-400" />
                          ) : (
                            <Circle className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />
                          )}
                          <div>
                            <p
                              className={`text-sm font-semibold ${
                                done ? "text-zinc-300 line-through" : "text-white"
                              }`}
                            >
                              {item.titulo}
                            </p>
                            <p className="text-xs text-zinc-400">{item.subtitulo}</p>
                          </div>
                        </button>

                        {item.timerSeg && (
                          <button
                            type="button"
                            onClick={() =>
                              onStartTimer(item.timerSeg!, `${item.titulo} (${item.timerSeg}s)`)
                            }
                            className="shrink-0 rounded-xl border border-obsidian-700 bg-obsidian-800 px-3 py-2 text-xs font-semibold text-zinc-200 active:scale-95"
                          >
                            ⏱ {item.timerSeg}s
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        }

        if (blockKey === "TARDE") {
          return (
            <section
              key="TARDE"
              className={`rounded-2xl border transition ${
                isCurrent
                  ? "border-lime-400/40 bg-obsidian-900"
                  : "border-obsidian-800 bg-obsidian-900/70"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleBlock("TARDE")}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      isCurrent
                        ? "bg-lime-400/20 text-lime-300"
                        : "bg-obsidian-800 text-zinc-400"
                    }`}
                  >
                    <Sunset className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white">Mediodía / Tarde (11:30 – 19:00)</h3>
                      {isCurrent && (
                        <span className="rounded-md bg-lime-400 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-obsidian-950">
                          Ahora
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">
                      {rp.recomiendaDescansoHoy
                        ? `Descanso SNC sugerido (Próxima: ${activeWorkout?.nombre})`
                        : `Hoy toca: ${activeWorkout?.nombre ?? "Gym"}`}{" "}
                      · {state.mealsToday.length} comidas hoy
                    </p>
                  </div>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-zinc-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-zinc-400" />
                )}
              </button>

              {isOpen && (
                <div className="grid gap-3 border-t border-obsidian-800 p-4 sm:grid-cols-2">
                  <div className="flex flex-col justify-between rounded-xl border border-obsidian-700 bg-obsidian-950 p-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-lime-400">
                          <Dumbbell className="h-4 w-4" />
                          {rp.recomiendaDescansoHoy ? "Recuperación Activa" : "Sesión Activa"}
                        </span>
                        {state.dailyLog.modo_express && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                            <Zap className="h-3 w-3" /> Express 20m
                          </span>
                        )}
                      </div>
                      <h4 className="mt-1.5 text-lg font-bold text-white">
                        {rp.recomiendaDescansoHoy
                          ? `Reposar hoy → Mañana ${activeWorkout?.nombre}`
                          : activeWorkout?.nombre}
                      </h4>
                      <p className="mt-1 text-xs text-zinc-400">{activeWorkout?.enfoque}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigateTab("gym")}
                      className="mt-4 w-full rounded-xl bg-lime-400 py-3 text-sm font-bold text-obsidian-950 active:scale-98"
                    >
                      {state.todaySessionCompleted
                        ? "Sesión completada ✓ (Ver)"
                        : todaySetsTotal > 0
                        ? `Continuar (${todaySetsTotal} series hoy)`
                        : rp.recomiendaDescansoHoy
                        ? "Ver plan o entrenar igual →"
                        : "Abrir Entrenamiento →"}
                    </button>
                  </div>

                  <div className="flex flex-col justify-between rounded-xl border border-obsidian-700 bg-obsidian-950 p-4">
                    <div>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sky-400">
                        <Utensils className="h-4 w-4" />
                        Nutrición 1-Tap + IA
                      </span>
                      <h4 className="mt-1.5 text-lg font-bold text-white">
                        {Math.round(totals.proteina)}g / {state.config.proteina_meta}g Proteína
                      </h4>
                      <p className="mt-1 text-xs text-zinc-400">
                        Meta hoy ajustada a {state.config.calorias_meta} kcal según tu actividad real.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigateTab("comidas")}
                      className="mt-4 w-full rounded-xl border border-sky-400/40 bg-sky-400/15 py-3 text-sm font-bold text-sky-200 active:scale-98"
                    >
                      Registrar Comida →
                    </button>
                  </div>
                </div>
              )}
            </section>
          );
        }

        return (
          <section
            key="NOCHE"
            className={`rounded-2xl border transition ${
              isCurrent
                ? "border-lime-400/40 bg-obsidian-900"
                : "border-obsidian-800 bg-obsidian-900/70"
            }`}
          >
            <button
              type="button"
              onClick={() => toggleBlock("NOCHE")}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    isCurrent
                      ? "bg-lime-400/20 text-lime-300"
                      : "bg-obsidian-800 text-zinc-400"
                  }`}
                >
                  <Moon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white">Noche (19:00 – 23:59)</h3>
                    {isCurrent && (
                      <span className="rounded-md bg-lime-400 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-obsidian-950">
                        Ahora
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400">
                    Cena inteligente · Cierre de macros · Meta de sueño 7–8h
                  </p>
                </div>
              </div>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-zinc-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-zinc-400" />
              )}
            </button>

            {isOpen && (
              <div className="space-y-3 border-t border-obsidian-800 p-4">
                <div className="rounded-xl border border-obsidian-700 bg-obsidian-950 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                    Guía exacta para tu cena hoy ({state.config.calorias_meta} kcal meta hoy)
                  </p>
                  <p className="mt-1.5 text-sm text-zinc-200 leading-relaxed">
                    {restanKcal >= 350 && faltaProt >= 25
                      ? `Tienes ${restanKcal} kcal libres y faltan ${faltaProt}g de proteína. Cena ideal: 150–200g de pechuga/caballa + ensalada o brócoli + ${
                          rp.recomiendaDescansoHoy
                            ? "porción ligera de vegetales/papa enfriada (día de descanso)."
                            : "200g de papa yungay o amarilla enfriada para reponer glucógeno."
                        }`
                      : restanKcal < 150 && faltaProt >= 20
                      ? `Quedan pocas calorías (${Math.max(0, restanKcal)} kcal) pero faltan ${faltaProt}g de proteína. Prioriza claras, atún en agua o pechuga a la plancha con vegetales verdes sin aceite extra.`
                      : `Día cuadrado (${Math.round(totals.kcal)}/${state.config.calorias_meta} kcal · ${Math.round(totals.proteina)}g prot). Si tienes hambre ligera, yogur griego sin azúcar o infusión tibia.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigateTab("comidas")}
                    className="mt-3 rounded-xl bg-obsidian-800 px-4 py-2 text-xs font-semibold text-lime-300 hover:bg-obsidian-700"
                  >
                    Ir a registrar cena →
                  </button>
                </div>

                <div className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-4">
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <BedDouble className="h-4 w-4 text-indigo-400" />
                      <span className="text-sm font-semibold text-white">
                        Sueño (impacta tu recomendación de descanso)
                      </span>
                    </div>
                    <span className="font-mono text-xs text-indigo-300">
                      {state.dailyLog.sueno_horas
                        ? `${state.dailyLog.sueno_horas} h registradas`
                        : "Sin registrar"}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[5.5, 6.5, 7, 7.5, 8].map((h) => {
                      const selected = state.dailyLog.sueno_horas === h;
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => {
                            triggerLightHaptic();
                            onUpdateDaily({ sueno_horas: h });
                          }}
                          className={`rounded-xl py-2.5 font-mono text-sm font-bold transition active:scale-95 ${
                            selected
                              ? "bg-indigo-500 text-white"
                              : "border border-obsidian-700 bg-obsidian-900 text-zinc-300"
                          }`}
                        >
                          {h}h
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
