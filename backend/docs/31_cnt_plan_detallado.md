# Plan CNT detallado

## Objetivo

Replicar las capacidades de contabilidad del legado con una UI mas amigable,
una sola ruta de entrada y un area de trabajo full width usando solo los
componentes de la plantilla del proyecto.

No hace falta copiar el menu viejo 1:1. La regla es que cada funcion exista y
haga lo mismo que en el sistema anterior, pero con una navegacion mas simple y
una presentacion mas limpia.

La regla es esta:

1. La empresa y el punto se eligen una sola vez desde el sidebar.
2. Las pantallas CNT consumen esa seleccion como contexto global.
3. Cada pantalla valida contra Oracle con la misma query que el legado o con
   la ruta API equivalente.
4. Los reportes deben salir en pantalla y, cuando aplique, en PDF y Excel.

## Fuentes que mandan

- Memorias del proyecto:
  - `project_sigaf_progress.md`
  - `project_sigaf_modules.md`
  - `project_sigaf_permissions.md`
- Base de datos y descubrimiento:
  - `02_base_de_datos.md`
  - `10_inventario_modulos_activos.md`
  - `11_inventario_fat_ncf.md`
- Plan maestro:
  - `30_plan_maestro_modulos.md`
- Capturas del legado:
  - carpeta `C:\\Users\\JCABREU\\screenshots\\` en esta maquina, para comparar
    menu, densidad, texto y flujo

## Capacidades CNT del legado que se deben cubrir

Las opciones de abajo son la referencia funcional del sistema viejo. La UI
puede agruparlas, simplificarlas o reorganizarlas, mientras no pierda ninguna
capacidad.

### Configuracion

- Companias
- Puntos de Trabajo o Sucursales
- Acceso de Usuarios al Modulo
- Tipo de Cuenta
- Cuentas del Catalogo
- Asignar Cuenta a Sucursal
- Grupo Contable Sucursal
- Catalogo Centro de Costos
- Asignar Centros de Costos a Cuentas
- Tipo de Proyectos
- Proyectos
- Componentes de Proyectos
- Localidades
- Mantenimiento NCF
- Desbloquear Usuario

### Procesos

- Entrada de Diario
- Rep. Verificacion de Asientos
- Autorizar Asientos
- Actualizar Asientos
- Procesos Meses Anteriores
  - Apertura
  - Reverso
  - Cierre
- Presupuesto
  - Presupuesto Inicial
  - Ajustes
  - Ejecucion
- Modificar ED de Nomina
- Generar Entrada de Nomina
- Transacciones en US
  - Consulta
  - Registro
  - Ajuste

### Consultas

- Consulta de Asiento
- Consulta Movimientos de Cuentas

### Reportes

- Catalogo de Cuentas Corporativo
- Catalogo de Cuentas por Sucursal
- Catalogo Centros de Costos
- Listado de Cuentas con Centros de Costos
- Catalogo de Proyectos
- Balance de Comprobacion / Balance Situacion
- Mayor General
- Balance de Comprobacion / Bal. de Situacion Hist.
- Estados Financieros / Anexos / Presupuesto
  - Balance General
  - Estado de Resultados
  - Anexos
- Gastos por Proyecto/Componente
- Historico de Transacciones
- Historico de Asientos
- Estados Financieros en Lineas (Preliminares)

### Cierres

- Cierre Mensual
- Cierre Anual

## Fuera de alcance de CNT

Estos top-level menus pertenecen al shell global del sistema y no entran en el
plan CNT simplificado:

- Acceso
- Salir
- Sigaf
- Window

## Pantallas que ya existen y deben respetarse

- `frontend/src/features/cnt/catalogo.tsx`
- `frontend/src/features/cnt/asientos.tsx`
- `frontend/src/features/cnt/asiento-form.tsx`
- `frontend/src/features/cnt/balance.tsx`
- `frontend/src/features/cnt/mayor.tsx`
- `frontend/src/features/cnt/ncf.tsx`
- `frontend/src/features/cnt/periodos.tsx`
- `frontend/src/features/cnt/centros-costo.tsx`

## Pantallas que faltan y que se deben crear

- Companias y puntos
- Acceso de usuarios al modulo
- Tipo de cuenta
- Asignar cuenta a sucursal
- Grupo contable sucursal
- Asignar centros de costo a cuentas
- Tipo de proyectos
- Proyectos
- Componentes de proyectos
- Localidades
- Desbloquear usuario
- Verificacion de asientos
- Autorizar asientos
- Actualizar asientos
- Procesos de meses anteriores
- Presupuesto
- Modificar ED de nomina
- Generar entrada de nomina
- Transacciones en US
- Consulta de asiento
- Consulta de movimientos de cuentas
- Catalogos y reportes faltantes
- Cierres mensual y anual
- Perfiles y permisos dentro de CNT si el menu del legado lo expone

## Ruta UI de validacion

- Entrada principal: `/_authenticated/cnt`
- Cambio de contexto:
  - empresa activa desde sidebar
  - punto activo desde sidebar
