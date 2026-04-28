import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import type { ToolResult } from "../../types.js";
import { getRedisClient } from "../../runtime/redis.js";

const CACHE_TTL_SECONDS = 30;
const FETCH_TIMEOUT_MS = 15_000;
const ERROR_BODY_MAX_CHARS = 4_000;
const USER_AGENT = "status.mcpgw.app/1.0";

export type StatusOutputFormat = "auto" | "json" | "toon" | "raw";

export const statusOutputFormatSchema = z
  .enum(["auto", "json", "toon", "raw"])
  .default("auto")
  .describe(
    "Response format. auto formats JSON and RSS/Atom as JSON, toon returns TOON, raw returns the upstream body.",
  );

interface FetchCachedStatusOptions {
  brand: string;
  type: string;
  url: string;
  errorUrl?: string;
  maxChars?: number;
  format?: StatusOutputFormat;
}

interface FeedDocument {
  feed: Record<string, string | null>;
  items: Array<Record<string, string | null>>;
}

const xmlParser = new XMLParser({
  attributeNamePrefix: "@",
  cdataPropName: "#cdata",
  ignoreAttributes: false,
  parseAttributeValue: false,
  parseTagValue: false,
  textNodeName: "#text",
  trimValues: true,
});

export function normalizeStatusOutputFormat(
  format: unknown,
): StatusOutputFormat {
  if (
    format === "auto" ||
    format === "json" ||
    format === "toon" ||
    format === "raw"
  ) {
    return format;
  }

  return "auto";
}

export function createStatusError(text: string): ToolResult {
  return {
    content: [{ type: "text", text }],
    isError: true,
  };
}

function parseJson(body: string): unknown | null {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function compactWhitespace(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return compactWhitespace(String(value));
  }

  const record = asRecord(value);
  if (!record) return compactWhitespace(JSON.stringify(value));

  const cdata = textValue(record["#cdata"]);
  if (cdata !== null) return cdata;

  const text = textValue(record["#text"]);
  if (text !== null) return text;

  return compactWhitespace(JSON.stringify(record));
}

function attributeValue(value: unknown, attribute: string): string | null {
  const record = asRecord(value);
  const attributeText = record ? textValue(record[`@${attribute}`]) : null;
  if (attributeText !== null) return attributeText;

  return textValue(value);
}

function parseXml(body: string): Record<string, unknown> | null {
  try {
    return asRecord(xmlParser.parse(body));
  } catch {
    return null;
  }
}

function parseRss(body: string): FeedDocument | null {
  const root = parseXml(body);
  const channel = asRecord(asRecord(root?.rss)?.channel);
  if (!channel) return null;

  return {
    feed: {
      type: "rss",
      title: textValue(channel.title),
      link: textValue(channel.link),
      description: textValue(channel.description),
      updated: textValue(channel.lastBuildDate) ?? textValue(channel.pubDate),
    },
    items: asArray(channel.item).map((item) => {
      const entry = asRecord(item) ?? {};

      return {
        title: textValue(entry.title),
        link: textValue(entry.link),
        id: textValue(entry.guid),
        published: textValue(entry.pubDate),
        updated: textValue(entry.updated),
        summary: textValue(entry.description),
        content: textValue(entry["content:encoded"]),
      };
    }),
  };
}

function parseAtom(body: string): FeedDocument | null {
  const feed = asRecord(parseXml(body)?.feed);
  if (!feed) return null;

  return {
    feed: {
      type: "atom",
      title: textValue(feed.title),
      link: attributeValue(feed.link, "href"),
      id: textValue(feed.id),
      updated: textValue(feed.updated),
    },
    items: asArray(feed.entry).map((item) => {
      const entry = asRecord(item) ?? {};

      return {
        title: textValue(entry.title),
        link: attributeValue(entry.link, "href"),
        id: textValue(entry.id),
        published: textValue(entry.published),
        updated: textValue(entry.updated),
        summary: textValue(entry.summary),
        content: textValue(entry.content),
      };
    }),
  };
}

function parseStructuredBody(body: string): unknown | null {
  return parseJson(body) ?? parseRss(body) ?? parseAtom(body);
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return "null";

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value !== "string") return JSON.stringify(value);

  if (
    value.length > 0 &&
    !/[\n\r,:{}\[\]#]/.test(value) &&
    !/^\s|\s$/.test(value) &&
    !["true", "false", "null"].includes(value)
  ) {
    return value;
  }

  return JSON.stringify(value);
}

function formatCsvValue(value: unknown): string {
  const scalar = formatScalar(value);
  return /[,\n\r]/.test(scalar) ? JSON.stringify(String(value ?? "")) : scalar;
}

