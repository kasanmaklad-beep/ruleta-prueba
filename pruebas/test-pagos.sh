#!/bin/bash
# Prueba DETERMINISTA del pago del pleno: se apuesta a TODOS los números a la
# vez, así siempre gana exactamente uno y el resultado no depende de la suerte.
#
#   apostado = casillas × monto
#   cobra    = (pago + 1) × monto        (el ganador)
#   neto     = cobra − apostado          → tiene que dar SIEMPRE lo mismo
#
# Con 35 a 1 en la europea: 37×10 = 370 apostado, cobra 360, neto −10.
# Con 35 a 1 en la americana: 38×10 = 380 apostado, cobra 360, neto −20.
# El puerto se puede pasar por parámetro (wrangler no siempre toma el 8787):
#   bash <este script> http://localhost:8795
API=${1:-http://localhost:8787}
ok=0; fail=0
check(){ if [ "$2" = "$3" ]; then echo "  ✓ $1 (=$3)"; ok=$((ok+1)); else echo "  ✗ $1 — esperado $3, dio $2"; fail=$((fail+1)); fi; }
post(){ curl -s -X POST "$API$1" -H 'Content-Type: application/json' ${2:+-H "Authorization: Bearer $2"} -d "$3"; }
put(){  curl -s -X PUT  "$API$1" -H 'Content-Type: application/json' ${2:+-H "Authorization: Bearer $2"} -d "$3"; }
get(){  curl -s "$API$1" ${2:+-H "Authorization: Bearer $2"}; }

ADT=$(post /api/auth/login "" '{"username":"admin","password":"123456"}' | jq -r .token)
S=$(date +%s); N=$(echo "$S" | tail -c 8)
post /api/auth/register "" "{\"username\":\"pg_$S\",\"password\":\"clave123\",\"first_name\":\"Pago\",\"last_name\":\"Test\",\"cedula\":\"${N}6\",\"phone\":\"04141112233\",\"email\":\"pg$S@correo.com\",\"bank\":\"0134 - Banesco\"}" >/dev/null
PLT=$(post /api/auth/login "" "{\"username\":\"pg_$S\",\"password\":\"clave123\"}" | jq -r .token)
post /api/admin/deposit "$ADT" "{\"username\":\"pg_$S\",\"amount\":500000}" >/dev/null
put /api/admin/settings "$ADT" '{"settings":{"max_bet_pleno":100,"max_win_per_spin":999999999}}' >/dev/null

# Las dos mesas clásicas tienen que estar abiertas para jugarlas. El script se
# las abre y las deja como estaban al terminar.
guardar_estado(){ get /api/admin/games "$ADT" | jq -r ".mesas[] | select(.id==\"$1\") | if .activo then 1 elif .en_pruebas then 2 else 0 end"; }
EST_EUROPEA=$(guardar_estado europea)
EST_AMERICANA=$(guardar_estado americana)
post /api/admin/games/europea/activo "$ADT" '{"estado":1}' >/dev/null
post /api/admin/games/americana/activo "$ADT" '{"estado":1}' >/dev/null
restaurar_mesas(){
  post /api/admin/games/europea/activo "$ADT" "{\"estado\":${EST_EUROPEA:-0}}" >/dev/null
  post /api/admin/games/americana/activo "$ADT" "{\"estado\":${EST_AMERICANA:-0}}" >/dev/null
}
trap restaurar_mesas EXIT

# apuestas a todos los números de una rueda
apuestas_americana() {
  local m=$1; local out='{"type":"straight","payload":"00","amount":'$m'}'
  for n in $(seq 0 36); do out="$out,{\"type\":\"straight\",\"payload\":\"$n\",\"amount\":$m}"; done
  echo "$out"
}
apuestas_europea() {
  local m=$1; local out='{"type":"straight","payload":"0","amount":'$m'}'
  for n in $(seq 1 36); do out="$out,{\"type\":\"straight\",\"payload\":\"$n\",\"amount\":$m}"; done
  echo "$out"
}

# neto de una ronda cubriendo toda la rueda
neto() {
  local mesa=$1; local bets=$2
  local antes=$(get /api/me "$PLT" | jq -r .user.balance)
  post /api/game/spin "$PLT" "{\"bets\":[$bets],\"game\":\"$mesa\"}" >/dev/null
  local despues=$(get /api/me "$PLT" | jq -r .user.balance)
  echo $((despues - antes))
}

echo "── Cubriendo TODA la rueda: el neto no depende de la suerte ──"
echo "   (si el pago del pleno estuviera mal, esto se ve de una)"

for i in 1 2 3; do
  check "europea, ronda $i: paga 35 a 1"   "$(neto europea "$(apuestas_europea 10)")"   "-10"
done
for i in 1 2 3; do
  check "americana clásica, ronda $i: paga 35 a 1" "$(neto americana "$(apuestas_americana 10)")" "-20"
done

echo
echo "── Y Catatumbo sigue pagando 29 a 1 (sin rayo en el ganador) ──"
echo "   38×10 = 380 apostado, cobra 300 → neto −80 salvo que pegue un rayo"
for i in 1 2 3 4 5 6; do
  R=$(neto catatumbo "$(apuestas_americana 10)")
  if [ "$R" = "-80" ]; then echo "  ✓ ronda $i: neto −80 (sin rayo)"; ok=$((ok+1));
  elif [ "$R" -gt "-80" ]; then echo "  ✓ ronda $i: neto $R (pegó un rayo, cobra más)"; ok=$((ok+1));
  else echo "  ✗ ronda $i: neto $R — nunca debería ser menos que −80"; fail=$((fail+1)); fi
done

put /api/admin/settings "$ADT" '{"settings":{"max_win_per_spin":50000}}' >/dev/null
echo
echo "═══ $ok pasadas, $fail fallidas ═══"
exit $fail