- La shell CNT debe usar ancho completo sin `max-w`
- La UI debe usar solo componentes de la plantilla:
  - `Card`
  - `Button`
  - `Badge`
  - `Table`
  - `Dialog`
  - `DropdownMenu`
  - `Tabs`
  - `Select`
  - `Input`
  - `ScrollArea`
  - `Separator`

## Rutas API de validacion que ya existen

### Base y configuracion

- `GET /api/cnt/config/?no_cia=...`
- `GET /api/cnt/tcuenta/`

### Catalogo

- `GET /api/cnt/catalogo/?search=&tipo=&clase=&activa=`
- `GET /api/cnt/catalogo/<cuenta>/`
- `POST /api/cnt/catalogo/`
- `PATCH /api/cnt/catalogo/<cuenta>/`

### Centros de costo

- `GET /api/cnt/centros-costo/?no_cia=...`

### Periodos y cierres

- `GET /api/cnt/periodos/?no_cia=...`
- `GET /api/cnt/cierres/?no_cia=...&punto=...`

### NCF

- `GET /api/cnt/ncf/?no_cia=...&punto=...`
- `PATCH /api/cnt/ncf/<codigo_ncf>/`

### Asientos

- `GET /api/cnt/asientos/?no_cia=...&punto=...&ano=...&mes=...`
- `GET /api/cnt/asientos/<no_asiento>/?no_cia=...&punto=...&ano=...&mes=...`
- `POST /api/cnt/asientos/`
- `POST /api/cnt/asientos/<no_asiento>/aprobar/`
- `POST /api/cnt/asientos/<no_asiento>/actualizar/`
- `POST /api/cnt/asientos/<no_asiento>/anular/`

### Reportes contables

- `GET /api/cnt/balance/?no_cia=...&punto=...&ano=...&mes=...`
- `GET /api/cnt/mayor/?no_cia=...&punto=...&cuenta=...&ano=...&mes_ini=...&mes_fin=...`

## Rutas que faltan crear

Estas rutas no existen aun y el plan debe cubrirlas:

- `POST /api/cnt/ncf/` para crear secuencias NCF
- `POST /api/cnt/centros-costo/` para crear centros de costo
- `GET /api/cnt/reportes/<reporte>/pdf`
- `GET /api/cnt/reportes/<reporte>/xlsx`
- rutas de configuracion para asignar cuentas, grupos contables, proyectos y
  locales
- rutas de procesos para apertura, reverso, cierre, presupuesto y nomina
- rutas de consultas para asiento y movimientos de cuentas

## Mapa tabla -> validacion

- `CNT.TCNT_CIAS` y `CNT.TCNT_PUNTO` -> configuracion de empresa y punto
- `CNT.TCNT_TCUENTA` -> tipo de cuenta
- `CNT.TCNT_CATALOGO` -> catalogo de cuentas
- `CNT.TCNT_CENTRO_COSTO` -> centros de costo
- `CNT.TCNT_PERIODO_FISCAL` -> periodos fiscales
- `CNT.TCNT_NCF` -> secuencias NCF
- `CNT.TCNT_ASIENTO` y `CNT.TCNT_ASIENTOL` -> entrada y detalle de asientos
- `CNT.TCNT_HCUENTA` -> balance y mayor
- `CNT.TCNT_MOVIMIENTO` -> historico contable
- `CNT.TCNT_CIERRE` -> cierres
- `CNT.TCNT_USUARIO` -> permisos por usuario y modulo

## Como se debe mejorar la UI

- Layout mas friendly, sin pantallas estrechas.
- Menus densos, pero con componentes ya existentes de la plantilla.
- Reducir pasos: una sola seleccion de empresa y punto.
- Listados con busqueda y filtros claros.
- Dialogs cortos para alta y edicion.
- Reportes con acciones visibles para imprimir o exportar.
- No inventar paletas ni bloques decorativos fuera del sistema de estilos.
- No llevar al plan CNT los menus globales del shell que no son propios del
  modulo.

## Exportacion requerida

- PDF para:
  - Balance de Comprobacion
  - Mayor
  - Diario
  - Balance General
  - Estado de Resultados
  - Anexos
  - listados impresos del catalogo
- Excel para:
  - Catalogo
  - Asientos
  - Balance
  - Mayor
  - NCF
  - Centros de costo

La exportacion debe reutilizar la misma consulta que alimenta la vista.

## Orden de ejecucion propuesto

1. Ajustar la shell CNT al menu legacy completo y a full width.
2. Consolidar la seleccion unica de empresa y punto.
3. Cerrar las pantallas base ya existentes con la plantilla.
4. Crear las pantallas faltantes de configuracion.
5. Crear las pantallas de procesos.
6. Crear los reportes faltantes y sus exportaciones PDF/Excel.
7. Completar cierres y consultas.
8. Validar todo contra las capturas del legado y contra Oracle.

## Criterios de aceptacion

- El menu visible coincide con el legado.
- No hay `max-w` limitando la vista CNT.
- No hay selectores de empresa repetidos fuera del sidebar.
- Cada pantalla tiene una ruta UI y una ruta API clara.
- Los reportes generan el mismo resultado desde la misma query.
- Los listados grandes siguen usando paginacion o filtros server-side.
- Las capturas del servidor sirven como referencia visual final.
