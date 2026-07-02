# Auditoría CXP — clon vs legado (2026-07-02)

## Resumen

- 30 opciones de menú legacy inventariadas (memoria_cuentas_por_pagar.md).
- 28 rutas del clon smoke-testeadas con Playwright contra producción
  (Netlify + backend hopto.org): **0 errores de consola, 0 fallos de API, 0 404**.
- **22 con paridad funcional verificada** (varias con datos reales).
- **3 bugs encontrados y ARREGLADOS durante la auditoría** (ver abajo).
- **4 gaps abiertos** (1 mayor, 3 menores).
- Cierre mensual: validado solo-render según regla de producción (NO ejecutado).

## Bugs arreglados en esta auditoría

| Bug | Causa | Fix |
|-----|-------|-----|
| Formato 606 devolvía 0 filas siempre | filtro `tipo_movi='Credito'` (la columna guarda `'C'`) | `tipo_movi='C'` → junio 2026: 166 compras, RD$ 1,395,442.22, ITBIS 163,125.13 |
| Formato 607 devolvía 0 filas siempre | filtro `tipo_movi='Debito'` + las retenciones se registran en la factura (`'C'`), no en el pago | `tipo_movi='C'` → junio 2026: 1 retención ISR RD$ 1,777.78 |
| Entrada de documentos moría con ORA-01722 al calcular el próximo número | `MAX(TO_NUMBER(no_docu))` sobre `no_docu` no numéricos migrados | filtro `REGEXP_LIKE(no_docu,'^[0-9]+$')` — guardado verificado end-to-end con rollback |

(Además, los fixes sistémicos previos del mismo día aplican a CXP: CSRF
`/api/`, binds thick-mode `client.nbinds`, permisos por tipo de documento.)

## Mapeo legado → clon

### Configuración — paridad completa
| Legado | Clon | Estado |
|--------|------|--------|
| Fcxp101 Compañías | /cxp/cias | ✅ |
| Fcxp102 Puntos de Trabajo | /cxp/puntos | ✅ |
| Fcxp103 Acceso al Sistema | /cxp/usuarios + /sistema/usuarios | ✅ (docs por tipo arreglado hoy) |
| Fcxp104 Tipos de Documento | /cxp/tdocu | ✅ |
| Fcxp105 Tipos de Proveedor | /cxp/tproveedores | ✅ |
| Fcxp106 Proveedores | /cxp/proveedores | ✅ 444 proveedores |
| Fcxc111/112 Ciudades/Barrios | /cxp/ciudades, /cxp/barrios | ✅ |

### Procesos
| Legado | Clon | Estado |
|--------|------|--------|
| Fcxp203 Entrada Documentos DR/CR | /cxp/entrada-documentos | ✅ guardado verificado (rollback) |
| Fcxp202/204 Generar/Aplicar Saldos Menores | /cxp/saldos-menores | ✅ render + endpoint |
| Fcxp213 Liberar Débito | /cxp/liberar-debito | ✅ |
| Fcxp214 Bloquear/Desbloquear Pago | /cxp/bloquear-pago | ✅ |
| — (extra clon) Reversar Documento | /cxp/reversar | ✅ |
| **Fcxp207 Procesar Solicitud de Pago** | **NO EXISTE** | ❌ GAP |
| **Fcxp209 Generar Solicitud a Cheque** | **NO EXISTE** | ❌ GAP |

### Consultas/Reportes
| Legado | Clon | Estado |
|--------|------|--------|
| Fcxp501 Consulta Documentos DR/CR | /cxp/documentos | ✅ |
| Fcxp502 Consulta CxP | /cxp/cuentas + /cxp/estado-cuenta | ✅ |
| Fcxp503/Rcxp503 Movimientos Proveedores | /cxp/movimientos + /cxp/rep-movimientos | ✅ |
| Fcxp310/Rcxp308/310 Antigüedad Saldos | /cxp/envejecimiento | ✅ 54 filas |
| Fcxp301 Mayor Auxiliar | /cxp/rep-mayor | ✅ 188 movs junio |
| Rcxp306 Saldo Proveedores | /cxp/rep-alfabetico | ✅ 442 filas |
| Fcxp307/308 Formato 606 | /cxp/rep-606 | ✅ (arreglado hoy) |
| — Formato 607 | /cxp/rep-607 | ✅ (arreglado hoy) |
| Fcxp309 Certificado Retención | /cxp/rep-retenciones | ✅ (por año) |
| — Cuadre Contable | /cxp/rep-cuadre | ✅ |

### Cierre/Control — validado SIN ejecutar
| Legado | Clon | Estado |
|--------|------|--------|
| Fcxp401 Impresión Entrada de Diario | /cxp/asiento-contable | ✅ render |
| Fcxp402/403 Cierre | /cxp/generar-asiento + /cxp/cierre | ✅ render + endpoints presentes; ejecución NO probada (producción) |

## Gaps por severidad

### Mayores
- [ ] **Solicitudes de pago (Fcxp207 + Fcxp209)**: el flujo legado
  "generar solicitud a cheque → procesar solicitud de pago" (puente CxP→CHC,
  tablas TCXP_SOLICITUD*/TCHC_*) no existe en el clon. Hoy los pagos habría
  que digitarlos directo en CHC.
- [ ] **PDFs de reportes**: el legado imprime ~10 .rep (rcxp201/202/204/205/208,
  Rcxp306/308/310/311, Rcxp503). El clon solo tiene 2 print-data
  (documento, estado-cuenta). Las pantallas rep-* muestran datos pero
  no imprimen.

### Menores
- [ ] Fcxp110 "Asignar/Cambiar Cuenta Bancaria" de proveedor — sin pantalla.
- [ ] Fcxp107 "Asignar Proveedores a Puntos" — sin pantalla.
- [ ] Fcxp108 "Tipos Costos/Gastos DGII" — endpoint `/api/cxp/tipos-gasto/`
  existe pero sin CRUD UI.
- [ ] Export TXT formato DGII exacto de 606/607 (los .txt del legado en
  capturas/): verificar layout de columnas contra `cxp-export.ts`.
- [ ] `features/cxp/cxp-placeholder.tsx` es código muerto (nada lo importa).

### Sin evidencia (memoria legacy sin menu-code)
- Fcxp205, Fcxp206, Fcxp210, Fcxp212, Fcxp208 — formas secundarias sin
  nombre de menú en la memoria; requieren abrir el legado para clasificarlas.

## Evidencia
- Smoke 28 rutas: sesión Playwright 2026-07-02 (consola/red limpias).
- 606: `GET /api/cxp/rep-606/?no_cia=01&anio=2026&mes=6` → 166 filas.
- 607: ídem → 1 fila (RNC 00101981603, ISR 1,777.78).
- Entrada: `cxp_repo.entrada_documento` probe con commit suprimido → no_docu 2006392.
- Datos base: TCXP_DOCUMENTO junio/2026 cia 01 = 190 docs (165 C / 25 D).
