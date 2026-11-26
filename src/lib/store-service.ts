import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { FOOD_PRESETS_SEED, WORKOUT_TEMPLATES_SEED } from "@/lib/seed-data";
import {
  calculateExerciseProgression,
  ProgressionRecommendation,
  SetHistoryItem,
} from "@/lib/progression";
import { analyzeWeightHistory, WeightAnalyticsSummary } from "@/lib/weight-analytics";
import {
  BiometricCalculation,
  calculateBiometricTargets,
  DayTrainingType,
} from "@/lib/biometrics";
import { buildSmartRecoveryPlan, SmartRecoveryPlan } from "@/lib/recovery-scheduler";

export interface EnrichedExerciseDTO {
  id: string;
  slug: string;
  nombre_plan_a: string;
  nombre_plan_b: string;
  reps_min: number;
  reps_max: number;
  es_unilateral: boolean;
  series_meta: number;
  descanso_seg: number;
  es_superserie: boolean;
  grupo_superserie: string | null;
  es_compuesto: boolean;
  peso_inicial_a: number;
  peso_inicial_b: number;
  orden: number;
  progressionA: ProgressionRecommendation;
  progressionB: ProgressionRecommendation;
  todaySets: {
    id: string;
    numero_serie: number;
    variante_usada: "A" | "B";
    peso_asignado_kg: number;
    peso_real_kg: number;
    reps: number;
    sensacion_rir: string;
    notas: string | null;
  }[];
}

export interface WorkoutTemplateDTO {
  id: string;
  slug: string;
  nombre: string;
  enfoque: string | null;
  orden: number;
  ejercicios: EnrichedExerciseDTO[];
}

export interface AppStateDTO {
  fecha: string;
  dbConnected: boolean;
  aiConfigured: boolean;
  config: {
    sexo: "M" | "F";
    edad: number;
    altura_cm: number;
    peso_base_kg: number;
    factor_actividad: number;
    deficit_pct: number;
    proteina_g_kg: number;
    modo_auto_macros: boolean;
    calorias_meta: number;
    proteina_meta: number;
    fibra_meta: number;
    agua_meta: number;
    rutina_actual_index: number;
  };
  biometrics: BiometricCalculation;
  recoveryPlan: SmartRecoveryPlan;
  dailyLog: {
    fecha: string;
    peso_kg: number | null;
    cintura_cm: number | null;
    sueno_horas: number | null;
    agua_ml: number;
    creatina_ok: boolean;
    rutina_matutina: Record<string, boolean>;
    caminata_post_comida: boolean;
    gym_postergado: boolean;
    modo_express: boolean;
    notas: string | null;
  };
  workouts: WorkoutTemplateDTO[];
  todaySessionCompleted: boolean;
  foodPresets: {
    id: string;
    slug: string;
    categoria: string;
    nombre: string;
    porcion_texto: string;
    kcal: number;
    proteina: number;
    fibra: number;
    alerta_sodio: boolean;
    beneficio_tag: string | null;
    orden: number;
  }[];
  mealsToday: {
    id: string;
    fecha: string;
    bloque_horario: string;
    texto_original: string | null;
    nombre: string;
    multiplicador: number;
    kcal: number;
    proteina: number;
    fibra: number;
    bandera_sodio_grasa: string | null;
    es_estimacion_ia: boolean;
    recomendacion_ia: string | null;
    createdAt: string;
  }[];
  weightAnalytics: WeightAnalyticsSummary;
}

function resolveDayTrainingType(params: {
  gymPostergado: boolean;
  recomiendaDescanso: boolean;
  tieneSetsHoy: boolean;
  modoExpress: boolean;
  activeWorkoutSlug: string;
}): DayTrainingType {
  if (params.gymPostergado) return "DESCANSO";
  if (params.recomiendaDescanso && !params.tieneSetsHoy) return "DESCANSO";
  if (params.modoExpress) return "EXPRESS";
  if (params.activeWorkoutSlug.startsWith("pierna")) return "PIERNA";
  return "TORSO";
}

let seededChecked = false;

