// OpenTelemetry for this service (tech-stack.md section 7): the tracer provider every span is made
// with, and the context manager that keeps a request's span current across its awaits. Spans are
// exported over OTLP/HTTP when an endpoint is configured. Telemetry is best effort: a span that
// cannot be exported changes nothing a request does.
import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { AlwaysOnSampler, BatchSpanProcessor, ParentBasedSampler, TracerProvider } from '@opentelemetry/sdk-trace';

export interface TracingOptions {
  readonly serviceName: string;
  /** The OTLP/HTTP endpoint. Without one, spans are still made, and none is exported. */
  readonly otlpEndpoint?: string | undefined;
}

export interface Tracing {
  /** Exports the spans still queued, then stops. */
  shutdown(): Promise<void>;
}

export function startTracing({ serviceName, otlpEndpoint }: TracingOptions): Tracing {
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  const exporter =
    otlpEndpoint === undefined ? undefined : new OTLPTraceExporter({ url: `${otlpEndpoint.replace(/\/+$/, '')}/v1/traces` });
  const provider = new TracerProvider({
    // A trace the caller sampled is recorded, and so is every trace this service starts.
    sampler: new ParentBasedSampler({ root: new AlwaysOnSampler() }),
    resource: resourceFromAttributes({ 'service.name': serviceName }),
    spanProcessors: exporter === undefined ? [] : [new BatchSpanProcessor({ exporter })],
  });
  trace.setGlobalTracerProvider(provider);
  return { shutdown: () => provider.shutdown() };
}
