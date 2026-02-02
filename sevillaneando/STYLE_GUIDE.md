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
- ESLint: detectar errores
- Prettier: formatear código
- TypeScript: validar tipos