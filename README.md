# Health OS — Sistema Operativo Personal de Salud, Gym y Nutrición con IA

Aplicación **Web + Móvil PWA (Single-User, Mobile-First, ADHD-Friendly)** construida con **Next.js (App Router), TypeScript, Tailwind CSS, Prisma + PostgreSQL y Google Gemini 2.5 Flash**, diseñada para operar **100% en capas gratuitas ($0/mes)** sin suscripciones ni servicios de pago.

---

## Puntos de Mejora Aplicados (Arquitectura & UX ADHD-Friendly)

1. **Stack 100% Gratuito y Resiliente (Zero Cost / Zero Lock-in):**
   - **IA Gratuita (`gemini-2.5-flash` en Google AI Studio):** Prompt compacto con salida JSON tipada (`responseSchema`) que consume mínimos tokens dentro de la cuota gratuita. Si aún no configuras `GEMINI_API_KEY` o te quedas sin señal, entra automáticamente un **estimador nutricional local de respaldo** con platos habituales (chaufa, pollo a la brasa, ceviche, tostadas con palta, huevos, avena, etc.).
   - **Auto-Seed Idempotente:** Además de `npm run db:seed`, el servidor verifica en el primer arranque si la base de datos está vacía y precarga automáticamente las 4 rutinas (22 ejercicios Plan A/B) y los 16 alimentos base sin duplicar registros.
   - **Modo Local Temporal de Previsualización:** Puedes probar toda la interfaz al instante incluso antes de pegar tu `DATABASE_URL`.
2. **Anticeguera Temporal + Gimnasio sin Fricción:**
   - **Wake Lock API + Web Audio API + Vibración Háptica:** El temporizador de descanso (`60s / 90s / 120s / 150s` y mini-timers cervicales `5s / 15s`) mantiene la pantalla encendida en el gimnasio y emite un acorde suave sintetizado localmente (sin archivos MP3 externos ni notificaciones push de pago).
   - **Persistencia de Borradores por Serie (`sessionStorage`):** Si cambias de app a Spotify/WhatsApp a mitad del ejercicio, el peso y las repeticiones ingresadas no se pierden.
   - **Sincronización al Enfocar (`visibilitychange`):** Al desbloquear el celular o pasar de la PC al móvil, refresca automáticamente el estado desde PostgreSQL.
3. **Salud Metabólica, Postural y Cero Culpa:**
   - **Cero Alertas Rojas Punitivas:** Paleta industrial de alto contraste (`Obsidian` + `Volt Lime` + `Sky` + `Warm Amber`) que siempre ofrece el siguiente paso accionable.
   - **Etiquetas Metabólicas Sutiles:** Destaca almidón resistente (*Papa amarilla enfriada*), Omega-3 (*Pescado azul/caballa*) y avisos sutiles de sodio/retención hídrica (*Encurtidos*, *Chaufa*, etc.) recomendando hidratación compensatoria.
   - **Backup Personal en 1 Clic:** Exportación directa de tu progreso en JSON desde la pestaña `Progreso`.

---

## 1. Obtener Credenciales 100% Gratuitas (Sin Tarjeta)

### A) Base de Datos PostgreSQL Gratis (Neon.tech — Recomendado)
1. Entra a [https://neon.tech](https://neon.tech) y crea una cuenta gratuita (Plan Free: 0.5 GB, suficiente para años de registros personales).
2. Crea un proyecto llamado `health-os` y copia el **Connection String** (`postgresql://...`).

### B) API Key Gratuita de Gemini (`gemini-2.5-flash`)
1. Entra a **Google AI Studio**: [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Haz clic en **"Create API Key"** (capa gratuita sin facturación requerida).
3. Copia tu clave `AIzaSy...`.

---

## 2. Instalación y Ejecución Local

```bash
# 1. Entrar al proyecto e instalar dependencias
cd health-os
npm install

# 2. Crear archivo .env a partir del ejemplo
cp .env.example .env
```

Edita `.env` con tus datos:

```env
DATABASE_URL="postgresql://usuario:password@ep-ejemplo.us-east-2.aws.neon.tech/neondb?sslmode=require"
APP_PIN="2580"
GEMINI_API_KEY="AIzaSyTuApiKeyGratuita..."
AUTH_SECRET="mi-frase-secreta-personal"
```

Sincroniza el esquema y precarga las rutinas + alimentos base:

```bash
# Crear tablas en PostgreSQL
npx prisma db push

# Ejecutar seed idempotente (4 rutinas Torso/Pierna A-B + 16 alimentos base)
npx prisma db seed

# Iniciar servidor de desarrollo
npm run dev
```

Abre `http://localhost:3000` e ingresa tu `APP_PIN` (por defecto `2580`). La cookie segura `HttpOnly` recordará tu dispositivo por **90 días**.

---

## 3. Despliegue Gratis en Vercel + Instalación PWA en Celular

1. Sube esta carpeta a un repositorio privado en GitHub.
2. En [https://vercel.com](https://vercel.com) (Plan Hobby Gratis), haz clic en **Add New → Project** e importa el repositorio.
3. En **Environment Variables**, agrega:
   - `DATABASE_URL`
   - `APP_PIN`
   - `GEMINI_API_KEY`
   - `AUTH_SECRET`
4. Haz clic en **Deploy** (`npm run build` ejecuta automáticamente `prisma generate && next build`).
5. **Instalar como App Nativa (PWA):**
   - **Android (Chrome):** Abre la URL desplegada → Menú `⋮` → **"Instalar aplicación"** / **"Agregar a la pantalla principal"**.
   - **iPhone (Safari):** Abre la URL desplegada → Botón **Compartir** → **"Agregar a inicio"**. Abrirá a pantalla completa en modo oscuro.
