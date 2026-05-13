# Dashboard y alertas NCF

## Propósito

Pantalla principal del clon. Muestra al usuario el estado real de su sistema:
empresas configuradas, módulos donde tiene acceso, y rangos NCF cerca de
agotarse. Replica la alarma de NCF que el sistema viejo ya tenía.

## Cómo se usa

- Ruta: `/` (después del login).
- KPIs arriba (4 tarjetas):
  - **Empresas activas** — cuenta empresas con `ACTIVA='S'` en `FAT.TFAT_CIAS`.
  - **Módulos con acceso** — cuántos módulos distintos tienen al menos una entrada activa para el usuario.
  - **NCF críticos** — rangos donde quedan ≤ 25% del rango total.
  - **NCF en aviso** — rangos donde quedan ≤ `cant_min_ncf` configurado.
- Panel **Alertas NCF**: lista cada rango en alerta con código, empresa, próximo número, disponibles, mínimo configurado y color por severidad (rojo crítico / amarillo aviso).
- Panel **Empresas**: las 5 (o las que estén activas) con su RNC.
- Panel **Mis accesos por módulo y empresa**: tarjetas por cada `(módulo, empresa, punto)` con `por_defecto` resaltado.
- Botón **Refrescar**: vuelve a llamar a los endpoints.

## Endpoints HTTP

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/api/me/` | autenticado | empresas + módulos + flag admin |
| GET | `/api/fat/ncf/?no_cia=&punto=` | autenticado con permiso FAT | NCF + tipos doc por empresa/punto |
| GET | `/api/fat/ncf/alerts/?level=low\|critical\|all` | autenticado | rangos NCF en alerta de todas las empresas |

## Cálculo de severidad

Para cada rango `(NCF_INICIAL, NCF_FINAL, PROX_NCF, CANT_MIN_NCF)`:

```
disponibles = max(0, NCF_FINAL - PROX_NCF + 1)
total       = NCF_FINAL - NCF_INICIAL + 1
critical    = (disponibles / total) <= 0.25
low_stock   = CANT_MIN_NCF > 0 AND disponibles <= CANT_MIN_NCF
severity    = critical ? 'critical' : (low_stock ? 'warning' : 'ok')
```

## Modelo de datos relevante

- `CNT.TCNT_NCF` — rangos por (`NO_LOCALIDAD`, `CODIGO_NCF`).
- `FAT.TFAT_CIAS` — empresas con descripción y RNC.
- `T<MODULE>_USUARIO` — accesos por usuario (módulo × cía × punto).

## Casos de prueba mínimos

1. Cargar dashboard como JCABREU → ve 5 empresas y al menos 9 alertas (datos reales actuales).
2. Refrescar → KPIs se actualizan.
3. Filtrar `/api/fat/ncf/alerts/?level=critical` → solo regresa los rojos (≥ 6 hoy).
4. Usuario sin acceso a FAT en una empresa → no recibe esa alerta filtrada por permisos.
