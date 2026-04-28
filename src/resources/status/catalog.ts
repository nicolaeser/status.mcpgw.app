import { defineResource } from "../_shared/define-resource.js";
import { listStatusProviders } from "../../status/catalog.js";

const CATALOG_URI = "status://catalog";

const resource = defineResource({
  uri: CATALOG_URI,
  name: "status_catalog",
  title: "Status Catalog",
  description:
    "Overview of the status.mcpgw.app MCP server, output formats, and supported providers.",
  mimeType: "text/markdown",
  annotations: {
    audience: ["assistant", "user"],
    priority: 0.9,
  },
  async read() {
    const providers = listStatusProviders();

    return {
      contents: [
        {
          uri: CATALOG_URI,
          mimeType: "text/markdown",
          text: [
            "# status.mcpgw.app",
            "",
            "MCP server for querying public vendor status pages and service health feeds.",
            "",
            "## Tool naming",
            "",
            "- Tools follow the pattern `<provider>_<signal>`.",
            "- Common signals include `status`, `summary`, `components`, `incidents`, `incidents_unresolved`, `scheduled_maintenances`, `scheduled_maintenances_active`, and `scheduled_maintenances_upcoming`.",
            "- Some providers expose vendor-specific signals such as `status_page`, `products`, `rss`, `atom`, `current`, `current_atom`, `current_full`, `history`, or `instances`.",
            "",
            "## Output format",
            "",
            "- Most status tools accept a `format` argument.",
            "- `auto` returns structured JSON for JSON, RSS, and Atom sources.",
            "- `json` forces normalized JSON output.",
            "- `toon` returns TOON-style flattened text.",
            "- `raw` returns the upstream response body.",
            "",
            `## Providers (${providers.length})`,
            "",
            providers.map((provider) => `- ${provider}`).join("\n"),
            "",
            "Use the `status://provider/{provider}` resource template for provider-specific tool names.",
          ].join("\n"),
        },
      ],
    };
  },
});

export default resource;
