export type RirSensation = "FACIL" | "JUSTO" | "AL_LIMITE" | "MUY_PESADO";
export type ProgressionAction = "SUBIR" | "CONSOLIDAR" | "RECALIBRAR" | "INICIAL";

export interface SetHistoryItem {
  fecha: string;
  numero_serie: number;
  variante_usada: string;
  peso_asignado_kg: number;
  peso_real_kg: number;
  reps: number;
  sensacion_rir: string;
}

export interface ExerciseMetaInput {
  reps_min: number;
  reps_max: number;
  series_meta: number;
  es_compuesto: boolean;
  peso_inicial_a: number;
  peso_inicial_b: number;
}

export interface ProgressionRecommendation {
  variante: "A" | "B";
  accion: ProgressionAction;
  etiquetaAccion: string;
  ultimaVezTexto: string; // Ej: "Última vez: 45 kg (10, 10, 9)" o "Sin historial previo"
  objetivoHoyPesoKg: number;
  objetivoHoyTexto: string; // Ej: "Objetivo hoy: 47.5 kg (8–12 reps)"
  repsSugeridasPorSerie: number;
  notaTecnica?: string;
}

function roundToStep(value: number, step: number = 2.5): number {
  if (value <= 0) return 0;
  const rounded = Math.round(value / step) * step;
  return Number(rounded.toFixed(2));
}

/**
 * Calcula la progresión independiente para Plan A o Plan B según las últimas series registradas
 * en sesiones ANTERIORES a hoy (para no mutar el objetivo mientras registras series hoy).
 */
export function calculateExerciseProgression(
  meta: ExerciseMetaInput,
  previousSessionSets: SetHistoryItem[],
  variante: "A" | "B"
): ProgressionRecommendation {
  const rangoStr = `${meta.reps_min}–${meta.reps_max} reps`;
  const pesoDefault = variante === "A" ? meta.peso_inicial_a : meta.peso_inicial_b;

  if (!previousSessionSets || previousSessionSets.length === 0) {
    return {
      variante,
      accion: "INICIAL",
      etiquetaAccion: "Calibración base",
      ultimaVezTexto: "Sin registro previo en este plan",
      objetivoHoyPesoKg: pesoDefault,
      objetivoHoyTexto: `${pesoDefault} kg (${rangoStr})`,
      repsSugeridasPorSerie: meta.reps_min,
      notaTecnica: "Primera sesión registrada en este variante: busca un peso con RIR 1-2.",
    };
  }

  // Ordenar series por numero_serie
  const ordered = [...previousSessionSets].sort((a, b) => a.numero_serie - b.numero_serie);
  const pesosUsados = ordered.map((s) => s.peso_real_kg);
  const pesoPrincipal = pesosUsados[0] ?? pesoDefault;
  const pesoMinUsado = Math.min(...pesosUsados);
  const huboBajadaPeso = pesoMinUsado < pesoPrincipal;

  const repsStr = ordered.map((s) => s.reps).join(", ");
  const pesoResumenStr = huboBajadaPeso
    ? `${pesoPrincipal}→${pesoMinUsado} kg`
    : `${pesoPrincipal} kg`;
  const ultimaVezTexto = `${pesoResumenStr} (${repsStr})`;

  // Evaluar condiciones de recalibración a la baja:
  // - Alguna serie por debajo de reps_min
  // - O marcó MUY_PESADO
  // - O tuvo que bajar peso durante las series
  const algunaBajoMinimo = ordered.some((s) => s.reps < meta.reps_min);
  const marcoMuyPesado = ordered.some((s) => s.sensacion_rir === "MUY_PESADO");

  if (algunaBajoMinimo || marcoMuyPesado || huboBajadaPeso) {
    // Si bajó peso y con ese peso menor sí entró en rango, usar ese peso manejable;
    // de lo contrario reducir ~7.5% redondeado a 2.5kg (o -2.5kg mínimo si pesa >10kg)
    const setsConPesoMenorEnRango = ordered.filter(
      (s) => s.peso_real_kg === pesoMinUsado && s.reps >= meta.reps_min && s.sensacion_rir !== "MUY_PESADO"
    );

    let nuevoPeso: number;
    if (huboBajadaPeso && setsConPesoMenorEnRango.length > 0) {
      nuevoPeso = pesoMinUsado;
    } else if (pesoMinUsado <= 0) {
      nuevoPeso = 0;
    } else {
      const reducido = roundToStep(pesoMinUsado * 0.92, 2.5);
      nuevoPeso = reducido === pesoMinUsado && pesoMinUsado >= 5 ? Math.max(0, pesoMinUsado - 2.5) : reducido;
    }

    return {
      variante,
      accion: "RECALIBRAR",
      etiquetaAccion: "↓ Recalibrar",
      ultimaVezTexto,
      objetivoHoyPesoKg: nuevoPeso,
      objetivoHoyTexto: `${nuevoPeso} kg (${rangoStr})`,
      repsSugeridasPorSerie: meta.reps_min,
      notaTecnica: "Ajustado para trabajar con buena técnica en tu rango objetivo.",
    };
  }

  // Evaluar subida de peso:
  // Completó TODAS las series meta (>= series_meta) en el tope del rango (>= reps_max)
  // con sensación FACIL o JUSTO
  const completoSeriesMeta = ordered.length >= meta.series_meta;
  const todasEnTope = ordered.every((s) => s.reps >= meta.reps_max);
  const sensacionControlada = ordered.every(
    (s) => s.sensacion_rir === "FACIL" || s.sensacion_rir === "JUSTO"
  );

  if (completoSeriesMeta && todasEnTope && sensacionControlada) {
    const incremento = meta.es_compuesto ? 5 : 2.5;
    const nuevoPeso = Number((pesoPrincipal + incremento).toFixed(2));
    return {
      variante,
      accion: "SUBIR",
      etiquetaAccion: `↑ Subir peso (+${incremento} kg)`,
      ultimaVezTexto,
      objetivoHoyPesoKg: nuevoPeso,
      objetivoHoyTexto: `${nuevoPeso} kg (${rangoStr})`,
      repsSugeridasPorSerie: meta.reps_min,
      notaTecnica: `Tope de rango dominado (${ordered.length}×${meta.reps_max}). Sube +${incremento} kg y apunta a ${meta.reps_min}+ reps.`,
    };
  }

  // Consolidar peso actual (+1 rep objetivo por serie hasta llegar al tope)
  const promedioReps = Math.round(
    ordered.reduce((acc, s) => acc + s.reps, 0) / ordered.length
  );
  const targetRep = Math.min(meta.reps_max, promedioReps + 1);

  return {
    variante,
    accion: "CONSOLIDAR",
    etiquetaAccion: "= Consolidar (+1 rep)",
    ultimaVezTexto,
    objetivoHoyPesoKg: pesoPrincipal,
    objetivoHoyTexto: `${pesoPrincipal} kg (buscar ~${targetRep} reps)`,
    repsSugeridasPorSerie: targetRep,
    notaTecnica: `Mantén ${pesoPrincipal} kg y suma +1 rep por serie dentro de ${rangoStr}.`,
  };
}
