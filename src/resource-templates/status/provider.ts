import { defineResourceTemplate } from "../_shared/define-resource-template.js";
import {
  isKnownStatusProvider,
  listProviderToolNames,
  listStatusProviders,
} from "../../status/catalog.js";

const template = defineResourceTemplate({
  uriTemplate: "status://provider/{provider}",
  name: "status_provider",
  title: "Status Provider",
  description: "Lists the available MCP status tools for a provider.",
  mimeType: "text/markdown",
  async complete(argumentName, value) {
    if (argumentName !== "provider") return [];

    return listStatusProviders().filter((provider) =>
      provider.toLowerCase().startsWith(value.toLowerCase()),
    );
  },
  async read(uri, variables) {
    const provider = variables.provider;

    if (!isKnownStatusProvider(provider)) {
      return {
        contents: [
          {
            uri,
            mimeType: "text/markdown",
            text: [
              `# Unknown provider: ${provider}`,
              "",
              "Known providers:",
              "",
              ...listStatusProviders().map((entry) => `- ${entry}`),
            ].join("\n"),
          },
        ],
      };
    }

    const tools = listProviderToolNames(provider);

    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: [
            `# ${provider}`,
            "",
            `Available tools for \`${provider}\` on status.mcpgw.app.`,
            "",
            "## Tools",
            "",
            ...tools.map((tool) => `- \`${tool}\``),
            "",
            "Most tools support a `format` argument with `auto`, `json`, `toon`, and `raw` values.",
          ].join("\n"),
        },
      ],
    };
  },
});

export default template;
