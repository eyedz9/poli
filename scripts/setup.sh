#!/usr/bin/env bash
set -e

echo "=== PoliReports setup ==="

# 1. Copy env
if [ ! -f .env ]; then
  cp .env.example .env

  # Generate secrets automatically — don't leave placeholder values
  REDIS_PASSWORD=$(openssl rand -hex 32)
  N8N_PASSWORD=$(openssl rand -hex 16)
  JWT_SECRET=$(openssl rand -hex 32)
  API_KEY_SALT=$(openssl rand -hex 32)
  INTERNAL_TRIGGER_TOKEN=$(openssl rand -hex 32)

  sed -i "s/REDIS_PASSWORD=change-me.*/REDIS_PASSWORD=${REDIS_PASSWORD}/" .env
  sed -i "s/N8N_PASSWORD=change-me.*/N8N_PASSWORD=${N8N_PASSWORD}/" .env
  sed -i "s/JWT_SECRET=change-me.*/JWT_SECRET=${JWT_SECRET}/" .env
  sed -i "s/API_KEY_SALT=change-me.*/API_KEY_SALT=${API_KEY_SALT}/" .env
  sed -i "s/INTERNAL_TRIGGER_TOKEN=change-me.*/INTERNAL_TRIGGER_TOKEN=${INTERNAL_TRIGGER_TOKEN}/" .env

  echo "Created .env with auto-generated secrets."
  echo ""
  echo "  n8n password: ${N8N_PASSWORD}"
  echo "  (save this — it is not shown again)"
else
  echo ".env already exists, skipping."
fi

# 2. Create secrets dir (for GCP service account)
mkdir -p secrets

echo ""
echo "Next: fill in your API keys in .env, then:"
echo "  docker compose up --build"
echo ""
echo "Services (localhost only — not exposed to network):"
echo "  API        http://localhost:3000"
echo "  Dashboard  http://localhost:5173"
echo "  n8n        http://localhost:5678"
echo "  Redis UI   http://localhost:5540  (docker compose --profile dev up)"
