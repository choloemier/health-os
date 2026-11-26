import { NextRequest, NextResponse } from "next/server";
import { interpretMealWithGemini } from "@/lib/gemini-nutrition";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const texto = String(body.texto ?? "").trim();

    if (!texto || texto.length < 2) {
      return NextResponse.json(
        { error: "Describe brevemente qué comiste" },
        { status: 400 }
      );
    }

    const result = await interpretMealWithGemini(texto, {
      consumidoKcal: Number(body.consumidoKcal) || 0,
      metaKcal: Number(body.metaKcal) || 2050,
      consumidoProteina: Number(body.consumidoProteina) || 0,
      metaProteina: Number(body.metaProteina) || 135,
      consumidoFibra: Number(body.consumidoFibra) || 0,
      metaFibra: Number(body.metaFibra) || 30,
      horaActual: String(body.horaActual || "14:00"),
      entrenaHoy: Boolean(body.entrenaHoy),
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Error interpreting meal:", err);
    return NextResponse.json(
      { error: "No se pudo analizar la comida en este momento" },
      { status: 500 }
    );
  }
}
