# Manual de Despliegue

## 1. Objetivo
Este manual define un flujo de despliegue para:
- Backend NestJS.
- Base de datos PostgreSQL/PostGIS.
- App movil Expo (Android/iOS).

## 2. Estrategia recomendada
Separar en tres servicios:
1. Base de datos gestionada (PostgreSQL).
2. Backend en plataforma PaaS (Render, Railway, Fly.io, Azure App Service).
3. App movil compilada con EAS Build.

## 3. Pre-requisitos
- Repositorio actualizado y versionado.
- Credenciales de Firebase (cliente y admin).
- Variables de entorno definidas para backend y frontend.
- Cuenta Expo para builds (EAS).

## 4. Despliegue de la base de datos
### Opcion A: proveedor gestionado
1. Crea una instancia PostgreSQL.
2. Si necesitas funciones espaciales avanzadas, asegura soporte PostGIS.
3. Guarda credenciales y cadena de conexion.

### Opcion B: contenedor propio
1. Despliega imagen postgis/postgis:15-3.3.
2. Configura volumen persistente.
3. Habilita backups y politicas de acceso por IP/red privada.

## 5. Despliegue del backend (NestJS)
### 5.1 Build y arranque
Comandos base:

```bash
npm install
npm run build
node dist/main.js
```

### 5.2 Variables de entorno de produccion

```env
NODE_ENV=production
PORT=3000

DATABASE_HOST=
DATABASE_PORT=5432
DATABASE_USER=
DATABASE_PASSWORD=
DATABASE_NAME=

JWT_SECRET=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

TICKETMASTER_API_KEY=
GEMINI_API_KEY=
SCRAPER_SYSTEM_UID=system-scraper-uid
SCRAPER_SYSTEM_EMAIL=scraper.bot@sevillaneando.local
SCRAPER_SYSTEM_NAME=Sevillaneando Bot
LEGACY_SCRAPER_EMAIL=mod@demo.com
```

### 5.3 Consideraciones operativas
- Exponer HTTPS obligatorio.
- Permitir WebSocket para Socket.IO en el mismo dominio de la API.
- Configurar health checks del proveedor.
- Activar logs y metricas.

## 6. Despliegue app movil con Expo (EAS)
### 6.1 Configuracion inicial

```bash
npm install -g eas-cli
eas login
cd apps/frontend
eas build:configure
```

Esto genera el archivo eas.json si no existe.

### 6.2 Variables para build
Definir en EAS Secrets o entorno:

```env
EXPO_PUBLIC_API_URL=https://tu-api.com
EXPO_PUBLIC_SHARE_BASE_URL=https://tu-dominio-de-enlaces

EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

### 6.3 Build Android

```bash
eas build -p android --profile production
```

### 6.4 Build iOS

```bash
eas build -p ios --profile production
```

## 7. Publicacion
### Android
- Subir AAB a Google Play Console.
- Completar ficha, testers y rollout.

### iOS
- Subir build a App Store Connect.
- Configurar TestFlight y envio a revision.

## 8. Checklist de salida a produccion
- API responde en HTTPS.
- Conexion a base de datos estable.
- Autenticacion Firebase funcional en release.
- Subida de imagenes funcional.
- Endpoints criticos validados (auth, events, chat, recomendaciones).
- Variables secretas almacenadas fuera del repositorio.
- Backups y monitoreo activos.

## 9. Plan de rollback
1. Mantener la version anterior desplegada y etiquetada.
2. Si falla la nueva release, revertir a la imagen/commit previo.
3. Verificar conectividad DB y estado de colas/sockets tras rollback.

## 10. Verificacion post-despliegue
- Smoke tests manuales:
  - Login/registro.
  - Listado de eventos.
  - Creacion/edicion de evento.
  - Chat de evento y mensaje privado.
- Revisar errores en logs durante los primeros 30 minutos.
- Confirmar uso correcto de EXPO_PUBLIC_API_URL en cliente release.