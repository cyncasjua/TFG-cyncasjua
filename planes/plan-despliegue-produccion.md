# Plan de Despliegue a Producción — Sevillaneando (TFG, coste 0)

> Fecha: mayo 2026  
> Stack: NestJS + PostgreSQL/PostGIS · React Native (Expo) · Firebase · Cloudinary  
> Restricción: presupuesto cero, proyecto académico

---

## Distribución de la app: Expo Go (Android + iOS, gratis)

No se publica en ninguna tienda. En su lugar:

1. El tribunal instala **Expo Go** desde Google Play o App Store (app gratuita)
2. Tú publicas con `eas update` → genera un enlace y QR
3. El tribunal abre el enlace o escanea el QR con Expo Go → la app carga directamente

**Funciona en Android e iOS sin pagar nada.**

> Si alguna funcionalidad nativa falla en Expo Go (maps, notificaciones push), se genera un APK de Android como respaldo (ver Fase 5B).

---

## Arquitectura gratuita

```
[EAS Update — Expo]         (actualizaciones OTA gratis)
        |
  [Expo Go — enlace/QR]     (Android + iOS, sin tienda)
        |
   [App móvil]  ──────────►  [Render.com — NestJS API]
                                       |
                              [Supabase — PostgreSQL + PostGIS]
                              [Firebase Auth + Storage]  (plan Spark, gratis)
                              [Cloudinary]               (plan Free, gratis)
```

---

## Fase 1 — Base de datos: Supabase (ya hecho)

- Proyecto creado en Supabase
- PostGIS habilitado (`CREATE EXTENSION IF NOT EXISTS postgis`)
- Credenciales disponibles en Project Settings → Database

---

## Fase 2 — Backend: Render.com (gratis)

**Limitaciones del plan free:**
- El servicio se **duerme tras 15 minutos sin tráfico** (cold start ~30-60 seg)
- 750 horas/mes de ejecución
- WebSockets funcionan pero sin garantía de persistencia (suficiente para demos)

### 2.1 Dockerfile (ya creado)

`apps/backend/Dockerfile` y `apps/backend/.dockerignore` ya están en el repositorio.

El `main.ts` ya escucha en `process.env.PORT`, compatible con Render.

### 2.2 Variables de entorno en Render

En el panel de Render → Environment, añadir:

```
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=*

DATABASE_HOST=<host>.supabase.co
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=<contraseña-supabase>
DATABASE_NAME=postgres

FIREBASE_PROJECT_ID=sevillaneando-79df4
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@sevillaneando-79df4.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=<key-del-.env-local>

TICKETMASTER_API_KEY=<key>
GEMINI_API_KEY=<key>
CLOUDINARY_CLOUD_NAME=<name>
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>

SCRAPER_SYSTEM_UID=<uid-firebase>
SCRAPER_SYSTEM_EMAIL=<email>
SCRAPER_SYSTEM_NAME=SevillaBot
LEGACY_SCRAPER_EMAIL=<email>
```

### 2.3 Desplegar en Render

1. Subir cambios a GitHub (`Dockerfile` y `.dockerignore`)
2. Render.com → New → **Web Service**
3. Conectar repositorio GitHub
4. Configuración:
   - **Root Directory:** `sevillaneando/apps/backend`
   - **Runtime:** Docker
   - **Plan:** Free
5. Añadir variables de entorno
6. Deploy → URL tipo `https://sevillaneando-backend.onrender.com`

### 2.4 Verificar

```
GET https://sevillaneando-backend.onrender.com/health
```

Debe devolver `{ status: "ok" }`.

---

## Fase 3 — Cron jobs: cron-job.org (gratis)

Render Free duerme el servicio, por lo que los cron jobs internos de NestJS no se ejecutan solos. Solución: llamadas HTTP externas desde cron-job.org.

1. Crear cuenta gratuita en https://cron-job.org
2. Crear jobs:

| Job | URL | Horario |
|-----|-----|---------|
| Scraping | `https://<render-url>/scheduler/run-scraping` | Cada día 8:00 |
| Notificaciones | `https://<render-url>/scheduler/run-notifications` | Cada hora |
| Keep-alive | `https://<render-url>/health` | Cada 14 minutos |

El job de keep-alive evita que el servicio se duerma durante el período de la demo.

---

## Fase 4 — Frontend: preparar para EAS Update

### 4.1 Actualizar variables de entorno

En `apps/frontend/.env`:

```
EXPO_PUBLIC_API_URL=https://sevillaneando-backend.onrender.com
EXPO_PUBLIC_SHARE_BASE_URL=https://sevillaneando-backend.onrender.com/events
EXPO_PUBLIC_FIREBASE_API_KEY=<key>
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=<domain>
EXPO_PUBLIC_FIREBASE_PROJECT_ID=<id>
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=<bucket>
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<id>
EXPO_PUBLIC_FIREBASE_APP_ID=<appId>
```

