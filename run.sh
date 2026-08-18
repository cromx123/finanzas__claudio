#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v docker &>/dev/null; then
  echo "Error: docker no está instalado o no está en el PATH." >&2
  exit 1
fi

cd "$SCRIPT_DIR/infra"

echo "Building images..."
docker compose build

echo "Starting the containers..."
docker compose up -d

echo "Containers started successfully."
docker compose ps
echo
echo "API:  http://localhost:8000"
echo "Web:  http://localhost:3005"
echo "Script completed."
