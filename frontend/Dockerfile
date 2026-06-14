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
COPY entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]