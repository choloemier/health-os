export type DayTrainingType = "PIERNA" | "TORSO" | "EXPRESS" | "DESCANSO";

export interface BiometricInputs {
  sexo: "M" | "F";
  edad: number;
  altura_cm: number;
  peso_referencia_kg: number;
  factor_actividad: number; // Multiplicador NEAT base (sin contar la sesión de pesas del día)
  deficit_pct: number; // % de déficit sobre el TDEE real de HOY (ej. 20%)
  proteina_g_kg: number; // Helms et al. (2014) / Morton et al. (2018): 1.8 - 2.2 g/kg en déficit
  tipoDiaHoy: DayTrainingType;
  caminataPostComidaHecha: boolean;
}

export interface BiometricCalculation {
  pesoUsadoKg: number;
  tmbKcal: number; // Mifflin-St Jeor (1990)
  gastoNeatBaseKcal: number;
  gastoEntrenoHoyKcal: number; // Compendium of Physical Activities (Herrmann et al., 2024) + EPOC
  gastoCaminataKcal: number;
  tdeeHoyRealKcal: number; // Gasto total real de HOY (cambia si entrenas pierna, torso, express o descansas)
  tdeeDiaDescansoKcal: number;
  tdeeDiaEntrenoPromedioKcal: number;
  recorteDiarioKcal: number;
  caloriasMetaHoy: number;
  caloriasDiaDescanso: number;
  caloriasDiaEntreno: number;
  diferenciaVsDescansoKcal: number;
  proteinaMetaG: number;
  fibraMetaG: number;
  aguaMetaMl: number;
  ritmoTeoricoSemanalKg: number;
  guiaAlimentacionHoy: string;
  respaldoCientifico: string;
}

export const ACTIVITY_LEVELS = [
  { value: 1.22, label: "Escritorio / Casa", desc: "<4,500 pasos fuera del gym" },
  { value: 1.32, label: "Ligero Cotidiano", desc: "5,000–7,500 pasos diarios" },
  { value: 1.42, label: "Activo", desc: "8,000–10,500 pasos diarios" },
  { value: 1.55, label: "Muy Activo / De pie", desc: ">11,000 pasos o trabajo físico" },
];

/**
 * Motor energético dinámico basado en evidencia científica:
 * 1. TMB: Ecuación de Mifflin-St Jeor (1990, Am J Clin Nutr) — mayor precisión validada en adultos.
 * 2. Gasto por sesión de pesas + EPOC: Compendium of Physical Activities (Ainsworth 2011 / Herrmann 2024)
 *    & Lytle et al. (2019): Pierna involucra mayor masa muscular (~4.6 kcal/kg), Torso (~3.6 kcal/kg),
 *    Express 20 min (~1.7 kcal/kg), Descanso/Postergado (0 kcal).
 * 3. Ciclado automático en Día de Descanso / "No fui al gym":
 *    Ajusta calorías a la baja según el TDEE real sin gym para no perder el déficit porcentual,
 *    manteniendo proteína fija alta (1.8–2.2 g/kg, Morton et al. 2018 Br J Sports Med; Helms et al. 2014 JISSN)
 *    porque la síntesis proteica muscular (MPS) permanece elevada 36–48h post-entreno (MacDougall et al. 1995).
 */
