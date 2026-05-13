# Inventario módulos activos Regal General

Solo los 9 módulos en uso real. Datos extraídos de `JCABREU@AB` el 2026-05-06.

## Resumen

| # | Módulo | Schema | Tablas | Columnas | FMX | REP | Usuarios activos | Descripción |
|---|---|---|---|---|---|---|---|---|
| 1 | Facturación | FAT | 76 | 1024 | 175 | 109 | 35 | facturas, NCF/eCF, conduces, devoluciones |
| 2 | Órdenes Compra | ODC | 8 | 60 | 19 | 9 | 25 | requisiciones, OC, cotizaciones, autoriz. |
| 3 | Cuentas x Pagar | CXP | 30 | 350 | 44 | 30 | 23 | proveedores, retenciones, NCF informales |
| 4 | Inventario | INV | 63 | 700 | 82 | 82 | 23 | productos, lotes, seriales, transferencias |
| 5 | Cuentas x Cobrar | CXC | 50 | 580 | 81 | 154 | 22 | clientes, cobros, rutas, financiamiento |
| 6 | Bancos / Cheques | CHC | 37 | 350 | 56 | 93 | 15 | conciliación, caja, transferencias |
| 7 | Nómina | SDN | 89 | 994 | 104 | 50 | 13 | RRHH, AFP, ARS, ISR, prestaciones |
| 8 | Contabilidad | CNT | 63 | 600 | 59 | 50 | 11 | catálogo, asientos, estados, cierres |
| 9 | Caja Chica | ACC | 15 | 100 | 24 | 11 | 6 | múltiples cajas por sucursal |

**Totales:** 431 tablas, 5241 columnas, 644 FMX, 588 REP, 173 usuarios distintos en uso.

## Schemas auxiliares

- **GUIA** (3 tablas): `TGUIA`, `TGUIAL`, `TGUIA_ACCESO` — guías de despacho/conduces. Mantener — está integrado con FAT.
- **MAN** (2 tablas): mantenimiento utilitario — revisar si está en uso real.
- **ABREGONZA** (5 tablas): customizaciones específicas del cliente — `TCXC_BARRIO_ABREGONZA`, `TCXC_CIUDAD_ABREGONZA`, `TCXC_CLIENTE_ABREGONZA`, `TCXC_TCLI_ABREGONZA`, `TCXP_DPROVEEDOR_ABREGONZA`. **Crítico replicar.**

## Módulos descartados (sin uso)

- ❌ **SMT** Mercancía en Tránsito / Importaciones — 0 usuarios activos
- ❌ **ACF** Activos Fijos — 0 usuarios
- ❌ **MPR** Producción — 0 usuarios

## PL/SQL servidor (mínimo)

Solo 28 objetos en BD (lógica vive en Forms):
- CNT 16 (6 funciones, 1 procedure, 9 triggers de validación de usuario, 2 views)
- INV 4 (triggers de impuesto, almacén, usuario; 1 view)
- SDN 2 (triggers HORAS_AUTORIZADAS y INSERTA_USUARIO_LS)
- FAT 1 trigger (USUARIO_MODI_CONDUCE) + 1 view (VFAT_DOCU_PROYECTO)

Dump completo: `legacy_dumps/plsql/all_sources.sql` (4941 líneas).

## Modelo de auth y permisos

- **Auth:** usuario Oracle nativo. Login del clon nuevo = `oracledb.connect(user, password, dsn)`.
- **~50 usuarios** humanos activos en Oracle (todos `ACCOUNT_STATUS=OPEN`).
- **Permisos:** una tabla `TXXX_USUARIO` por módulo con clave `(NO_CIA, PUNTO, USUARIO)` + flags S/N por acción específica + tabla detalle `TXXX_USUARIOD` por tipo de documento.
- **7 niveles:** Empresa → Punto/Sucursal → Módulo → Usuario → Tipo doc → Acción → Recurso (almacén/cajero/cliente).
- **Particularidad ODC:** `AUTORIZACION_1/2/3` con `MONTO_MINIMO/MAXIMO` (3 niveles de aprobación por monto).

Matriz exportada: `legacy_dumps/sql/permisos_columnas.csv`.

## Ubicación física de los binarios

```
D:\\RegalGeneral\gpsc\
  Fat\Formas\*.fmx     (175 archivos)
  Fat\Reportes\*.rep   (109)
  Sdn\Formas\*.fmx     (104)
  Sdn\Reportes\*.rep   (50)
  Cxc\Formas\*.fmx     (81)
  ...
```

**FMB y RDF (fuentes): NO encontrados en D:\\RegalGeneral ni rutas comunes de C:\.** Pendiente confirmar con el cliente si están en otro lugar (USB, backup, GP Software).

## Lista completa de usuarios humanos detectados

50 usuarios Oracle reales (`ACCOUNT_STATUS=OPEN`): AALBURQUERQUE, ABREGONZA, ACASTRO, ACLASE, ADOLIVIER, ADOLORES, AOLIVER, AOLIVIER, ARAMIREZ, BCARABALLO, BDELACRUZ, CLEYBA, CMORA, DABREU, DRODRIGUEZ, ECLASE, EGOMEZ, EPAULINO, IBIEL, ICUEVAS, IMARTINEZ, JBAEZS, JCABREU, JDIAZ, JSANTOS, JVALLEJO, LDEJESUS, LDESUS, LHERNANDEZ, LLGONZALEZ, LSEGUNDO, MDAVID, MDELACRUZ, MLIRIANO, MPENA, MPILAR, PABREU, RABREU, RABREUG, RCASTILLO, RHERRERA, RLEON, RMMCONSULTING, RPAGAN, SABREU, SESPINAL, UPENA, VRODRIGUEZ, YMORALES (+ JCABREU como DBA).

Locked: LGONZALEZ.

## Tipos de documento por módulo

48 columnas en tablas TXXX_TDOCU:
- ACF, CHC, CXC, CXP, FAT, INV, MPR(descartado), SMT(descartado): cada uno tiene su tabla de tipos. Detalle en `legacy_dumps/active/document_types.csv`.

## Foreign keys

163 FKs entre tablas (mayoría dentro del mismo schema). Detalle en `legacy_dumps/active/fkeys.csv`.

## Lo que falta para cerrar Fase 1

Estos son los puntos que **no se pueden extraer automáticamente** y requieren acción del cliente:

1. **Confirmar fuentes FMB/RDF** (o aceptar clon comportamental).
2. **Generar golden files DGII** ejecutando los reportes 606, 607, 608, E31-E47 en Regal General para un período de prueba y guardando los archivos en `legacy_dumps/dgii/samples/`.
3. **Generar samples integraciones externas:** correr en Regal General los archivos AFP, ARS, ACH, retenciones para un mes real y guardarlos en `legacy_dumps/integraciones/`.
4. **Capturas de impresión:** PNG/PDF de cómo se ven hoy las facturas, cheques, recibos. Guardar en `legacy_dumps/impresion/`.

Yo no puedo correr Forms desde la línea de comandos — esos pasos los hace una persona usando el sistema.
