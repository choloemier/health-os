import { GoogleGenAI, Type } from "@google/genai";

export interface DailyNutritionContext {
  consumidoKcal: number;
  metaKcal: number;
  consumidoProteina: number;
  metaProteina: number;
  consumidoFibra: number;
  metaFibra: number;
  horaActual: string;
  entrenaHoy: boolean;
}

export interface InterpretedMealResult {
  nombre_limpio: string;
  kcal: number;
  proteina_g: number;
  fibra_g: number;
  bandera_sodio_o_grasa_saturada: string | null;
  veredicto_y_ajuste: string;
  fuente: "GEMINI_FLASH" | "ESTIMADOR_LOCAL";
  modelo_usado?: string;
}

// Cascada automática de modelos Flash gratuitos en Google AI Studio:
// Si el modelo principal tiene alta demanda temporal (503) o cambia de disponibilidad (404),
// salta al instante al siguiente modelo Flash real sin caer en modo local.
const GEMINI_FLASH_CANDIDATES = [
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
];

/**
 * Estimador heurístico local gratuito de último recurso (solo si no hay internet o no hay API Key)
 */
function fallbackLocalEstimate(
  texto: string,
  ctx: DailyNutritionContext
): InterpretedMealResult {
  const lower = texto.toLowerCase();
  let kcal = 350;
  let proteina = 20;
  let fibra = 3;
  let bandera: string | null = null;

  const isZeroCalDrink =
    (lower.includes("zero") ||
      lower.includes("light") ||
      lower.includes("sin azucar") ||
      lower.includes("sin azúcar") ||
      lower.includes("agua") ||
      lower.includes("cafe solo") ||
      lower.includes("café negro") ||
      lower.includes("infusion") ||
      lower.includes("té")) &&
    !lower.includes("chaufa") &&
    !lower.includes("pollo") &&
    !lower.includes("pan") &&
    !lower.includes("hamburguesa") &&
    !lower.includes("pizza") &&
    !lower.includes("arroz");

  if (isZeroCalDrink) {
    kcal = 0;
    proteina = 0;
    fibra = 0;
    bandera =
      lower.includes("pepsi") || lower.includes("coca") || lower.includes("gaseosa")
        ? "0 kcal · Edulcorantes no calóricos y ligero aporte de sodio; alterna con agua pura"
        : null;
  } else if (lower.includes("chaufa")) {
    kcal = 680;
    proteina = 32;
    fibra = 3;
    bandera = "Sodio elevado (sillao) y aceite de salteado · suma +400ml de agua hoy";
  } else if (lower.includes("pollo a la brasa")) {
    kcal = 720;
    proteina = 48;
    fibra = 4;
    bandera = "Sodio en aderezo y grasa en piel/papas · retira piel si puedes";
  } else if (lower.includes("ceviche") || lower.includes("cebiche")) {
    kcal = 420;
    proteina = 38;
    fibra = 5;
  } else if (lower.includes("tostada") || lower.includes("pan")) {
    kcal = 260;
    proteina = 10;
    fibra = 4;
    if (lower.includes("palta") || lower.includes("aguacate")) {
      kcal += 120;
      fibra += 4;
    }
    if (lower.includes("huevo")) {
      kcal += 78;
      proteina += 6.5;
    }
  } else if (
    lower.includes("hamburguesa") ||
    lower.includes("pizza") ||
    lower.includes("salchipapa")
  ) {
    kcal = 780;
    proteina = 28;
    fibra = 3;
    bandera = "Alto en sodio y grasas saturadas · hidrata bien y camina 15 min";
  } else if (
    lower.includes("avena") ||
    lower.includes("batido") ||
    lower.includes("whey") ||
    lower.includes("proteina")
  ) {
    kcal = 260;
    proteina = 28;
    fibra = 4;
  } else if (lower.includes("lomo saltado")) {
    kcal = 690;
    proteina = 36;
    fibra = 4;
    bandera = "Sodio moderado-alto por sillao y papas fritas";
  }

  const nuevoTotalKcal = ctx.consumidoKcal + kcal;
  const nuevoTotalProt = ctx.consumidoProteina + proteina;
  const restanKcal = ctx.metaKcal - nuevoTotalKcal;
  const faltaProt = Math.max(0, Math.round(ctx.metaProteina - nuevoTotalProt));

  let veredicto = "";
  if (restanKcal < 0) {
    veredicto = `Quedas ${Math.abs(restanKcal)} kcal sobre la meta${
      faltaProt > 10 ? ` y te faltan ${faltaProt}g de proteína` : ""
    }. Cierra la siguiente comida con pechuga/claras + brócoli al vapor sin aceite extra y camina 15 min.`;
  } else if (faltaProt > 25) {
    veredicto = `Vas en rango (${restanKcal} kcal libres), pero faltan ${faltaProt}g de proteína. En tu próxima comida asegura 150–180g de pollo, atún o caballa con vegetales.`;
  } else {
    veredicto = `Vas sólido en rango (${restanKcal} kcal disponibles y buena ruta de proteína). Mantén hidratación constante.`;
  }

  const limpio = texto.trim().charAt(0).toUpperCase() + texto.trim().slice(1);

  return {
    nombre_limpio: limpio.slice(0, 90),
    kcal,
    proteina_g: Number(proteina.toFixed(1)),
    fibra_g: Number(fibra.toFixed(1)),
    bandera_sodio_o_grasa_saturada: bandera,
    veredicto_y_ajuste: veredicto,
    fuente: "ESTIMADOR_LOCAL",
  };
}

