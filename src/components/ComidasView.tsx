"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Plus,
  Trash2,
  Loader2,
  Info,
  Check,
  X,
} from "lucide-react";
import { AppStateDTO } from "@/lib/store-service";
import { InterpretedMealResult } from "@/lib/gemini-nutrition";
import { NutritionTrafficLight } from "@/components/NutritionTrafficLight";
import { getNowTimeContext } from "@/lib/date-utils";
import { triggerLightHaptic } from "@/lib/sound-haptics";

interface ComidasViewProps {
  state: AppStateDTO;
  onAddMeal: (payload: {
    bloque_horario: string;
    texto_original?: string | null;
    nombre: string;
    multiplicador?: number;
    kcal: number;
    proteina: number;
    fibra: number;
    bandera_sodio_grasa?: string | null;
    es_estimacion_ia?: boolean;
    recomendacion_ia?: string | null;
  }) => Promise<void>;
  onDeleteMeal: (mealId: string) => Promise<void>;
  onUpdateDaily: (patch: Record<string, unknown>) => Promise<void>;
}

const MULTIPLIERS = [0.5, 1, 1.5, 2];

const CATEGORY_LABELS: Record<string, string> = {
  PROTEINA: "Proteínas Base",
  CARBOHIDRATO: "Carbohidratos Estratégicos",
  VEGETAL_GRASA: "Vegetales & Grasas Saludables",
};

