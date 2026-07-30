#!/bin/bash
# Mide con giros de verdad contra el servidor que la rueda europea pague bien.
# El script se abre la mesa europea solo y la deja como estaba al terminar.
# El puerto se puede pasar por parámetro (wrangler no siempre toma el 8787):
#   bash <este script> http://localhost:8795
API=${1:-http://localhost:8787}
ok=0; fail=0
check(){ if echo "$3" | jq -e "$2" >/dev/null 2>&1; then echo "  ✓ $1"; ok=$((ok+1)); else echo "  ✗ $1"; echo "     → $(echo "$3"|head -c 240)"; fail=$((fail+1)); fi; }
post(){ curl -s -X POST "$API$1" -H 'Content-Type: application/json' ${2:+-H "Authorization: Bearer $2"} -d "$3"; }
put(){  curl -s -X PUT  "$API$1" -H 'Content-Type: application/json' ${2:+-H "Authorization: Bearer $2"} -d "$3"; }
get(){  curl -s "$API$1" ${2:+-H "Authorization: Bearer $2"}; }

ADT=$(post /api/auth/login "" '{"username":"admin","password":"123456"}' | jq -r .token)
S=$(date +%s); N=$(echo "$S" | tail -c 8)
post /api/auth/register "" "{\"username\":\"eu_$S\",\"password\":\"clave123\",\"first_name\":\"Euro\",\"last_name\":\"Test\",\"cedula\":\"${N}2\",\"phone\":\"04141112233\",\"email\":\"eu$S@correo.com\",\"bank\":\"0134 - Banesco\"}" >/dev/null
PLT=$(post /api/auth/login "" "{\"username\":\"eu_$S\",\"password\":\"clave123\"}" | jq -r .token)
post /api/admin/deposit "$ADT" "{\"username\":\"eu_$S\",\"amount\":2000000}" >/dev/null
put /api/admin/settings "$ADT" '{"settings":{"max_bet_pleno":100,"max_win_per_spin":999999999}}' >/dev/null
# La europea tiene que estar abierta para jugarla. El script se la abre y la
# deja como estaba al terminar: así no depende de en qué estado quedó el salón
# ni obliga a tocar nada a mano (antes el encabezado pedía encenderla en lib.js).
ESTADO_EUROPEA=$(get /api/admin/games "$ADT" | jq -r '.mesas[] | select(.id=="europea") | if .activo then 1 elif .en_pruebas then 2 else 0 end')
post "/api/admin/games/europea/activo" "$ADT" '{"estado":1}' >/dev/null
restaurar_europea(){ post "/api/admin/games/europea/activo" "$ADT" "{\"estado\":${ESTADO_EUROPEA:-0}}" >/dev/null; }
trap restaurar_europea EXIT


echo "── El 00 no existe en la europea ──"
R=$(post /api/game/spin "$PLT" '{"bets":[{"type":"straight","payload":"00","amount":10}],"game":"europea"}')
check "rechaza un pleno al 00" '.error | test("no existe el 00")' "$R"
R=$(post /api/game/spin "$PLT" '{"bets":[{"type":"topline","payload":"0-00-1-2-3","amount":10}],"game":"europea"}')
check "rechaza el top line (lleva 00)" '.error | test("no existe el 00")' "$R"
R=$(post /api/game/spin "$PLT" '{"bets":[{"type":"straight","payload":"00","amount":10}],"game":"catatumbo"}')
check "pero en Catatumbo el 00 sí vale" '.resultNum != null' "$R"

echo
echo "── La europea clásica no tiene rayos ──"
R=$(post /api/game/spin "$PLT" '{"bets":[{"type":"color","payload":"red","amount":10}],"game":"europea"}')
check "no manda ningún rayo" '.lightning | length == 0' "$R"
check "y dice en qué mesa se jugó" '.game == "europea"' "$R"
R=$(post /api/game/spin "$PLT" '{"bets":[{"type":"color","payload":"red","amount":10}],"game":"catatumbo"}')
check "Catatumbo sí manda rayos" '.lightning | length > 0' "$R"

echo
echo "── Nunca sale el 00 en la europea (300 giros) ──"
CEROS=0; DOBLES=0
for i in $(seq 1 300); do
  n=$(post /api/game/spin "$PLT" '{"bets":[{"type":"color","payload":"red","amount":10}],"game":"europea"}' | jq -r .resultNum)
  [ "$n" = "00" ] && DOBLES=$((DOBLES+1))
  [ "$n" = "0" ] && CEROS=$((CEROS+1))
done
echo "  salieron $CEROS ceros y $DOBLES dobles cero en 300 giros"
check "el 00 no salió nunca" "$DOBLES == 0" "{\"DOBLES\":$DOBLES}"
check "el 0 sí sale (la rueda gira de verdad)" "$CEROS > 0" "{\"CEROS\":$CEROS}"

# ventaja_real <mesa> <tipo> <payload> <giros> <monto>
medir() {
  local mesa="$1" tipo="$2" payload="$3" giros="$4" monto="$5"
  local antes=$(get /api/me "$PLT" | jq -r .user.balance)
  for i in $(seq 1 $giros); do
    post /api/game/spin "$PLT" "{\"bets\":[{\"type\":\"$tipo\",\"payload\":\"$payload\",\"amount\":$monto}],\"game\":\"$mesa\"}" >/dev/null
  done
  local despues=$(get /api/me "$PLT" | jq -r .user.balance)
  echo "scale=2; (($antes - $despues) * 100) / ($giros*$monto)" | bc
}

echo
echo "── Lo que deja cada mesa, jugando de verdad ──"
echo -n "  Europea, al rojo (esperado ~2,7%) …………… "
V=$(medir europea color red 3000 100); echo "real: ${V}%"
echo -n "  Catatumbo, al rojo (esperado ~5,3%) ………… "
V=$(medir catatumbo color red 3000 100); echo "real: ${V}%"
echo -n "  Europea, al pleno 17 (esperado ~2,7%) …… "
V=$(medir europea straight 17 4000 100); echo "real: ${V}%"

put /api/admin/settings "$ADT" '{"settings":{"max_win_per_spin":50000}}' >/dev/null
echo
echo "═══ $ok pasadas, $fail fallidas ═══"
exit $fail
