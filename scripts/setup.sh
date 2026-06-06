#!/usr/bin/env bash
set -e

echo "=== PoliReports setup ==="

# 1. Copy env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — fill in your keys before starting."
else
  echo ".env already exists, skipping."
fi

# 2. Create secrets dir (for GCP service account)
mkdir -p secrets

echo ""
echo "Next steps:"
echo "  1. Edit .env with your API keys"
echo "  2. Add GCP service account JSON to secrets/gcp-service-account.json"
echo "  3. Run: docker compose up --build"
echo ""
echo "Services will be available at:"
echo "  API        http://localhost:3000"
echo "  Dashboard  http://localhost:5173"
echo "  n8n        http://localhost:5678"
echo "  Redis UI   http://localhost:5540  (run with: docker compose --profile dev up)"