### 4.2 Actualizar app.json

Cambiar el paquete anónimo por uno real:

```json
{
  "expo": {
    "name": "Sevillaneando",
    "slug": "sevillaneando",
    "version": "1.0.0",
    "runtimeVersion": {
      "policy": "sdkVersion"
    },
    "android": {
      "package": "com.sevillaneando.app",
      "versionCode": 1,
      "permissions": ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"]
    },
    "ios": {
      "bundleIdentifier": "com.sevillaneando.app"
    },
    "updates": {
      "url": "https://u.expo.dev/<EAS-PROJECT-ID>"
    }
  }
}
```

El `EAS-PROJECT-ID` se obtiene al ejecutar `eas init`.

### 4.3 Crear eas.json

Crear `apps/frontend/eas.json`:

```json
{
  "cli": {
    "version": ">= 16.0.0"
  },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    }
  },
  "update": {
    "channel": "production"
  }
}
```

---

## Fase 5A — Publicar con EAS Update (Expo Go)

```bash
npm install -g eas-cli
eas login                  # cuenta gratuita en expo.dev

cd apps/frontend
eas init                   # vincula el proyecto a Expo, genera EAS_PROJECT_ID
eas update --branch production --message "TFG demo"
```

Al terminar genera:
- Un enlace `exp.host/@tu-usuario/sevillaneando`
- Un QR para escanear con Expo Go

Compartir ese enlace con el tribunal. Lo abren con Expo Go (Android o iOS) y la app carga sin instalar nada más.

---

## Fase 5B — APK de respaldo (si algo falla en Expo Go)

Si alguna funcionalidad nativa no funciona en Expo Go (mapas, notificaciones):

```bash
eas build --platform android --profile preview
```

Genera un APK descargable por enlace directo. El tribunal lo instala en Android activando "orígenes desconocidos".

---

## Resumen de costes

| Servicio | Plan | Coste |
|----------|------|-------|
| Supabase (base de datos) | Free | 0 EUR |
| Render.com (backend) | Free | 0 EUR |
| cron-job.org (scheduler + keep-alive) | Free | 0 EUR |
| Firebase Auth + Storage | Spark (free) | 0 EUR |
| Cloudinary (imágenes) | Free | 0 EUR |
| EAS Update (Expo Go) | Free | 0 EUR |
| EAS Build (APK respaldo) | Free (30/mes) | 0 EUR |
| Google Play / App Store | No aplica | 0 EUR |
| **TOTAL** | | **0 EUR** |

---

## Checklist de despliegue

**Backend y base de datos:**
- [x] Cuenta en Supabase creada, proyecto en región EU
- [x] PostGIS habilitado en Supabase
- [x] Dockerfile creado en `apps/backend/`
- [x] `main.ts` escucha en `process.env.PORT`
- [ ] Push a GitHub con Dockerfile y .dockerignore
- [ ] Web Service creado en Render apuntando a `sevillaneando/apps/backend`
- [ ] Variables de entorno configuradas en Render
- [ ] `GET /health` responde 200 desde la URL de Render
- [ ] Jobs creados en cron-job.org (scraping, notificaciones, keep-alive)

**Frontend:**
- [ ] `apps/frontend/.env` con `EXPO_PUBLIC_API_URL` de Render
- [ ] `app.json` actualizado (paquete, runtimeVersion, updates.url)
- [ ] `eas.json` creado
- [ ] `eas init` ejecutado (obtener EAS_PROJECT_ID)
- [ ] `eas update --branch production` ejecutado sin errores
- [ ] Enlace/QR probado con Expo Go en Android e iOS
- [ ] Login funciona
- [ ] Mapa de eventos carga
- [ ] Chat en tiempo real funciona

---

## Orden de ejecución

```
1. [HECHO] Crear proyecto en Supabase + habilitar PostGIS
2. [HECHO] Crear Dockerfile en apps/backend
3. Push a GitHub
4. Crear Web Service en Render → añadir variables de entorno → Deploy
5. Verificar GET /health en la URL de Render
6. Crear jobs en cron-job.org (scraping, notificaciones, keep-alive cada 14 min)
7. Actualizar EXPO_PUBLIC_API_URL en apps/frontend/.env
8. Actualizar app.json y crear eas.json
9. eas init → eas update --branch production
10. Probar enlace Expo Go en Android e iOS
11. Si algo falla: eas build --platform android --profile preview (APK respaldo)
```

---

## Alternativa si Render falla con WebSockets

Si el chat en tiempo real no funciona en Render Free usar **Railway**:

- 5 USD de crédito gratis al mes (sin tarjeta, con cuenta GitHub)
- Soporta WebSockets de forma nativa
- Despliegue igual: conectar repo GitHub, configurar variables de entorno
- URL: https://railway.app
