# Configuration is baked into the image, not bind-mounted. A bind mount only works when the Docker
# daemon's VM shares the host path, and when it does not the container silently sees an empty
# directory. A build context is uploaded by the client, so this works wherever Docker runs.
FROM apache/apisix:3.18.0-debian
COPY config.yaml apisix.yaml /usr/local/apisix/conf/
COPY orchestra /usr/local/apisix/orchestra
