# Watcher del Agente de Reportes

Poll loop que revisa cada 45s si hay una corrida pendiente del botón
"Resolver todo con Agente" (Configuración → Reportes, admin) y, si la hay,
lanza una sesión headless de Claude Code para resolverla. Diseño completo en
`backend/docs/superpowers/specs/2026-07-30-agente-reportes-boton-design.md`.

Este watcher es independiente de la tarea programada
`ZentoryERP-Reportes-AutoFix` (que corre cada 4h con su propio prompt en
`C:\Users\JCABREU\bin\zentoryerp-reportes-runner-prompt.txt`). Ambos pueden
tomar reportes `ABIERTO` — el reclamo vía `UPDATE ... WHERE ESTADO='ABIERTO'`
evita que se pisen, pero corren en paralelo sin coordinarse entre sí.

## Cómo probarlo manualmente (una corrida)

1. Define el token (mismo valor que `AGENTE_REPORTES_TOKEN` en el `.env` de
   la VM):
   ```
   $env:AGENTE_REPORTES_TOKEN = "el-token-real"
   ```
2. Corre el script en primer plano:
   ```
   powershell -File backend\docs\superpowers\agente-reportes\watcher-agente-reportes.ps1
   ```
3. Desde la app, con un usuario admin, click en "Resolver todo con Agente".
4. En 0-45s el script debería detectar `pendiente: true`, escribir
   `logs\prompt-<fecha>.txt` y `logs\run-<fecha>.log`, e invocar Claude Code.
5. Revisa `logs\run-<fecha>.log` para ver qué hizo.

## Cómo dejarlo corriendo siempre (activación real — paso manual, no incluido en el PR)

Esto deja un proceso con credenciales de deploy corriendo sin supervisión.
Actívalo solo cuando quieras que el botón funcione de verdad en producción:

```
$env:AGENTE_REPORTES_TOKEN = "el-token-real"
schtasks /create /tn "ZentoryERP-AgenteReportesWatcher" /tr "powershell -WindowStyle Hidden -File C:\Users\JCABREU\AppData\Local\memorias_sigaft\facturation-system\backend\docs\superpowers\agente-reportes\watcher-agente-reportes.ps1" /sc onlogon /rl highest
```

Para pararlo:
```
schtasks /end /tn "ZentoryERP-AgenteReportesWatcher"
schtasks /delete /tn "ZentoryERP-AgenteReportesWatcher" /f
```
