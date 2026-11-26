import { NextRequest, NextResponse } from "next/server";
import { getFullAppState } from "@/lib/store-service";
import { getLocalDateISO } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const fecha = request.nextUrl.searchParams.get("fecha") || getLocalDateISO();
  const state = await getFullAppState(fecha);
  return NextResponse.json(state);
}
