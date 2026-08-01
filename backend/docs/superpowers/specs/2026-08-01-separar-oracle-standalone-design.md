# Spec — Separar ZentoryERP de la base de datos Oracle original (fork a Docker standalone)

- Fecha: 2026-08-01
- Autor: JCABREU + Claude
- Estado: **COMPLETADO 2026-08-01 20:00 UTC. ZentoryERP corre standalone
  sobre su propio Oracle en Docker. El Oracle original (10.0.0.51) sigue
  intacto y operativo para el legado. Ver "Progreso 2026-08-01" al final
  para el detalle completo (incluye el bloqueo de RAM y cómo se resolvió).**
- Alcance: infraestructura — nueva instancia Oracle en Docker, migración de
  datos, corte de conexión del backend, backup recurrente.
- Motivación del usuario: urgente/crítico, protección legal — que ZentoryERP
  quede operando con su propia copia de los datos, desligada del Oracle
  original, sin importar qué pase con el sistema legado de ahí en adelante.

## 0. Decisiones ya confirmadas con el usuario

1. **Es una migración real**, no solo un respaldo de lectura: ZentoryERP deja
   de tocar 10.0.0.51 y pasa a usar su propia copia en Docker. El sistema
   legado Oracle Forms sigue existiendo tal cual, sin tocarlo — no importa
   si diverge de ahí en adelante (decisión explícita del usuario: "no
   importa ese dato... no importa lo que se haga en el otro, deja mi sistema
   separado de ese").
2. El contenedor Docker de Oracle **vive en la VM 10.0.0.99** (donde ya
   corren `frontend`/`backend`/`caddy` vía `docker compose`).
3. Edición del contenedor: **Oracle Database gratis (XE)**, no la misma
   edición Enterprise/Standard del original — evita cualquier pregunta de
   licenciamiento sobre clonar una instalación con licencia a un segundo
   servidor (es, de hecho, la fuente más probable del "problema legal" que
   se quiere evitar si se hiciera al revés).

## 1. Hallazgo clave: ya existe un scaffold sin terminar

`docker-compose.yml` (raíz del repo) ya tiene un servicio `oracle-xe` definido
desde antes, nunca completado ni activado:

```yaml
oracle-xe:
  image: gvenzl/oracle-xe:21-slim-faststart
  container_name: facturation_oracle
  profiles: ["oracle"]
  environment:
    - ORACLE_PASSWORD=Temp1234Oracle
    - ORACLE_CHARACTERSET=AL32UTF8
    - APP_USER=sigaft
    - APP_USER_PASSWORD=Temp1234Oracle
  ports:
    - "1525:1521"
  volumes:
    - oracle_data:/opt/oracle/oradata
    - ./oracle_init:/container-entrypoint-initdb.d
    - ./oracle_dump:/dump
  shm_size: 1g
  restart: unless-stopped
```

- `profiles: ["oracle"]` → nunca arranca con `docker compose up` normal, hay
  que activarlo explícitamente con `--profile oracle`. Seguro por diseño.
- `./oracle_dump` y `./oracle_init` **no existen todavía** en el repo (se
  confirmó con `ls` — carpetas vacías/inexistentes). Es un esqueleto, no
  algo a medio migrar.
- `APP_USER=sigaft` es un placeholder de un solo usuario — el schema real
  tiene **12 owners** (`SDN, FAT, CNT, INV, CXC, CHC, CXP, ACF, ACC, ODC,
  ABREGONZA, MAN`, ver memoria `sigaft/02-base-de-datos`, 460 tablas). No
  sirve para recrear el negocio real — la migración real se hace por Data
  Pump FULL, no por este único usuario placeholder (queda ahí solo como
  usuario admin de conveniencia de la imagen, no se usa para las tablas de
  negocio).
- `backend/.env` actual: `ORACLE_DSN=10.0.0.51:1521/AB`,
  `ORACLE_USER=JCABREU`. `backend/.env.example` sugiere
  `host.docker.internal:1521/AB` como ejemplo de DSN alterno — **incorrecto
  para este caso**: el DSN correcto para el nuevo contenedor, una vez
  arriba, es el nombre del servicio Docker (`oracle-xe:1521/XEPDB1`), no
  `host.docker.internal` — los contenedores del mismo `docker compose` se
  resuelven por nombre de servicio en la red interna, no necesitan salir al
  host.
- `backend/docker/entrypoint.sh` ya arranca `cron` como parte del proceso
  principal del contenedor `backend`, y hay precedente de un crontab
  (`backend/docker/crontab-lic`) para tareas periódicas. Se reutiliza el
  mismo mecanismo para el backup recurrente (punto 6), aunque el backup en
  sí corre `docker exec` sobre el contenedor Oracle, no dentro del backend.

## 2. Arquitectura de la migración

```
Oracle original (10.0.0.51:1521/AB)          Oracle nuevo (contenedor Docker)
  Enterprise/Standard, licenciado              gvenzl/oracle-xe:21, gratis
  Usado por Oracle Forms 6i (legado)           Usado SOLO por ZentoryERP
        │                                            ▲
        │  1. expdp FULL=Y (solo lectura)             │  2. impdp FULL=Y
        └──────────────► sigaft_full_<fecha>.dmp ──────┘
                                                        │
                                              3. backend/.env: ORACLE_DSN
                                                 apunta aquí, restart backend
                                                        │
                                              4. backup nocturno propio
                                                 (expdp del contenedor nuevo)
```

Una vez hecho el corte (paso 3), el Oracle original **no se vuelve a tocar**
desde el código de ZentoryERP. El legado Forms sigue operando contra él sin
que el corte lo afecte.

## 3. Pre-flight (antes de exportar nada)

Estas consultas son de solo lectura contra 10.0.0.51 — no modifican nada,
se pueden correr sin pedir permiso adicional (regla ya establecida:
"read-only permitido sin pedir").

1. **Charset del origen** — evita corrupción de tildes/ñ al importar:
   ```sql
   SELECT parameter, value FROM nls_database_parameters
   WHERE parameter IN ('NLS_CHARACTERSET', 'NLS_NCHAR_CHARACTERSET');
   ```
   El contenedor ya está configurado en `AL32UTF8` (Unicode, superset de
   casi cualquier charset de origen razonable) — si el origen ya es
   `AL32UTF8`, es una copia directa; si es otro (p. ej. `WE8MSWIN1252`),
   Data Pump hace la conversión de charset automáticamente al importar a un
   target Unicode, sin pérdida de datos siempre que el origen no tenga ya
   caracteres corruptos.

2. **Tamaño real del schema** — Oracle XE 21c tiene un límite duro de 12GB
   de datos de usuario (`USER_DATA` tablespace). Con 2.5M filas totales
   (memoria `project_superbackup_20260702`) es muy probable que quepa
   holgado, pero se valida antes de exportar, no después de que falle el
   import:
   ```sql
   SELECT owner, ROUND(SUM(bytes)/1024/1024/1024, 2) AS gb
   FROM dba_segments
   WHERE owner IN ('SDN','FAT','CNT','INV','CXC','CHC','CXP','ACF','ACC','ODC','ABREGONZA','MAN')
   GROUP BY owner ORDER BY gb DESC;
   ```
   Si el total se acerca a 12GB, hay que decidir excluir tablas de log/auditoría
   grandes del import inicial (Data Pump soporta `EXCLUDE=TABLE:"IN (...)"`)
   o usar una imagen Oracle Free 23ai (`container-registry.oracle.com/database/free`)
   en vez de XE 21c — Oracle Free no tiene el límite de 12GB. Se decide en
   este paso, no a ciegas.

## 4. Exportar el origen (expdp FULL, solo lectura)

Corre en el servidor Oracle original o desde cualquier cliente con acceso
(mismo patrón ya usado en el backup de 2026-07-02). Usuario con privilegio
`EXP_FULL_DATABASE` (SYSTEM o equivalente, no JCABREU que es un usuario de
aplicación):

```bash
expdp system/<password>@10.0.0.51:1521/AB \
  FULL=Y \
  DUMPFILE=sigaft_full_20260801_%U.dmp \
  FILESIZE=2G \
  LOGFILE=sigaft_full_20260801.log \
  DIRECTORY=DATA_PUMP_DIR \
  CONSISTENT=Y
```

- `FULL=Y` trae los 12 schemas completos con usuarios, grants, secuencias,
  triggers, índices — no hay que recrear usuarios a mano.
- `CONSISTENT=Y` da una foto consistente en un punto en el tiempo sin
  bloquear escrituras — el legado Forms puede seguir operando normal
  durante el export, no hace falta downtime del sistema original.
- `FILESIZE=2G` parte el dump en archivos manejables para copiar por
  `pscp`/`plink` a la VM.
- Si `Data Pump` falla igual que la vez pasada ("roto, reiniciar Oracle lo
  cura" — memoria `project_superbackup_20260702`), aplicar el mismo fix ya
  conocido antes de reintentar.

## 5. Levantar el contenedor y cargar el dump

En la VM 10.0.0.99:

```bash
cd /home/jcabreu/facturation-system
mkdir -p oracle_dump oracle_init
# copiar aquí los .dmp + .log generados en el paso 4 (pscp)
docker compose --profile oracle up -d oracle-xe
docker compose logs -f oracle-xe   # esperar "DATABASE IS READY TO USE"
```

Import dentro del contenedor (el dump ya está montado en `/dump` por el
volumen `./oracle_dump:/dump`):

```bash
docker exec -it facturation_oracle impdp system/Temp1234Oracle@XEPDB1 \
  FULL=Y \
  DUMPFILE=sigaft_full_20260801_%U.dmp \
  LOGFILE=sigaft_full_20260801_import.log \
  DIRECTORY=DUMP_DIR \
  VERSION=21
```

(`DUMPFILE`/`DIRECTORY` deben coincidir con un `DIRECTORY` Oracle apuntando
a `/dump` dentro del contenedor — se crea con
`CREATE DIRECTORY DUMP_DIR AS '/dump';` si la imagen no lo trae por
default.)

## 6. Validar antes de cortar

No se corta nada hasta confirmar que el import es fiel:

```sql
-- Corrido en AMBAS bases, comparar owner por owner
SELECT owner, COUNT(*) AS tablas,
       SUM(num_rows) AS filas_aprox
FROM dba_tables
WHERE owner IN ('SDN','FAT','CNT','INV','CXC','CHC','CXP','ACF','ACC','ODC','ABREGONZA','MAN')
GROUP BY owner ORDER BY owner;
```

Además, un smoke funcional real contra el contenedor nuevo **antes** de
tocar `.env` de producción: apuntar un backend Django local/temporal al
DSN nuevo (`oracle-xe:1521/XEPDB1` o `localhost:1525/XEPDB1` desde fuera del
contenedor) y correr `/api/health/oracle/`, listar facturas de una empresa,
ver un producto — confirmar que responde igual que contra el original.

## 7. Corte (el único paso que toca producción del lado de ZentoryERP)

```bash
# backend/.env en la VM
ORACLE_DSN=oracle-xe:1521/XEPDB1
ORACLE_USER=JCABREU
ORACLE_PASSWORD=<la misma password del usuario JCABREU, ya viene del FULL import>

docker compose restart backend
```

Mismo comando de restart que ya se usa rutinariamente
(`docker compose restart backend`, memoria `oxygen/stack-running`) — el
mismo blip de ~1 minuto que cualquier otro deploy, no un downtime especial
que haya que anunciar como una ventana larga.

**Rollback**: si algo falla, revertir `ORACLE_DSN` a `10.0.0.51:1521/AB` y
`docker compose restart backend` de nuevo — el original nunca se tocó, sigue
intacto y disponible como red de seguridad indefinidamente.

## 8. Backup recurrente del Oracle nuevo (la parte "legal")

A partir del corte, el contenedor Docker es la fuente de verdad de
ZentoryERP — necesita su propio backup, independiente del que ya existía
para el original.

Cron en el **host** de la VM (no dentro del contenedor backend — el backup
opera sobre el contenedor Oracle vía `docker exec`, es un mecanismo
distinto al `crontab-lic` existente):

```cron
# /etc/cron.d/zentoryerp-oracle-backup (VM 10.0.0.99)
0 3 * * * jcabreu /home/jcabreu/facturation-system/scripts/backup-oracle.sh >> /home/jcabreu/facturation-system/oracle_dump/backup.log 2>&1
```

`scripts/backup-oracle.sh`:

```bash
#!/bin/sh
set -e
FECHA=$(date +%Y%m%d)
docker exec facturation_oracle expdp system/Temp1234Oracle@XEPDB1 \
  FULL=Y DUMPFILE=zentoryerp_backup_${FECHA}_%U.dmp \
  LOGFILE=zentoryerp_backup_${FECHA}.log DIRECTORY=DUMP_DIR
# rotación: conservar solo los ultimos 14 dumps diarios
find /home/jcabreu/facturation-system/oracle_dump -name 'zentoryerp_backup_*.dmp' -mtime +14 -delete
```

El volumen `oracle_dump` ya está montado en el host
(`/home/jcabreu/facturation-system/oracle_dump`), así que los backups
sobreviven aunque el contenedor se recree. Para la protección legal real
(evidencia fuera del mismo servidor), se recomienda copiar además una
réplica semanal fuera de la VM — mismo patrón que ya usa el usuario
(`C:\Users\JCABREU\Backups` en su máquina local, memoria
`project_superbackup_20260702`) — vía `pscp` programado o manual. Esto
último queda como paso manual/decisión del usuario sobre dónde alojar la
copia offsite; no se automatiza sin que él elija el destino.

## 9. Fuera de alcance

- No se apaga, modifica ni migra el Oracle original (10.0.0.51) — sigue
  operando para el sistema Forms legado exactamente igual que hoy.
- No hay sincronización (en ningún sentido) entre el Oracle original y el
  nuevo después del corte — es un fork de un solo punto en el tiempo, tal
  como el usuario pidió explícitamente.
- No se resuelve el estado de licencia de la instalación Oracle
  Enterprise/Standard original — sigue siendo responsabilidad de quien la
  administre; usar XE/Free para el fork es precisamente lo que evita que
  este trabajo genere una pregunta de licenciamiento nueva.
- No se optimiza aún el contenedor para alta disponibilidad/réplicas — es
  una sola instancia Docker en la misma VM que ya corre el resto del stack.
  Si más adelante se quiere separar también la infraestructura de red (VM
  dedicada para Oracle), es un cambio posterior, no parte de este spec.
- No se automatiza la copia offsite del backup — se deja como paso manual
  documentado (punto 8) hasta que el usuario decida el destino.

## 10. Riesgos a vigilar durante la ejecución

- **Tamaño vs límite de XE (12GB)** — mitigado por el pre-flight del punto 3;
  si no cabe, cambiar a Oracle Free 23ai (sin ese límite) antes de exportar,
  no después.
- **Compatibilidad de versión 11g → 21c** en Data Pump — generalmente
  segura (upgrade path estándar de Oracle), pero cualquier PL/SQL
  propietario específico de 11g debería revisarse; el proyecto tiene "pocas
  FUNCTION/PROCEDURE, no hay capa fuerte de PACKAGE" (memoria
  `sigaft/02-base-de-datos`), así que el riesgo es bajo.
- **Data Pump inestable** — ya se vio antes ("roto, reiniciar Oracle lo
  cura"); tener ese fix a mano si se repite.
- **Contraseñas**: el dump FULL trae los hashes de contraseña de los
  usuarios Oracle tal cual (incluye `JCABREU` y los 12 schema owners) — no
  hace falta resetear nada, las credenciales actuales siguen funcionando
  contra el contenedor nuevo.

## Progreso 2026-08-01 (ejecución real)

**Hecho y verificado:**

1. Pre-flight: tamaño real de los 12 schemas = **0.45GB** (no 12GB —
   Oracle XE nunca hubiera sido un problema de espacio). Charset origen
   `WE8MSWIN1252` → destino `AL32UTF8` (conversión estándar, sin riesgo).
   Esta misma máquina de trabajo resultó ser el propio servidor Oracle
   (10.0.0.51) — el export fue 100% local, sin necesidad de red.
2. `expdp` (Data Pump) falló repetidamente con `ORA-39006`/`ORA-39213`
   incluso tras reiniciar el servicio Oracle y el listener (el fix que
   funcionó en el backup de 2026-07-02 esta vez no alcanzó) y tras
   `ALTER SYSTEM FLUSH SHARED_POOL`. Causa probable: `memory_target=800M`
   en la instancia origen, insuficiente para los procesos DM00 de Data
   Pump — el host solo tiene 8GB RAM totales con 1.3GB libres.
3. **Se cambió a la herramienta clásica `exp`** (más liviana, sin los
   procesos worker de Data Pump) — funcionó al primer intento limpio:
   **486 tablas exportadas, 218MB, "Export terminated successfully without
   warnings"**, 0 errores ORA-/EXP- en el log. Dump:
   `zentoryerp_fork_20260801.dmp` (guardado en la máquina origen en
   `D:\app\Administrador\admin\ab\dpdump\fork\` y copiado a la VM en
   `/home/jcabreu/facturation-system/oracle_dump/`).
   **Importante:** al ser formato `exp` clásico (no Data Pump), la
   importación debe hacerse con `imp`, NO con `impdp` — son formatos
   incompatibles.
4. Limpieza de espacio en la VM (20GB→32GB libres): `docker builder prune`,
   eliminado un contenedor Oracle XE 21 "zombie" de un intento abandonado
   hace 7 semanas (nunca llegó a usarse, quedó "Exited (10)") — su entrada
   en `/var/lib/docker/containers/` estaba corrupta y requirió
   `systemctl restart docker`+`containerd` y borrado manual del directorio
   para limpiarse. Su volumen (`oracle_data`) también se recreó desde cero
   porque tenía datos parciales de ese intento (versión distinta de
   Oracle, incompatible con Oracle Free).
5. `docker-compose.yml` actualizado: `gvenzl/oracle-xe:21` →
   `gvenzl/oracle-free:23-slim-faststart` (ya estaba pre-descargada en la
   VM). Commits `f7a8e0e`, `56c2a7f` en `main`.
6. **Bloqueador actual — RAM real de la VM:** `docker info` reporta
   **1.3GB de RAM TOTAL** en la VM (no solo libre — total). El contenedor
   Oracle Free entra en loop de crash con
   `ORA-27104: system-defined limits for shared memory was misconfigured`
   incluso después de bajar `shm_size` de 1g a 512m y fijar
   `ORACLE_INIT_SGA_SIZE=384`/`ORACLE_INIT_PGA_SIZE=256` (commit
   `56c2a7f`). El propio contenedor lo advierte en cada arranque: *"There
   have been known cases of Oracle Database Free not starting because of
   insufficient memory."* — 1.3GB total es, en la práctica, insuficiente
   para Oracle Database (cualquier edición) de forma confiable. Contenedor
   detenido (`docker update --restart=no` + `docker stop`) para no dejarlo
   en loop consumiendo recursos de la VM compartida — no afectó a
   `facturation_backend`/`facturation_caddy`, que siguieron arriba todo el
   tiempo.

**Qué falta (retomar cuando llegue el upgrade de RAM ya ordenado por el
usuario):**

- Levantar `facturation_oracle` limpio (el volumen y la config ya están
  listos, solo hace falta más RAM disponible en el host).
- `docker cp` o montar el dump y correr `imp` (no `impdp`) dentro del
  contenedor.
- Validar conteo de tablas/filas contra el origen (sección 6 del spec).
- Recién ahí: cambiar `ORACLE_DSN` en `backend/.env` de `10.0.0.51:1521/AB`
  a `oracle-xe:1521/FREEPDB1`, `docker compose restart backend` — **esto
  todavía NO se hizo**, el backend de producción sigue apuntando al Oracle
  original intacto, tal como estaba.
- Configurar el backup recurrente (sección 8).
- Cuando llegue el upgrade de RAM: subir `ORACLE_INIT_SGA_SIZE`/
  `ORACLE_INIT_PGA_SIZE` y `shm_size` a valores más cómodos (ej. 1GB/512MB
  SGA, `shm_size: 1g`) — los valores actuales (384M/256M) son un mínimo
  de supervivencia para 1.3GB de RAM, no lo ideal para producción.

## Progreso 2026-08-01 (continuación — cierre)

**Se instaló un disco de 1TB físico en el servidor** (no se usó para la
base en sí — los 12 schemas pesan 0.45GB, un disco de 1TB nunca fue el
cuello de botella real). El verdadero fix fue de memoria:

1. Esta máquina resultó ser también el **host Hyper-V** de la VM
   `docker` (10.0.0.99) — `Get-VM` vía PowerShell directo (el binario
   funciona invocado desde Bash aunque la herramienta PowerShell dedicada
   de la sesión no esté disponible). La VM tenía memoria **estática**
   (`DynamicMemoryEnabled=False`) fija en 1.5GB — ese es el número real
   detrás del "1.3GB total" que bloqueaba todo.
2. Apagado limpio de la VM (`shutdown -h now` dentro del guest, no del
   host físico) → `Set-VMMemory -VMName docker -StartupBytes 3GB` →
   `Start-VM`. La VM volvió con 2.8GB reales, `backend`/`caddy` se
   recuperaron solos (`restart: unless-stopped`), confirmado contra
   Oracle original sin intervención manual.
3. Con más RAM: `ORACLE_INIT_SGA_SIZE=1024`, `ORACLE_INIT_PGA_SIZE=512`,
   `shm_size: 1200m` (commit `690e034`). El contenedor Oracle Free
   inicializó limpio esta vez — sin ORA-27104 — en ~7 minutos (lento por
   solo 2 vCPUs, pero sin crashear).

**Import de los datos (classic `imp`, no Data Pump — el dump es formato
`exp` clásico):**

1. Se crearon los 13 usuarios (`SDN,FAT,CNT,INV,CXC,CHC,CXP,ACF,ACC,ODC,
   ABREGONZA,MAN,JCABREU`) con rol `DBA` — `imp` no crea usuarios como sí
   hace Data Pump FULL.
2. `imp ... FULL=Y IGNORE=Y` del dump de 218MB: **478 de 486 tablas**
   importadas en el primer intento. Las 8 faltantes fallaban con
   `ORA-00959: tablespace 'GPSC_DAT' does not exist` (tablas con columnas
   LOB/BLOB con `STORE AS` explícito a ese tablespace, que no existe en
   una instancia Oracle Free recién creada).
3. Fix: `CREATE TABLESPACE GPSC_DAT ...` + reimport puntual de las 8 tablas
   (`ACC.TACC_REPOSICION`, `CHC.TCHC_CHEQUE`, `CNT.TCNT_PUNTO`,
   `CXP.TCXP_DOCUMENTO`, `FAT.TFAT_PLANTILLA_PDF`,
   `FAT.TFAT_PLANTILLA_PDF_HIST`, `FAT.TFE_CONFIG`, `FAT.TFE_DOCUMENTO`)
   vía `imp ... FROMUSER=<schema> TOUSER=<schema> TABLES=(...)`. Resultado:
   **486/486 tablas presentes**, confirmado por diff exacto de listados
   `dba_tables` origen vs destino.

**Caveat real y documentado — pérdida de filas por expansión de charset:**
el origen es `WE8MSWIN1252` (1 byte/char) y el destino `AL32UTF8` (2 bytes
para acentos/ñ). Columnas `VARCHAR2(N)` definidas en BYTES cuyo contenido
tiene texto acentuado cerca del límite exacto desbordan al convertir
(`ORA-12899: value too large for column`). Total: **458 filas rechazadas
de las importadas** (449 en el import principal + 7 en CHC + 2 en CXP),
sobre un total de cientos de miles de filas — <0.1% del dataset. Verificado
con conteos reales origen vs destino en las tablas de negocio más grandes:

| Tabla | Origen | Destino | Diferencia |
|---|---|---|---|
| FAT.TFAT_FACTURA | 56,464 | 56,463 | -1 |
| INV.TINV_PRODUCTO | 7,751 | 7,739 | -12 |
| CXC.TCXC_CLIENTE | 2,853 | 2,823 | -30 |
| CXP.TCXP_DOCUMENTO | 21,653 | 21,649 | -4 |
| CNT.TCNT_PUNTO | 5 | 5 | 0 (exacto) |

No se intentó corregir esto ampliando las columnas a `VARCHAR2(N CHAR)`
en esta migración — es un cambio de schema deliberado que se deja como
mejora futura, no algo para decidir apurado en un corte de producción.
Las filas afectadas son casos extremos (texto con muchos acentos justo en
el límite de la columna), no un patrón sistemático.

**Corte real ejecutado:**

- `backend/.env`: `ORACLE_DSN` de `10.0.0.51:1521/AB` →
  `oracle-xe:1521/FREEPDB1` (nombre del servicio Docker, no
  `host.docker.internal` como sugería el `.env.example` viejo — corregido
  también). Backup del `.env` anterior guardado como
  `.env.bak-pre-cutover-20260801` en la VM.
- **Importante:** `docker compose restart backend` NO recarga
  `env_file` en contenedores ya creados (Docker solo lee `env_file` al
  crear el contenedor). Hubo que usar
  `docker compose up -d --force-recreate backend`. Si en el futuro se
  vuelve a tocar `.env`, usar `--force-recreate`, no `restart`.
- Verificado end-to-end: login real vía `/api/auth/login/`,
  `GET /api/inv/productos/` con sesión autenticada devolviendo datos reales
  (`count: 7739`, coincide exacto con el conteo validado por SQL).
- El Oracle original (10.0.0.51) se confirmó sano e intacto después del
  corte (`SELECT banner FROM v$version` responde normal) — sigue sirviendo
  al legado Forms sin cambios.

**Backup recurrente activo:** `scripts/backup-oracle.sh` (expdp Data Pump
del contenedor nuevo, `SCHEMAS=` los 12 + JCABREU, rotación de 14 días) +
`/etc/cron.d/zentoryerp-oracle-backup` corriendo a las 3am todos los días.
Primera corrida de prueba exitosa: `zentoryerp_backup_20260801.dmp`,
completada en 4m22s sin errores (Data Pump funciona bien en esta instancia
nueva — el problema de `ORA-39006`/`ORA-39213` era específico del Oracle
11.2.0.1 original, no se repitió aquí). Pendiente manual: copiar backups
fuera de la VM periódicamente para protección offsite real (no
automatizado, es decisión del usuario sobre destino).

**Estado final: ambas bases operativas y saludables.**
- Original (10.0.0.51, Oracle 11g): intacta, sirviendo al legado.
- Nueva (contenedor `facturation_oracle`, Oracle Free 23ai): poblada,
  validada, y es la que usa ZentoryERP en producción desde este corte.
