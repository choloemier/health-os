import { NextRequest, NextResponse } from "next/server";
import {
  deleteGymSetData,
  getFullAppState,
  logGymSetData,
  updateGymSetData,
} from "@/lib/store-service";
import { getLocalDateISO } from "@/lib/date-utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fecha = String(body.fecha || getLocalDateISO());

    await logGymSetData({
      fecha,
      workoutTemplateId: String(body.workoutTemplateId),
      exerciseTemplateId: String(body.exerciseTemplateId),
      varianteUsada: body.varianteUsada === "B" ? "B" : "A",
      pesoAsignadoKg: Math.max(0, Number(body.pesoAsignadoKg) || 0),
      pesoRealKg: Math.max(0, Number(body.pesoRealKg) || 0),
      reps: Math.max(0, Math.round(Number(body.reps) || 0)),
      sensacionRir: String(body.sensacionRir || "JUSTO"),
      esExpress: Boolean(body.esExpress),
    });

    const state = await getFullAppState(fecha);
    return NextResponse.json(state);
  } catch (err) {
    console.error("Error logging gym set:", err);
    return NextResponse.json({ error: "No se pudo guardar la serie" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const fecha = String(body.fecha || getLocalDateISO());
    await updateGymSetData({
      id: String(body.id),
      pesoRealKg: Number(body.pesoRealKg) || 0,
      reps: Number(body.reps) || 0,
      sensacionRir: body.sensacionRir ? String(body.sensacionRir) : undefined,
    });
    const state = await getFullAppState(fecha);
    return NextResponse.json(state);
  } catch (err) {
    console.error("Error updating gym set:", err);
    return NextResponse.json({ error: "No se pudo editar la serie" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    const fecha = request.nextUrl.searchParams.get("fecha") || getLocalDateISO();
    if (id) {
      await deleteGymSetData(id);
    }
    const state = await getFullAppState(fecha);
    return NextResponse.json(state);
  } catch (err) {
    console.error("Error deleting gym set:", err);
    return NextResponse.json({ error: "No se pudo eliminar la serie" }, { status: 500 });
  }
}
