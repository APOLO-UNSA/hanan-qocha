#!/usr/bin/env bash
# Valida cada archivo de datos contra su esquema. Sale con error si alguno no cumple.
set -euo pipefail
status=0
for name in sensor sites vision recommendations; do
  schema="data/contracts/${name}.schema.json"
  [ -f "$schema" ] || continue
  for dir in data/mock data/processed; do
    file="${dir}/${name}.json"
    if [ -f "$file" ]; then
      echo "Validando $file"
      check-jsonschema --schemafile "$schema" "$file" || status=1
    fi
  done
done
exit $status
