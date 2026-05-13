# Comparacion pendiente CNT vs sistema viejo

## Objetivo

Antes de cerrar CNT como modulo funcionalmente equivalente, hace falta una
comparacion sistematica entre el sistema viejo y el clon para asegurar que no
falten acciones, filtros, reportes, estados, permisos ni comportamientos por
empresa o punto.

Este documento queda como checklist viva de esa auditoria.

## Fuente de verdad para la comparacion

1. Capturas del legado en `C:\Users\JCABREU\screenshots\`.
2. Flujo real del sistema viejo abierto por modulo, opcion y reporte.
3. Oracle 11g como fuente de estructura y datos reales.
4. Planes y memorias actuales del proyecto:
   - `31_cnt_plan_detallado.md`
   - `30_plan_maestro_modulos.md`
   - `project_sigaf_progress.md`

## Alcance minimo de la auditoria

### Shell y navegacion
- Confirmar que cada opcion funcional del legado exista en el clon, aunque la
  navegacion no sea 1:1.
- Validar empresa y punto unicos desde sidebar.
- Validar periodos activos, cierres y anos visibles segun Oracle.

### Configuracion
- Companias
- Puntos de trabajo o sucursales
- Tipo de cuenta
- Catalogo de cuentas
- Centros de costo
- Proyectos y componentes
- Localidades
- NCF
- Desbloqueo de usuario
- Accesos y permisos CNT si el legado los expone dentro del modulo

### Procesos
- Entrada de diario
- Verificacion de asientos
- Autorizar asientos
- Actualizar asientos
- Procesos de meses anteriores
- Presupuesto
- Entrada de nomina
- Transacciones en US

### Consultas
- Consulta de asiento
- Consulta de movimientos de cuentas

### Reportes
- Catalogos
- Balance de comprobacion
- Mayor general
- Historicos
- Estados financieros
- Proyectos / componentes
- Centros de costo
- PDF / Excel donde aplique

### Cierres
- Cierre mensual
- Cierre anual

## Matriz de revision sugerida

Usar esta estructura por cada opcion del legado:

| Area | Opcion legado | Que hace en el viejo | Ruta/UI nueva | API/tabla Oracle | Estado | Gap |
|---|---|---|---|---|---|---|
| Configuracion | Ejemplo | Alta y mantenimiento | `/cnt?...` | `TCNT_*` | Pendiente | Describir diferencia |

## Criterios de aceptacion

Una opcion del legado se considera cubierta solo si cumple todo esto:

1. Existe una ruta o flujo visible en el clon.
2. Usa datos reales de Oracle o la API correcta.
3. Soporta el mismo objetivo operativo que el sistema viejo.
4. Respeta empresa, punto, periodo y permisos.
5. Si es reporte, sale en pantalla y exporta cuando corresponda.
6. Si es mantenimiento, permite consultar y editar con la logica correcta.

## Gaps ya conocidos al momento de crear este documento

- Formularios de `catalogo`, `ncf` y `centros-costo` siguen en dialog; aun no se
  movieron a vistas inline como `nuevo asiento`.
- Falta la comparacion fina contra capturas del legado para confirmar opciones
  no implementadas en configuracion, procesos, consultas y estados financieros.
- Falta verificar que cada reporte del legado tenga equivalente funcional en el
  clon y no solo cobertura parcial.

## Proximo uso de este documento

En la siguiente ronda CNT, recorrer cada captura del sistema viejo y llenar esta
matriz opcion por opcion hasta dejar claro:

- lo ya cubierto,
- lo cubierto con diferencia aceptable,
- y lo que aun falta construir.
