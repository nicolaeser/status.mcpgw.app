# status.mcpgw.app

`status.mcpgw.app` is a Streamable HTTP MCP server focused on public service status data. It exposes provider-specific tools for status pages, incidents, unresolved incidents, components, maintenance windows, RSS feeds, Atom feeds, and similar operational endpoints.

## Quick Start

```bash
npm install
npm run dev
```

The MCP endpoint is `http://localhost:3000/mcp`.

## What This Server Exposes

### Tools

The MCP surface is a single unified tool, `status_check`, defined in `src/tools/status-check.ts`. It accepts:

- `provider`: provider key (e.g. `openai`, `anthropic`, `cloudflare`, `aws`, `github`, `stripe`, `newrelic`)
- `endpoint` (optional): which endpoint to fetch for that provider. Common Statuspage-style endpoints include `summary`, `status`, `components`, `incidents`, `incidents_unresolved`, `scheduled_maintenances`, `scheduled_maintenances_active`, `scheduled_maintenances_upcoming`. Single-page providers expose endpoints such as `status_page`, `system_status`, `health_status`, `rss`, `atom`, `current`, `current_full`, `history`, `products`, `instances`, or `notices`. Omit to fetch the provider's primary feed.
- `format` (optional): output shape, one of:
  - `auto`: normalize JSON, RSS, and Atom into structured JSON
  - `json`: force normalized JSON
  - `toon`: return flattened TOON text
  - `raw`: return the upstream response body

The provider and endpoint catalog lives in `src/tools/_shared/provider-registry.ts`.

### Resources

The server includes status-oriented MCP resources:

- `status://catalog`: server overview, naming conventions, and provider list
- `status://provider/{provider}`: provider-specific resource template that lists the available tools

### Prompts

The server includes a reusable `status_investigation` prompt for structured incident and maintenance analysis across one or more providers.

## Project Layout

- `src/tools/`: the unified `status_check` tool plus the provider/endpoint registry under `_shared/`
- `src/resources/`: status server resources
- `src/resource-templates/`: provider lookup templates
- `src/prompts/`: reusable prompts for status analysis
- `src/http/`: HTTP transport, auth, and MCP routing

Current AI-oriented providers in the tool catalog include OpenAI, Anthropic, OpenRouter, Cohere, Mistral, Groq, xAI, Together AI, Fireworks AI, Perplexity, DeepSeek, and Moonshot AI.

The broader service catalog also includes providers such as GitLab, Notion, Supabase, PlanetScale, Neon, MongoDB Cloud, Databricks, PagerDuty, Shopify, Postmark, Cloudinary, Render, Snowflake, Railway, Fly.io, Vultr, and Zendesk.

## Security

The server supports bearer-token authentication via `AUTH_MODE=bearer` and `API_KEY`. For local development you can run with `AUTH_MODE=none` or `DISABLE_AUTH=true`, but that should stay out of production.

## Deployment

```bash
docker compose up -d
```

`docker-compose.yml` and `docker-compose.dev.yml` are already aligned with the `status.mcpgw.app` server identity.

### Redis DB Layout

When `REDIS_URL` is configured, Redis logical databases are used as follows:

- DB 0: MCP sessions
- DB 1: rate limiting
- DB 2: MCP tasks
- DB 3: cached upstream status payloads

## Notes

- The default MCP server name is `status.mcpgw.app`.
- Provider tool responses are cached in Redis with a short TTL to reduce upstream pressure.
- The provider and endpoint inventory is defined in `src/tools/_shared/provider-registry.ts`.
