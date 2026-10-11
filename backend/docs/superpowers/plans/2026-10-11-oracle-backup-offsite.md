# Sub-plan — Backup off-site Oracle (ZentoryERP / Abregonza)

**Contexto**: Al pasar Abregonza a producción e-CF (post Fase 15), los datos
fiscales viven en una única VM (`10.0.0.99`, Ubuntu 22.04). Hoy existe un
backup DAILY local vía `expdp` que corre 03:00 AM (ver estado actual más
abajo). **Lo que falta** es que una copia de ese dump viva fuera de la VM
— un fallo de disco, incendio en la oficina de Abregonza o ransomware
local destruyen simultáneamente los datos y la "copia de seguridad". La
DGII puede exigir retención fiscal de hasta 10 años; perder esos datos
tras un paso a producción productiva es inaceptable.

Este sub-plan documenta el estado real actual del backup, enumera las
opciones realistas para off-site (cloud + físico), recomienda una, y deja
las tareas concretas listas para ejecutar cuando Roberto apruebe la ruta.

**No bloquea nada ahora** (Abregonza aún está en certificación), pero es
pre-requisito duro para el día 1 post-certificación — se recomienda
cerrarlo antes de ejecutar el sub-plan post-cert
(`2026-10-11-ecf-modo-produccion-post-certificacion.md`).

## Estado actual (verificado 2026-10-11, 83va corrida)

**Setup existente — descubierto esta corrida**:
- `/etc/cron.d/zentoryerp-oracle-backup`:
  `0 3 * * * jcabreu /home/jcabreu/facturation-system/scripts/backup-oracle.sh >> /home/jcabreu/facturation-system/oracle_dump/backup.log 2>&1`
- Script `scripts/backup-oracle.sh`: `docker exec facturation_oracle expdp
  system/*** @FREEPDB1 SCHEMAS=SDN,FAT,CNT,INV,CXC,CHC,CXP,ACF,ACC,ODC,ABREGONZA,MAN,JCABREU
  DIRECTORY=DUMP_DIR DUMPFILE=zentoryerp_backup_YYYYMMDD.dmp REUSE_DUMPFILES=Y`
  + `find ... -mtime +14 -delete` (retención 14 días rolling).
- Destino: `/home/jcabreu/facturation-system/oracle_dump/` (bind-mount
  `/dump` dentro del contenedor Oracle).
- Dumps presentes hoy: 2026-09-27 → 2026-10-11 (15 archivos), tamaño
  creciente 206→210 MB (crecimiento ~0.4 MB/día). Último exitoso
  2026-10-11 03:04 (log confirma `Job ... successfully completed`).
- Volumen de oradata: `/mnt/datos1tb/docker/volumes/facturation-system_oracle_data/_data`
  — 6.8 GB usados sobre 885 GB disponibles.
- Herramientas disponibles en la VM: `rsync` sí; `rclone/aws/gcloud/az/
  duplicity/restic/borg` NO.

**Lo que falta — gap de off-site**:
1. Los dumps viven solo en `/dev/sda1` (58 GB, el disco raíz de la VM).
   Fallo de disco raíz → pérdida total.
2. No hay replicación a ningún destino remoto (bucket, segunda VM,
   disco físico externo rotado).
3. No hay verificación periódica de que el dump importa (dump corrupto
   silencioso es un riesgo real con `expdp`: el `Job ... successfully
   completed` del log solo confirma que exportó, no que se pueda
   re-importar).
4. No hay cifrado at-rest — el `.dmp` contiene nombres de clientes, RNCs,
   facturas, nómina (SDN); si va a un bucket público-ish habría que
   cifrarlo primero.

## Opciones realistas (ordenadas por relación costo-cobertura)

### Opción A — Cloudflare R2 + rclone (RECOMENDADA)

**Qué**: Agregar `rclone` a la VM, configurar un bucket Cloudflare R2
(`abregonza-oracle-backup`), cifrar el `.dmp` con `age` (clave simétrica
guardada en el password manager de Roberto), subir el cifrado al bucket
diariamente después del `expdp`. Retención en el bucket: 30 días hot + 1
snapshot mensual retenido 10 años en bucket cold/archive.

**Pros**:
- R2 tiene **egress gratis**, almacenamiento US$0.015/GB/mes (hot) +
  US$0.015/GB/mes para infrequent access (comparable AWS S3 Glacier
  Instant). Con dumps de ~210 MB × 30 días hot + 120 snapshots mensuales
  = ~6 GB en hot + ~25 GB en archive = **~US$0.50-1/mes**.
