export interface RecentSessionSummary {
  fecha: string; // YYYY-MM-DD
  workoutSlug: string;
  workoutNombre: string;
  totalSets: number;
  highFatigueSets: number; // AL_LIMITE o MUY_PESADO
}

export interface DayScheduleSlot {
  fecha: string;
  diaCorto: string; // Lun, Mar, Mié...
  esHoy: boolean;
  estado: "ENTRENO_HECHO" | "DESCANSO_PASADO" | "HOY_ENTRENAR" | "HOY_DESCANSAR" | "PROYECTADO_ENTRENAR" | "PROYECTADO_DESCANSO";
  etiqueta: string;
}

export interface SmartRecoveryPlan {
  recomiendaDescansoHoy: boolean;
  tituloEstado: string;
  razonCientifica: string;
  protocoloHoy: string[];
  sesionesUltimos7Dias: number;
  diasConsecutivosPrevios: number;
  calendario7Dias: DayScheduleSlot[];
}

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function addDaysISO(baseISO: string, deltaDays: number): string {
  const d = new Date(baseISO + "T12:00:00");
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDiaCorto(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return DIAS_SEMANA[d.getDay()];
}

/**
 * Planificador Inteligente de Descanso y Recuperación (Split Torso/Pierna 4 días):
 * - Detecta días consecutivos entrenados (máximo óptimo: 2 seguidos -> 1 día de descanso SNC).
 * - Detecta fatiga alta ayer (sesión de pierna pesada o >50% series al límite) o sueño <6h.
 * - Detecta si ya completó las 4 sesiones en los últimos 7 días.
 * - Proyecta los próximos días (ej. Entreno -> Entreno -> Descanso) automáticamente.
 */
export function buildSmartRecoveryPlan(params: {
  hoyISO: string;
  recentSessions: RecentSessionSummary[];
  nextWorkoutNombre: string;
  suenoHoyHoras: number | null;
  gymPostergadoHoy: boolean;
  entrenamientoCompletadoHoy: boolean;
}): SmartRecoveryPlan {
  const {
    hoyISO,
    recentSessions,
    nextWorkoutNombre,
    suenoHoyHoras,
    gymPostergadoHoy,
    entrenamientoCompletadoHoy,
  } = params;

  const sessionByDate = new Map<string, RecentSessionSummary>();
  for (const s of recentSessions) {
    if (s.totalSets > 0) {
      sessionByDate.set(s.fecha, s);
    }
  }

  const ayerISO = addDaysISO(hoyISO, -1);
  const anteayerISO = addDaysISO(hoyISO, -2);
  const tresDiasAtrasISO = addDaysISO(hoyISO, -3);

  const entrenoAyer = sessionByDate.get(ayerISO);
  const entrenoAnteayer = sessionByDate.get(anteayerISO);
  const entrenoTresAtras = sessionByDate.get(tresDiasAtrasISO);

  let diasConsecutivosPrevios = 0;
  if (entrenoAyer) {
    diasConsecutivosPrevios = 1;
    if (entrenoAnteayer) {
      diasConsecutivosPrevios = 2;
      if (entrenoTresAtras) diasConsecutivosPrevios = 3;
    }
  }

  // Contar sesiones en ventana móvil de 7 días (hoy - 6 a hoy)
  let sesionesUltimos7Dias = 0;
  for (let i = -6; i <= 0; i++) {
    if (sessionByDate.has(addDaysISO(hoyISO, i))) {
      sesionesUltimos7Dias++;
    }
  }

  const fatigaAltaAyer =
    entrenoAyer &&
    entrenoAyer.totalSets >= 6 &&
    entrenoAyer.highFatigueSets / entrenoAyer.totalSets >= 0.6;

  const piernaPesadaAyer =
    entrenoAyer &&
    entrenoAyer.workoutSlug.startsWith("pierna") &&
    entrenoAyer.highFatigueSets >= 4;

  const suenoBajo = suenoHoyHoras !== null && suenoHoyHoras < 6;

  let recomiendaDescansoHoy = false;
  let tituloEstado = `Día óptimo para entrenar: ${nextWorkoutNombre}`;
  let razonCientifica =
    diasConsecutivosPrevios === 1
      ? `Ayer hiciste ${entrenoAyer?.workoutNombre}. Como el split alterna grupos musculares distintos, hoy tienes luz verde antes de tu día de descanso.`
      : "Sistema nervioso descansado y glucógeno disponible para progresar cargas hoy.";
  let protocoloHoy = [
    `Ejecutar ${nextWorkoutNombre} buscando RIR 1–2`,
    "Asegurar proteína meta y +500 ml de agua intra/post entreno",
    "Dormir 7.5–8h esta noche para supercompensar",
  ];

  if (entrenamientoCompletadoHoy || sessionByDate.has(hoyISO)) {
    recomiendaDescansoHoy = false;
    tituloEstado = "Entrenamiento de hoy cumplido ✓";
    razonCientifica =
      diasConsecutivosPrevios >= 1
        ? "Completaste 2 días seguidos de estímulo. Mañana te corresponde Día de Descanso Activo para crecer."
        : "Estímulo registrado. Ahora la ganancia muscular ocurre en la comida y el sueño.";
    protocoloHoy = [
      "Llegar al 100% de tu meta de proteína hoy",
      "Caminata suave post-comida de 10–15 min",
      "5g de creatina + hidratación completa",
    ];
  } else if (gymPostergadoHoy) {
    recomiendaDescansoHoy = true;
    tituloEstado = "Día marcado como Descanso / Recuperación";
    razonCientifica = `${nextWorkoutNombre} quedó reservado intacto para mañana sin perder tu secuencia.`;
    protocoloHoy = [
      "Mantener proteína alta (protege músculo en déficit)",
      "Dar 7,000–8,000 pasos suaves (oxida grasa sin fatigar SNC)",
      "Movilidad cervical de 5 min",
    ];
  } else if (diasConsecutivosPrevios >= 2) {
    recomiendaDescansoHoy = true;
    tituloEstado = "Descanso Inteligente Recomendado (1 día)";
    razonCientifica = `Llevas ${diasConsecutivosPrevios} días seguidos entrenando (${entrenoAnteayer?.workoutNombre} + ${entrenoAyer?.workoutNombre}). En un split Torso/Pierna de 4 días, descansar hoy recupera el sistema nervioso central y evita estancar pesos mañana.`;
    protocoloHoy = [
      "Cero pesas hoy: deja supercompensar fibras y tendones 24h",
      "Caminata ligera de 15–20 min + rutina postural cervical",
      "Mantén tu proteína igual de alta hoy (la síntesis proteica dura 36–48h)",
    ];
  } else if (sesionesUltimos7Dias >= 4) {
    recomiendaDescansoHoy = true;
    tituloEstado = "Meta semanal de 4 sesiones alcanzada · Reposición";
    razonCientifica = `Ya acumulaste ${sesionesUltimos7Dias} entrenamientos en los últimos 7 días. Un día de reposo consolida fuerza antes de iniciar el nuevo bloque.`;
    protocoloHoy = [
      "Descanso activo: pasos suaves e hidratación 2.8L+",
      "Cumplir meta de proteína y vegetales",
      "Retomar Torso/Pierna mañana totalmente fresco",
    ];
  } else if (piernaPesadaAyer && suenoBajo) {
    recomiendaDescansoHoy = true;
    tituloEstado = "Descanso por Recuperación Incompleta (Sueño + Pierna)";
    razonCientifica = `Ayer tuviste sesión exigente de pierna y dormiste ${suenoHoyHoras}h (<6h). Reposar hoy (o usar Modo Express 20m) previene sobrecarga articular.`;
    protocoloHoy = [
      "Prioridad #1 hoy: recuperar sueño esta noche (7.5–8h)",
      "Si decides ir al gym de todos modos, activa Modo Express (20 min)",
      "Hidratación alta + electrolitos naturales",
    ];
  } else if (fatigaAltaAyer) {
    razonCientifica = `Ayer llevaste varias series al límite en ${entrenoAyer?.workoutNombre}. Hoy puedes hacer ${nextWorkoutNombre} dejando 1–2 reps en recámara (RIR 1–2) sin llegar al fallo.`;
  }

  // Construir tira visual de 7 días (-3 días pasados, HOY, +3 días proyectados)
  const calendario7Dias: DayScheduleSlot[] = [];
  let streakSimulado = sessionByDate.has(hoyISO)
    ? diasConsecutivosPrevios + 1
    : recomiendaDescansoHoy
    ? 0
    : diasConsecutivosPrevios + 1;

  for (let offset = -3; offset <= 3; offset++) {
    const iso = addDaysISO(hoyISO, offset);
    const corto = getDiaCorto(iso);

    if (offset < 0) {
      const hecho = sessionByDate.get(iso);
      calendario7Dias.push({
        fecha: iso,
        diaCorto: corto,
        esHoy: false,
        estado: hecho ? "ENTRENO_HECHO" : "DESCANSO_PASADO",
        etiqueta: hecho ? hecho.workoutNombre : "Descanso",
      });
    } else if (offset === 0) {
      const hechoHoy = sessionByDate.get(iso) || entrenamientoCompletadoHoy;
      calendario7Dias.push({
        fecha: iso,
        diaCorto: corto,
        esHoy: true,
        estado: hechoHoy
          ? "ENTRENO_HECHO"
          : recomiendaDescansoHoy
          ? "HOY_DESCANSAR"
          : "HOY_ENTRENAR",
        etiqueta: hechoHoy
          ? sessionByDate.get(iso)?.workoutNombre || nextWorkoutNombre
          : recomiendaDescansoHoy
          ? "Descanso SNC"
          : nextWorkoutNombre,
      });
    } else {
      // Proyección inteligente: máximo 2 días seguidos de entreno -> 1 día de descanso
      const tocaDescanso = streakSimulado >= 2;
      if (tocaDescanso) {
        calendario7Dias.push({
          fecha: iso,
          diaCorto: corto,
          esHoy: false,
          estado: "PROYECTADO_DESCANSO",
          etiqueta: "Descanso",
        });
        streakSimulado = 0;
      } else {
        calendario7Dias.push({
          fecha: iso,
          diaCorto: corto,
          esHoy: false,
          estado: "PROYECTADO_ENTRENAR",
          etiqueta: "Gym",
        });
        streakSimulado++;
      }
    }
  }

  return {
    recomiendaDescansoHoy,
    tituloEstado,
    razonCientifica,
    protocoloHoy,
    sesionesUltimos7Dias,
    diasConsecutivosPrevios,
    calendario7Dias,
  };
}
