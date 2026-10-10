# Sub-plan Fase 12 — Infraestructura Productiva ZentoryERP (decisión Roberto)

**Contexto**: Fases 1-11 cerradas 2026-10-10. Portal DGII en Fase 12
`/Postulacion/FormularioServicioProduccion` pidiendo 3 URLs HTTPS para el
directorio público de servicios productivos (visibles en la Oficina Virtual
DGII para todos los contribuyentes que facturen a Abregonza):

- Servicio de Autenticación — `https://<host>/fe/autenticacion/api/[semilla|ValidacionCertificado]`
- Servicio de Recepción — `https://<host>/fe/recepcion/api/ecf`
- Servicio de Aprobación Comercial — `https://<host>/fe/aprobacioncomercial/api/ecf`

**Por qué no lo clickea el runner**: una vez confirmadas, estas URLs quedan
en el directorio público DGII y cualquier contribuyente que emita e-CFs
contra Abregonza las usará. Cambiarlas después requiere ticket formal a
DGII. Es identidad productiva de Abregonza SRL — categoría "acción
legalmente vinculante" en las reglas del runner.

**Infraestructura actual (no apta prod)**:
- Backend: Docker `facturation_backend` corriendo en VM `10.0.0.99`
  (Windows Server 2019 Essentials, red doméstica/oficina).
- Reverse proxy: Caddy en `grupo-abregonza.hopto.org:8443` (DynDNS).
- Tunnel actual (post-74va): Cloudflare quick tunnel
  `chosen-variations-defense-carpet.trycloudflare.com` — hostname efímero,
  cambia cada reinicio del contenedor `cloudflared`.
- ISP bloquea 443 inbound (confirmado empíricamente 74va corrida).
- Sin SLA, sin backup, sin monitoreo externo.

## Opciones de infraestructura productiva (evaluadas)

### Opción A — Cloudflare Named Tunnel + dominio custom
**Qué**: Cuenta Cloudflare gratuita (o Workers Paid $5/mes para mayor
tolerancia), tunnel con nombre fijo (`cloudflared tunnel create abregonza-prod`),
asociado a un hostname bajo un dominio propio en Cloudflare DNS (ej.
`fe.abregonza.com.do` o `api.zentoryerp.do`). TLS termina en Cloudflare
edge con certificado administrado automáticamente.

**Lo que requiere**:
- Comprar/transferir un dominio (sugerido: `.com.do` ~US$30/año via NIC.DO,
  o `.com` ~US$10/año). Recomendado `.com.do` por imagen local.
- Cuenta Cloudflare gratuita, agregar dominio, cambiar nameservers.
- En VM, reemplazar quick tunnel por named tunnel: `cloudflared tunnel create`,
  guardar credenciales JSON persistente, actualizar `docker-compose.yml` con
  bind-mount y `cloudflared tunnel run <uuid>`.
- Dejar el contenedor `cloudflared` como `restart: unless-stopped`.

**Pros**:
- Costo bajo: solo el dominio ($10-30/año).
- No requiere IP pública, no toca ISP ni router.
- TLS gestionado por Cloudflare (sin renovaciones manuales).
- Protección DDoS/WAF básica incluida.
- Si cae la red doméstica, el hostname sigue existiendo (DGII reintenta).

**Contras**:
- Dependencia dura de Cloudflare + de la red local de la oficina.
- Latencia extra (Cloudflare edge → tunnel → VM local).
- Si la VM apaga, DGII no logra entregar comprobantes (SLA ~0).

**Comando setup (una vez decidido dominio)**:
```bash
# dentro de la VM, en el contenedor cloudflared
docker run --rm -v ~/.cloudflared:/home/nonroot/.cloudflared \
  cloudflare/cloudflared:latest tunnel login
docker run --rm -v ~/.cloudflared:/home/nonroot/.cloudflared \
  cloudflare/cloudflared:latest tunnel create abregonza-prod
# apuntar DNS en Cloudflare: fe.abregonza.com.do CNAME <uuid>.cfargotunnel.com
# docker-compose.yml:
#   cloudflared:
#     image: cloudflare/cloudflared:latest
#     restart: unless-stopped
#     volumes: ["~/.cloudflared:/home/nonroot/.cloudflared:ro"]
#     command: tunnel run abregonza-prod
#     networks: [facturation-system_default]
```

