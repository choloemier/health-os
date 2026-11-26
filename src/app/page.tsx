import { HealthOsDashboard } from "@/components/HealthOsDashboard";
import { getLocalDateISO } from "@/lib/date-utils";
import { getFullAppState } from "@/lib/store-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const fecha = getLocalDateISO();
  const initialState = await getFullAppState(fecha);

  return <HealthOsDashboard initialState={initialState} />;
}
