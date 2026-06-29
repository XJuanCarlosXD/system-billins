---
name: nueva-empresa-onboarding
description: Wizard para registrar una nueva empresa (no_cia) y su primer punto en CNT.
when_to_use: ["nueva empresa", "crear empresa", "agregar compañía", "onboarding empresa"]
modules_required: [CNT]
tools_used: [cnt_listar_companias, cnt_crear_compania, cnt_crear_punto]
estimated_steps: 5-7
---

# Skill: Onboarding de nueva empresa

Guía paso a paso para dar de alta una empresa nueva (no_cia + punto +
configuración inicial). Requiere permisos CNT.

## 1. Datos de la empresa

Pide al usuario:
- `nombre` (razón social, max 80 chars)
- `rnc` (validar formato 9 o 11 dígitos)
- `direccion`, `telefono`, `email`
- `moneda` base (DOP / USD / EUR)
- `actividad_economica` (string libre)

## 2. Verificar duplicado

`cnt_listar_companias()` → verificar que el RNC no esté ya registrado.
Si hay duplicado, alerta y aborta.

## 3. Reservar código de compañía

Pregunta al usuario qué `no_cia` quiere usar (2 chars, ej. "03"). Si
ya existe, sugiere el siguiente disponible.

## 4. Resumen y confirmación

```
no_cia:   <xx>
Nombre:   <razon social>
RNC:      <xxx>
Moneda:   <xxx>
```

Pide confirmación explícita.

## 5. Crear compañía

`cnt_crear_compania(no_cia, nombre, rnc, ...)`. **Write irreversible** —
una vez creada, el `no_cia` queda reservado.

## 6. Crear primer punto

Toda compañía necesita al menos un `punto` (sucursal). Pregunta:
- `punto` (2 chars, default "01")
- `nombre_punto` (ej. "Casa Matriz")
- `direccion` del punto

`cnt_crear_punto(no_cia, punto, nombre_punto, ...)`.

## 7. Próximos pasos (informativo, no son writes)

Después del onboarding, el usuario debe:
- Crear usuarios y asignarlos a la empresa (módulo Usuarios).
- Configurar módulos activos (FAT, CXC, CXP, INV, CHC, etc.) en
  `TXXX_PUNTO`.
- Configurar series de NCF (si va a usar FAT).
- Cargar plan contable inicial (si va a usar CNT).

Ofrece al usuario abrir las pantallas correspondientes.

## Reglas

- Solo DBA o usuario con permiso CNT puede correr esta skill.
- Los writes son **irreversibles**: requieren confirmación explícita.
- Si falla a mitad (ej. compañía creada pero punto no), avisa para
  corregir manualmente.
