export type TimeBlock = "MANANA" | "TARDE" | "NOCHE";

export interface TimeContextInfo {
  block: TimeBlock;
  label: string;
  greeting: string;
  focusSummary: string;
  timeRange: string;
}

/**
 * Devuelve fecha local YYYY-MM-DD sin desfases UTC
 */
export function getLocalDateISO(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Detecta el bloque horario "Modo Ahora" según las reglas UX ADHD-Friendly:
 * - Mañana: 05:00 - 11:30
 * - Mediodía / Tarde: 11:30 - 19:00
 * - Noche: 19:00 - 23:59 (y 00:00 - 04:59 priorizando descanso)
 */
export function getNowTimeContext(date: Date = new Date()): TimeContextInfo {
  const minutesOfDay = date.getHours() * 60 + date.getMinutes();

  // 05:00 (300) -> 11:29 (689)
  if (minutesOfDay >= 300 && minutesOfDay < 690) {
    return {
      block: "MANANA",
      label: "Modo Mañana",
      greeting: "Arranque limpio",
      focusSummary: "Peso en ayunas · Rutina cervical (5-8 min) · Hidratación inicial",
      timeRange: "05:00 – 11:30",
    };
  }

  // 11:30 (690) -> 18:59 (1139)
  if (minutesOfDay >= 690 && minutesOfDay < 1140) {
    return {
      block: "TARDE",
      label: "Modo Mediodía / Tarde",
      greeting: "Energía y tracción",
      focusSummary: "Registro rápido de comidas · Entrenamiento · Caminata post-comida",
      timeRange: "11:30 – 19:00",
    };
  }

  // 19:00 -> 04:59
  return {
    block: "NOCHE",
    label: "Modo Noche",
    greeting: "Cierre sin fricción",
    focusSummary: "Cena estratégica · Resumen del día · Preparar 7–8h de sueño",
    timeRange: "19:00 – 23:59",
  };
}
