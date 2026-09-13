# Configuration is baked into the image, as everywhere in the local stack. The image has no shell, so
# it carries no health check, and nothing waits for it: telemetry is best effort, and a service whose
# spans cannot be exported serves exactly as before.
FROM otel/opentelemetry-collector:0.160.0
COPY config.yaml /etc/otelcol/config.yaml
