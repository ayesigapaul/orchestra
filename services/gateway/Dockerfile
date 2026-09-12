# The build context is this directory and nothing above it (ADR-0020, rule B1).
FROM ghcr.io/astral-sh/uv:0.12.13 AS uv

FROM python:3.14.7-slim
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --locked --no-dev
COPY src ./src
RUN useradd --system --uid 10001 gateway
USER gateway
EXPOSE 8000
HEALTHCHECK --interval=5s --timeout=3s --retries=20 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz')"]
CMD ["/app/.venv/bin/uvicorn", "orchestra_gateway.app:app", "--app-dir", "src", "--host", "0.0.0.0", "--port", "8000"]
