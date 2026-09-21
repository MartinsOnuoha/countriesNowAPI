# The serving image.
#
# The dataset is baked in rather than fetched at boot. That is the whole point
# of the two-plane design: a replica that has started has everything it will
# ever need, so there is nothing for it to be *down to*. "API is down" was filed
# eleven times against V1 and every instance traced to a runtime dependency.
#
# It also means the image tag and the dataset version are the same fact. A
# rollback is a rollback of the data too, which is a property you want the first
# time a bad curation run reaches production.
#
# The artifact must exist in the build context. CI builds it with the harness
# and passes it through; see .github/workflows/release.yml.

# ---- build ------------------------------------------------------------------

FROM oven/bun:1.2-alpine AS build
WORKDIR /app

# Dependencies first, so a source-only change reuses the layer.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY tsconfig.json ./
COPY src ./src

# ---- runtime ----------------------------------------------------------------

FROM oven/bun:1.2-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    COUNTRIESNOW_ARTIFACT=/app/data/artifacts/countriesnow.sqlite

RUN addgroup -S app && adduser -S -G app app

COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/src ./src

# Renamed to a fixed path so COUNTRIESNOW_ARTIFACT is static across releases.
# The version is still authoritative inside the file and is what the ETag and
# /ready report; the filename is just a mount point.
ARG ARTIFACT=data/artifacts/countriesnow.sqlite
COPY --chown=app:app ${ARTIFACT} /app/data/artifacts/countriesnow.sqlite

USER app
EXPOSE 3000

# Liveness only. Readiness is /ready and is the orchestrator's business — a
# replica with no artifact is alive but must not be sent traffic, and conflating
# the two is how a bad deploy takes down a healthy fleet.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD bun -e 'const r = await fetch("http://127.0.0.1:" + (process.env.PORT ?? 3000) + "/health"); process.exit(r.ok ? 0 : 1)'

CMD ["bun", "run", "src/index.ts"]
