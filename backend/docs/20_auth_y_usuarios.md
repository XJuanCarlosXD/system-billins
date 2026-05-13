# Auth y administración de usuarios

## Propósito

Reemplazar el login del Regal General legado validando credenciales contra Oracle
nativo (sin tablas de hash propias) y permitir que administradores gestionen
usuarios y sus permisos por módulo.

## Cómo se usa desde la UI

### Iniciar sesión
1. Abrir la app (redirige a `/sign-in` si no hay sesión).
2. Capturar **Usuario** (lo convierte a mayúsculas) y **Contraseña**.
3. Submit → si Oracle autentica, entras al Dashboard.
4. Errores comunes:
   - "credenciales inválidas" → `ORA-01017` desde Oracle.
   - "Error de red" → backend caído o CORS bloqueando.

### Cerrar sesión
- Avatar arriba → **Cerrar sesión** → confirma → POST a `/api/auth/logout/`
  y reset del estado local.

### Cambiar mi contraseña
- Avatar → **Cambiar contraseña** (`/cambiar-clave`).
- Pide contraseña actual + nueva + confirmación.
- El backend valida la actual con un `oracledb.connect()` previo y si pasa
  ejecuta `ALTER USER {user} IDENTIFIED BY {nueva}`.
- Reglas de la nueva contraseña: 4–30 caracteres en `[A-Za-z0-9_@#$\-\.\+]`.

### Administrar usuarios (solo admin)
- Avatar → **Administrar usuarios** o sidebar **Sistema → Permisos → Usuarios**.
- Solo aparece si tienes rol `DBA` o `Regal General` en Oracle.
- Funciones:
  - **Buscar** por texto (server-side).
  - **Filtrar** Todos / Solo activos.
  - **Ordenar** por usuario / estado / creado, asc o desc (clic en el header).
  - **Paginar** 10/25/50/100 con primero/anterior/siguiente/último.
  - **Crear usuario** → ejecuta `CREATE USER ... IDENTIFIED BY ...` + `GRANT CONNECT, RESOURCE, ROLE_REGAL_GENERAL`.
  - **Resetear contraseña** (icono llave).
  - **Bloquear/Desbloquear** cuenta (icono candado). No puedes bloquearte a ti mismo.
  - **Permisos por módulo** (icono escudo) — abre dialog para asignar acceso a `(módulo, empresa, punto)` insertando/borrando filas en `TXXX_USUARIO`.

## Endpoints HTTP

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/api/auth/login/` | público | login con `{username, password}` |
| POST | `/api/auth/logout/` | autenticado | cierra sesión |
| GET | `/api/me/` | autenticado | yo + empresas + módulos + `is_admin` |
| GET | `/api/me/permissions/?modulo=&no_cia=&punto=` | autenticado | mis permisos en módulo |
| POST | `/api/auth/change-password/` | autenticado | `{current_password, new_password, confirm_password}` |
| GET | `/api/admin/users/` | admin | lista paginada (`page`, `page_size`, `order_by`, `direction`, `q`, `include_locked`) |
| POST | `/api/admin/users/` | admin | crea usuario `{username, password}` |
| GET | `/api/admin/users/<u>/` | admin | detalle de un usuario |
| PATCH | `/api/admin/users/<u>/` | admin | `{new_password?, locked?}` (no auto-lock) |
| GET | `/api/admin/users/<u>/access/` | admin | accesos del usuario |
| POST | `/api/admin/users/<u>/access/` | admin | otorga acceso `{modulo, no_cia, punto?, activo?, por_defecto?}` |
| DELETE | `/api/admin/users/<u>/access/?modulo=&no_cia=&punto=` | admin | revoca acceso |

## Modelo de datos relevante

- `dba_users` (Oracle) — usuarios humanos del sistema (con `account_status`, fecha creación).
- `dba_role_privs` — para detectar admin (DBA / Regal General).
- `<MODULE>.T<MODULE>_USUARIO` — filas de permiso por (cía, punto, usuario) con flags S/N por acción.
- `<MODULE>.T<MODULE>_USUARIOD` (donde aplica) — detalle por tipo de documento.

## Casos de prueba mínimos

1. Login válido → 200 con `{is_authenticated: true}`.
2. Login con credenciales inválidas → 401 `{detail: "credenciales inválidas"}`.
3. Cambiar mi contraseña con la actual incorrecta → 400.
4. Admin crea usuario `TEST_QA01` / `temp1234` → 201.
5. Admin lista con `?q=test` → solo retorna `TEST_QA01`.
6. Admin otorga acceso `fat`/`01`/`01` a `TEST_QA01` → 201.
7. Admin revoca ese acceso → 200 con `deleted_rows >= 1`.
8. Admin se intenta auto-bloquear → 400 con mensaje claro.