export async function ensureSeededIfConnected(): Promise<void> {
  if (!isDatabaseConfigured() || seededChecked) return;

  const count = await prisma.workoutTemplate.count();
  if (count >= 4) {
    seededChecked = true;
    return;
  }

  await prisma.userConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  for (const w of WORKOUT_TEMPLATES_SEED) {
    const wt = await prisma.workoutTemplate.upsert({
      where: { slug: w.slug },
      update: { nombre: w.nombre, enfoque: w.enfoque, orden: w.orden },
      create: { slug: w.slug, nombre: w.nombre, enfoque: w.enfoque, orden: w.orden },
    });

    for (const ex of w.ejercicios) {
      await prisma.exerciseTemplate.upsert({
        where: { slug: ex.slug },
        update: {
          workout_template_id: wt.id,
          nombre_plan_a: ex.nombre_plan_a,
          nombre_plan_b: ex.nombre_plan_b,
          reps_min: ex.reps_min,
          reps_max: ex.reps_max,
          es_unilateral: ex.es_unilateral ?? false,
          series_meta: ex.series_meta,
          descanso_seg: ex.descanso_seg,
          es_superserie: ex.es_superserie ?? false,
          grupo_superserie: ex.grupo_superserie ?? null,
          es_compuesto: ex.es_compuesto,
          peso_inicial_a: ex.peso_inicial_a,
          peso_inicial_b: ex.peso_inicial_b,
          orden: ex.orden,
        },
        create: {
          slug: ex.slug,
          workout_template_id: wt.id,
          nombre_plan_a: ex.nombre_plan_a,
          nombre_plan_b: ex.nombre_plan_b,
          reps_min: ex.reps_min,
          reps_max: ex.reps_max,
          es_unilateral: ex.es_unilateral ?? false,
          series_meta: ex.series_meta,
          descanso_seg: ex.descanso_seg,
          es_superserie: ex.es_superserie ?? false,
          grupo_superserie: ex.grupo_superserie ?? null,
          es_compuesto: ex.es_compuesto,
          peso_inicial_a: ex.peso_inicial_a,
          peso_inicial_b: ex.peso_inicial_b,
          orden: ex.orden,
        },
      });
    }
  }

  for (const f of FOOD_PRESETS_SEED) {
    await prisma.foodPreset.upsert({
      where: { slug: f.slug },
      update: {
        categoria: f.categoria,
        nombre: f.nombre,
        porcion_texto: f.porcion_texto,
        kcal: f.kcal,
        proteina: f.proteina,
        fibra: f.fibra,
        alerta_sodio: f.alerta_sodio ?? false,
        beneficio_tag: f.beneficio_tag ?? null,
        orden: f.orden,
      },
      create: {
        slug: f.slug,
        categoria: f.categoria,
        nombre: f.nombre,
        porcion_texto: f.porcion_texto,
        kcal: f.kcal,
        proteina: f.proteina,
        fibra: f.fibra,
        alerta_sodio: f.alerta_sodio ?? false,
        beneficio_tag: f.beneficio_tag ?? null,
        orden: f.orden,
      },
    });
  }

  seededChecked = true;
}

function extractLatestPriorSessionSets(
  allPriorSets: SetHistoryItem[],
  variante: "A" | "B"
): SetHistoryItem[] {
  const filtered = allPriorSets.filter((s) => s.variante_usada === variante);
  if (filtered.length === 0) return [];
  const latestFecha = filtered.reduce(
    (max, item) => (item.fecha > max ? item.fecha : max),
    filtered[0].fecha
  );
  return filtered.filter((s) => s.fecha === latestFecha);
}

