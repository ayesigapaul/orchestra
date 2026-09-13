# Shortcuts for working on Orchestra locally. Each target runs commands the documentation already
# gives, so none of them is the only way to do anything. `make` on its own lists the targets.
#
# Written for GNU Make 3.81, the version macOS ships.

COMPOSE := docker compose -f infra/compose/docker-compose.yml
SERVICE ?=

.DEFAULT_GOAL := help
.PHONY: help up down restart reset ps logs traces seed probe smoke
.PHONY: test test-gateway test-tenant-user-management check

help: ## List the targets
	@awk 'BEGIN { FS = ":.*## " } /^[a-z][a-z-]*:.*## / { printf "  make %-30s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

up: ## Build and start the local stack, wait until it is healthy, and seed the local Tenant
	$(COMPOSE) up -d --build --wait --wait-timeout 420
	infra/compose/seed-local-tenant.sh
	@echo "The edge is at http://localhost:9080, Keycloak at http://localhost:8080 (console at /admin),"
	@echo "and Grafana, with the stack's traces, at http://localhost:3000."

down: ## Stop the local stack, keeping its data
	$(COMPOSE) down

restart: ## Stop the local stack and start it again, keeping its data
	$(MAKE) --no-print-directory down
	$(MAKE) --no-print-directory up

reset: ## Delete the local stack's data and start it again from empty volumes
	$(COMPOSE) down -v --remove-orphans
	$(MAKE) --no-print-directory up

ps: ## Show every container and its health
	$(COMPOSE) ps

logs: ## Follow the logs of every service, or of one with SERVICE=<name>
	$(COMPOSE) logs -f $(SERVICE)

traces: ## Follow the spans the Collector prints; Grafana at localhost:3000 shows them as traces
	$(COMPOSE) logs -f otel-collector

seed: ## Seed the local Tenant and the dev user's Platform User again
	infra/compose/seed-local-tenant.sh

probe: ## Call the identity probe through the edge as the dev user, in a new trace
	infra/compose/probe-identity.sh

smoke: ## Bring the stack up and prove it end to end, as CI does
	infra/compose/smoke.sh

test: test-gateway test-tenant-user-management ## Test both services, each from its own lockfile

test-gateway: ## Lint and test the Gateway with the pinned uv
	uvx uv@0.12.13 --directory services/gateway run ruff check
	uvx uv@0.12.13 --directory services/gateway run ruff format --check
	uvx uv@0.12.13 --directory services/gateway run pytest

test-tenant-user-management: ## Typecheck and test Tenant User Management
	cd services/tenant-user-management && pnpm install --frozen-lockfile && pnpm typecheck && pnpm test

check: ## Run the documentation and repository checks CI runs
	npx --yes markdownlint-cli2@0.23.2
	node scripts/validate-docs.mjs
	node scripts/open-questions.mjs --check
	node scripts/validate-schemas.mjs
	node scripts/build-diagrams.mjs --check
	node scripts/build-docs-nav.mjs --check
	node scripts/build-openapi.mjs --check
	node scripts/check-service-boundaries.mjs
