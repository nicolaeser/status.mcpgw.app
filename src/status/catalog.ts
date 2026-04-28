import { readdirSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function toolsRootDir(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../tools");
}

function isIgnoredEntry(name: string): boolean {
  return name.startsWith("_") || name === "examples";
}

function toToolSuffix(fileName: string): string {
  return fileName
    .replace(extname(fileName), "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function listStatusProviders(): string[] {
  return readdirSync(toolsRootDir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !isIgnoredEntry(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

export function isKnownStatusProvider(provider: string): boolean {
  return listStatusProviders().includes(provider);
}

export function listProviderToolNames(provider: string): string[] {
  const providerDir = resolve(toolsRootDir(), provider);

  return readdirSync(providerDir, { withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && [".js", ".ts"].includes(extname(entry.name)),
    )
    .filter((entry) => !entry.name.endsWith(".d.ts"))
    .filter(
      (entry) =>
        !entry.name.endsWith(".test.ts") &&
        !entry.name.endsWith(".spec.ts") &&
        !entry.name.endsWith(".test.js") &&
        !entry.name.endsWith(".spec.js") &&
        entry.name !== "index.ts" &&
        entry.name !== "index.js",
    )
    .map((entry) => `${provider}_${toToolSuffix(entry.name)}`)
    .sort((left, right) => left.localeCompare(right));
}