function isScalar(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getTabularKeys(rows: unknown[]): string[] | null {
  if (rows.length === 0 || !rows.every(isPlainObject)) return null;

  const keys = Object.keys(rows[0] as Record<string, unknown>);
  if (keys.length === 0) return null;

  for (const row of rows) {
    const rowKeys = Object.keys(row as Record<string, unknown>);
    const hasSameKeys =
      rowKeys.length === keys.length &&
      keys.every((key) => rowKeys.includes(key));
    const hasScalarValues = keys.every((key) =>
      isScalar((row as Record<string, unknown>)[key]),
    );

    if (!hasSameKeys || !hasScalarValues) return null;
  }

  return keys;
}

function encodeArrayToon(
  key: string,
  value: unknown[],
  indent: string,
): string[] {
  if (value.length === 0) return [`${indent}${key}[0]:`];

  const tabularKeys = getTabularKeys(value);
  if (tabularKeys) {
    return [
      `${indent}${key}[${value.length}]{${tabularKeys.join(",")}}:`,
      ...value.map(
        (row) =>
          `${indent}  ${tabularKeys
            .map((field) =>
              formatCsvValue((row as Record<string, unknown>)[field]),
            )
            .join(",")}`,
      ),
    ];
  }

  if (value.every(isScalar)) {
    return [
      `${indent}${key}[${value.length}]: ${value.map(formatCsvValue).join(",")}`,
    ];
  }

  return [
    `${indent}${key}[${value.length}]:`,
    ...value.flatMap((item, index) => {
      if (isScalar(item)) return [`${indent}  - ${formatScalar(item)}`];

      return [
        `${indent}  - item${index}:`,
        ...encodeObjectToon(item, `${indent}      `),
      ];
    }),
  ];
}

function encodeValueToon(value: unknown, key: string, indent = ""): string[] {
  if (Array.isArray(value)) return encodeArrayToon(key, value, indent);
  if (isPlainObject(value)) {
    return [`${indent}${key}:`, ...encodeObjectToon(value, `${indent}  `)];
  }

  return [`${indent}${key}: ${formatScalar(value)}`];
}

function encodeObjectToon(value: unknown, indent = ""): string[] {
  if (!isPlainObject(value)) return [`${indent}value: ${formatScalar(value)}`];

  return Object.entries(value).flatMap(([key, item]) =>
    encodeValueToon(item, key, indent),
  );
}

function formatToon(value: unknown): string {
  if (isPlainObject(value)) return encodeObjectToon(value).join("\n");
  return encodeValueToon(value, "items").join("\n");
}

function formatBody(body: string, format: StatusOutputFormat): string {
  if (format === "raw") return body;

  const parsed = parseStructuredBody(body);
  if (format === "toon") return formatToon(parsed ?? { body });
  if (parsed !== null) return JSON.stringify(parsed, null, 2);
  if (format === "json") return JSON.stringify({ body }, null, 2);

  return body;
}

function applyOutputLimit(text: string, maxChars?: number): string {
  if (maxChars === undefined || text.length <= maxChars) return text;

  return `${text.slice(0, maxChars)}\n\n[Truncated - ${text.length} total chars, showing first ${maxChars}]`;
}

async function readFromCache(cacheKey: string): Promise<string | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    return await redis.get(cacheKey);
  } catch {
    return null;
  }
}

async function writeToCache(cacheKey: string, body: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(cacheKey, body, "EX", CACHE_TTL_SECONDS);
  } catch {
    return;
  }
}

function createContent(
  body: string,
  options: FetchCachedStatusOptions,
): ToolResult {
  const text = formatBody(body, options.format ?? "auto");

  return {
    content: [
      {
        type: "text",
        text: applyOutputLimit(text, options.maxChars),
      },
    ],
  };
}

export async function fetchCachedStatus(
  options: FetchCachedStatusOptions,
): Promise<ToolResult> {
  const cacheKey = `${options.brand}:${options.type}`;
  const cached = await readFromCache(cacheKey);

  if (cached !== null) return createContent(cached, options);

  const errorUrl = options.errorUrl ?? options.url;
  let response: Response;

  try {
    response = await fetch(options.url, {
      headers: {
        Accept:
          "application/json, application/xml, text/xml, text/html;q=0.9, text/plain;q=0.8",
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    return createStatusError(
      `Network error while fetching ${errorUrl}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const body = await response.text();

  if (!response.ok) {
    const errorBody =
      body.length > ERROR_BODY_MAX_CHARS
        ? `${body.slice(0, ERROR_BODY_MAX_CHARS)}\n\n[Truncated error body]`
        : body;

    return createStatusError(
      `HTTP ${response.status} ${response.statusText} while fetching ${errorUrl}\n\n${errorBody}`,
    );
  }

  await writeToCache(cacheKey, body);
  return createContent(body, options);
}