### Opción B — VPS cloud (Hetzner / DigitalOcean / Vultr) con nginx + Let's Encrypt
**Qué**: migrar el backend a un VPS con IP pública fija. nginx hace reverse
proxy a Django/uvicorn, certbot renueva Let's Encrypt automático.

**Opciones concretas**:
- Hetzner CX22 (2 vCPU ARM, 4 GB RAM, 40 GB SSD) — €4.59/mes, data center en
  Alemania (latencia DO ~140 ms).
- DigitalOcean Droplet s-1vcpu-2gb — US$12/mes, DC New York (latencia DO
  ~50 ms, más cerca de DGII).
- Linode Shared Nanode — US$5/mes, DC Atlanta.

**Pros**:
- IP pública fija: no depende de red local.
- Uptime SLA 99.9%+.
- Backups snapshot automáticos (DO +US$2/mes).
- Mejor latencia hacia DGII si DC está en EE.UU. Este.
- Separa prod de dev (la VM local sigue siendo desarrollo).

**Contras**:
- Costo mensual recurrente (US$5-15).
- Requiere migrar Oracle o configurar conexión segura al Oracle de la
  oficina (VPN/túnel) — Oracle sigue siendo la BD canónica.
- Mantenimiento adicional (parches OS, backups, monitoreo).
- Mayor trabajo inicial: migrar imagen Docker, variables de entorno,
  secretos, scripts de deploy.

**Nota crítica Oracle**: si el VPS no puede alcanzar el Oracle de la
oficina, Fases 9/11 (recibir e-CFs/ACECF) fallan al escribir
`TFE_DOCUMENTO_RECIBIDO`. Soluciones: (a) VPN permanente oficina ↔ VPS,
(b) migrar Oracle a un servicio gestionado (Oracle Cloud Free Tier tiene
Autonomous DB gratis, pero migración es grande), (c) usar un buffer
local (SQLite/Postgres en el VPS) y sincronizar a Oracle de la oficina
periódicamente — rompe la lógica actual.

### Opción C — ngrok Static Domain Pro
**Qué**: suscripción ngrok Pro con dominio estático
(`abregonza.ngrok.app` o custom), tunnel desde la VM actual.

**Costo**: US$20/mes (Pro) o US$50/mes (Business, incluye más conexiones).

**Pros**:
- Setup trivial (ya usa pattern similar al cloudflared quick tunnel).
- Dominio custom opcional sin DNS propio.

**Contras**:
- Más caro que Cloudflare named tunnel (US$240/año vs US$10-30/año dominio).
- Mismo problema de dependencia red local.
- Marca "ngrok" en el hostname (si no se usa custom domain).

### Opción D — Abrir 443 en el router local
**Qué**: pedir al ISP abrir el puerto 443 inbound a la IP residencial de la
oficina, configurar port forwarding en el router hacia `10.0.0.99:443`,
usar `grupo-abregonza.hopto.org` con TLS directo (Caddy ya configurado).

**Pros**:
- Cero costos mensuales.
- Infraestructura ya existente.

**Contras (fuerte NO)**:
- ISPs residenciales/comerciales en DO generalmente bloquean 443 por abuso
  (confirmado 74va corrida).
- Expone directamente la red local a internet (riesgo de ataques).
- IP residencial puede cambiar (ya mitigado con hopto.org, pero igual).
- Sin DDoS protection ni WAF.
- Imagen poco profesional en el directorio DGII.
- **Descartada salvo que no haya otra opción**.

## Recomendación del runner

**Para empezar producción con el menor riesgo y costo**:

**Fase 1 (ahora)**: Opción A — Cloudflare Named Tunnel + dominio custom.
- Comprar dominio `.com.do` (sugerido `abregonza.com.do` si está libre, o
  `fe.abregonza.com.do` como subdominio del principal de la empresa).
- Setup named tunnel estable con `restart: unless-stopped` en docker-compose.
- Agregar monitor externo (UptimeRobot gratis) que alerte si cae el tunnel.
- Mantener el Oracle local; la VM es responsable 24/7 de responder.

