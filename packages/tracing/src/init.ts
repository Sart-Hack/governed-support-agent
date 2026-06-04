import { type Tracer, trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { BatchSpanProcessor, type SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

export interface TracingHandle {
  tracer: Tracer;
  /** False when no Langfuse keys were found; spans are recorded to nowhere. */
  enabled: boolean;
  shutdown(): Promise<void>;
}

export interface InitTracingOptions {
  serviceName?: string;
  /** Langfuse base URL. Defaults to LANGFUSE_BASE_URL or http://localhost:3001. */
  baseUrl?: string;
  publicKey?: string;
  secretKey?: string;
  /** Inject a processor (e.g. an in-memory one) instead of the Langfuse exporter; for tests. */
  spanProcessor?: SpanProcessor;
}

/**
 * Wire OpenTelemetry traces to Langfuse via its OTLP/HTTP endpoint. Returns a
 * no-op (disabled) handle when no Langfuse keys are present, so the agent runs
 * fine offline and in tests without exporting anywhere.
 */
export function initTracing(opts: InitTracingOptions = {}): TracingHandle {
  const serviceName = opts.serviceName ?? "governed-support-agent";

  const processor = opts.spanProcessor ?? langfuseProcessor(opts);
  if (!processor) {
    return { tracer: trace.getTracer(serviceName), enabled: false, shutdown: async () => {} };
  }

  const provider = new NodeTracerProvider({
    resource: new Resource({ [ATTR_SERVICE_NAME]: serviceName }),
    spanProcessors: [processor],
  });
  provider.register();

  return {
    tracer: provider.getTracer(serviceName),
    enabled: true,
    shutdown: () => provider.shutdown(),
  };
}

function langfuseProcessor(opts: InitTracingOptions): SpanProcessor | undefined {
  const baseUrl = opts.baseUrl ?? process.env.LANGFUSE_BASE_URL ?? "http://localhost:3001";
  const publicKey =
    opts.publicKey ??
    process.env.LANGFUSE_PUBLIC_KEY ??
    process.env.LANGFUSE_INIT_PROJECT_PUBLIC_KEY;
  const secretKey =
    opts.secretKey ??
    process.env.LANGFUSE_SECRET_KEY ??
    process.env.LANGFUSE_INIT_PROJECT_SECRET_KEY;
  if (!publicKey || !secretKey) return undefined;

  const auth = Buffer.from(`${publicKey}:${secretKey}`).toString("base64");
  const exporter = new OTLPTraceExporter({
    url: `${baseUrl.replace(/\/$/, "")}/api/public/otel/v1/traces`,
    headers: { Authorization: `Basic ${auth}` },
  });
  return new BatchSpanProcessor(exporter);
}
