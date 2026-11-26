import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { FOOD_PRESETS_SEED, WORKOUT_TEMPLATES_SEED } from "../src/lib/seed-data";

const connectionString = process.env.DATABASE_URL?.trim();
const prisma =
  connectionString && connectionString.includes("neon.tech")
    ? new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })
    : new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed idempotente de Health OS...");

  // 1. UserConfig base
  await prisma.userConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      calorias_meta: 2050,
      proteina_meta: 135,
      fibra_meta: 30,
      agua_meta: 2800,
      rutina_actual_index: 0,
    },
  });
  console.log("✅ UserConfig verificado (135g proteína, 30g fibra, 2.8L agua)");

  // 2. Rutinas de 4 días (Torso A, Pierna A, Torso B, Pierna B) con Plan A y Plan B
  for (const w of WORKOUT_TEMPLATES_SEED) {
    const workout = await prisma.workoutTemplate.upsert({
      where: { slug: w.slug },
      update: {
        nombre: w.nombre,
        enfoque: w.enfoque,
        orden: w.orden,
      },
      create: {
        slug: w.slug,
        nombre: w.nombre,
        enfoque: w.enfoque,
        orden: w.orden,
      },
    });

    for (const ex of w.ejercicios) {
      await prisma.exerciseTemplate.upsert({
        where: { slug: ex.slug },
        update: {
          workout_template_id: workout.id,
          nombre_plan_a: ex.nombre_plan_a,
          nombre_plan_b: ex.nombre_plan_b,
          reps_min: ex.reps_min,
          reps_max: ex.reps_max,
          es_unilateral: ex.es_unilateral ?? false,
          series_meta: ex.series_meta,
          descanso_seg: ex.descanso_seg,
          es_superserie: ex.es_superserie ?? false,
          grupo_superserie: ex.grupo_superserie ?? null,
          es_compuesto: ex.es_compuesto,
          peso_inicial_a: ex.peso_inicial_a,
          peso_inicial_b: ex.peso_inicial_b,
          orden: ex.orden,
        },
        create: {
          slug: ex.slug,
          workout_template_id: workout.id,
          nombre_plan_a: ex.nombre_plan_a,
          nombre_plan_b: ex.nombre_plan_b,
          reps_min: ex.reps_min,
          reps_max: ex.reps_max,
          es_unilateral: ex.es_unilateral ?? false,
          series_meta: ex.series_meta,
          descanso_seg: ex.descanso_seg,
          es_superserie: ex.es_superserie ?? false,
          grupo_superserie: ex.grupo_superserie ?? null,
          es_compuesto: ex.es_compuesto,
          peso_inicial_a: ex.peso_inicial_a,
          peso_inicial_b: ex.peso_inicial_b,
          orden: ex.orden,
        },
      });
    }
  }
  console.log("✅ 4 Rutinas (Torso/Pierna A-B) y 22 ejercicios con Plan A/B precargados");

  // 3. Alimentos Base (Chips 1-Tap)
  for (const food of FOOD_PRESETS_SEED) {
    await prisma.foodPreset.upsert({
      where: { slug: food.slug },
      update: {
        categoria: food.categoria,
        nombre: food.nombre,
        porcion_texto: food.porcion_texto,
        kcal: food.kcal,
        proteina: food.proteina,
        fibra: food.fibra,
        alerta_sodio: food.alerta_sodio ?? false,
        beneficio_tag: food.beneficio_tag ?? null,
        orden: food.orden,
      },
      create: {
        slug: food.slug,
        categoria: food.categoria,
        nombre: food.nombre,
        porcion_texto: food.porcion_texto,
        kcal: food.kcal,
        proteina: food.proteina,
        fibra: food.fibra,
        alerta_sodio: food.alerta_sodio ?? false,
        beneficio_tag: food.beneficio_tag ?? null,
        orden: food.orden,
      },
    });
  }
  console.log("✅ 16 Alimentos base (Proteínas, Carbohidratos, Vegetales/Grasas) precargados");
  console.log("🚀 Seed completado con éxito.");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