export async function getFullAppState(fecha: string): Promise<AppStateDTO> {
  const aiKey = process.env.GEMINI_API_KEY?.trim();
  const aiConfigured = Boolean(aiKey && aiKey !== "AIzaSy..." && aiKey.length >= 15);

  await ensureSeededIfConnected();

  const [
    configRow,
    dailyRow,
    templates,
    presets,
    meals,
    weightRows,
    priorSets,
    todaySetsRows,
    recentSessionsRows,
  ] = await Promise.all([
    prisma.userConfig.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    }),
    prisma.dailyLog.findUnique({ where: { fecha } }),
    prisma.workoutTemplate.findMany({
      orderBy: { orden: "asc" },
      include: { ejercicios: { orderBy: { orden: "asc" } } },
    }),
    prisma.foodPreset.findMany({ orderBy: { orden: "asc" } }),
    prisma.mealEntry.findMany({
      where: { fecha },
      orderBy: { createdAt: "desc" },
    }),
    prisma.dailyLog.findMany({
      where: { peso_kg: { not: null } },
      select: { fecha: true, peso_kg: true },
      orderBy: { fecha: "asc" },
      take: 120,
    }),
    prisma.setLog.findMany({
      where: { fecha: { lt: fecha } },
      orderBy: [{ fecha: "desc" }, { numero_serie: "asc" }],
      take: 800,
    }),
    prisma.setLog.findMany({
      where: { fecha },
      orderBy: { numero_serie: "asc" },
    }),
    prisma.workoutSession.findMany({
      orderBy: { fecha: "desc" },
      take: 14,
      include: {
        workoutTemplate: { select: { slug: true, nombre: true } },
        sets: { select: { sensacion_rir: true } },
      },
    }),
  ]);

  const priorByEx = new Map<string, SetHistoryItem[]>();
  for (const s of priorSets) {
    const list = priorByEx.get(s.exercise_template_id) ?? [];
    list.push({
      fecha: s.fecha,
      numero_serie: s.numero_serie,
      variante_usada: s.variante_usada,
      peso_asignado_kg: s.peso_asignado_kg,
      peso_real_kg: s.peso_real_kg,
      reps: s.reps,
      sensacion_rir: s.sensacion_rir,
    });
    priorByEx.set(s.exercise_template_id, list);
  }

  const todayByEx = new Map<string, typeof todaySetsRows>();
  for (const s of todaySetsRows) {
    const list = todayByEx.get(s.exercise_template_id) ?? [];
    list.push(s);
    todayByEx.set(s.exercise_template_id, list);
  }

  const workouts: WorkoutTemplateDTO[] = templates.map((wt) => ({
    id: wt.id,
    slug: wt.slug,
    nombre: wt.nombre,
    enfoque: wt.enfoque,
    orden: wt.orden,
    ejercicios: wt.ejercicios.map((ex) => {
      const history = priorByEx.get(ex.id) ?? [];
      const lastSetsA = extractLatestPriorSessionSets(history, "A");
      const lastSetsB = extractLatestPriorSessionSets(history, "B");

      return {
        id: ex.id,
        slug: ex.slug,
        nombre_plan_a: ex.nombre_plan_a,
        nombre_plan_b: ex.nombre_plan_b,
        reps_min: ex.reps_min,
        reps_max: ex.reps_max,
        es_unilateral: ex.es_unilateral,
        series_meta: ex.series_meta,
        descanso_seg: ex.descanso_seg,
        es_superserie: ex.es_superserie,
        grupo_superserie: ex.grupo_superserie,
        es_compuesto: ex.es_compuesto,
        peso_inicial_a: ex.peso_inicial_a,
        peso_inicial_b: ex.peso_inicial_b,
        orden: ex.orden,
        progressionA: calculateExerciseProgression(ex, lastSetsA, "A"),
        progressionB: calculateExerciseProgression(ex, lastSetsB, "B"),
        todaySets: (todayByEx.get(ex.id) ?? []).map((ts) => ({
          id: ts.id,
          numero_serie: ts.numero_serie,
          variante_usada: (ts.variante_usada === "B" ? "B" : "A") as "A" | "B",
          peso_asignado_kg: ts.peso_asignado_kg,
          peso_real_kg: ts.peso_real_kg,
          reps: ts.reps,
          sensacion_rir: ts.sensacion_rir,
          notas: ts.notas,
        })),
      };
    }),
  }));

  const activeTemplate = workouts[configRow.rutina_actual_index] ?? workouts[0];
  const todaySessionCompleted = recentSessionsRows.some(
    (s) => s.fecha === fecha && s.completada
  );

  const weightAnalytics = analyzeWeightHistory(
    weightRows
      .filter((r): r is { fecha: string; peso_kg: number } => r.peso_kg !== null)
      .map((r) => ({ fecha: r.fecha, peso_kg: r.peso_kg }))
  );

  // Planificador Inteligente de Días de Descanso y Recuperación SNC
  const recentSummaries = recentSessionsRows.map((rs) => ({
    fecha: rs.fecha,
    workoutSlug: rs.workoutTemplate.slug,
    workoutNombre: rs.workoutTemplate.nombre,
    totalSets: rs.sets.length,
    highFatigueSets: rs.sets.filter(
      (st) => st.sensacion_rir === "AL_LIMITE" || st.sensacion_rir === "MUY_PESADO"
    ).length,
  }));

  const recoveryPlan = buildSmartRecoveryPlan({
    hoyISO: fecha,
    recentSessions: recentSummaries,
    nextWorkoutNombre: activeTemplate?.nombre ?? "Torso A",
    suenoHoyHoras: dailyRow?.sueno_horas ?? null,
    gymPostergadoHoy: dailyRow?.gym_postergado ?? false,
    entrenamientoCompletadoHoy: todaySessionCompleted,
  });

  // Peso vivo de referencia sin fugas: usa Promedio 7d -> Peso de hoy -> Último peso -> Peso base configurado
  const pesoVivo =
    weightAnalytics.promedioActual7d ??
    dailyRow?.peso_kg ??
    weightAnalytics.ultimoPeso ??
    configRow.peso_base_kg;

  const tipoDiaHoy = resolveDayTrainingType({
    gymPostergado: dailyRow?.gym_postergado ?? false,
    recomiendaDescanso: recoveryPlan.recomiendaDescansoHoy,
    tieneSetsHoy: todaySetsRows.length > 0,
    modoExpress: dailyRow?.modo_express ?? false,
    activeWorkoutSlug: activeTemplate?.slug ?? "torso-a",
  });

  const sexoClean: "M" | "F" = configRow.sexo === "F" ? "F" : "M";
  const biometrics = calculateBiometricTargets({
    sexo: sexoClean,
    edad: configRow.edad,
    altura_cm: configRow.altura_cm,
    peso_referencia_kg: pesoVivo,
    factor_actividad: configRow.factor_actividad,
    deficit_pct: configRow.deficit_pct,
    proteina_g_kg: configRow.proteina_g_kg,
    tipoDiaHoy,
    caminataPostComidaHecha: dailyRow?.caminata_post_comida ?? false,
  });

  // Si modo_auto_macros está activo (por defecto), las metas del día se ajustan dinámicamente sin fugas
  const effectiveCaloriasMeta = configRow.modo_auto_macros
    ? biometrics.caloriasMetaHoy
    : configRow.calorias_meta;
  const effectiveProteinaMeta = configRow.modo_auto_macros
    ? biometrics.proteinaMetaG
    : configRow.proteina_meta;
  const effectiveFibraMeta = configRow.modo_auto_macros
    ? biometrics.fibraMetaG
    : configRow.fibra_meta;
  const effectiveAguaMeta = configRow.modo_auto_macros
    ? biometrics.aguaMetaMl
    : configRow.agua_meta;

  const parsedMorning =
    dailyRow?.rutina_matutina && typeof dailyRow.rutina_matutina === "object"
      ? (dailyRow.rutina_matutina as Record<string, boolean>)
      : {};

  return {
    fecha,
    dbConnected: true,
    aiConfigured,
    config: {
      sexo: sexoClean,
      edad: configRow.edad,
      altura_cm: configRow.altura_cm,
      peso_base_kg: configRow.peso_base_kg,
      factor_actividad: configRow.factor_actividad,
      deficit_pct: configRow.deficit_pct,
      proteina_g_kg: configRow.proteina_g_kg,
      modo_auto_macros: configRow.modo_auto_macros,
      calorias_meta: effectiveCaloriasMeta,
      proteina_meta: effectiveProteinaMeta,
      fibra_meta: effectiveFibraMeta,
      agua_meta: effectiveAguaMeta,
      rutina_actual_index: configRow.rutina_actual_index,
    },
    biometrics,
    recoveryPlan,
    dailyLog: {
      fecha,
      peso_kg: dailyRow?.peso_kg ?? null,
      cintura_cm: dailyRow?.cintura_cm ?? null,
      sueno_horas: dailyRow?.sueno_horas ?? null,
      agua_ml: dailyRow?.agua_ml ?? 0,
      creatina_ok: dailyRow?.creatina_ok ?? false,
      rutina_matutina: parsedMorning,
      caminata_post_comida: dailyRow?.caminata_post_comida ?? false,
      gym_postergado: dailyRow?.gym_postergado ?? false,
      modo_express: dailyRow?.modo_express ?? false,
      notas: dailyRow?.notas ?? null,
    },
    workouts,
    todaySessionCompleted,
    foodPresets: presets,
    mealsToday: meals.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
    weightAnalytics,
  };
}

