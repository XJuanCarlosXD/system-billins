# Pantalla de documentación

## Propósito

Centralizar toda la documentación del proyecto dentro de la propia app, con
buscador, para que cualquier usuario (sobre todo el cliente) pueda leer cómo
funciona cada módulo sin salir a leer el repo.

## Cómo se usa

- Ruta: `/docs`.
- Sidebar: **Sistema → Configuración → Documentación** (también visible en menú principal).
- Layout:
  - Lista lateral con todos los .md disponibles.
  - Panel principal con el contenido renderizado del seleccionado.
  - Buscador arriba (busca en el título y en el contenido — server-side).
- Cuando hay match, se resaltan fragmentos con número de línea.

## Cómo se agrega/actualiza una doc

1. Crear/editar un `.md` en `backend/docs/` con la convención `NN_nombre.md`.
2. Primer línea recomendada: `# Título` (se usa como título mostrado).
3. La pantalla `/docs` la recoge automáticamente (no hace falta tocar código).
4. **Regla del proyecto:** cada feature/módulo nuevo aporta su .md aquí.

## Endpoints HTTP

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/api/docs/?q=` | autenticado | lista de docs (con `matches[]` cuando hay `q`) |
| GET | `/api/docs/<slug>/` | autenticado | contenido de un doc |

## Casos de prueba mínimos

1. Listar todos los docs → al menos los del proyecto base.
2. Buscar `NCF` → varios matches en docs de FAT y de docs general.
3. Slug inválido → 400.
4. Slug inexistente → 404.
