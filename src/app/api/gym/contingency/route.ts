import { NextRequest, NextResponse } from "next/server";
import { getFullAppState, handleGymContingencyData } from "@/lib/store-service";
import { getLocalDateISO } from "@/lib/date-utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fecha = String(body.fecha || getLocalDateISO());

    await handleGymContingencyData({
      fecha,
      action: body.action,
      workoutTemplateId: body.workoutTemplateId,
      routineIndex: body.routineIndex,
    });

    const state = await getFullAppState(fecha);
    return NextResponse.json(state);
  } catch (err) {
    console.error("Error handling gym contingency:", err);
    return NextResponse.json({ error: "No se pudo ajustar la sesión" }, { status: 500 });
  }
}