export async function updateDailyLogData(
  fecha: string,
  patch: Partial<{
    peso_kg: number | null;
    cintura_cm: number | null;
    sueno_horas: number | null;
    agua_ml: number;
    agua_delta: number;
    creatina_ok: boolean;
    rutina_matutina: Record<string, boolean>;
    caminata_post_comida: boolean;
    gym_postergado: boolean;
    modo_express: boolean;
    notas: string | null;
  }>
) {
  const existing = await prisma.dailyLog.findUnique({ where: { fecha } });
  const currentAgua = existing?.agua_ml ?? 0;
  const nextAgua =
    typeof patch.agua_delta === "number"
      ? Math.max(0, currentAgua + patch.agua_delta)
      : typeof patch.agua_ml === "number"
      ? Math.max(0, patch.agua_ml)
      : currentAgua;

  const dataToSave: Record<string, unknown> = { agua_ml: nextAgua };
  if (patch.peso_kg !== undefined) dataToSave.peso_kg = patch.peso_kg;
  if (patch.cintura_cm !== undefined) dataToSave.cintura_cm = patch.cintura_cm;
  if (patch.sueno_horas !== undefined) dataToSave.sueno_horas = patch.sueno_horas;
  if (patch.creatina_ok !== undefined) dataToSave.creatina_ok = patch.creatina_ok;
  if (patch.rutina_matutina !== undefined) dataToSave.rutina_matutina = patch.rutina_matutina;
  if (patch.caminata_post_comida !== undefined)
    dataToSave.caminata_post_comida = patch.caminata_post_comida;
  if (patch.gym_postergado !== undefined) dataToSave.gym_postergado = patch.gym_postergado;
  if (patch.modo_express !== undefined) dataToSave.modo_express = patch.modo_express;
  if (patch.notas !== undefined) dataToSave.notas = patch.notas;

  await prisma.dailyLog.upsert({
    where: { fecha },
    update: dataToSave,
    create: {
      fecha,
      ...dataToSave,
    },
  });

  // Si actualizó su peso hoy, mantener peso_base_kg sincronizado como respaldo inicial
  if (typeof patch.peso_kg === "number" && patch.peso_kg > 30) {
    await prisma.userConfig.upsert({
      where: { id: 1 },
      update: { peso_base_kg: patch.peso_kg },
      create: { id: 1, peso_base_kg: patch.peso_kg },
    });
  }
}

