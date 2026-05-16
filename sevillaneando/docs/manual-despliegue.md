# Manual de Despliegue

## 1. Objetivo

Este manual define el flujo completo para desplegar Sevillaneando en produccion y para cambiar entre entorno local y produccion sin modificar el codigo fuente.

## 2. Estrategia recomendada

Tres servicios independientes:

1. Base de datos gestionada (PostgreSQL + PostGIS).
2. Backend NestJS en plataforma PaaS (Render, Railway, Fly.io, Azure App Service...).
3. App movil compilada con EAS Build + EAS Update para actualizaciones OTA.

## 3. Cambiar entre local y produccion

Todo el cambio de entorno se gestiona **solo con variables de entorno**, sin tocar el codigo.

### 3.1 Backend

El backend lee automaticamente `.env.${NODE_ENV}`:

| Entorno | Comando | Fichero cargado |
| --- | --- | --- |
| Local | `npm run start:dev` | `apps/backend/.env.development` |
| Produccion | `npm run start:prod` | `apps/backend/.env.production` |

En produccion el proveedor PaaS inyecta las variables directamente (sin fichero `.env`); el fichero `.env.production` sirve como referencia/plantilla para saber que variables configurar en el panel del proveedor.

### 3.2 Frontend

El frontend carga el fichero `.env` de su raiz. Los scripts copian el fichero correcto antes de arrancar:

| Entorno | Comando | Fichero copiado a `.env` |
| --- | --- | --- |
| Local | `npm run start:dev` | `apps/frontend/.env.development` |
| Local (prod API) | `npm run start:prod` | `apps/frontend/.env.production` |
| Build EAS | `eas build --profile production` | Variables de EAS Secrets |

Para el build de produccion con EAS las variables **no se leen del `.env` local** sino de EAS Secrets (ver seccion 7).

## 4. Pre-requisitos

- Repositorio actualizado y versionado.
- Credenciales de Firebase (cliente y admin SDK).
- Variables de entorno definidas para backend y frontend.
- Cuenta Expo con acceso al proyecto para builds EAS.
- Cuenta en el proveedor PaaS elegido para el backend.

## 5. Despliegue de la base de datos

### Opcion A: proveedor gestionado (recomendado)

1. Crear una instancia PostgreSQL en Supabase, Neon, Railway u otro proveedor.
2. Verificar que el proveedor soporta la extension PostGIS o activarla manualmente:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

1. Guardar la cadena de conexion y las credenciales.

**Importante**: en produccion `synchronize` esta desactivado (TypeORM no crea ni altera tablas automaticamente). El schema se crea en el primer arranque del backend **solo si la base de datos esta vacia** gracias al seed. Si la BD ya tiene datos o `synchronize` esta desactivado y el schema no existe, hay que aplicarlo manualmente:

```bash
# Opcion rapida para TFG: activar synchronize=true en el primer arranque,
# luego desactivarlo. O ejecutar el backend una vez en modo development
# apuntando a la BD de produccion para que TypeORM cree las tablas.
NODE_ENV=development DATABASE_HOST=<prod-host> ... npm run start:dev
```

### Opcion B: contenedor propio

1. Desplegar imagen `postgis/postgis:15-3.3`.
2. Configurar volumen persistente.
3. Habilitar backups y politicas de acceso por IP o red privada.

## 6. Despliegue del backend (NestJS)

### 6.1 Build

```bash
cd apps/backend
npm install
npm run build:prod   # compila con NODE_ENV=production a dist/
```

### 6.2 Arranque

```bash
npm run start:prod   # NODE_ENV=production node dist/main.js
```

### 6.3 Variables de entorno de produccion

Configurar estas variables en el panel del proveedor PaaS (o en `.env.production` si se arranca manualmente):

```env
PORT=3000
NODE_ENV=production

# CORS: dejar vacio si solo hay clientes moviles nativos.
# Añadir el dominio si hay frontend web o acceso a Swagger desde navegador.
ALLOWED_ORIGINS=

DATABASE_HOST=
DATABASE_PORT=5432
DATABASE_USER=
DATABASE_PASSWORD=
DATABASE_NAME=
DATABASE_SSL=true

JWT_SECRET=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
# Incluir los \n literales dentro de comillas: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_PRIVATE_KEY=

TICKETMASTER_API_KEY=
GEMINI_API_KEY=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

SCRAPER_SYSTEM_UID=system-scraper-uid
SCRAPER_SYSTEM_EMAIL=scraper.bot@sevillaneando.local
SCRAPER_SYSTEM_NAME=Sevillaneando Bot
LEGACY_SCRAPER_EMAIL=mod@demo.com
```

