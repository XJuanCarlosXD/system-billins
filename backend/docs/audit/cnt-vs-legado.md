# Auditoría CNT — clon vs legado (2026-07-02)

## Resumen

- 76 opciones de menú legacy inventariadas (memoria_contabilidad.md: 60 forms, 12 reportes).
- 21 vistas del clon (5 secciones) smoke-testeadas con Playwright en producción:
  **20 limpias, 1 bug encontrado y ARREGLADO** (autorizar-anterior).
- Balance de Comprobación **verificado contablemente**: mayo 2021 = 459
  cuentas, débitos = créditos = RD$ 43,714,543.14 (cuadre exacto);
  junio 2021 = 79 cuentas cuadradas.
- Cierre mensual: validado solo-render (regla de producción, NO ejecutado).
- **Hallazgo de negocio crítico** (no es bug del clon): ver abajo.

## ⚠️ Hallazgo de negocio: la contabilidad está en período JULIO 2021

`TCNT_PUNTO` (cia 01, punto 01): `ano_proceso=2021, mes_proceso=7`.
El último cierre registrado es junio 2021 (ejecutado el 2026-05-15 —
aparenta prueba durante el desarrollo del clon). **Hay ~5 años de cierres
contables sin procesar**; por eso el Balance/Mayor de 2022–2026 salen
vacíos: `TCNT_BCUENTA/HCUENTA` no tiene saldos posteriores.
Los asientos de los módulos operativos (FAT/CXC/CXP...) existen pero no se
han llevado al mayor. Ponerse al día = correr la cadena
generar-asiento → autorizar → actualizar → cierre por cada mes faltante
(coincide con el plan "Runner Cierres"). Decisión del negocio pendiente.

## Bug arreglado en esta auditoría

| Bug | Causa | Fix |
|-----|-------|-----|
| Vista Autorizar Meses Anteriores disparaba `GET /api/cnt/asientos/?no_cia=[object Object]...` → 500 | `cntAsientos({objeto})` pero la firma del método es posicional | llamada corregida a `cntAsientos(noCia, punto, a, m, {...})` |

## Mapeo legado → clon

### Configuración
| Legado | Clon (sección configuracion) | Estado |
|--------|------------------------------|--------|
| Mant. Compañías | companias | ✅ |
| Mant. Sucursales | sucursales | ✅ |
| Mant. Cuentas (catálogo) | catalogo (533 cuentas) | ✅ |
| Mant. Tipo De Cuenta | tipos-cuenta | ✅ |
| Mant. Centro de Costos | centros | ✅ |
| Mant. NCF / Tipos de NCF | ncf | ✅ |
| Asignar Cuenta a Sucursal | catalogo-sucursal | ✅ |
| Grupo Contable Sucursal | grupos-sucursal | ✅ |
| (períodos/cierres) | periodos | ✅ |
| Mant. Acceso / Desbloquear Usuario | /sistema/usuarios | ✅ |
| **Proyectos / Tipos / Componentes** | — | ❌ GAP |
| **Mant. Localidades** | — | ❌ GAP menor |
| **Mant. Departamentos** | — | ❌ GAP menor |
| **Mant. Dirección Administrativa** | — | ❌ GAP menor |
| **Equivalencia Catálogo Gubernamental** | — | ❌ GAP menor |
| Asignar Centros de Costos a Cuentas | (¿dentro de catálogo?) | ⚠️ verificar |

### Procesos
| Legado | Clon (sección procesos) | Estado |
|--------|--------------------------|--------|
| Entrada de Asientos | asientos + asiento-form | ✅ |
| Autorizar Asientos | autorizar | ✅ |
| Autorizar Asientos Meses Anteriores | autorizar-anterior | ✅ (bug arreglado hoy) |
| Actualizar Asientos | endpoint asientos/<n>/actualizar/ | ✅ |
| Actualizar Asientos Meses Anteriores | (mismo endpoint, sin pantalla dedicada) | ⚠️ parcial |
| Digitar/Actualizar Presupuesto | presupuesto | ✅ (sin datos 2026) |
| REP Verificación de Asientos (Rcnt210) | verificacion | ✅ pantalla |
| **Asientos en US$ (Entrada/Autorizar/Actualizar/Consulta — TCNT_*_US)** | — | ❌ GAP (eje multimoneda completo) |
| **Generar Entrada de Nómina / Modificar ED Nómina** | — (SDN genera por su lado) | ❌ GAP |
| **Generar/Aplicar Saldos Menores (CNT)** | — | ❌ GAP menor |
| **Modificar Componente al Histórico** | — | ❌ GAP menor (depende de Proyectos) |

### Consultas / Reportes
| Legado | Clon | Estado |
|--------|------|--------|
| Balance Comprobación/Situación | reportes/balance | ✅ verificado (cuadre exacto 2021) |
| Balance Comprobación Histórico | mismo balance con año/mes pasado | ✅ |
| Mayor General | reportes/mayor | ✅ |
| Consulta de Asiento | consultas/consulta-asientos | ✅ |
| Consulta Movimientos de Cuentas (Fcnt502) | consultas/movimientos | ✅ |
| Estados Financieros En Líneas | reportes/estados (Estado de Resultados) | ⚠️ PARCIAL |
| **Mant./Imprimir/Utilitario Anexos y EF (TCNT_LINEAS_EF...)** | — | ❌ GAP mayor (motor EF configurable) |
| **Gastos por Proyecto/Componente** | — | ❌ GAP (depende de Proyectos) |
| **PDFs catálogos (Rcnt301/310/311/312/317)** | — | ❌ GAP (pantallas sin imprimir) |
| **Histórico Asientos/Transacciones (Rcnt315/316) impreso** | consulta sí, PDF no | ⚠️ parcial |

### Cierre — validado SIN ejecutar
| Legado | Clon | Estado |
|--------|------|--------|
| Fcnt401 (cierre) | cierres/cierre-mensual | ✅ render + endpoint POST presente |
| Fcnt402 (cierre con utilidad retenida) | cierres/cierres (historial) | ✅ render |

## Gaps por severidad

### Mayores
- [ ] **Eje multimoneda US$** (TCNT_ASIENTO_US y familia): 4 formas legacy sin equivalente.
- [ ] **Motor de Estados Financieros configurable** (anexos, líneas EF,
  encabezados — TCNT_LINEAS_EF/ENCABEZADO_EF/CUENTAS_EF): el clon solo
  tiene un Estado de Resultados fijo.
- [ ] **PDFs de reportes CNT**: balance/mayor/catálogos/históricos sin impresión.

### Menores
- [ ] Proyectos + Tipos + Componentes + Gastos por Proyecto.
- [ ] Localidades, Departamentos, Dirección Administrativa (catálogos).
- [ ] Equivalencia catálogo gubernamental (Rcnt catalogo_gob).
- [ ] Pantalla dedicada "Actualizar Asientos Meses Anteriores".
- [ ] Integración Nómina→CNT (generar ED de nómina).

## Evidencia
- Smoke 21 vistas: sesión Playwright 2026-07-02.
- Balance: `GET /api/cnt/balance/?no_cia=01&punto=01&ano=2021&mes=5` →
  459 filas, D=C=43,714,543.14.
- Período: `GET /api/cnt/periodos/` → ano_proceso 2021 / mes_proceso 7;
  7 cierres históricos (2020-12 … 2021-06).
- Catálogo: 533 cuentas. Asientos junio 2026: existen (n≥5 en página 1).
