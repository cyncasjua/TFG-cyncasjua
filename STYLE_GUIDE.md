# Guía de Estilo - Sevillaneando

## Reglas básicas
- Identación: 2 espacios
- Comillas: simples
- Punto y coma: siempre
- Longitud máxima: 100 caracteres
- Final de línea: Unix (LF)

**Final de línea Unix:**
Windows termina con `\r\n`, Unix con `\n`. Usamos Unix para que Git funcione igual en todos.

## Nombres
- Variables/funciones: camelCase
- Clases/Interfaces: PascalCase
- Constantes: UPPER_SNAKE_CASE
- Archivos: kebab-case

## TypeScript
- Tipos siempre explícitos
- No usar any

# Git y Commits
- feat: nueva funcionalidad
- fix: corrección de bug
- docs: documentación
- style: formato (sin cambios de lógica)
- refactor: refactorización
- test: tests
- chore: tareas menores

## Herramientas

### ESLint - Detecta errores
```bash
npm run lint        # Validar
npm run lint:fix    # Validar y corregir
```
### Prettier - Formatea código
```bash
npm run format      # Formatear
npm run format:check  # Verificar formato
```

### TypeScript - Valida tipos
```bash
npm run type-check  # Verificar tipos
```

## Flujo de Desarrollo

```
┌─────────────────────────────────────────────────────────────┐
│                   CAMBIOS EN EL CÓDIGO                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  npm run lint:fix      │ Detecta y corrige errores ESLint   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  npm run format        │ Formatea código con Prettier       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  npm run type-check    │ Valida tipos con TypeScript        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  git add .             │ Prepara cambios para commit        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  git commit -m         │ Commit con mensaje convencional    │
│  "feat: descripción"   │ feat|fix|docs|style|refactor|test  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  git push              │ Sube cambios al repositorio        │
└─────────────────────────────────────────────────────────────┘
```

### Checklist antes de Commit
- [ ] `npm run lint:fix` pasó sin errores
- [ ] `npm run format` formateó el código
- [ ] `npm run type-check` sin errores de tipos
- [ ] Mensaje de commit: Conventional commits
- [ ] Push a la rama
