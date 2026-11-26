"use client";

import React, { useEffect, useState } from "react";
import {
  Scale,
  TrendingDown,
  Settings2,
  Download,
  Lock,
  Info,
  Check,
  Calculator,
  BookOpen,
} from "lucide-react";
import { AppStateDTO } from "@/lib/store-service";
import { ACTIVITY_LEVELS } from "@/lib/biometrics";
import { triggerLightHaptic } from "@/lib/sound-haptics";

interface ProgresoViewProps {
  state: AppStateDTO;
  onUpdateDaily: (patch: Record<string, unknown>) => Promise<void>;
  onUpdateConfig: (patch: Record<string, unknown>) => Promise<void>;
  onLockScreen: () => Promise<void>;
}

export function ProgresoView({
  state,
  onUpdateDaily,
  onUpdateConfig,
  onLockScreen,
}: ProgresoViewProps) {
  const cfg = state.config;
  const bio = state.biometrics;
  const wa = state.weightAnalytics;

  const [pesoInput, setPesoInput] = useState<string>(
    state.dailyLog.peso_kg ? String(state.dailyLog.peso_kg) : String(bio.pesoUsadoKg)
  );
  const [cinturaInput, setCinturaInput] = useState<string>(
    state.dailyLog.cintura_cm ? String(state.dailyLog.cintura_cm) : ""
  );

  // Parámetros Biométricos Editables
  const [sexo, setSexo] = useState<"M" | "F">(cfg.sexo);
  const [edad, setEdad] = useState<string>(String(cfg.edad));
  const [alturaCm, setAlturaCm] = useState<string>(String(cfg.altura_cm));
  const [pesoBase, setPesoBase] = useState<string>(String(bio.pesoUsadoKg));
  const [factorAct, setFactorAct] = useState<number>(cfg.factor_actividad);
  const [deficitPct, setDeficitPct] = useState<number>(cfg.deficit_pct);
  const [protGKg, setProtGKg] = useState<string>(String(cfg.proteina_g_kg));
  const [modoAuto, setModoAuto] = useState<boolean>(cfg.modo_auto_macros);

  // Overrides manuales opcionales si apaga modoAuto
  const [calMeta, setCalMeta] = useState<string>(String(cfg.calorias_meta));
  const [protMeta, setProtMeta] = useState<string>(String(cfg.proteina_meta));
  const [fibraMeta, setFibraMeta] = useState<string>(String(cfg.fibra_meta));
  const [aguaLitros, setAguaLitros] = useState<string>(
    String(Number((cfg.agua_meta / 1000).toFixed(1)))
  );
  const [savedCfg, setSavedCfg] = useState(false);

  useEffect(() => {
    setSexo(cfg.sexo);
    setEdad(String(cfg.edad));
    setAlturaCm(String(cfg.altura_cm));
    setPesoBase(String(bio.pesoUsadoKg));
    setFactorAct(cfg.factor_actividad);
    setDeficitPct(cfg.deficit_pct);
    setProtGKg(String(cfg.proteina_g_kg));
    setModoAuto(cfg.modo_auto_macros);
    setCalMeta(String(cfg.calorias_meta));
    setProtMeta(String(cfg.proteina_meta));
    setFibraMeta(String(cfg.fibra_meta));
    setAguaLitros(String(Number((cfg.agua_meta / 1000).toFixed(1))));
  }, [cfg, bio.pesoUsadoKg]);

  const handleSaveWeightAndWaist = async (e: React.FormEvent) => {
    e.preventDefault();
    const valPeso = parseFloat(pesoInput.replace(",", "."));
    const valCintura = cinturaInput ? parseFloat(cinturaInput.replace(",", ".")) : undefined;
    const patch: Record<string, unknown> = {};
    if (!isNaN(valPeso) && valPeso >= 30 && valPeso <= 250) {
      patch.peso_kg = Number(valPeso.toFixed(1));
    }
    if (valCintura !== undefined && !isNaN(valCintura) && valCintura >= 45 && valCintura <= 180) {
      patch.cintura_cm = Number(valCintura.toFixed(1));
    }
    if (Object.keys(patch).length === 0) return;
    triggerLightHaptic();
    await onUpdateDaily(patch);
  };

  const handleSaveBiometrics = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerLightHaptic();
    const parsedPeso = parseFloat(pesoBase.replace(",", ".")) || bio.pesoUsadoKg;
    const litros = parseFloat(aguaLitros.replace(",", ".")) || 2.8;

    await onUpdateConfig({
      sexo,
      edad: parseInt(edad, 10) || 28,
      altura_cm: parseFloat(alturaCm.replace(",", ".")) || 175,
      peso_base_kg: Number(parsedPeso.toFixed(1)),
      sync_peso_hoy: state.dailyLog.peso_kg === null,
      factor_actividad: factorAct,
      deficit_pct: deficitPct,
      proteina_g_kg: parseFloat(protGKg.replace(",", ".")) || 1.9,
      modo_auto_macros: modoAuto,
      calorias_meta: parseInt(calMeta, 10) || 2050,
      proteina_meta: parseInt(protMeta, 10) || 145,
      fibra_meta: parseInt(fibraMeta, 10) || 30,
      agua_meta: Math.round(litros * 1000),
    });

    setSavedCfg(true);
    setTimeout(() => setSavedCfg(false), 2600);
  };

  const handleExportBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `health-os-backup-${state.fecha}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Detector de Fugas Calóricas: compara ritmo teórico según % déficit vs ritmo real de 7 días
  const hayComparacionFuga = wa.ritmoSemanalKg !== null && wa.puntos.length >= 5;
  const desviacionSemanalKg =
    wa.ritmoSemanalKg !== null
      ? Number((wa.ritmoSemanalKg - bio.ritmoTeoricoSemanalKg).toFixed(2))
      : 0;

  const pts = wa.puntos.slice(-30);
  const svgW = 600;
  const svgH = 210;
  const padX = 36;
  const padY = 24;

  let minW = 70;
  let maxW = 80;
  if (pts.length > 0) {
    const allVals = pts.flatMap((p) => [p.peso_kg, p.promedioMovil7d]);
    minW = Math.floor(Math.min(...allVals) - 0.8);
    maxW = Math.ceil(Math.max(...allVals) + 0.8);
    if (maxW - minW < 2) maxW = minW + 2;
  }

  const getX = (idx: number) => {
    if (pts.length <= 1) return svgW / 2;
    return padX + (idx / (pts.length - 1)) * (svgW - padX * 2);
  };

  const getY = (val: number) =>
    svgH - padY - ((val - minW) / (maxW - minW)) * (svgH - padY * 2);

  const maPath =
    pts.length > 1
      ? pts
          .map(
            (p, idx) =>
              `${idx === 0 ? "M" : "L"} ${getX(idx).toFixed(1)} ${getY(
                p.promedioMovil7d
              ).toFixed(1)}`
          )
          .join(" ")
      : "";

  const dailyPath =
    pts.length > 1
      ? pts
          .map(
            (p, idx) =>
              `${idx === 0 ? "M" : "L"} ${getX(idx).toFixed(1)} ${getY(p.peso_kg).toFixed(1)}`
          )
          .join(" ")
      : "";

  return (
    <div className="space-y-4">
      {/* 1. Calculadora Biométrica Dinámica (TMB + TDEE + % Déficit + Ciclado Descanso/Entreno) */}
      <form
        onSubmit={handleSaveBiometrics}
        className="rounded-2xl border border-lime-400/35 bg-obsidian-900 p-4 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-lime-400" />
            <h2 className="text-lg font-bold text-white">
              Biometría & Déficit Dinámico (Sin Fugas)
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setModoAuto((prev) => !prev)}
            className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
              modoAuto
                ? "border-lime-400/50 bg-lime-400/15 text-lime-300"
                : "border-obsidian-700 bg-obsidian-800 text-zinc-400"
            }`}
          >
            {modoAuto ? "Cálculo Automático Activo ✓" : "Modo Manual Fijo"}
          </button>
        </div>

        {/* Inputs Corporales */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-3">
            <label className="block text-[11px] text-zinc-400">Sexo biológico</label>
            <div className="mt-1.5 grid grid-cols-2 gap-1">
              {(["M", "F"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSexo(s)}
                  className={`rounded-lg py-1 font-mono text-xs font-bold ${
                    sexo === s
                      ? "bg-lime-400 text-obsidian-950"
                      : "bg-obsidian-800 text-zinc-400"
                  }`}
                >
                  {s === "M" ? "Hombre" : "Mujer"}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-3">
            <label className="block text-[11px] text-zinc-400">Edad (años)</label>
            <input
              type="number"
              value={edad}
              onChange={(e) => setEdad(e.target.value)}
              className="mt-1 w-full bg-transparent font-mono text-lg font-bold text-white focus:outline-none"
            />
          </div>

          <div className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-3">
            <label className="block text-[11px] text-zinc-400">Altura (cm)</label>
            <input
              type="number"
              step="0.5"
              value={alturaCm}
              onChange={(e) => setAlturaCm(e.target.value)}
              className="mt-1 w-full bg-transparent font-mono text-lg font-bold text-white focus:outline-none"
            />
          </div>

          <div className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-3">
            <label className="block text-[11px] text-zinc-400">Peso actual (kg)</label>
            <input
              type="number"
              step="0.1"
              value={pesoBase}
              onChange={(e) => setPesoBase(e.target.value)}
              className="mt-1 w-full bg-transparent font-mono text-lg font-bold text-lime-300 focus:outline-none"
            />
          </div>

          <div className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-3 col-span-2 sm:col-span-1">
            <label className="block text-[11px] text-zinc-400">Proteína (g/kg)</label>
            <input
              type="number"
              step="0.1"
              value={protGKg}
              onChange={(e) => setProtGKg(e.target.value)}
              className="mt-1 w-full bg-transparent font-mono text-lg font-bold text-sky-300 focus:outline-none"
            />
          </div>
        </div>

        {/* Nivel de Actividad Fuera del Gym (NEAT) */}
        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-2">
            Movimiento cotidiano fuera del gym (el gasto de cada rutina se suma aparte según el día)
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ACTIVITY_LEVELS.map((lvl) => {
              const selected = Math.abs(factorAct - lvl.value) < 0.04;
              return (
                <button
                  key={lvl.value}
                  type="button"
                  onClick={() => setFactorAct(lvl.value)}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    selected
                      ? "border-lime-400/50 bg-lime-400/15 text-white"
                      : "border-obsidian-800 bg-obsidian-950 text-zinc-400"
                  }`}
                >
                  <p className="text-xs font-bold">{lvl.label}</p>
                  <p className="text-[10px] opacity-80 mt-0.5">{lvl.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selector Porcentual de Déficit */}
        <div className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-bold text-white">
              Porcentaje de Déficit Calórico:{" "}
              <span className="font-mono text-lime-400">
                {deficitPct > 0 ? `-${deficitPct}%` : deficitPct === 0 ? "0% (Mant.)" : `+${Math.abs(deficitPct)}%`}
              </span>
            </label>
            <div className="flex gap-1.5">
              {[10, 15, 20, 25].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setDeficitPct(pct)}
                  className={`rounded-lg px-2.5 py-1 font-mono text-xs font-bold ${
                    deficitPct === pct
                      ? "bg-lime-400 text-obsidian-950"
                      : "bg-obsidian-800 text-zinc-300"
                  }`}
                >
                  -{pct}%
                </button>
              ))}
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={deficitPct}
            onChange={(e) => setDeficitPct(Number(e.target.value))}
            className="w-full accent-lime-400"
          />

          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>0% Mantenimiento</span>
            <span>15% Suave / Recomp</span>
            <span>20% Óptimo sostenible</span>
            <span>25–30% Agresivo corto</span>
          </div>
        </div>

        {/* Desglose Científico Transparente (Día de Entreno vs Día de Descanso) */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-3">
            <span className="text-[10px] uppercase text-zinc-500">TMB Basal</span>
            <p className="font-mono text-base font-bold text-zinc-200">{bio.tmbKcal} kcal</p>
          </div>
          <div className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-3">
            <span className="text-[10px] uppercase text-zinc-500">Meta Día Entreno</span>
            <p className="font-mono text-base font-bold text-lime-400">
              {bio.caloriasDiaEntreno} kcal
            </p>
          </div>
          <div className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-3">
            <span className="text-[10px] uppercase text-zinc-500">Meta Día Descanso</span>
            <p className="font-mono text-base font-bold text-sky-300">
              {bio.caloriasDiaDescanso} kcal
            </p>
          </div>
          <div className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-3">
            <span className="text-[10px] uppercase text-zinc-500">Ritmo Teórico</span>
            <p className="font-mono text-base font-bold text-emerald-300">
              {bio.ritmoTeoricoSemanalKg} kg/sem
            </p>
          </div>
        </div>

        {!modoAuto && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2 border-t border-obsidian-800">
            <div className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-3">
              <label className="block text-xs text-zinc-400">Calorías fijas</label>
              <input
                type="number"
                value={calMeta}
                onChange={(e) => setCalMeta(e.target.value)}
                className="mt-1 w-full bg-transparent font-mono text-base font-bold text-white focus:outline-none"
              />
            </div>
            <div className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-3">
              <label className="block text-xs text-zinc-400">Proteína fija (g)</label>
              <input
                type="number"
                value={protMeta}
                onChange={(e) => setProtMeta(e.target.value)}
                className="mt-1 w-full bg-transparent font-mono text-base font-bold text-sky-300 focus:outline-none"
              />
            </div>
            <div className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-3">
              <label className="block text-xs text-zinc-400">Fibra fija (g)</label>
              <input
                type="number"
                value={fibraMeta}
                onChange={(e) => setFibraMeta(e.target.value)}
                className="mt-1 w-full bg-transparent font-mono text-base font-bold text-emerald-300 focus:outline-none"
              />
            </div>
            <div className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-3">
              <label className="block text-xs text-zinc-400">Agua fija (L)</label>
              <input
                type="number"
                step="0.1"
                value={aguaLitros}
                onChange={(e) => setAguaLitros(e.target.value)}
                className="mt-1 w-full bg-transparent font-mono text-base font-bold text-cyan-300 focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 text-[11px] text-zinc-400">
          <BookOpen className="h-3.5 w-3.5 shrink-0 mt-0.5 text-zinc-500" />
          <span>{bio.respaldoCientifico}</span>
        </div>

        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-400 py-3.5 text-sm font-extrabold text-obsidian-950 active:scale-98"
        >
          {savedCfg ? (
            <>
              <Check className="h-4 w-4 stroke-[2.5]" /> Parámetros y Déficit Actualizados ✓
            </>
          ) : (
            <>
              <Settings2 className="h-4 w-4" /> Guardar Biometría y Recalcular Todo
            </>
          )}
        </button>
      </form>

      {/* 2. Control de Peso + Cintura + Detector de Fugas */}
      <div className="rounded-2xl border border-obsidian-700 bg-obsidian-900 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-lime-400" />
            <h2 className="text-lg font-bold text-white">Tendencia Corporal & Auditoría de Fugas</h2>
          </div>
          <span className="rounded-full border border-obsidian-700 bg-obsidian-800 px-3 py-1 text-xs font-semibold text-zinc-300">
            Teórico: {bio.ritmoTeoricoSemanalKg} kg/sem
          </span>
        </div>

        <form
          onSubmit={handleSaveWeightAndWaist}
          className="grid grid-cols-1 gap-2.5 rounded-xl border border-obsidian-800 bg-obsidian-950 p-3 sm:grid-cols-3"
        >
          <div className="flex items-center justify-between sm:block">
            <label className="text-xs text-zinc-400">Peso de hoy (kg)</label>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              value={pesoInput}
              onChange={(e) => setPesoInput(e.target.value)}
              className="mt-0.5 w-28 sm:w-full rounded-lg border border-obsidian-700 bg-obsidian-900 px-2.5 py-1.5 font-mono text-base font-bold text-white focus:border-lime-400 focus:outline-none"
            />
          </div>
          <div className="flex items-center justify-between sm:block">
            <label className="text-xs text-zinc-400">Cintura / ombligo (cm, opc.)</label>
            <input
              type="number"
              step="0.5"
              inputMode="decimal"
              placeholder="Ej. 86.5"
              value={cinturaInput}
              onChange={(e) => setCinturaInput(e.target.value)}
              className="mt-0.5 w-28 sm:w-full rounded-lg border border-obsidian-700 bg-obsidian-900 px-2.5 py-1.5 font-mono text-base font-bold text-sky-300 focus:border-lime-400 focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-obsidian-800 border border-lime-400/40 py-2.5 text-xs font-bold text-lime-300 hover:bg-obsidian-700 active:scale-95"
            >
              Registrar Medidas de Hoy
            </button>
          </div>
        </form>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-3">
            <span className="text-[11px] text-zinc-400">Último diario</span>
            <p className="mt-0.5 font-mono text-lg font-bold text-zinc-200">
              {wa.ultimoPeso ? `${wa.ultimoPeso} kg` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-lime-400/30 bg-obsidian-950 p-3">
            <span className="text-[11px] text-lime-300">Promedio 7 días</span>
            <p className="mt-0.5 font-mono text-lg font-bold text-lime-400">
              {wa.promedioActual7d ? `${wa.promedioActual7d} kg` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-3">
            <span className="text-[11px] text-zinc-400">Ritmo real 7d</span>
            <p
              className={`mt-0.5 font-mono text-lg font-bold ${
                wa.enMetaRitmo ? "text-lime-400" : "text-sky-300"
              }`}
            >
              {wa.ritmoSemanalKg !== null
                ? `${wa.ritmoSemanalKg > 0 ? "+" : ""}${wa.ritmoSemanalKg} kg`
                : "—"}
            </p>
          </div>
        </div>

        {/* Detector Automático de Fugas Calóricas */}
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed ${
            wa.estancadoDosSemanas || desviacionSemanalKg > 0.35
              ? "border-amber-400/35 bg-amber-400/10 text-amber-200"
              : "border-obsidian-800 bg-obsidian-950 text-zinc-300"
          }`}
        >
          {wa.estancadoDosSemanas || desviacionSemanalKg > 0.35 ? (
            <Info className="h-4 w-4 shrink-0 text-amber-300 mt-0.5" />
          ) : (
            <TrendingDown className="h-4 w-4 shrink-0 text-lime-400 mt-0.5" />
          )}
          <div>
            <p>{wa.mensajeEstado}</p>
            {hayComparacionFuga && Math.abs(desviacionSemanalKg) >= 0.25 && (
              <p className="mt-1 text-[11px] opacity-90">
                Auditoría teórica vs real: Tu déficit proyecta{" "}
                <strong>{bio.ritmoTeoricoSemanalKg} kg/sem</strong> y tu curva real marca{" "}
                <strong>{wa.ritmoSemanalKg} kg/sem</strong>.{" "}
                {desviacionSemanalKg > 0.25
                  ? "Si persiste >10 días, revisa aceites ocultos/salsas (~150–200 kcal no registradas) o baja 1 nivel tu factor de actividad NEAT arriba."
                  : "Estás bajando más rápido que el cálculo teórico; mantén proteína alta."}
              </p>
            )}
          </div>
        </div>

        {/* Gráfico SVG */}
        <div className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-3">
          {pts.length === 0 ? (
            <div className="flex h-36 items-center justify-center text-xs text-zinc-500">
              Registra tu peso arriba para graficar peso diario vs promedio móvil de 7 días.
            </div>
          ) : (
            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-48 overflow-visible">
              {[0, 0.5, 1].map((t) => {
                const val = minW + t * (maxW - minW);
                const y = getY(val);
                return (
                  <g key={t}>
                    <line
                      x1={padX}
                      x2={svgW - padX}
                      y1={y}
                      y2={y}
                      stroke="#1E222B"
                      strokeDasharray="4 4"
                    />
                    <text x={4} y={y + 4} fill="#71717A" fontSize="11" fontFamily="monospace">
                      {val.toFixed(1)}
                    </text>
                  </g>
                );
              })}
              {dailyPath && (
                <path
                  d={dailyPath}
                  fill="none"
                  stroke="#52525B"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              )}
              {pts.map((p, idx) => (
                <circle
                  key={`d-${p.fecha}`}
                  cx={getX(idx)}
                  cy={getY(p.peso_kg)}
                  r="3.5"
                  fill="#71717A"
                  opacity="0.65"
                />
              ))}
              {maPath && (
                <path
                  d={maPath}
                  fill="none"
                  stroke="#A3E635"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {pts.map((p, idx) => (
                <circle
                  key={`ma-${p.fecha}`}
                  cx={getX(idx)}
                  cy={getY(p.promedioMovil7d)}
                  r={idx === pts.length - 1 ? "5" : "2.5"}
                  fill="#A3E635"
                />
              ))}
            </svg>
          )}
        </div>
      </div>

      {/* Utilidades */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleExportBackup}
          className="flex items-center justify-center gap-2 rounded-2xl border border-obsidian-700 bg-obsidian-900 py-3.5 text-xs font-bold text-zinc-200 hover:bg-obsidian-800"
        >
          <Download className="h-4 w-4 text-sky-400" />
          Exportar Backup JSON
        </button>
        <button
          type="button"
          onClick={onLockScreen}
          className="flex items-center justify-center gap-2 rounded-2xl border border-obsidian-700 bg-obsidian-900 py-3.5 text-xs font-bold text-zinc-300 hover:bg-obsidian-800"
        >
          <Lock className="h-4 w-4 text-amber-300" />
          Bloquear Pantalla (PIN)
        </button>
      </div>
    </div>
  );
}
