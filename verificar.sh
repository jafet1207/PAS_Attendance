#!/usr/bin/env bash
# Puerta de calidad local: compila backend + frontend y corre la suite de pruebas del backend.
# Mismo comando que usa .github/workflows/ci.yml, para que "verde en mi máquina" y "verde en CI"
# signifiquen lo mismo.
set -u

echo "==> Compilando backend y frontend..."
npm run build || { echo "❌ Error: la compilación ha fallado." >&2; exit 2; }

echo "==> Corriendo la suite de pruebas del backend..."
npm run test:backend || { echo "❌ Error: la suite de pruebas ha fallado." >&2; exit 2; }

echo "✅ Verificación exitosa. Todo está listo para enviar."
exit 0
