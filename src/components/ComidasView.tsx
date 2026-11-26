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
  Copy,
  ClipboardPaste,
  PenLine,
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

type EntryMode = "PROMPT_CHAT" | "API_AUTO" | "MANUAL_DIRECTO";

const MULTIPLIERS = [0.5, 1, 1.5, 2];

const CATEGORY_LABELS: Record<string, string> = {
  PROTEINA: "Proteínas Base",
  CARBOHIDRATO: "Carbohidratos Estratégicos",
  VEGETAL_GRASA: "Vegetales & Grasas Saludables",
};

/**
 * Parser tolerante: extrae el JSON devuelto por el chat de Gemini aunque traiga bloques ```json
 * o texto adicional antes/después, con soporte de respaldo si pega texto plano con números.
 */
function parsePastedChatOutput(raw: string, fallbackName: string): InterpretedMealResult | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. Limpiar fences ```json ... ``` y buscar el objeto { ... }
  const withoutFences = trimmed
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const firstBrace = withoutFences.indexOf("{");
  const lastBrace = withoutFences.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = withoutFences.slice(firstBrace, lastBrace + 1);
    try {
      const obj = JSON.parse(jsonCandidate);
      return {
        nombre_limpio: String(
          obj.nombre_limpio || obj.nombre || obj.plato || fallbackName || "Comida importada"
        ).slice(0, 100),
        kcal: Math.max(0, Math.round(Number(obj.kcal ?? obj.calorias ?? 0) || 0)),
        proteina_g: Math.max(
          0,
          Number(Number(obj.proteina_g ?? obj.proteina ?? 0).toFixed(1))
        ),
        fibra_g: Math.max(0, Number(Number(obj.fibra_g ?? obj.fibra ?? 0).toFixed(1))),
        bandera_sodio_o_grasa_saturada:
          obj.bandera_sodio_o_grasa_saturada?.trim()
            ? String(obj.bandera_sodio_o_grasa_saturada).trim()
            : null,
        veredicto_y_ajuste: String(
          obj.veredicto_y_ajuste || obj.recomendacion || obj.ajuste || ""
        ).trim(),
        fuente: "GEMINI_FLASH",
      };
    } catch {
      // Si el JSON tenía alguna coma suelta, intentar regex abajo
    }
  }

  // 2. Respaldo por expresiones regulares si pegó texto libre en lugar de JSON
  const kcalMatch = withoutFences.match(/(\d+(?:[.,]\d+)?)\s*(?:kcal|calor[ií]as)/i);
  const protMatch = withoutFences.match(
    /(?:prote[ií]nas?|prot)\s*[:=-]?\s*(\d+(?:[.,]\d+)?)/i
  ) || withoutFences.match(/(\d+(?:[.,]\d+)?)\s*g?\s*(?:de\s+)?prote[ií]na/i);
  const fibraMatch = withoutFences.match(
    /(?:fibra)\s*[:=-]?\s*(\d+(?:[.,]\d+)?)/i
  ) || withoutFences.match(/(\d+(?:[.,]\d+)?)\s*g?\s*(?:de\s+)?fibra/i);

  if (kcalMatch || protMatch) {
    return {
      nombre_limpio: (fallbackName || "Comida desde Chat Gemini").slice(0, 100),
      kcal: kcalMatch ? Math.round(parseFloat(kcalMatch[1].replace(",", "."))) : 0,
      proteina_g: protMatch ? parseFloat(protMatch[1].replace(",", ".")) : 0,
      fibra_g: fibraMatch ? parseFloat(fibraMatch[1].replace(",", ".")) : 0,
      bandera_sodio_o_grasa_saturada: null,
      veredicto_y_ajuste: "",
      fuente: "GEMINI_FLASH",
    };
  }

  return null;
}