export function calculateBiometricTargets(input: BiometricInputs): BiometricCalculation {
  const peso = Math.max(35, Math.min(250, input.peso_referencia_kg || 80));
  const altura = Math.max(120, Math.min(230, input.altura_cm || 175));
  const edad = Math.max(14, Math.min(95, input.edad || 28));
  // Si el usuario tenía un factor antiguo alto (ej. 1.45 que ya incluía gym), normalizar suavemente o respetar rango NEAT
  const neatFactor = Math.max(1.15, Math.min(1.85, input.factor_actividad || 1.32));
  const deficitPct = Math.max(-25, Math.min(40, input.deficit_pct ?? 20));
  const protFactor = Math.max(1.4, Math.min(2.8, input.proteina_g_kg || 1.9));

  // 1. Mifflin-St Jeor BMR
  const sexoOffset = input.sexo === "F" ? -161 : 5;
  const tmb = Math.round(10 * peso + 6.25 * altura - 5 * edad + sexoOffset);

  // 2. NEAT diario sin ejercicio programado
  const gastoNeatBaseKcal = Math.round(tmb * neatFactor);

  // 3. Costo energético neto real según tipo de sesión de HOY
  let gastoEntrenoHoyKcal = 0;
  if (input.tipoDiaHoy === "PIERNA") {
    gastoEntrenoHoyKcal = Math.round(peso * 4.5); // Ej. 80kg -> ~360 kcal (alta demanda + EPOC)
  } else if (input.tipoDiaHoy === "TORSO") {
    gastoEntrenoHoyKcal = Math.round(peso * 3.5); // Ej. 80kg -> ~280 kcal
  } else if (input.tipoDiaHoy === "EXPRESS") {
    gastoEntrenoHoyKcal = Math.round(peso * 1.7); // Ej. 80kg -> ~136 kcal (20 min intensos)
  } else {
    gastoEntrenoHoyKcal = 0; // DESCANSO o "Hoy no pude ir al gym"
  }

  // Caminata post-comida (12-15 min a paso ligero ~3.5 METs netos ≈ 0.95 kcal/kg)
  const gastoCaminataKcal = input.caminataPostComidaHecha ? Math.round(peso * 0.95) : 0;

  const tdeeDiaDescansoKcal = gastoNeatBaseKcal;
  const gastoEntrenoPromedio = Math.round(peso * 4.0);
  const tdeeDiaEntrenoPromedioKcal = gastoNeatBaseKcal + gastoEntrenoPromedio;
  const tdeeHoyRealKcal = gastoNeatBaseKcal + gastoEntrenoHoyKcal + gastoCaminataKcal;

  const pisoMinimo = input.sexo === "F" ? 1200 : 1400;
  const multDeficit = 1 - deficitPct / 100;

  const caloriasDiaDescanso = Math.max(pisoMinimo, Math.round(tdeeDiaDescansoKcal * multDeficit));
  const caloriasDiaEntreno = Math.max(
    pisoMinimo,
    Math.round(tdeeDiaEntrenoPromedioKcal * multDeficit)
  );
  const caloriasMetaHoy = Math.max(pisoMinimo, Math.round(tdeeHoyRealKcal * multDeficit));

  const recorteDiarioKcal = tdeeHoyRealKcal - caloriasMetaHoy;
  const diferenciaVsDescansoKcal = caloriasMetaHoy - caloriasDiaDescanso;

  // Promedio semanal asumiendo 4 días de entreno + 3 días de descanso (Hall et al. / regla ~7700 kcal/kg)
  const deficitPromedioSemanal =
    4 * (tdeeDiaEntrenoPromedioKcal - caloriasDiaEntreno) +
    3 * (tdeeDiaDescansoKcal - caloriasDiaDescanso);
  const ritmoTeoricoSemanalKg = Number(((-deficitPromedioSemanal) / 7700).toFixed(2));

  // Proteína constante todos los días (síntesis proteica dura 36-48h en descanso)
  const proteinaMetaG = Math.round(peso * protFactor);
  // Fibra: 14g por cada 1000 kcal (IOM / USDA)
  const fibraMetaG = Math.max(25, Math.min(42, Math.round((caloriasMetaHoy / 1000) * 14)));
  // Agua: 35 ml/kg base + 500 ml extra en días de entrenamiento (ACSM hydration guidelines)
  const aguaBaseMl = Math.round((peso * 35) / 100) * 100;
  const aguaMetaMl =
    input.tipoDiaHoy === "DESCANSO" ? Math.max(2100, aguaBaseMl) : Math.max(2500, aguaBaseMl + 500);

  let guiaAlimentacionHoy = "";
  if (input.tipoDiaHoy === "DESCANSO") {
    guiaAlimentacionHoy = `Hoy es día sin pesas: tu meta baja automáticamente a ${caloriasMetaHoy} kcal para sostener tu -${deficitPct}% real sin acumular excedente. Mantén intactos los ${proteinaMetaG}g de proteína (síntesis muscular activa 48h) y recorta media porción de carbohidratos densos, priorizando ensaladas, brócoli y bayas/papa enfriada moderada.`;
  } else if (input.tipoDiaHoy === "PIERNA") {
    guiaAlimentacionHoy = `Día de Pierna (+${gastoEntrenoHoyKcal} kcal de gasto real): dispones de +${diferenciaVsDescansoKcal} kcal extra respecto a un día de descanso (${caloriasMetaHoy} kcal totales). Úsalas en carbohidratos limpios alrededor del entreno (ej. 200–250g de papa yungay/amarilla o 150g de menestras) para rendir fuerte sin salir de tu -${deficitPct}% de déficit.`;
  } else if (input.tipoDiaHoy === "EXPRESS") {
    guiaAlimentacionHoy = `Sesión Express 20 min (+${gastoEntrenoHoyKcal} kcal de gasto): meta ajustada con precisión a ${caloriasMetaHoy} kcal y ${proteinaMetaG}g de proteína.`;
  } else {
    guiaAlimentacionHoy = `Día de Torso (+${gastoEntrenoHoyKcal} kcal de gasto): cuentas con +${diferenciaVsDescansoKcal} kcal sobre tu base de descanso (${caloriasMetaHoy} kcal). Incluye 1 porción completa de papa o legumbres post-entreno junto a tu proteína magra.`;
  }

  return {
    pesoUsadoKg: Number(peso.toFixed(1)),
    tmbKcal: tmb,
    gastoNeatBaseKcal,
    gastoEntrenoHoyKcal,
    gastoCaminataKcal,
    tdeeHoyRealKcal,
    tdeeDiaDescansoKcal,
    tdeeDiaEntrenoPromedioKcal,
    recorteDiarioKcal,
    caloriasMetaHoy,
    caloriasDiaDescanso,
    caloriasDiaEntreno,
    diferenciaVsDescansoKcal,
    proteinaMetaG,
    fibraMetaG,
    aguaMetaMl,
    ritmoTeoricoSemanalKg,
    guiaAlimentacionHoy,
    respaldoCientifico:
      "Mifflin-St Jeor (1990) · Compendium METs (Herrmann 2024) · Proteína en déficit 1.8–2.2g/kg (Morton 2018, Helms 2014) · Hidratación ACSM.",
  };
}
