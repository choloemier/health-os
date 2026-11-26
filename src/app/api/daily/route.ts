import { NextRequest, NextResponse } from "next/server";
import { getFullAppState, updateDailyLogData } from "@/lib/store-service";
import { getLocalDateISO } from "@/lib/date-utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fecha = String(body.fecha || getLocalDateISO());
    await updateDailyLogData(fecha, {
      peso_kg: body.peso_kg,
      cintura_cm: body.cintura_cm,
      sueno_horas: body.sueno_horas,
      agua_ml: body.agua_ml,
      agua_delta: body.agua_delta,
      creatina_ok: body.creatina_ok,
      rutina_matutina: body.rutina_matutina,
      caminata_post_comida: body.caminata_post_comida,
      gym_postergado: body.gym_postergado,
      modo_express: body.modo_express,
      notas: body.notas,
    });
    const state = await getFullAppState(fecha);
    return NextResponse.json(state);
  } catch (err) {
    console.error("Error updating daily log:", err);
    return NextResponse.json({ error: "No se pudo actualizar el registro diario" }, { status: 500 });
  }
}
