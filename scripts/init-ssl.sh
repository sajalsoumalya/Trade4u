#!/bin/bash
# Get Let's Encrypt SSL certificate for trade4u.soumalya.in
# Usage: ./scripts/init-ssl.sh your-email@example.com

EMAIL="${1:-your-email@example.com}"
DOMAIN="trade4u.soumalya.in"
CERT_DIR="./certs"

mkdir -p "$CERT_DIR"

echo "Fetching SSL certificate for $DOMAIN..."

# Stop nginx if running
docker compose stop nginx-proxy 2>/dev/null || true

# Get certificate using certbot
docker run --rm \
  -v "$(pwd)/certs:/etc/letsencrypt" \
  -v "/var/run/docker.sock:/var/run/docker.sock" \
  certbot/certbot:latest certonly \
  --docker-compose \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --standalone \
  --keep-until-expiring || {
    echo "Failed to get certificate. Make sure port 80 is open."
    exit 1
  }

echo "Certificate obtained successfully!"
echo "Files created in $CERT_DIR/"
ls -la "$CERT_DIR/live/$DOMAIN/"