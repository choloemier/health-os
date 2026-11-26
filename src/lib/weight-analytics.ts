export interface WeightPoint {
  fecha: string; // YYYY-MM-DD
  peso_kg: number;
}

export interface EnrichedWeightPoint extends WeightPoint {
  promedioMovil7d: number;
}

export interface WeightAnalyticsSummary {
  puntos: EnrichedWeightPoint[];
  ultimoPeso: number | null;
  promedioActual7d: number | null;
  ritmoSemanalKg: number | null; // negativo = bajando peso (ej. -0.65 kg/sem)
  enMetaRitmo: boolean;
  estancadoDosSemanas: boolean;
  mensajeEstado: string;
}

/**
 * Calcula promedio móvil de 7 días calendario, ritmo semanal y detector de estancamiento (14 días).
 */
export function analyzeWeightHistory(rawPoints: WeightPoint[]): WeightAnalyticsSummary {
  const sorted = [...rawPoints]
    .filter((p) => typeof p.peso_kg === "number" && p.peso_kg > 20)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (sorted.length === 0) {
    return {
      puntos: [],
      ultimoPeso: null,
      promedioActual7d: null,
      ritmoSemanalKg: null,
      enMetaRitmo: false,
      estancadoDosSemanas: false,
      mensajeEstado: "Registra tu peso en ayunas para activar la tendencia móvil de 7 días.",
    };
  }

  const puntos: EnrichedWeightPoint[] = sorted.map((point, idx) => {
    const targetTime = new Date(point.fecha + "T00:00:00").getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    const windowItems = sorted.slice(0, idx + 1).filter((cand) => {
      const candTime = new Date(cand.fecha + "T00:00:00").getTime();
      return targetTime - candTime < sevenDaysMs;
    });

    const avg =
      windowItems.reduce((sum, item) => sum + item.peso_kg, 0) / windowItems.length;

    return {
      ...point,
      promedioMovil7d: Number(avg.toFixed(2)),
    };
  });

  const latest = puntos[puntos.length - 1];
  const latestTime = new Date(latest.fecha + "T00:00:00").getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  // Buscar punto cercano a hace ~7 días (entre 5 y 10 días atrás)
  const point7dAgo = [...puntos]
    .reverse()
    .find((p) => {
      const diffDays = (latestTime - new Date(p.fecha + "T00:00:00").getTime()) / dayMs;
      return diffDays >= 5 && diffDays <= 10;
    });

  // Buscar punto cercano a hace ~14 días (entre 12 y 18 días atrás)
  const point14dAgo = [...puntos]
    .reverse()
    .find((p) => {
      const diffDays = (latestTime - new Date(p.fecha + "T00:00:00").getTime()) / dayMs;
      return diffDays >= 12 && diffDays <= 18;
    });

  let ritmoSemanalKg: number | null = null;
  if (point7dAgo) {
    const exactDays =
      (latestTime - new Date(point7dAgo.fecha + "T00:00:00").getTime()) / dayMs;
    const rawDiff = latest.promedioMovil7d - point7dAgo.promedioMovil7d;
    ritmoSemanalKg = Number(((rawDiff / exactDays) * 7).toFixed(2));
  }

  // Meta visual: bajada de 0.5 a 1.0 kg/semana -> ritmoSemanalKg entre -1.05 y -0.45
  const enMetaRitmo =
    ritmoSemanalKg !== null && ritmoSemanalKg <= -0.45 && ritmoSemanalKg >= -1.05;

  // Detector de meseta de 2 semanas: si hay referencia de 14 días y al menos 6 pesajes,
  // y el promedio móvil varió menos de ±0.25 kg (o subió levemente sin bajar)
  let estancadoDosSemanas = false;
  if (point14dAgo && puntos.length >= 6) {
    const cambio14d = latest.promedioMovil7d - point14dAgo.promedioMovil7d;
    if (cambio14d > -0.25 && cambio14d < 0.35) {
      estancadoDosSemanas = true;
    }
  }

  let mensajeEstado = "Acumulando primeros días para calcular ritmo semanal fiable.";
  if (estancadoDosSemanas) {
    mensajeEstado =
      "Promedio estable hace ~2 semanas. Paso práctico: suma 1 caminata post-comida de 15 min o recorta -150 kcal (ej. 1 cda menos de aceite).";
  } else if (ritmoSemanalKg !== null) {
    if (enMetaRitmo) {
      mensajeEstado = `Ritmo óptimo (${ritmoSemanalKg} kg/sem). Mantén proteína alta y cargas del gym.`;
    } else if (ritmoSemanalKg < -1.05) {
      mensajeEstado = `Bajada rápida (${ritmoSemanalKg} kg/sem). Prioriza los 135g+ de proteína para proteger masa muscular.`;
    } else if (ritmoSemanalKg > -0.45 && ritmoSemanalKg < 0) {
      mensajeEstado = `Bajando suave (${ritmoSemanalKg} kg/sem). Constancia sólida y sostenible.`;
    } else {
      mensajeEstado = `Variación semanal +${ritmoSemanalKg} kg (puede ser retención hídrica/glucógeno). Observa el promedio 3 días más.`;
    }
  }

  return {
    puntos,
    ultimoPeso: latest.peso_kg,
    promedioActual7d: latest.promedioMovil7d,
    ritmoSemanalKg,
    enMetaRitmo,
    estancadoDosSemanas,
    mensajeEstado,
  };
}
