#!/bin/bash
# Etapa 3a: que el servidor juegue bien las dos ruedas.
API=http://localhost:8787
ok=0; fail=0
check(){ if echo "$3" | jq -e "$2" >/dev/null 2>&1; then echo "  ✓ $1"; ok=$((ok+1)); else echo "  ✗ $1"; echo "     → $(echo "$3"|head -c 260)"; fail=$((fail+1)); fi; }
post(){ curl -s -X POST "$API$1" -H 'Content-Type: application/json' ${2:+-H "Authorization: Bearer $2"} -d "$3"; }
put(){  curl -s -X PUT  "$API$1" -H 'Content-Type: application/json' ${2:+-H "Authorization: Bearer $2"} -d "$3"; }
get(){  curl -s "$API$1" ${2:+-H "Authorization: Bearer $2"}; }

ADT=$(post /api/auth/login "" '{"username":"admin","password":"123456"}' | jq -r .token)
PLT=$(post /api/auth/login "" '{"username":"humo","password":"humo1234"}' | jq -r .token)

echo "── El catálogo de mesas ──"
R=$(get /api/games "$PLT")
check "lista las mesas de ruleta" '[.mesas[] | select(.tipo == "ruleta" or .tipo == null)] | length >= 4' "$R"
check "Catatumbo: americana, 38 casillas, con rayos, pleno 29" \
  '.mesas[] | select(.id=="catatumbo") | .casillas==38 and .rayos==true and .pago_pleno==29 and .activo==true' "$R"
check "Europea Clásica: 37 casillas, sin rayos, pleno 35" \
  '.mesas[] | select(.id=="europea") | .casillas==37 and .rayos==false and .pago_pleno==35' "$R"
check "la europea no tiene doble cero" '.mesas[] | select(.id=="europea") | .doble_cero==false' "$R"
check "la americana le deja 5,3% a la casa en las de afuera" \
  '.mesas[] | select(.id=="catatumbo") | .ventaja_resto_mesa==5.3' "$R"
check "la europea le deja 2,7%" '.mesas[] | select(.id=="europea") | .ventaja_resto_mesa==2.7' "$R"
check "Catatumbo está encendida" '.mesas[] | select(.id=="catatumbo") | .activo == true' "$R"

echo
echo "── El catálogo manda el orden de la rueda (Etapa 3b) ──"
# El navegador dibuja las casillas con ESTE orden y el servidor devuelve el
# resultado como una posición dentro de él. Si no coincidieran, la bola caería
# en un número distinto al que salió.
check "Catatumbo manda las 38 casillas en orden" \
  '.mesas[] | select(.id=="catatumbo") | .orden | length == 38' "$R"
check "la europea manda 37 y ninguna es el 00" \
  '.mesas[] | select(.id=="europea") | (.orden|length==37) and ((.orden|map(tostring)|index("00"))==null)' "$R"
ORD=$(echo "$R" | jq -c '.mesas[] | select(.id=="catatumbo") | .orden')
G=$(post /api/game/spin "$PLT" '{"bets":[{"type":"color","payload":"red","amount":1}],"game":"catatumbo"}')
check "el número que sale es el que está en esa posición del orden" \
  "(${ORD}[.resultIndex] | tostring) == (.resultNum | tostring)" "$G"

echo
echo "── Mesas apagadas: no se puede jugar ──"
R=$(post /api/game/spin "$PLT" '{"bets":[{"type":"color","payload":"red","amount":100}],"game":"europea"}')
check "la europea (apagada) rechaza el giro" '.error | test("no existe o está cerrada")' "$R"
R=$(post /api/game/spin "$PLT" '{"bets":[{"type":"color","payload":"red","amount":100}],"game":"inventada"}')
check "una mesa inventada también" '.error | test("no existe o está cerrada")' "$R"

echo
echo "── Las mesas se manejan desde el panel (Etapa 4) ──"
R=$(get /api/admin/games "$ADT")
check "el panel lista las mesas con sus cuentas" \
  '(.mesas | length) >= 4 and (.mesas[0] | has("ventaja_pleno")) and (.mesas[0] | has("rondas"))' "$R"
check "y dice si el catálogo ya está en la base" '.en_la_base == true' "$R"
R=$(post /api/admin/games "$ADT" '{"id":"mesa_trampa","label":"Trampa","rueda":"europea","animales":false,"rayos":false,"pago_pleno":29}')
check "no deja guardar 29 a 1 en una mesa SIN rayos" '.error | test("tiene que pagar 35")' "$R"
R=$(post /api/admin/games "$ADT" '{"id":"mesa_rara","label":"Rara","rueda":"marciana","animales":false,"rayos":false,"pago_pleno":35}')
check "ni una rueda que no existe" '.error | test("rueda no existe")' "$R"
# Para probar esto hace falta que Catatumbo sea la ÚNICA abierta, así que se
# cierran las demás un momento y después se dejan como estaban.
ABIERTAS=$(get /api/admin/games "$ADT" | jq -r '[.mesas[] | select(.activo and .id != "catatumbo") | .id] | join(" ")')
for m in $ABIERTAS; do post "/api/admin/games/$m/activo" "$ADT" '{"activo":false}' >/dev/null; done
R=$(post /api/admin/games/catatumbo/activo "$ADT" '{"activo":false}')
check "no deja apagar la última mesa encendida" '.error | test("única mesa encendida")' "$R"
for m in $ABIERTAS; do post "/api/admin/games/$m/activo" "$ADT" '{"activo":true}' >/dev/null; done
R=$(get /api/games "$PLT")
check "el jugador recibe la presentación de cada mesa" '.mesas[] | select(.id=="catatumbo") | .icono != null and .detalle1 != null' "$R"

echo
echo "── El panel informa las dos ruedas ──"
# La prueba fija el perfil que quiere medir: no se puede asumir en qué quedó
# la configuración de una corrida anterior.
put /api/admin/settings "$ADT" '{"settings":{"ltg_pesos":"40,20,15,11,7,4,2,1","ltg_min":1,"ltg_max":5}}' >/dev/null
R=$(get /api/admin/settings "$ADT")
check "informa la ventaja por rueda" '.lightning.por_rueda | length == 2' "$R"
check "americana: pleno 5,4% y resto 5,3%" \
  '.lightning.por_rueda[] | select(.rueda=="americana") | .ventaja_pleno==5.4 and .ventaja_resto_mesa==5.3' "$R"
check "europea: el MISMO ajuste deja menos (los rayos pegan más seguido)" \
  '.lightning.por_rueda[] | select(.rueda=="europea") | .ventaja_pleno < 5.4 and .ventaja_resto_mesa==2.7' "$R"

echo
echo "── Que no se cuele el 00 en una rueda de un solo cero ──"
# Se enciende la europea a mano en la base para poder probarla de verdad.
echo "  (nota: la europea se prueba con giros directos más abajo, en el script de node)"

echo
echo "═══ $ok pasadas, $fail fallidas ═══"
exit $fail
