#!/bin/sh
set -e
cron

# Compilar el wrapper de firma DGII (depende del .exe montado por volumen,
# no puede quedar fijo en la imagen). Silencioso si mono/mcs no estan
# disponibles (imagen vieja sin rebuild aun) - no debe tumbar el arranque.
if command -v mcs >/dev/null 2>&1 && [ -f "/app/apps/fe/tools/App Firma Digital.exe" ]; then
    mcs -r:"/app/apps/fe/tools/App Firma Digital.exe" \
        -out:/app/apps/fe/tools/firmar.exe \
        "/app/apps/fe/tools/firmar_wrapper.cs" \
        || echo "WARN: no se pudo compilar firmar_wrapper.cs (firma DGII via App oficial no disponible)"
fi

exec "$@"
