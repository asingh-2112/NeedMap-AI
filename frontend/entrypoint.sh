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