export async function logGymSetData(input: {
  fecha: string;
  workoutTemplateId: string;
  exerciseTemplateId: string;
  varianteUsada: "A" | "B";
  pesoAsignadoKg: number;
  pesoRealKg: number;
  reps: number;
  sensacionRir: string;
  esExpress?: boolean;
}) {
  const session = await prisma.workoutSession.upsert({
    where: {
      fecha_workout_template_id: {
        fecha: input.fecha,
        workout_template_id: input.workoutTemplateId,
      },
    },
    update: {
      es_express: input.esExpress ?? undefined,
    },
    create: {
      fecha: input.fecha,
      workout_template_id: input.workoutTemplateId,
      es_express: input.esExpress ?? false,
    },
  });

  const existingCount = await prisma.setLog.count({
    where: {
      workout_session_id: session.id,
      exercise_template_id: input.exerciseTemplateId,
    },
  });

  await prisma.setLog.create({
    data: {
      fecha: input.fecha,
      workout_session_id: session.id,
      exercise_template_id: input.exerciseTemplateId,
      numero_serie: existingCount + 1,
      variante_usada: input.varianteUsada,
      peso_asignado_kg: input.pesoAsignadoKg,
      peso_real_kg: input.pesoRealKg,
      reps: input.reps,
      sensacion_rir: input.sensacionRir,
    },
  });
}

export async function updateGymSetData(input: {
  id: string;
  pesoRealKg: number;
  reps: number;
  sensacionRir?: string;
}) {
  await prisma.setLog.update({
    where: { id: input.id },
    data: {
      peso_real_kg: Math.max(0, input.pesoRealKg),
      reps: Math.max(0, Math.round(input.reps)),
      ...(input.sensacionRir ? { sensacion_rir: input.sensacionRir } : {}),
    },
  });
}

