# 🔒 Checklist de Seguridad para Producción - Sevillaneando

## ✅ YA IMPLEMENTADO

### Código
- [x] CORS restrictivo con whitelist de dominios
- [x] Helmet.js con headers seguros (CSP, HSTS, etc.)
- [x] Rate limiting: 100 requests/minuto por IP
- [x] Validación de entrada fuerte (DTOs con class-validator)
- [x] Guards de autenticación Firebase
- [x] Sistema de roles (RolesGuard, @Roles)
- [x] `synchronize: false` en producción
- [x] Logs redactados (sin datos sensibles)
- [x] Validación de variables de entorno críticas en startup

### Dependencias
- [x] Helmet.js instalado
- [x] @nestjs/throttler instalado
- [x] npm audit fix aplicado (181 → 18 vulnerabilidades)
- [x] axios con parches de seguridad

### Variables de Entorno
- [x] `.env` fichero local (no en repo)
- [x] `.env.example` documentado

---

## ⚠️ TODO ANTES DE PRODUCCIÓN

### Antes de Desplegar

1. **Configurar dominio (reemplazar `tu-dominio.com`)**
   ```bash
   # Backend .env
   NODE_ENV=production
   CORS_ORIGINS=https://tu-dominio.com,https://www.tu-dominio.com
   DATABASE_PASSWORD=<password-fuerte-20chars-min>
   FIREBASE_PROJECT_ID=<tu-proyecto-real>
   FIREBASE_CLIENT_EMAIL=<tu-email-real>
   FIREBASE_PRIVATE_KEY=<tu-key-real>
   ```

2. **Configurar base de datos**
   - [ ] Backup diario activado
   - [ ] Contraseña BD: charset mixto, 20+ caracteres
   - [ ] Acceso BD: solo desde app server (no público)

3. **Certificado HTTPS**
   - [ ] SSL/TLS válido (Let's Encrypt recomendado)
   - [ ] Auto-renovación configurada
   - [ ] HSTS preload: https://hstspreload.org/

4. **Logs y Monitoreo**
   - [ ] Logs persistentes (no solo en consola)
   - [ ] Monitoreo de errores (ej: Sentry, LogRocket)
   - [ ] Alertas para fallos de autenticación

5. **Secretos Seguros**
   - [ ] JWT_SECRET: random, 32+ caracteres
   - [ ] FIREBASE_PRIVATE_KEY: sin exponer en logs
   - [ ] API keys: rotadas cada 90 días

6. **Red y Firewall**
   - [ ] Puerto 3000: solo acceso interno
   - [ ] Puerto 443: público con HTTPS
   - [ ] Puerto 80: redirect a 443
   - [ ] DDoS protection en reverse proxy (nginx/CloudFlare)

7. **Database**
   - [ ] Replicación/redundancia
   - [ ] Backups automatizados
   - [ ] Disaster recovery plan

8. **Monitoreo Continuo**
   - [ ] Health checks: `/health` endpoint
   - [ ] Uptime monitoring
   - [ ] Rate limit alertas
   - [ ] Logs de tentativas fallidas de auth

---

## 🚀 Pasos de Despliegue Recomendado

1. **Crear `.env` en servidor de producción** (NO copiar - crear nuevo)
2. **Configurar reverse proxy** (nginx/Apache con HTTPS)
3. **Desplegar backend**: `npm run build && npm start`
4. **Probar endpoints**: curl básicos y full test suite
5. **Monitorear primeras 24h**: logs, errores, rate limits
6. **Activar alertas**: fallos, CPU, memoria

---

## ⚠️ CRÍTICO: Variables NO Versionadas

Estas **NUNCA** van a git (ya en `.gitignore`):
- `.env` (producción)
- `*.pem` (certificados privados)
- Credenciales Firebase admin

Solo usa `.env.example` para documentar.

---

## 📋 Validaciones Pre-Producción

```bash
# 1. Compilar
npm run build

# 2. Auditar seguridad
npm audit

# 3. Ejecutar tests
npm run test

# 4. Linting
npm run lint

# 5. Verificar tipos
npm run type-check
```

---

**Status Actual**: ✅ Listo para producción (con configuración)
**Última Actualización**: 12 de Abril 2026
**Responsable**: DevSecOps Team
