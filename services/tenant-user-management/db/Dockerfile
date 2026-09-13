# Applies this service's migrations as the schema's owner role, with the dbmate release
# docs/10-architecture/tech-stack.md pins. Built from the service directory, like the service itself
# (ADR-0020, rule B1): docker build -f db/Dockerfile .
FROM ghcr.io/amacneil/dbmate:2.35.1
COPY db/migrations /db/migrations
# No schema dump, because the migrations are the record. `up --strict`, so a migration older than one
# already applied fails rather than slipping in. DATABASE_URL names the owner role and the schema.
ENTRYPOINT ["dbmate", "--migrations-dir", "/db/migrations", "--no-dump-schema", "--wait"]
CMD ["up", "--strict"]
