# ── NeedMap AI Frontend (Expo Web) ─────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* yarn.lock* ./
RUN npm install --legacy-peer-deps

COPY . .

# Build-time env: Cloud Run backend URL
ARG BACKEND_URL
ENV EXPO_PUBLIC_BACKEND_URL=$BACKEND_URL

RUN npx expo export --platform web

# ── production (static files via nginx) ─────────────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

RUN printf 'server {\n\
    listen 8080;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    location / {\n\
        try_files $$uri $$uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]