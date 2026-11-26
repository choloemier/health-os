import { NextRequest, NextResponse } from "next/server";
import {
  addMealEntryData,
  deleteMealEntryData,
  getFullAppState,
  updateMealEntryData,
} from "@/lib/store-service";
import { getLocalDateISO } from "@/lib/date-utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fecha = String(body.fecha || getLocalDateISO());

    await addMealEntryData({
      fecha,
      bloque_horario: String(body.bloque_horario || "TARDE"),
      texto_original: body.texto_original ?? null,
      nombre: String(body.nombre || "Alimento"),
      multiplicador: Number(body.multiplicador) || 1,
      kcal: Math.max(0, Number(body.kcal) || 0),
      proteina: Math.max(0, Number(body.proteina) || 0),
      fibra: Math.max(0, Number(body.fibra) || 0),
      bandera_sodio_grasa: body.bandera_sodio_grasa ?? null,
      es_estimacion_ia: Boolean(body.es_estimacion_ia),
      recomendacion_ia: body.recomendacion_ia ?? null,
    });

    const state = await getFullAppState(fecha);
    return NextResponse.json(state);
  } catch (err) {
    console.error("Error adding meal entry:", err);
    return NextResponse.json({ error: "No se pudo registrar la comida" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const fecha = String(body.fecha || getLocalDateISO());
    await updateMealEntryData({
      id: String(body.id),
      nombre: String(body.nombre || "Alimento"),
      kcal: Number(body.kcal) || 0,
      proteina: Number(body.proteina) || 0,
      fibra: Number(body.fibra) || 0,
    });
    const state = await getFullAppState(fecha);
    return NextResponse.json(state);
  } catch (err) {
    console.error("Error editing meal entry:", err);
    return NextResponse.json({ error: "No se pudo editar la comida" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    const fecha = request.nextUrl.searchParams.get("fecha") || getLocalDateISO();
    if (id) {
      await deleteMealEntryData(id);
    }
    const state = await getFullAppState(fecha);
    return NextResponse.json(state);
  } catch (err) {
    console.error("Error deleting meal:", err);
    return NextResponse.json({ error: "No se pudo borrar el alimento" }, { status: 500 });
  }
}
