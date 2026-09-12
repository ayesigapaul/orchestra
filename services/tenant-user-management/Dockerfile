# Tenant User Management (ADR-0022). Node.js runs the TypeScript sources directly by stripping types,
# so there is no build step and no compiled output that could drift from the source.

FROM node:24.21.0-alpine AS deps
WORKDIR /app
# Keep in step with packageManager in package.json.
RUN npm install --global pnpm@12.4.1
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM node:24.21.0-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
USER node
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=3s --retries=12 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8080/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "src/main.ts"]