export async function interpretMealWithGemini(
  textoComida: string,
  ctx: DailyNutritionContext
): Promise<InterpretedMealResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey || apiKey === "AIzaSy..." || apiKey.length < 15) {
    return fallbackLocalEstimate(textoComida, ctx);
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Actúa como un nutricionista deportivo clínico conciso, práctico y CERO CULPA (amigable para TDAH, cuidando composición corporal, hígado graso y retención de líquidos).

Comida o bebida reportada por el usuario: "${textoComida}"

Contexto del usuario HOY ANTES de sumar este ítem:
- Hora local: ${ctx.horaActual}
- ¿Entrena fuerza hoy?: ${ctx.entrenaHoy ? "Sí" : "No / Descanso activo"}
- Calorías llevadas hoy: ${ctx.consumidoKcal} / ${ctx.metaKcal} kcal
- Proteína llevada hoy: ${ctx.consumidoProteina}g / ${ctx.metaProteina}g
- Fibra llevada hoy: ${ctx.consumidoFibra}g / ${ctx.metaFibra}g

Instrucciones:
1. Estima con precisión nutricional real las kcal, proteína (g) y fibra (g) de "${textoComida}" (ej. bebidas zero/light sin azúcar aportan 0 kcal, 0g proteína y 0g fibra; platos peruanos/latinos como chaufa, papa yungay, palta, menestras según sus porciones reales).
2. Si tiene alto sodio (sillao, embutidos, salsas, encurtidos, exceso de bebidas con sodio) o alta grasa saturada/fritura relevante para hígado graso o retención hídrica, descríbelo brevemente en bandera_sodio_o_grasa_saturada; si es limpio o insignificante, devuelve cadena vacía "".
3. En veredicto_y_ajuste (MÁXIMO 2 frases directas, tono aliado sin regaños): suma mentalmente este ítem al acumulado de hoy e indica cómo queda respecto a sus metas y qué comer exactamente en la siguiente comida del día para equilibrar.`;

  let lastError: unknown = null;

  for (const modelName of GEMINI_FLASH_CANDIDATES) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          temperature: 0.2,
          httpOptions: { timeout: 12000 },
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              nombre_limpio: {
                type: Type.STRING,
                description: "Nombre corto y limpio del plato o bebida registrada",
              },
              kcal: {
                type: Type.INTEGER,
                description: "Calorías totales estimadas",
              },
              proteina_g: {
                type: Type.NUMBER,
                description: "Gramos de proteína estimados",
              },
              fibra_g: {
                type: Type.NUMBER,
                description: "Gramos de fibra estimados",
              },
              bandera_sodio_o_grasa_saturada: {
                type: Type.STRING,
                description:
                  "Nota breve si es alto en sodio o grasa saturada (útil para hígado graso/retención), o vacío si no aplica",
              },
              veredicto_y_ajuste: {
                type: Type.STRING,
                description:
                  "1 a 2 frases directas sin culpa indicando balance del día y ajuste concreto para la siguiente comida",
              },
            },
            required: [
              "nombre_limpio",
              "kcal",
              "proteina_g",
              "fibra_g",
              "bandera_sodio_o_grasa_saturada",
              "veredicto_y_ajuste",
            ],
          },
        },
      });

      const rawText = response.text;
      if (!rawText) continue;

      const parsed = JSON.parse(rawText);
      return {
        nombre_limpio: String(parsed.nombre_limpio || textoComida).slice(0, 100),
        kcal: Math.max(0, Math.round(Number(parsed.kcal) || 0)),
        proteina_g: Math.max(0, Number(Number(parsed.proteina_g || 0).toFixed(1))),
        fibra_g: Math.max(0, Number(Number(parsed.fibra_g || 0).toFixed(1))),
        bandera_sodio_o_grasa_saturada: parsed.bandera_sodio_o_grasa_saturada?.trim()
          ? String(parsed.bandera_sodio_o_grasa_saturada).trim()
          : null,
        veredicto_y_ajuste: String(parsed.veredicto_y_ajuste || ""),
        fuente: "GEMINI_FLASH",
        modelo_usado: modelName,
      };
    } catch (err) {
      lastError = err;
      // Continuar al siguiente modelo Flash de respaldo
    }
  }

  console.warn("Todos los modelos Gemini fallaron, usando estimador local:", lastError);
  return fallbackLocalEstimate(textoComida, ctx);
}
