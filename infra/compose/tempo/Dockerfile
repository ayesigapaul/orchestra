# Configuration is baked into the image, as everywhere in the local stack. Tempo runs as one binary,
# every component in one process.
FROM grafana/tempo:3.0.3
COPY tempo.yaml /etc/tempo.yaml
CMD ["-config.file=/etc/tempo.yaml"]