export async function deleteGymSetData(setId: string) {
  await prisma.setLog.delete({ where: { id: setId } }).catch(() => null);
}

export async function handleGymContingencyData(input: {
  fecha: string;
  action: "SKIP_TODAY" | "RESUME_TODAY" | "TOGGLE_EXPRESS" | "COMPLETE_SESSION" | "SET_ROUTINE";
  workoutTemplateId?: string;
  routineIndex?: number;
}) {
  if (input.action === "SKIP_TODAY") {
    await updateDailyLogData(input.fecha, { gym_postergado: true });
  } else if (input.action === "RESUME_TODAY") {
    await updateDailyLogData(input.fecha, { gym_postergado: false });
  } else if (input.action === "TOGGLE_EXPRESS") {
    const existing = await prisma.dailyLog.findUnique({ where: { fecha: input.fecha } });
    await updateDailyLogData(input.fecha, {
      modo_express: !(existing?.modo_express ?? false),
      gym_postergado: false,
    });
  } else if (input.action === "COMPLETE_SESSION") {
    const cfg = await prisma.userConfig.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
    if (input.workoutTemplateId) {
      await prisma.workoutSession.upsert({
        where: {
          fecha_workout_template_id: {
            fecha: input.fecha,
            workout_template_id: input.workoutTemplateId,
          },
        },
        update: { completada: true },
        create: {
          fecha: input.fecha,
          workout_template_id: input.workoutTemplateId,
          completada: true,
        },
      });
    }
    await prisma.userConfig.update({
      where: { id: 1 },
      data: {
        rutina_actual_index: (cfg.rutina_actual_index + 1) % 4,
      },
    });
  } else if (input.action === "SET_ROUTINE" && typeof input.routineIndex === "number") {
    await prisma.userConfig.upsert({
      where: { id: 1 },
      update: { rutina_actual_index: Math.max(0, Math.min(3, input.routineIndex)) },
      create: { id: 1, rutina_actual_index: Math.max(0, Math.min(3, input.routineIndex)) },
    });
  }
}

export async function addMealEntryData(input: {
  fecha: string;
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
}) {
  await prisma.mealEntry.create({
    data: {
      fecha: input.fecha,
      bloque_horario: input.bloque_horario,
      texto_original: input.texto_original ?? null,
      nombre: input.nombre,
      multiplicador: input.multiplicador ?? 1,
      kcal: Math.round(input.kcal),
      proteina: Number(input.proteina.toFixed(1)),
      fibra: Number(input.fibra.toFixed(1)),
      bandera_sodio_grasa: input.bandera_sodio_grasa ?? null,
      es_estimacion_ia: input.es_estimacion_ia ?? false,
      recomendacion_ia: input.recomendacion_ia ?? null,
    },
  });
}

export async function updateMealEntryData(input: {
  id: string;
  nombre: string;
  kcal: number;
  proteina: number;
  fibra: number;
}) {
  await prisma.mealEntry.update({
    where: { id: input.id },
    data: {
      nombre: input.nombre.trim().slice(0, 120) || "Alimento",
      kcal: Math.max(0, Math.round(input.kcal)),
      proteina: Math.max(0, Number(input.proteina.toFixed(1))),
      fibra: Math.max(0, Number(input.fibra.toFixed(1))),
    },
  });
}

export async function deleteMealEntryData(mealId: string) {
  await prisma.mealEntry.delete({ where: { id: mealId } }).catch(() => null);
}

export async function updateUserConfigData(patch: {
  sexo?: "M" | "F";
  edad?: number;
  altura_cm?: number;
  peso_base_kg?: number;
  factor_actividad?: number;
  deficit_pct?: number;
  proteina_g_kg?: number;
  modo_auto_macros?: boolean;
  calorias_meta?: number;
  proteina_meta?: number;
  fibra_meta?: number;
  agua_meta?: number;
  rutina_actual_index?: number;
}) {
  await prisma.userConfig.upsert({
    where: { id: 1 },
    update: patch,
    create: {
      id: 1,
      ...patch,
    },
  });
}