export function ComidasView({
  state,
  onAddMeal,
  onDeleteMeal,
  onUpdateDaily,
}: ComidasViewProps) {
  const [multiplier, setMultiplier] = useState<number>(1);
  const [aiInput, setAiInput] = useState<string>("");
  const [interpreting, setInterpreting] = useState<boolean>(false);
  const [preview, setPreview] = useState<InterpretedMealResult | null>(null);
  const [editNombre, setEditNombre] = useState<string>("");
  const [editKcal, setEditKcal] = useState<string>("");
  const [editProt, setEditProt] = useState<string>("");
  const [editFibra, setEditFibra] = useState<string>("");
  const [justAddedToast, setJustAddedToast] = useState<string | null>(null);

  const totals = state.mealsToday.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      proteina: acc.proteina + m.proteina,
      fibra: acc.fibra + m.fibra,
    }),
    { kcal: 0, proteina: 0, fibra: 0 }
  );

  const showQuickToast = (msg: string) => {
    setJustAddedToast(msg);
    setTimeout(() => {
      setJustAddedToast((prev) => (prev === msg ? null : prev));
    }, 2600);
  };

  const handlePresetTap = async (preset: AppStateDTO["foodPresets"][number]) => {
    triggerLightHaptic();
    const block = getNowTimeContext().block;
    const kcal = Math.round(preset.kcal * multiplier);
    const proteina = Number((preset.proteina * multiplier).toFixed(1));
    const fibra = Number((preset.fibra * multiplier).toFixed(1));
    const multLabel = multiplier === 1 ? "" : ` (${multiplier}x)`;

    await onAddMeal({
      bloque_horario: block,
      nombre: `${preset.nombre}${multLabel}`,
      multiplicador: multiplier,
      kcal,
      proteina,
      fibra,
      bandera_sodio_grasa: preset.alerta_sodio
        ? "Alimento alto en sodio · recuerda sumar +250ml de agua"
        : null,
      es_estimacion_ia: false,
    });

    showQuickToast(`+ ${preset.nombre}${multLabel} (${kcal} kcal · ${proteina}g P)`);
  };

  const handleInterpretSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim() || interpreting) return;
    setInterpreting(true);
    triggerLightHaptic();

    try {
      const now = new Date();
      const horaActual = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;

      const res = await fetch("/api/meals/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: aiInput.trim(),
          consumidoKcal: Math.round(totals.kcal),
          metaKcal: state.config.calorias_meta,
          consumidoProteina: Number(totals.proteina.toFixed(1)),
          metaProteina: state.config.proteina_meta,
          consumidoFibra: Number(totals.fibra.toFixed(1)),
          metaFibra: state.config.fibra_meta,
          horaActual,
          entrenaHoy: !state.dailyLog.gym_postergado,
        }),
      });

      if (res.ok) {
        const data: InterpretedMealResult = await res.json();
        setPreview(data);
        setEditNombre(data.nombre_limpio);
        setEditKcal(String(data.kcal));
        setEditProt(String(data.proteina_g));
        setEditFibra(String(data.fibra_g));
      }
    } finally {
      setInterpreting(false);
    }
  };

  const handleConfirmPreview = async () => {
    if (!preview) return;
    triggerLightHaptic();
    const block = getNowTimeContext().block;

    await onAddMeal({
      bloque_horario: block,
      texto_original: aiInput.trim(),
      nombre: editNombre.trim() || preview.nombre_limpio,
      multiplicador: 1,
      kcal: Math.max(0, parseInt(editKcal, 10) || 0),
      proteina: Math.max(0, parseFloat(editProt) || 0),
      fibra: Math.max(0, parseFloat(editFibra) || 0),
      bandera_sodio_grasa: preview.bandera_sodio_o_grasa_saturada,
      es_estimacion_ia: true,
      recomendacion_ia: preview.veredicto_y_ajuste,
    });

    showQuickToast(`Guardado: ${editNombre || preview.nombre_limpio}`);
    setPreview(null);
    setAiInput("");
  };

  return (
    <div className="space-y-4">
      {/* Toast ligero de confirmación 1-Tap */}
      {justAddedToast && (
        <div className="rounded-xl border border-lime-400/40 bg-lime-400/15 px-4 py-2.5 text-xs font-bold text-lime-200">
          ✓ {justAddedToast}
        </div>
      )}

      {/* Semáforo Diario en Tiempo Real */}
      <NutritionTrafficLight
        state={state}
        onAddWater={(ml) => onUpdateDaily({ agua_delta: ml })}
        onToggleWalk={(val) => onUpdateDaily({ caminata_post_comida: val })}
      />

      {/* Caja Inteligente con IA ("¿Qué comiste?") */}
      <div className="rounded-2xl border border-obsidian-700 bg-obsidian-900 p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-lime-400" />
            <h3 className="font-bold text-white">¿Qué comiste? (Intérprete IA)</h3>
          </div>
          <span className="rounded-full bg-obsidian-800 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-400">
            {state.aiConfigured ? "Gemini Flash Activo" : "Estimador Local"}
          </span>
        </div>

        <p className="text-xs text-zinc-400 mb-3">
          Escribe cualquier plato dentro o fuera del plan. Obtendrás macros editables y cómo equilibrar tu siguiente comida sin culpa.
        </p>

        <form onSubmit={handleInterpretSubmit} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder='Ej: "un plato de arroz chaufa de pollo y gaseosa zero" o "2 tostadas con palta y 1 huevo"'
            className="flex-1 rounded-xl border border-obsidian-700 bg-obsidian-950 px-3.5 py-3 text-sm text-white placeholder-zinc-500 focus:border-lime-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={interpreting || !aiInput.trim()}
            className="flex items-center justify-center gap-2 rounded-xl bg-lime-400 px-5 py-3 text-sm font-extrabold text-obsidian-950 active:scale-95 disabled:opacity-50"
          >
            {interpreting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analizando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Calcular
              </>
            )}
          </button>
        </form>

        {/* Ejemplos rápidos de prueba 1 toque */}
        {!preview && !aiInput && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {[
              "2 tostadas con palta y 2 huevos",
              "Plato de arroz chaufa de pollo y gaseosa zero",
              "1/4 pollo a la brasa con ensalada",
            ].map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => setAiInput(sample)}
                className="rounded-lg border border-obsidian-800 bg-obsidian-950 px-2.5 py-1 text-[11px] text-zinc-400 hover:text-zinc-200"
              >
                {sample}
              </button>
            ))}
          </div>
        )}

        {/* Tarjeta de Confirmación Rápida Editable antes de Guardar */}
        {preview && (
          <div className="mt-4 space-y-3 rounded-2xl border border-lime-400/40 bg-obsidian-950 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-lime-300">
                Confirmación editable ({preview.fuente === "GEMINI_FLASH" ? "Gemini IA" : "Local"})
              </span>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-lg p-1 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              type="text"
              value={editNombre}
              onChange={(e) => setEditNombre(e.target.value)}
              className="w-full rounded-xl border border-obsidian-700 bg-obsidian-900 px-3 py-2 text-sm font-bold text-white focus:border-lime-400 focus:outline-none"
            />

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-obsidian-800 bg-obsidian-900 p-2.5">
                <label className="block text-[10px] uppercase text-zinc-400">Calorías</label>
                <input
                  type="number"
                  value={editKcal}
                  onChange={(e) => setEditKcal(e.target.value)}
                  className="mt-0.5 w-full bg-transparent font-mono text-base font-bold text-white focus:outline-none"
                />
              </div>
              <div className="rounded-xl border border-obsidian-800 bg-obsidian-900 p-2.5">
                <label className="block text-[10px] uppercase text-zinc-400">Proteína (g)</label>
                <input
                  type="number"
                  step="0.5"
                  value={editProt}
                  onChange={(e) => setEditProt(e.target.value)}
                  className="mt-0.5 w-full bg-transparent font-mono text-base font-bold text-sky-300 focus:outline-none"
                />
              </div>
              <div className="rounded-xl border border-obsidian-800 bg-obsidian-900 p-2.5">
                <label className="block text-[10px] uppercase text-zinc-400">Fibra (g)</label>
                <input
                  type="number"
                  step="0.5"
                  value={editFibra}
                  onChange={(e) => setEditFibra(e.target.value)}
                  className="mt-0.5 w-full bg-transparent font-mono text-base font-bold text-emerald-300 focus:outline-none"
                />
              </div>
            </div>

            {preview.bandera_sodio_o_grasa_saturada && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-300" />
                <span>{preview.bandera_sodio_o_grasa_saturada}</span>
              </div>
            )}

            <div className="rounded-xl border border-sky-400/25 bg-sky-400/10 p-3 text-xs text-sky-100 leading-relaxed">
              <strong className="block text-sky-300 mb-0.5">Veredicto y Ajuste del Día:</strong>
              {preview.veredicto_y_ajuste}
            </div>

            <button
              type="button"
              onClick={handleConfirmPreview}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-400 py-3 text-sm font-extrabold text-obsidian-950 active:scale-98"
            >
              <Check className="h-4 w-4 stroke-[2.5]" />
              Confirmar y Guardar en mi Día
            </button>
          </div>
        )}
      </div>

      {/* Chips Rápidos de 1 Toque con Multiplicador (0.5x / 1x / 1.5x / 2x) */}
      <div className="rounded-2xl border border-obsidian-700 bg-obsidian-900 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-white">Chips Rápidos (1 Toque)</h3>
            <p className="text-xs text-zinc-400">
              Selecciona porción y toca cualquier alimento para sumarlo al instante
            </p>
          </div>

          {/* Selector de Multiplicador */}
          <div className="flex items-center gap-1 rounded-xl border border-obsidian-800 bg-obsidian-950 p-1">
            {MULTIPLIERS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  triggerLightHaptic();
                  setMultiplier(m);
                }}
                className={`rounded-lg px-2.5 py-1 font-mono text-xs font-bold transition ${
                  multiplier === m
                    ? "bg-lime-400 text-obsidian-950"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {m}x
              </button>
            ))}
          </div>
        </div>

        {(["PROTEINA", "CARBOHIDRATO", "VEGETAL_GRASA"] as const).map((cat) => {
          const items = state.foodPresets.filter((f) => f.categoria === cat);
          return (
            <div key={cat} className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {CATEGORY_LABELS[cat]}
              </h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {items.map((item) => {
                  const k = Math.round(item.kcal * multiplier);
                  const p = Number((item.proteina * multiplier).toFixed(1));
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handlePresetTap(item)}
                      className="flex items-center justify-between gap-2 rounded-xl border border-obsidian-800 bg-obsidian-950 p-3 text-left transition hover:border-lime-400/50 active:scale-98"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-bold text-white">{item.nombre}</p>
                        </div>
                        <p className="text-xs text-zinc-400">
                          {multiplier !== 1 ? `${multiplier} × ` : ""}
                          {item.porcion_texto} ·{" "}
                          <span className="font-mono text-zinc-300">{k} kcal</span> ·{" "}
                          <span className="font-mono text-sky-300">{p}g P</span>
                        </p>
                        {(item.alerta_sodio || item.beneficio_tag) && (
                          <span
                            className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              item.alerta_sodio
                                ? "bg-amber-400/15 text-amber-300"
                                : "bg-emerald-400/10 text-emerald-300"
                            }`}
                          >
                            {item.beneficio_tag}
                          </span>
                        )}
                      </div>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-obsidian-800 text-lime-400">
                        <Plus className="h-4 w-4" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Registro de Comidas de Hoy */}
      <div className="rounded-2xl border border-obsidian-700 bg-obsidian-900 p-4">
        <h3 className="font-bold text-white mb-3">
          Comidas registradas hoy ({state.mealsToday.length})
        </h3>
        {state.mealsToday.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Aún no registraste alimentos hoy. Toca un chip arriba o escribe qué comiste.
          </p>
        ) : (
          <div className="space-y-2">
            {state.mealsToday.map((meal) => (
              <div
                key={meal.id}
                className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{meal.nombre}</span>
                      {meal.es_estimacion_ia && (
                        <span className="rounded bg-lime-400/15 px-1.5 py-0.5 text-[10px] font-bold text-lime-300">
                          IA
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-zinc-400">
                      {meal.kcal} kcal · <span className="text-sky-300">{meal.proteina}g P</span> ·{" "}
                      <span className="text-emerald-300">{meal.fibra}g Fibra</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteMeal(meal.id)}
                    aria-label="Borrar comida"
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-obsidian-800 hover:text-amber-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {meal.bandera_sodio_grasa && (
                  <p className="mt-2 text-[11px] text-amber-300">
                    ⚡ {meal.bandera_sodio_grasa}
                  </p>
                )}
                {meal.recomendacion_ia && (
                  <p className="mt-1.5 border-t border-obsidian-800 pt-1.5 text-xs text-zinc-300">
                    {meal.recomendacion_ia}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