- `rclone` conocido, muchas corridas sobre VPS Ubuntu lo usan.
- Lifecycle policy nativa en R2 (migración hot→cold automático,
  purga transparente).
- `age` es ligero (~1 MB binary, Rust-free), cifra en ~5 s para 210 MB,
  interoperable (recuperación posible con cualquier Linux + llave).
- Credenciales R2 scoped al bucket (no root AWS); si se filtran, radio
  de daño limitado.

**Contras**:
- Cuenta Cloudflare (Roberto ya la tiene desde Fase 12 tunnel). API
  tokens separados por servicio — un token R2-only, scoped a bucket.
- Dependencia de Cloudflare como vendor; mitigable con copia local
  anual a disco físico (ver Opción C como complemento).

**Costo estimado**: US$12-20/año (incluye margen por crecimiento 2026→2029).

**Alternativa idéntica si Roberto prefiere otro vendor**: Backblaze B2
(mismo precio, también egress a Cloudflare gratis vía Bandwidth
Alliance), o Scaleway Object Storage (EU, 75 GB gratis). AWS S3 Glacier
Deep Archive es ~5× más barato por GB pero cobra egress (US$0.09/GB) +
retrieval fee — mala idea si alguna vez hay que restaurar varios dumps.

### Opción B — Rsync a segunda VM/VPS (DIY)

**Qué**: Alquilar un VPS Hetzner (CX11, €4/mes) o un storage box Hetzner
(1 TB, €3/mes), `rsync -av --link-dest` diario del directorio `oracle_dump/`
vía SSH + clave dedicada. Snapshot con `cp -al` (hardlinks) para retención
en el remoto.

**Pros**:
- Control total, sin API vendor-specific.
- Fácil de testear (rsync + ssh es "obvio").
- Hetzner storage box = 1 TB por €3/mes (~US$3.5), espacio sobrado.

**Contras**:
- Infraestructura adicional (otro servidor que mantener).
- Más superficie de ataque (SSH público, claves que rotar).
- Sin lifecycle policies — rotación manual con scripts.

**Costo**: ~US$40-60/año.

**Cuándo tiene sentido**: Si Roberto no quiere más dependencias Cloudflare
y prefiere "físicamente otro proveedor".

### Opción C — Disco externo USB rotado semanalmente (complemento, NO reemplazo)

**Qué**: Dos discos USB 1 TB (US$30 c/u), uno en la oficina de Abregonza
en caja fuerte, otro con Roberto en su casa. Script dominical copia el
dump de la semana al disco presente, Roberto los intercambia los
domingos.

**Pros**:
- Costo one-time ~US$60.
- Air-gapped: inmune a ransomware/intrusión remota.
- Satisface requerimientos de retención fiscal estricta a 10 años.

**Contras**:
- Depende de disciplina humana (intercambio semanal).
- Si la oficina se incendia el lunes, el disco de la oficina se pierde
  — recuperación hasta el domingo anterior.
- No es automatizable al 100%.

**Cuándo tiene sentido**: SIEMPRE como complemento, nunca como único
backup off-site. Combinar con A o B.

### Opción D — No hacer nada / dejar como está

**Pros**: Costo cero, trabajo cero.

**Contras**: Pérdida total ante fallo disco único / ransomware /
incendio local. **No es aceptable para producción fiscal de 10+ años
de datos**.

## Recomendación del runner

**Opción A (R2 + rclone + age) como principal + Opción C (USB rotado)
como complemento de desastre**. Costo total ~US$80 one-time + US$15/año.
Cubre:
- Pérdida de disco raíz (A restaura en <1h).
- Ransomware local (A tiene retención 30d; C es air-gapped).
- Vendor failure de Cloudflare (C sigue vivo offline).

La decisión de qué proveedor cloud específico queda a Roberto —
estructuralmente R2/B2/Scaleway son intercambiables.

## Tareas propuestas (ejecutables cuando Roberto apruebe)

