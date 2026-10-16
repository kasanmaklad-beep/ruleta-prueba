#!/bin/bash
# Loop desatendido: una tarea por vuelta hasta que TAREAS-FIESTAANIMAL.md diga TODO LISTO.
# Uso:  cd ~/ruleta-deploy && ./loop-fiestaanimal.sh
cd "$(dirname "$0")"
MAX=30
for i in $(seq 1 $MAX); do
  echo "================ VUELTA $i de $MAX — $(date '+%H:%M') ================"
  claude -p --dangerously-skip-permissions --model opus \
    "Lee SPEC-FIESTAANIMAL.md y TAREAS-FIESTAANIMAL.md. Toma la PRIMERA tarea marcada [ ] de la Fase 1 (ignora la Fase 2 mientras diga PAUSA). Hazla completa, verifica (npm run build y las pruebas que la tarea indique), haz commit en español, y marca la tarea [x]. Si no puedes terminarla, anota BLOQUEADA: <motivo> debajo y pasa a la siguiente. Si todas las tareas de Fase 1 están [x], agrega la línea TODO LISTO FASE 1 al final del archivo y termina. Haz UNA sola tarea en esta sesión." \
    2>&1 | tee -a loop-fiestaanimal.log
  if grep -q "TODO LISTO FASE 1" TAREAS-FIESTAANIMAL.md; then
    echo "✅ Fase 1 terminada en la vuelta $i"; break
  fi
done
echo "Fin del loop. Revisa docs/fiestaanimal/RESUMEN-PARA-GASEN.md"