**Fase 2 (a mediano plazo, 3-6 meses)**: migrar a Opción B — VPS DO con
VPN hacia el Oracle de la oficina.
- Mejor SLA.
- Separa dev/prod.
- Backups formales.
- No se puede hacer HOY porque implica trabajo de migración significativo
  y Oracle en VPS requiere decisión de arquitectura más grande.

## Checklist operativo (una vez Roberto decida)

Si decide **Opción A** (asumido como default):

- [ ] Comprar dominio: NIC.DO o Namecheap, elegir `fe.abregonza.com.do` o similar.
- [ ] Crear cuenta Cloudflare gratuita; agregar dominio; cambiar NS en NIC.DO.
- [ ] En VM, `cloudflared tunnel login` + `cloudflared tunnel create abregonza-prod`.
- [ ] Guardar `~/.cloudflared/<uuid>.json` (secreto, backup aparte).
- [ ] En Cloudflare DNS, CNAME `fe` → `<uuid>.cfargotunnel.com`.
- [ ] Editar `docker-compose.yml` (sección `cloudflared`): reemplazar quick
      tunnel por `tunnel run abregonza-prod`, agregar bind-mount a
      `~/.cloudflared`, `restart: unless-stopped`.
- [ ] `docker compose up -d cloudflared`, verificar `docker logs cloudflared`
      muestra "Registered tunnel connection" sin errores.
- [ ] Smoke test externo: `curl -sk https://fe.abregonza.com.do/fe/autenticacion/api/semilla`
      desde cualquier red (no la propia) → HTTP 200 XML.
- [ ] En portal DGII Fase 12, llenar 3 textboxes con `fe.abregonza.com.do`
      (sin puerto, Cloudflare termina TLS en 443 estándar) → click
      "Confirmar URLS".
- [ ] Verificar portal avanza a Fase 13 (Declaración Jurada).
- [ ] Setear UptimeRobot: 3 monitores (uno por endpoint) cada 5 minutos.

## Nota sobre el tunnel actual (`chosen-variations-defense-carpet.trycloudflare.com`)

El quick tunnel sigue vigente **hasta que se reinicie el contenedor
`cloudflared`**. El runner tiene instrucción explícita (76va) de NO
reiniciarlo. Una vez montado el named tunnel, el quick tunnel se puede
retirar.

## Riesgos a tener presentes antes de confirmar en Fase 12

1. **Downtime**: si la VM está apagada cuando DGII intenta entregar un
   e-CF productivo, el contribuyente que emite recibe timeout. DGII
   reintenta por horas, pero cada hora que la VM esté caída es un e-CF que
   no se registra en Abregonza en tiempo real.
2. **Rotación de certificado**: el certificado digital Roberto Abreu
   Espinal (`roberto-abreu-espinal.p12`) tiene fecha de expiración. Si
   vence antes de la próxima renovación, Fases 9/11 fallan en producción
   también. Programar recordatorio ~30 días antes del vencimiento.
3. **Cambio de URLs**: una vez enviadas a DGII, cambiar las URLs requiere
   trámite formal (ticket soporte DGII 809-689-3444). Elegir hostname que
   NO cambie en 2+ años.
4. **Oracle backup**: si la BD Oracle se pierde (incendio, ransomware,
   hardware), los e-CFs recibidos de otros contribuyentes se pierden —
   obligación fiscal de 10 años de guarda. Backup off-site es crítico;
   fuera del alcance de este plan pero mencionar a Roberto.

## Próximo paso para la corrida 78va (y siguientes)

- Si Roberto no respondió todavía: el runner no tiene qué hacer en
  Fase 12 — avanzar OTRA cosa (ejemplos: documentar Fase 13/14 leyendo
  guías DGII; limpiar logging temporal `[VALCERT]`+`[ARECF]` del contenedor
  si Fases 9-11 están estables; limpiar scripts huérfanos de `/tmp` del
  contenedor; limpiar los `repro*.mjs` y `_gen_*.mjs` del working tree
  frontend que ya no sirven).
- Si Roberto decidió Opción A: ejecutar el checklist operativo arriba.
- Si Roberto decidió Opción B: escribir sub-plan específico de migración
  Oracle + VPS antes de tocar nada.