| # | Tarea | Tamaño | Dependencias |
|---|-------|--------|--------------|
| 1 | Crear cuenta/bucket R2 (`abregonza-oracle-backup`), generar API token scoped al bucket, guardar credenciales en password manager de Roberto | 30min | Decisión Roberto sobre vendor |
| 2 | Instalar `rclone` + `age` en la VM (`apt install rclone age`), configurar remoto R2 con `rclone config`, generar llave `age` y guardarla fuera de la VM | 30min | Tarea 1 |
| 3 | Extender `scripts/backup-oracle.sh`: tras `expdp` exitoso, `age -r <pubkey> dump.dmp > dump.dmp.age` + `rclone copy dump.dmp.age r2:abregonza-oracle-backup/daily/`. Logging al mismo `backup.log` existente | 1h | Tarea 2 |
| 4 | Configurar lifecycle en R2: diario → archive a los 30 días, purgar diarios > 90d; snapshot mensual (1er del mes) retenido 10 años | 30min | Tarea 1 |
| 5 | Script de verificación semanal: domingo 04:00 descargar el último `.age`, descifrar, importar con `impdp` en una base scratch, verificar `COUNT(*)` de 3 tablas clave (`FAT.TFAT_FACTURA`, `FAT.TFE_DOCUMENTO`, `SDN.TSDN_EMPLEADO`). Alerta a Roberto si falla | 2h | Tarea 3 |
| 6 | Comprar 2 discos USB 1TB (Opción C), script `backup-usb.sh` detecta disco por UUID y copia los últimos 7 dumps + llave `age` pública (nunca la privada) | 1h + hardware | — (independiente de A) |
| 7 | Documentar runbook de restauración: pasos exactos para re-levantar oradata desde un `.dmp.age` ante pérdida de la VM; probar end-to-end en un contenedor Oracle Free limpio | 2h | Tarea 3 |

Camino crítico mínimo para "backup off-site funcional": Tareas 1-4
(~2.5h de trabajo). Tareas 5-7 refinan robustez.

## Riesgos y mitigaciones

1. **Llave `age` perdida**: Si la llave privada se pierde, los
   dumps cifrados son irrecuperables. **Mitigación**: generar la llave
   con `age-keygen` en una máquina offline, imprimir la llave privada
   en papel, Roberto guarda copias en 2 ubicaciones físicas distintas
   (caja fuerte casa + oficina). La pública queda en la VM.
2. **Expdp "exitoso" pero dump corrupto**: Patrón conocido con
   `expdp` cuando hay I/O errors intermitentes. **Mitigación**: Tarea
   5 (verificación semanal con `impdp` real).
3. **Rclone falla silenciosamente** (red, token expirado, cuota R2):
   El cron no envía mail por default. **Mitigación**: wrapping del
   script con `set -e` + healthcheck ping a `healthchecks.io`
   (free tier) o similar; alerta a `juancarlos192003@gmail.com` si no
   recibe ping en 25h.
4. **Lifecycle de R2 purga por error**: config humana sensible.
   **Mitigación**: snapshot mensual **separado** del flow diario, con
   su propio prefix (`monthly/`) y lifecycle=NEVER_PURGE. El diario
   purga, el mensual no.
5. **Costos escalan si Oracle crece 10×**: Hoy ~210 MB/dump. Si llega
   a 2 GB/dump (ventas crecieron 10×), 30 días × 2 GB = 60 GB hot =
   ~US$1/mes. Sigue siendo trivial. No es un riesgo real.

## Alcance explícito fuera de este sub-plan

- Backup de archivos no-Oracle (XMLs firmados, PDFs representación
  impresa) — si se guardan en disco en producción, el mismo pipeline
  los puede cubrir, pero decisión depende del Gap 4 del sub-plan
  post-cert (hoy los PDFs se generan on-demand desde datos, no se
  guardan). Revisar cuando se cierre Gap 4.
- Backup de código — ya cubierto por GitHub (`XJuanCarlosXD/system-billins`).
- Backup de configuración Docker (`docker-compose.yml`, Caddyfile,
  secrets) — pequeño, debería ir también a R2 bajo `config/` pero sin
  cifrado (ya está versionado y no contiene secretos sensibles, los
  secretos van en `.env` que SÍ necesitaría cifrado — considerar
  como Tarea 8 opcional).
- HA / failover de la VM principal — fuera de alcance (es un sub-plan
  distinto, ~US$500+/año).

## Fuentes

- Verificación real VM 2026-10-11 (83va corrida):
  `cat /etc/cron.d/zentoryerp-oracle-backup`, `scripts/backup-oracle.sh`,
  `ls -la oracle_dump/`.
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- `age` encryption spec: https://age-encryption.org/
- Plan maestro `2026-09-22-ecf-certificacion-plan-maestro.md` (riesgo
  "Backup off-site de Oracle" en sub-plan Fase 12 y post-cert).
