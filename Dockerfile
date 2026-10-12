# Multi-stage build for the personal app variant (ADR-0021):
# one Bun process serves the streamable-HTTP MCP API (/mcp) and the
# built web app (dist/) at / and /nutrition-tracker/.

# ---- Stage 1: build the web app -------------------------------------------
FROM oven/bun:1 AS build

WORKDIR /app

# Install all deps (dev deps needed for vue-tsc + vite) first for layer caching
COPY package.json bun.lock ./
COPY shared/package.json shared/
COPY server/package.json server/
RUN bun install --frozen-lockfile

# Build the Vue app (base: /nutrition-tracker/, per ADR-0013)
COPY . .
RUN bun run build

# ---- Stage 2: runtime ------------------------------------------------------
# Prod-only install: server needs @modelcontextprotocol/sdk + the shared
# workspace package (zod, js-quantities). The dataset SQLite DB is NOT baked
# into the image (407MB); it is volume-mounted at runtime.
FROM oven/bun:1

WORKDIR /app
ENV NODE_ENV=production \
    NUTRITION_DB_PATH=/app/server/data/opennutrition.sqlite \
    NUTRITION_PORT=3000

COPY package.json bun.lock ./
COPY shared/package.json shared/
COPY server/package.json server/
RUN bun install --production --frozen-lockfile

# Server + shared are run from TypeScript source (bun runs TS natively;
# shared exports ./index.ts directly)
COPY shared/ shared/
COPY server/ server/

# Built web app from stage 1
COPY --from=build /app/dist/ dist/

# Entrypoint fixes ownership of writable bind mounts, then drops to bun
COPY --chmod=755 docker/entrypoint.sh /app/entrypoint.sh

# Optionally remap the bun user (uid/gid 1000 in oven/bun) to the host user's
# uid/gid so bind-mount ownership lines up (pass HOST_UID/HOST_GID via compose
# build args). Skipped when unset or already 1000 — the entrypoint's root-side
# chown covers ownership either way; remapping just keeps host-side files
# owned by the host user. Fails the build if the uid collides.
ARG UID=
ARG GID=
RUN if [ -n "$UID" ] && [ "$UID" != "$(id -u bun)" ]; then \
      [ -z "$GID" ] && GID="$UID"; \
      usermod --uid "$UID" --gid "$GID" bun; \
    fi \
 && command -v setpriv >/dev/null

# Start as root so the entrypoint can chown bind mounts, then drop to bun
# via setpriv. The volume-mounted DB must be readable by the bun user
# (chmod 644 is enough — the server opens it readonly).
USER root
ENTRYPOINT ["/app/entrypoint.sh"]

EXPOSE 3000

CMD ["bun", "run", "server/index.ts"]
