# ── NeedMap AI Frontend (Expo Web) ─────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* yarn.lock* ./
RUN npm install --legacy-peer-deps

COPY . .

ARG BACKEND_URL
ENV EXPO_PUBLIC_BACKEND_URL=$BACKEND_URL

RUN npx expo export --platform web

# ── production (nginx) ─────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Cloud Run injects PORT env var — use it
# The 'envsubst' in the entrypoint substitutes $PORT at runtime
COPY <<'ENTRYPOINT' /docker-entrypoint.sh
#!/bin/sh
set -e

PORT="${PORT:-8080}"

cat > /etc/nginx/conf.d/default.conf << NGINX
server {
    listen ${PORT};
    server_name _;
    root /usr/share/nginx/html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 256;
}
NGINX

exec nginx -g "daemon off;"
ENTRYPOINT

RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]