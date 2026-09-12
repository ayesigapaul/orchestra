# The realm is baked into the image rather than bind-mounted, for the same reason as the APISIX
# image: a build context always reaches the daemon, a bind mount only if the host path is shared.
FROM quay.io/keycloak/keycloak:26.7.3
COPY orchestra-realm.json /opt/keycloak/data/import/