### 6.4 Consideraciones operativas

- Exponer HTTPS obligatorio (el proveedor suele gestionarlo automaticamente).
- Habilitar soporte WebSocket para Socket.IO en el mismo dominio de la API.
- Configurar health checks apuntando a `/health` (el endpoint devuelve `{ status: 'ok' }`).
- Activar logs y metricas del proveedor.

## 7. Despliegue de la app movil con EAS

### 7.1 Configuracion inicial (una sola vez)

```bash
npm install -g eas-cli
eas login
cd apps/frontend
eas build:configure   # genera eas.json si no existe
```

### 7.2 Variables de entorno para el build

Las variables `EXPO_PUBLIC_*` deben configurarse como **EAS Secrets** para que se incluyan en el bundle compilado. El fichero `.env.production` local **no se usa** durante `eas build`.

```bash
# Configurar cada variable como secret en EAS:
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://tu-api.com"
eas secret:create --scope project --name EXPO_PUBLIC_SHARE_BASE_URL --value "https://tu-api.com/events"
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value "..."
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value "..."
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value "..."
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET --value "..."
# APP_ID de Android: 1:NNNNN:android:XXXX  /  iOS: 1:NNNNN:ios:XXXX
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_APP_ID --value "..."
```

Para listar los secrets existentes: `eas secret:list`

### 7.3 Build Android

```bash
eas build -p android --profile production
```

Genera un AAB listo para subir a Google Play Console.

### 7.4 Build iOS

```bash
eas build -p ios --profile production
```

Genera un IPA listo para subir a App Store Connect.

### 7.5 Actualizaciones OTA (sin nuevo build)

Para cambios en JS/assets sin necesidad de pasar por las tiendas:

```bash
eas update --branch production --message "descripcion del cambio"
```

La app descarga la actualizacion automaticamente en el siguiente inicio (configurado en `app.json` con `updates.checkAutomatically: ON_LOAD`).

## 8. Publicacion en tiendas

### Android

- Subir AAB a Google Play Console.
- Completar ficha, capturas, testers y rollout gradual.

### iOS

- Subir build a App Store Connect.
- Configurar TestFlight y enviar a revision de Apple.

## 9. Checklist de salida a produccion

- [ ] API responde en HTTPS con health check `GET /health` → `{ status: 'ok' }`.
- [ ] Conexion a base de datos estable y tablas creadas.
- [ ] `DATABASE_SSL=true` configurado en el backend.
- [ ] Autenticacion Firebase funcional en build release.
- [ ] Subida de imagenes funcional (Cloudinary).
- [ ] WebSocket (Socket.IO) accesible en el mismo dominio que la API.
- [ ] `EXPO_PUBLIC_API_URL` apunta a la URL HTTPS del backend (no a localhost).
- [ ] Secrets de EAS configurados correctamente antes del build.
- [ ] Endpoints criticos validados: auth, events, chat, recomendaciones.
- [ ] Variables secretas almacenadas fuera del repositorio (panel PaaS o EAS Secrets).
- [ ] Backups y monitoreo de la BD activos.

## 10. Plan de rollback

1. Mantener la version anterior desplegada y etiquetada en git (`git tag v1.x.x`).
2. Si falla la nueva release del backend, redeployar la imagen/commit previo en el proveedor PaaS.
3. Si falla la app movil, publicar un OTA con `eas update` que revierta a la version anterior, o forzar una nueva release desde la build previa.
4. Verificar conectividad a BD y estado de WebSockets tras el rollback.

## 11. Verificacion post-despliegue

Smoke tests manuales minimos:

- Login y registro de usuario.
- Listado de eventos y detalle.
- Creacion y edicion de evento.
- Chat de evento y mensaje privado.
- Subida de imagen en perfil o evento.

Revisar logs del proveedor durante los primeros 30 minutos tras el despliegue.
