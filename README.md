# facturation-system

Clon web del ERP legado siguiendo el plan por fases. Stack:

- **Frontend**: Vite + React 19 + TypeScript + Tailwind 4 + shadcn/ui + TanStack Router + TanStack Query + React Hook Form + Zod + Recharts (template `shadcn-admin`).
- **Backend**: Django 5 + DRF + `oracledb` (driver thin para Oracle 11g) + `django-cors-headers`.
- **DB metadata app nueva**: SQLite local (`backend/data/app.sqlite3`).
- **DB legado**: Oracle 11g del host (`service AB`). El backend se conecta como cliente — **no se levanta contenedor de Oracle**.

## Reglas duras del proyecto

1. **PROHIBIDO** detener / reiniciar / degradar el servicio Oracle del host.
2. **PROHIBIDO** correr migraciones contra `legacy_oracle`. El router `LegacyRouter` lo bloquea.
3. Toda escritura al Oracle legado pasa por servicios controlados del backend, nunca por ORM directo.
4. Cada form / paso valida 1-a-1 los campos, validaciones, reglas y reportes del sistema viejo antes de marcarse como terminado.

## Arranque

```bash
# 1. Configurar variables
cp .env.example backend/.env
# editar backend/.env y rellenar ORACLE_PASSWORD

# 2. Levantar todo
make up        # foreground con logs
# o
make up-d      # background

# 3. Migrar (solo SQLite local)
make migrate

# 4. Verificar conexion al Oracle legado
make oracle-check
# o curl http://localhost:8000/api/health/oracle/

# 5. Front en http://localhost:5173
# 6. API en  http://localhost:8000/api/
```

## Hot reload sin rebuild

- Backend: `runserver` recarga al detectar cambios en `./backend` (volume mount).
- Frontend: Vite HMR sobre `./frontend` (volume mount + `CHOKIDAR_USEPOLLING=true`).

`node_modules` y `data/` viven en volumes propios para no chocar con el host.

## Make targets

`make help` lista todo. Los principales:

| Target | Que hace |
| --- | --- |
| `up` / `up-d` | levanta servicios |
| `down` | baja servicios |
| `build` / `rebuild` | construye imagenes |
| `migrate` | migra SQLite local |
| `makemigrations` | genera migraciones |
| `oracle-check` | prueba conexion Oracle legado |
| `logs` / `logs-back` / `logs-front` | tail de logs |
| `shell-back` / `bash-back` | acceso al backend |
| `shell-front` | sh dentro del frontend |
| `clean` | down -v (borra volumes) |
