# Regla: registrar cada despliegue como Novedad

ZentoryERP muestra una pantalla de **Novedades** en el menú general (`/novedades`).
Es el historial de actualizaciones visible para el usuario final: cada vez que se
sube algo al sistema, aparece ahí como una noticia.

## La regla (obligatoria)

**Cada vez que se pushea / despliega algo, hay que agregar una entrada de Novedad.**

Concretamente, antes de:

- hacer `git push` a `main` (dispara el deploy del frontend en Netlify), o
- subir backend a la VM de producción (`pscp` a `10.0.0.99`),

se debe **agregar una entrada nueva** al arreglo `NOVEDADES` en:

```
frontend/src/data/novedades.ts
```

La entrada más reciente va **de primera** (orden descendente por fecha).

## Cómo escribir la entrada

Cada novedad es un objeto con estos campos:

| Campo         | Obligatorio | Descripción                                                             |
| ------------- | ----------- | ----------------------------------------------------------------------- |
| `fecha`       | sí          | Fecha del push en formato `YYYY-MM-DD`.                                  |
| `tipo`        | sí          | `'nuevo'` (función nueva) \| `'mejora'` \| `'correccion'`.              |
| `modulo`      | sí          | Módulo afectado (ver `ModuloNovedad`). `'General'` si es transversal.    |
| `titulo`      | sí          | Una línea corta y clara: *qué es*.                                       |
| `descripcion` | sí          | 1–3 frases en lenguaje de negocio: qué cambió y para qué le sirve.       |
| `commit`      | no          | Hash corto del commit, para trazabilidad.                               |

### Ejemplo

```ts
{
  fecha: '2026-08-10',
  tipo: 'nuevo',
  modulo: 'Facturación',
  titulo: 'Documento a crédito autoselecciona forma de pago y vendedor',
  descripcion:
    'Al facturar a crédito, el sistema elige automáticamente la forma "A CRÉDITO" y el vendedor del usuario, agilizando la captura.',
  commit: 'a1b2c3d',
},
```

## Buenas prácticas

- **Lenguaje de negocio, no jerga técnica.** El lector es el usuario, no el
  desarrollador. Evita nombres de tablas, funciones o rutas internas.
- **Una novedad por cambio con impacto visible.** Los cambios internos sin
  efecto para el usuario (refactors, tooling) no necesitan entrada.
- **Agrupa lo relacionado.** Varios commits de una misma mejora pueden ir en
  una sola entrada.
- **No borres novedades viejas.** El arreglo es el historial; solo se agrega
  arriba.

## Por qué

Así cada despliegue queda registrado como una noticia dentro del propio
sistema, el usuario ve qué se subió y cuándo, y se mantiene una bitácora de
producto legible sin tener que leer el `git log`.
