import { z } from "zod";
import type { Tool, ToolResult } from "../types.js";
import {
  ALL_ENDPOINT_KEYS,
  PROVIDER_KEYS,
  PROVIDERS,
} from "./_shared/provider-registry.js";
import {
  createStatusError,
  fetchCachedStatus,
  normalizeStatusOutputFormat,
  statusOutputFormatSchema,
} from "./_shared/status-client.js";

const providerEnum = z.enum(PROVIDER_KEYS as [string, ...string[]]).describe(
  `Provider key. One of: ${PROVIDER_KEYS.join(", ")}.`,
);

const endpointEnum = z
  .enum(ALL_ENDPOINT_KEYS as [string, ...string[]])
  .optional()
  .describe(
    [
      "Which endpoint to fetch for the provider. Most Statuspage-style providers expose:",
      "summary, status, components, incidents, incidents_unresolved,",
      "scheduled_maintenances, scheduled_maintenances_active, scheduled_maintenances_upcoming.",
      "Single-page providers expose one of: status_page, system_status, health_status, status, global, rss, atom, current, current_full, history, products, instances, notices.",
      "Omit to fetch the provider's primary endpoint.",
    ].join(" "),
  );

function listEndpointsError(provider: string): ToolResult {
  return createStatusError(
    `Unknown provider "${provider}". Known providers: ${PROVIDER_KEYS.join(", ")}.`,
  );
}

function unknownEndpointError(
  provider: string,
  endpoint: string,
  available: string[],
): ToolResult {
  return createStatusError(
    `Provider "${provider}" has no endpoint "${endpoint}". Available endpoints: ${available.join(", ")}.`,
  );
}

const tool: Tool = {
  name: "status_check",
  description:
    "Fetches a status page or status API for any supported provider. Pass `provider` (e.g. \"newrelic\", \"openai\", \"aws\") and optionally `endpoint` (e.g. \"summary\", \"incidents_unresolved\", \"status_page\"). Omitting `endpoint` returns the provider's primary feed. Use `format` to control output shape.",
  rateLimit: {
    tool: { max: 120 },
    client: { max: 60 },
  },
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  inputSchema: {
    provider: providerEnum,
    endpoint: endpointEnum,
    format: statusOutputFormatSchema,
  },

  async execute({ provider, endpoint, format }) {
    const entry = PROVIDERS[provider];
    if (!entry) return listEndpointsError(provider);

    const endpointKey = endpoint ?? entry.defaultEndpoint;
    const target = entry.endpoints[endpointKey];
    if (!target) {
      return unknownEndpointError(
        provider,
        endpointKey,
        Object.keys(entry.endpoints).sort(),
      );
    }

    return fetchCachedStatus({
      brand: entry.brand,
      type: endpointKey,
      url: target.url,
      maxChars: target.maxChars,
      format: normalizeStatusOutputFormat(format),
    });
  },
};

export default tool;
