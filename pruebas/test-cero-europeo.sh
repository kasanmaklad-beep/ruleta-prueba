#!/bin/bash
# Las combinaciones del cero en la mesa europea: que el servidor las acepte y
# que paguen lo que dice la mesa. Se corre con la europea encendida a mano en
# lib.js (activo: true), igual que test-europea.sh.
#
# Por qué importa: en la europea el 0 se combina con la primera columna
# (splits 0/1, 0/2, 0/3, los dos tríos y los primeros cuatro). Todas pagan por
# cantidad de números, así que en una rueda de 37 le dejan a la casa el mismo
# 2,7% que el resto de la mesa. Si alguna pagara de menos sería un robo
# escondido, y de más, un agujero en la caja.
API=http://localhost:8787
ok=0; fail=0
check(){ if echo "$3" | jq -e "$2" >/dev/null 2>&1; then echo "  ✓ $1"; ok=$((ok+1)); else echo "  ✗ $1"; echo "     → $(echo "$3"|head -c 260)"; fail=$((fail+1)); fi; }
post(){ curl -s -X POST "$API$1" -H 'Content-Type: application/json' ${2:+-H "Authorization: Bearer $2"} -d "$3"; }

ADT=$(post /api/auth/login "" '{"username":"admin","password":"123456"}' | jq -r .token)
S=$(date +%s); N=$(echo "$S" | tail -c 8)
post /api/auth/register "" "{\"username\":\"c0_$S\",\"password\":\"clave123\",\"first_name\":\"Cero\",\"last_name\":\"Test\",\"cedula\":\"${N}7\",\"phone\":\"04141112233\",\"email\":\"c0$S@correo.com\",\"bank\":\"0134 - Banesco\"}" >/dev/null
PLT=$(post /api/auth/login "" "{\"username\":\"c0_$S\",\"password\":\"clave123\"}" | jq -r .token)
post /api/admin/deposit "$ADT" "{\"username\":\"c0_$S\",\"amount\":500000}" >/dev/null

MONTO=10

# nombre | tipo | payload | pago (ganancia neta a 1)
COMBOS=(
  "split 0-1|split|0-1|17"
  "split 0-2|split|0-2|17"
  "split 0-3|split|0-3|17"
  "trío 0-1-2|street|0-1-2|11"
  "trío 0-2-3|street|0-2-3|11"
  "primeros cuatro 0-1-2-3|corner|0-1-2-3|8"
)

echo "── El servidor acepta las combinaciones del cero en la europea ──"
for c in "${COMBOS[@]}"; do
  IFS='|' read -r nombre tipo payload pago <<< "$c"
  R=$(post /api/game/spin "$PLT" "{\"bets\":[{\"type\":\"$tipo\",\"payload\":\"$payload\",\"amount\":$MONTO}],\"game\":\"europea\"}")
  check "acepta $nombre" '.resultNum != null' "$R"
done

echo
echo "── Y paga exactamente lo que corresponde ──"
# Se gira hasta juntar al menos dos aciertos por combinación (con tope, para
# que una mala racha no deje el script corriendo para siempre). La cuenta es
# exacta: la ganancia total tiene que ser aciertos × (pago + 1) × monto.
for c in "${COMBOS[@]}"; do
  IFS='|' read -r nombre tipo payload pago <<< "$c"
  nums=$(echo "$payload" | tr '-' ' ')
  aciertos=0; ganado=0; giros=0
  while [ $aciertos -lt 2 ] && [ $giros -lt 400 ]; do
    R=$(post /api/game/spin "$PLT" "{\"bets\":[{\"type\":\"$tipo\",\"payload\":\"$payload\",\"amount\":$MONTO}],\"game\":\"europea\"}")
    n=$(echo "$R" | jq -r .resultNum)
    w=$(echo "$R" | jq -r .win)
    ganado=$((ganado + w)); giros=$((giros + 1))
    for x in $nums; do [ "$n" = "$x" ] && aciertos=$((aciertos + 1)); done
  done
  esperado=$((aciertos * (pago + 1) * MONTO))
  check "$nombre: $aciertos aciertos en $giros giros → paga $ganado (esperado $esperado)" \
    ".ganado == $esperado" "{\"ganado\": $ganado}"
done

echo
echo "═══ $ok pasadas, $fail fallidas ═══"
exit $fail
