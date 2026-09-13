# Runs the integration suite on the local stack's network, through PgBouncer, as the service's own
# roles (infra/compose/smoke.sh). Development dependencies are installed here and never in the
# service's image. Built from the service directory: docker build -f test/integration.Dockerfile .
FROM node:24.21.0-alpine
# Keep in step with packageManager in package.json.
RUN npm install --global pnpm@12.4.1
WORKDIR /app
RUN chown node:node /app
USER node
COPY --chown=node:node package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY --chown=node:node tsconfig.json vitest.integration.config.ts ./
COPY --chown=node:node src ./src
COPY --chown=node:node test ./test
CMD ["pnpm", "test:integration"]
