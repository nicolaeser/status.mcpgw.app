import { z } from "zod";
import { definePrompt } from "../_shared/define-prompt.js";
import { textPrompt } from "../_shared/prompt-result.js";
import { listStatusProviders } from "../../status/catalog.js";

const prompt = definePrompt({
  name: "status_investigation",
  title: "Status Investigation",
  description:
    "Builds a prompt for analyzing provider incidents, maintenance, and current status.",
  arguments: [
    {
      name: "providers",
      description:
        "Comma-separated provider slugs such as openai, cloudflare, or stripe",
      required: true,
    },
    {
      name: "focus",
      description:
        "What to assess, such as incidents, maintenance, or customer impact",
      required: false,
    },
  ],
  inputSchema: {
    providers: z.string().min(1),
    focus: z.string().optional(),
  },
  async complete(argumentName, value) {
    if (argumentName !== "providers") return [];

    return listStatusProviders().filter((provider) =>
      provider.toLowerCase().startsWith(value.toLowerCase()),
    );
  },
  async get({ providers, focus }) {
    const requestedProviders = providers
      .split(",")
      .map((provider) => provider.trim())
      .filter(Boolean);
    const focusLine = focus
      ? `Focus on ${focus}.`
      : "Focus on current incidents, active maintenance, overall service health, and user-visible impact.";

    return textPrompt(
      [
        "Investigate the following providers with the available status.mcpgw.app MCP tools:",
        "",
        ...requestedProviders.map((provider) => `- ${provider}`),
        "",
        focusLine,
        "",
        "Use provider-specific tools such as `<provider>_status`, `<provider>_summary`, `<provider>_incidents`, `<provider>_incidents_unresolved`, `<provider>_components`, and maintenance variants when available.",
        "",
        "Return:",
        "1. Current overall state by provider.",
        "2. Active or unresolved incidents.",
        "3. Scheduled or active maintenance that could affect users.",
        "4. Concrete follow-up actions only when the status data supports them.",
      ].join("\n"),
      "Prompt for structured operational status analysis",
    );
  },
});

export default prompt;
