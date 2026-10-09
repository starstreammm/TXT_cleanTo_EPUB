# ===== 1. Python Build =====
FROM python:3.14.6-alpine3.24 AS backend-build

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install pip build dependencies
# RUN apk add --no-cache build-base libffi-dev
RUN apk add --no-cache uv

COPY pyproject.toml uv.lock .
RUN uv sync --frozen --no-dev


# ===== 2. Final Runtime Image =====
FROM nginx:alpine3.24

WORKDIR /app

EXPOSE 80

VOLUME /app/data

# Install Supervisor + Pandoc
RUN apk add --no-cache tini supervisor pandoc

# Copy Python environment
COPY --from=backend-build /usr/local/bin/python /usr/local/bin/python
COPY --from=backend-build /app/.venv /app/.venv
ENV PYTHONPATH="/app/.venv/lib/python3.14/site-packages"

# Copy frontend build artifacts
# npm run build has already been run in the frontend build stage, so we can copy the build artifacts directly
COPY build/client /usr/share/nginx/html

# Nginx Entry Point
COPY nginx_entrypoint.sh /usr/local/bin/nginx_entrypoint.sh
RUN chmod +x /usr/local/bin/nginx_entrypoint.sh

# Copy application code
COPY supervisord.conf .
COPY api ./api

# Start: Python + Nginx
ENTRYPOINT ["tini", "--"]
CMD ["supervisord", "-c", "/app/supervisord.conf"]