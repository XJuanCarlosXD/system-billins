#!/bin/sh
set -e
BASE=http://localhost:8000
CJ=/tmp/cj_asistente.txt
rm -f $CJ

echo "-- login JCABREU"
curl -s -c $CJ -X POST $BASE/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"JCABREU","password":"508192003"}'
echo

echo "-- POST conversaciones/"
curl -s -b $CJ -X POST $BASE/api/asistente/conversaciones/ \
  -H "Content-Type: application/json" \
  -d '{"titulo":"smoke-test","no_cia":"01","punto":"01"}'
echo

echo "-- GET conversaciones/"
curl -s -b $CJ $BASE/api/asistente/conversaciones/
echo

echo "-- GET tools/  (primeros 800 chars)"
curl -s -b $CJ $BASE/api/asistente/tools/ | head -c 800
echo
