import { NextRequest, NextResponse } from "next/server";
import { getFullAppState, updateDailyLogData, updateUserConfigData } from "@/lib/store-service";
import { getLocalDateISO } from "@/lib/date-utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fecha = String(body.fecha || getLocalDateISO());

    const patch: Parameters<typeof updateUserConfigData>[0] = {};
    if (body.sexo === "M" || body.sexo === "F") patch.sexo = body.sexo;
    if (body.edad !== undefined) patch.edad = Math.max(14, Math.min(95, Number(body.edad)));
    if (body.altura_cm !== undefined)
      patch.altura_cm = Math.max(120, Math.min(230, Number(body.altura_cm)));
    if (body.peso_base_kg !== undefined)
      patch.peso_base_kg = Math.max(35, Math.min(250, Number(body.peso_base_kg)));
    if (body.factor_actividad !== undefined)
      patch.factor_actividad = Math.max(1.15, Math.min(1.9, Number(body.factor_actividad)));
    if (body.deficit_pct !== undefined)
      patch.deficit_pct = Math.max(-25, Math.min(40, Number(body.deficit_pct)));
    if (body.proteina_g_kg !== undefined)
      patch.proteina_g_kg = Math.max(1.2, Math.min(3.0, Number(body.proteina_g_kg)));
    if (body.modo_auto_macros !== undefined)
      patch.modo_auto_macros = Boolean(body.modo_auto_macros);
    if (body.calorias_meta !== undefined)
      patch.calorias_meta = Math.max(1100, Number(body.calorias_meta));
    if (body.proteina_meta !== undefined)
      patch.proteina_meta = Math.max(40, Number(body.proteina_meta));
    if (body.fibra_meta !== undefined)
      patch.fibra_meta = Math.max(10, Number(body.fibra_meta));
    if (body.agua_meta !== undefined)
      patch.agua_meta = Math.max(1000, Number(body.agua_meta));
    if (body.rutina_actual_index !== undefined)
      patch.rutina_actual_index = Math.max(0, Math.min(3, Number(body.rutina_actual_index)));

    await updateUserConfigData(patch);

    // Si también envió peso actual desde la calculadora biométrica, sincronizar el pesaje de hoy
    if (body.sync_peso_hoy && typeof patch.peso_base_kg === "number") {
      await updateDailyLogData(fecha, { peso_kg: patch.peso_base_kg });
    }

    const state = await getFullAppState(fecha);
    return NextResponse.json(state);
  } catch (err) {
    console.error("Error updating config:", err);
    return NextResponse.json({ error: "No se pudo guardar la configuración" }, { status: 500 });
  }
}
