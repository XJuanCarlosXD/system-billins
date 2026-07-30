# Poll loop: revisa cada 45s si hay una corrida PENDIENTE del boton
# "Resolver todo con Agente" y, si la hay, lanza Claude Code headless.
# Ver spec: backend/docs/superpowers/specs/2026-07-30-agente-reportes-boton-design.md

$RepoDir   = "C:\Users\JCABREU\AppData\Local\memorias_sigaft\facturation-system"
$ApiBase   = "https://grupo-abregonza.hopto.org:8443/api"
$Token     = $env:AGENTE_REPORTES_TOKEN
$LogDir    = Join-Path $PSScriptRoot "logs"
$ClaudeCli = "C:\Users\JCABREU\AppData\Roaming\npm\claude.cmd"

if (-not $Token) {
    Write-Error "Falta la variable de entorno AGENTE_REPORTES_TOKEN"
    exit 1
}
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

while ($true) {
    try {
        $resp = Invoke-RestMethod -Uri "$ApiBase/reportes/agente/pendiente/" `
            -Headers @{ Authorization = "Bearer $Token" } -Method Get
    } catch {
        Write-Host "$(Get-Date -Format s) poll fallo: $_"
        Start-Sleep -Seconds 45
        continue
    }

    if ($resp.pendiente) {
        $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $promptPath = Join-Path $LogDir "prompt-$stamp.txt"
        $logPath    = Join-Path $LogDir "run-$stamp.log"
        $reportesJson = $resp.reportes | ConvertTo-Json -Depth 5

        @"
Sos el agente autonomo de ZentoryERP. Resolve TODOS los reportes de
problemas en estado ABIERTO listados abajo. Esta corrida fue disparada
manualmente por un admin desde el boton "Resolver todo con Agente" (no es
la corrida programada cada 4h de ZentoryERP-Reportes-AutoFix, que sigue
corriendo por su cuenta — evita tocar un reporte que ya este EN_PROGRESO,
puede que la otra corrida ya lo haya tomado).

Repo: $RepoDir (rama main, working tree limpio)
Oracle: sqlplus JCABREU/508192003@AB
run_id de esta corrida: $($resp.run_id)
API_BASE (solo para reportar el resultado final): $ApiBase
Token para POST resultado/: $Token

Reportes ABIERTO (JSON, puede estar desactualizado si otra corrida ya tomo
alguno mientras tanto):
$reportesJson

Instrucciones obligatorias, en orden, por cada reporte:
1. Reclama el reporte de inmediato (antes de tocar codigo), igual que hace
   el runner de las 4h, para no chocar con el:
     sqlplus -s JCABREU/508192003@AB
     UPDATE TREP_PROBLEMA SET ESTADO = 'EN_PROGRESO', FECHA_ACTUALIZACION = SYSDATE
     WHERE REPORTE_ID = '<id>' AND ESTADO = 'ABIERTO';
     COMMIT;
   Si el UPDATE afecta 0 filas, otro proceso ya lo tomo — saltalo.
2. Lee TITULO + DESCRIPCION + MODULO completos si necesitas mas contexto
   (SELECT con SET LONG 100000 si DESCRIPCION es largo).
3. Diagnostica la causa real en el codigo o los datos (usa
   superpowers:systematic-debugging). No inventes features nuevas, solo
   corrige el problema reportado.
4. Sigue superpowers:test-driven-development para el fix. Corre la suite de
   tests existente (backend: pytest vía docker exec en la VM per la skill
   sigaft-deploy-vm; frontend: npx tsc --noEmit en los archivos tocados).
5. Usa la skill verify antes de dar el fix por bueno.
6. SOLO si todo lo anterior paso: pscp el backend a la VM, commit + push a
   main (Netlify despliega el frontend solo).
7. Marca el reporte COMPLETADO con nota de resolucion clara en espanol para
   el usuario que reporto (sin jerga interna):
     sqlplus -s JCABREU/508192003@AB
     UPDATE TREP_PROBLEMA SET ESTADO = 'COMPLETADO', RESUELTO_POR = 'CLAUDE-AUTO',
       NOTA_RESOLUCION = '<nota>', FECHA_RESOLUCION = SYSDATE, FECHA_ACTUALIZACION = SYSDATE
     WHERE REPORTE_ID = '<id>';
     COMMIT;
8. Si NO pudiste arreglarlo (ambiguo, requiere decision humana, tests no
   pasan): dejalo EN_PROGRESO (nunca lo regreses a ABIERTO ni lo canceles)
   y anota por que en el resumen final.

Reglas de seguridad (no negociables, iguales a las del runner de las 4h):
- NUNCA push a main si el smoke test / verify fallo o no corriste.
- NUNCA git reset --hard, git push --force, ni dumps completos de la BD.
- NUNCA canceles ni reabras un reporte.
- Si el fix requiere ALTER/CREATE TABLE no trivialmente reversible, o toca
  autenticacion/permisos/dinero de forma no obvia, NO lo hagas solo: deja el
  reporte EN_PROGRESO con nota tecnica para JCABREU.

Al final, pase lo que pase, reporta el resultado de ESTA corrida (una sola
vez, al terminar con todos los reportes que tomaste):
  POST $ApiBase/reportes/agente/resultado/
  header Authorization: Bearer $Token
  body {"run_id": "$($resp.run_id)", "estado": "COMPLETADO o ERROR",
        "resumen": "que se arreglo, que no y por que (texto para un admin)",
        "commit_sha": "sha del ultimo commit pusheado, o null si no hubo push"}
"@ | Set-Content -Path $promptPath -Encoding UTF8

        Get-Content $promptPath -Raw | & $ClaudeCli --dangerously-skip-permissions -p --output-format text *> $logPath
    }

    Start-Sleep -Seconds 45
}