export function ComidasView({
  state,
  onAddMeal,
  onDeleteMeal,
  onUpdateDaily,
}: ComidasViewProps) {
  const [entryMode, setEntryMode] = useState<EntryMode>("PROMPT_CHAT");
  const [multiplier, setMultiplier] = useState<number>(1);
  const [aiInput, setAiInput] = useState<string>("");
  const [pastedOutput, setPastedOutput] = useState<string>("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [interpreting, setInterpreting] = useState<boolean>(false);

  const [preview, setPreview] = useState<InterpretedMealResult | null>(null);
  const [editNombre, setEditNombre] = useState<string>("");
  const [editKcal, setEditKcal] = useState<string>("");
  const [editProt, setEditProt] = useState<string>("");
  const [editFibra, setEditFibra] = useState<string>("");
  const [editNota, setEditNota] = useState<string>("");
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
    }, 2800);
  };

  const buildPromptForGeminiChat = (): string => {
    const now = new Date();
    const horaStr = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
    const entrenaTexto = state.recoveryPlan.recomiendaDescansoHoy
      ? "No (Día de Descanso / Recuperación SNC)"
      : `Sí (${state.workouts[state.config.rutina_actual_index]?.nombre || "Fuerza"})`;

    const comidaTexto = aiInput.trim() || "[ESCRIBE AQUÍ QUÉ COMISTE Y CANTIDADES APROXIMADAS]";

    return `Actúa como mi nutricionista deportivo clínico (cero culpa, directo y preciso). Analiza esta comida que acabo de consumir:
"${comidaTexto}"

Mi contexto real de HOY antes de sumar esta comida:
- Hora actual: ${horaStr}
- Entreno hoy: ${entrenaTexto}
- Peso actual: ${state.biometrics.pesoUsadoKg} kg (Déficit configurado: -${state.config.deficit_pct}%)
- Calorías llevadas hoy: ${Math.round(totals.kcal)} / ${state.config.calorias_meta} kcal
- Proteína llevada hoy: ${Number(totals.proteina.toFixed(1))}g / ${state.config.proteina_meta}g
- Fibra llevada hoy: ${Number(totals.fibra.toFixed(1))}g / ${state.config.fibra_meta}g

Devuélveme ÚNICAMENTE un bloque JSON válido con esta estructura exacta (sin texto adicional fuera del JSON) para pegarlo en mi app:
{
  "nombre_limpio": "Nombre corto y claro del plato y porción",
  "kcal": 0,
  "proteina_g": 0,
  "fibra_g": 0,
  "bandera_sodio_o_grasa_saturada": "Aviso breve si es alto en sodio o grasa saturada relevante para retención/hígado graso, o vacío '' si es limpio",
  "veredicto_y_ajuste": "1 a 2 frases directas indicando cómo quedo frente a mis metas de hoy tras sumar esto y qué priorizar exactamente en mi siguiente comida"
}`;
  };

  const handleCopyPrompt = async () => {
    triggerLightHaptic();
    const promptText = buildPromptForGeminiChat();
    try {
      await navigator.clipboard.writeText(promptText);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 3000);
    } catch {
      // Fallback para navegadores móviles estrictos
      const ta = document.createElement("textarea");
      ta.value = promptText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 3000);
    }
  };

  const loadIntoEditableCard = (parsed: InterpretedMealResult) => {
    setPreview(parsed);
    setEditNombre(parsed.nombre_limpio);
    setEditKcal(String(parsed.kcal));
    setEditProt(String(parsed.proteina_g));
    setEditFibra(String(parsed.fibra_g));
    setEditNota(parsed.veredicto_y_ajuste || "");
    setPasteError(null);
  };

  const handleProcessPastedText = (rawText: string) => {
    const parsed = parsePastedChatOutput(rawText, aiInput.trim());
    if (!parsed) {
      setPasteError(
        "No detecté el bloque JSON de Gemini. Asegúrate de copiar toda la respuesta con llaves { ... }."
      );
      return;
    }
    triggerLightHaptic();
    loadIntoEditableCard(parsed);
  };

  const handlePasteFromClipboard = async () => {
    triggerLightHaptic();
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) {
        setPastedOutput(clip);
        handleProcessPastedText(clip);
      }
    } catch {
      setPasteError("Pega la respuesta manualmente en la caja de abajo (mantén presionado → Pegar).");
    }
  };

  const handleOpenBlankManual = () => {
    triggerLightHaptic();
    loadIntoEditableCard({
      nombre_limpio: aiInput.trim() || "",
      kcal: 0,
      proteina_g: 0,
      fibra_g: 0,
      bandera_sodio_o_grasa_saturada: null,
      veredicto_y_ajuste: "",
      fuente: "ESTIMADOR_LOCAL",
    });
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
          entrenaHoy: !state.dailyLog.gym_postergado && !state.recoveryPlan.recomiendaDescansoHoy,
        }),
      });

      if (res.ok) {
        const data: InterpretedMealResult = await res.json();
        loadIntoEditableCard(data);
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
      texto_original: aiInput.trim() || null,
      nombre: editNombre.trim() || preview.nombre_limpio || "Comida personalizada",
      multiplicador: 1,
      kcal: Math.max(0, parseInt(editKcal, 10) || 0),
      proteina: Math.max(0, parseFloat(editProt) || 0),
      fibra: Math.max(0, parseFloat(editFibra) || 0),
      bandera_sodio_grasa: preview.bandera_sodio_o_grasa_saturada,
      es_estimacion_ia: entryMode !== "MANUAL_DIRECTO",
      recomendacion_ia: editNota.trim() || null,
    });

    showQuickToast(`Guardado: ${editNombre || preview.nombre_limpio || "Comida"}`);
    setPreview(null);
    setAiInput("");
    setPastedOutput("");
  };

  return (
    <div className="space-y-4">
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

      {/* Centro Inteligente de Registro: Prompt Copy-Paste para Chat Gemini | IA Directa | Manual */}
      <div className="rounded-2xl border border-obsidian-700 bg-obsidian-900 p-4 space-y-3">
        {/* Pestañas de Modo */}
        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-obsidian-800 bg-obsidian-950 p-1">
          <button
            type="button"
            onClick={() => {
              setEntryMode("PROMPT_CHAT");
              setPreview(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-bold transition ${
              entryMode === "PROMPT_CHAT"
                ? "bg-lime-400 text-obsidian-950"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Copy className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Prompt Chat</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEntryMode("API_AUTO");
              setPreview(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-bold transition ${
              entryMode === "API_AUTO"
                ? "bg-lime-400 text-obsidian-950"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">IA Directa</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEntryMode("MANUAL_DIRECTO");
              handleOpenBlankManual();
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-bold transition ${
              entryMode === "MANUAL_DIRECTO"
                ? "bg-lime-400 text-obsidian-950"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <PenLine className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Manual Libre</span>
          </button>
        </div>

        {/* MODO 1: Copy-Paste con tu Chat de Gemini (100% Gratis, Cero API Límites, Fotos + Texto) */}
        {entryMode === "PROMPT_CHAT" && (
          <div className="space-y-3 pt-1">
            <div>
              <h3 className="font-bold text-white text-sm">
                Usar con tu Chat de Gemini (Copy → Paste)
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                1) Escribe qué comiste (o déjalo vacío si le mandarás foto en Gemini Chat) y copia el prompt con tus macros actuales de hoy. 2) Pega aquí el JSON que te responda Gemini.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Opcional: ej. 'medio pollo a la brasa con ensalada' (o vacío si subirás foto en Gemini)"
                className="flex-1 rounded-xl border border-obsidian-700 bg-obsidian-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-lime-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="flex items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 py-2.5 text-xs sm:text-sm font-extrabold text-obsidian-950 active:scale-95 shrink-0"
              >
                {copiedPrompt ? (
                  <>
                    <Check className="h-4 w-4 stroke-[2.5]" />
                    ¡Prompt copiado! Pégalo en Gemini
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    1. Copiar Prompt con mis Macros
                  </>
                )}
              </button>
            </div>

            {/* Área para pegar el output de Gemini Chat */}
            {!preview && (
              <div className="space-y-2 rounded-xl border border-obsidian-800 bg-obsidian-950 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-zinc-300">
                    2. Pega aquí el resultado que te dio Gemini:
                  </span>
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-400/15 px-3 py-1.5 text-xs font-bold text-sky-200 active:scale-95"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    Pegar del portapapeles
                  </button>
                </div>

                <textarea
                  rows={4}
                  value={pastedOutput}
                  onChange={(e) => {
                    setPastedOutput(e.target.value);
                    setPasteError(null);
                  }}
                  placeholder='Pega aquí todo lo que respondió Gemini (ej: {"nombre_limpio": "...", "kcal": 540, "proteina_g": 42, ...})'
                  className="w-full rounded-xl border border-obsidian-800 bg-obsidian-900 p-3 font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:border-lime-400 focus:outline-none"
                />

                {pasteError && (
                  <p className="text-xs text-amber-300">{pasteError}</p>
                )}

                {pastedOutput.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleProcessPastedText(pastedOutput)}
                    className="w-full rounded-xl border border-lime-400/50 bg-lime-400/15 py-2.5 text-xs font-extrabold text-lime-300 active:scale-98"
                  >
                    Procesar Respuesta Pegada →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* MODO 2: IA Directa por API */}
        {entryMode === "API_AUTO" && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-400">
                Cálculo directo desde el servidor usando tu API Key configurada.
              </p>
              <span className="rounded-full bg-obsidian-800 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-400">
                {state.aiConfigured ? "Gemini Flash Activo" : "Estimador Local"}
              </span>
            </div>

            <form onSubmit={handleInterpretSubmit} className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder='Ej: "plato de arroz chaufa de pollo" o "2 tostadas con palta y 2 huevos"'
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
          </div>
        )}

        {/* Tarjeta Unificada de Confirmación / Edición antes de Guardar */}
        {preview && (
          <div className="mt-3 space-y-3 rounded-2xl border border-lime-400/40 bg-obsidian-950 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-lime-300">
                {entryMode === "MANUAL_DIRECTO"
                  ? "Ingreso Manual Directo"
                  : entryMode === "PROMPT_CHAT"
                  ? "Datos Importados de tu Chat Gemini (Editables)"
                  : "Confirmación Editable"}
              </span>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-lg p-1 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block text-[10px] uppercase text-zinc-400 mb-1">
                Nombre del plato o alimento
              </label>
              <input
                type="text"
                placeholder="Ej: Almuerzo casero pollo + arroz"
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
                className="w-full rounded-xl border border-obsidian-700 bg-obsidian-900 px-3 py-2 text-sm font-bold text-white focus:border-lime-400 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-obsidian-800 bg-obsidian-900 p-2.5">
                <label className="block text-[10px] uppercase text-zinc-400">Calorías</label>
                <input
                  type="number"
                  inputMode="numeric"
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
                  inputMode="decimal"
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
                  inputMode="decimal"
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

            <div>
              <label className="block text-[10px] uppercase text-zinc-400 mb-1">
                Nota / Ajuste sugerido para el resto del día (opcional)
              </label>
              <textarea
                rows={2}
                value={editNota}
                onChange={(e) => setEditNota(e.target.value)}
                placeholder="Ej: Priorizar pechuga + ensalada en la cena"
                className="w-full rounded-xl border border-obsidian-800 bg-obsidian-900 px-3 py-2 text-xs text-sky-100 focus:border-lime-400 focus:outline-none"
              />
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
                        <p className="truncate text-sm font-bold text-white">{item.nombre}</p>
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
            Aún no registraste alimentos hoy. Usa el Prompt para Gemini Chat, los chips o ingreso manual arriba.
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
