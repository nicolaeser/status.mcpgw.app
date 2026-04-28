import type { Prompt, Resource, ResourceTemplate, Tool } from "../types.js";
import { invalidatePromptLoaderCache, loadPrompts } from "./prompt-loader.js";
import {
    invalidateResourceLoaderCache,
    loadResources,
} from "./resource-loader.js";
import {
    invalidateResourceTemplateLoaderCache,
    loadResourceTemplates,
} from "./resource-template-loader.js";
import { invalidateToolLoaderCache, loadTools } from "./tool-loader.js";

export interface McpRegistry {
    tools: Tool[];
    resources: Resource[];
    resourceTemplates: ResourceTemplate[];
    prompts: Prompt[];
}

let registryPromise: Promise<McpRegistry> | undefined;

async function buildMcpRegistry(): Promise<McpRegistry> {
    const [tools, resources, resourceTemplates, prompts] = await Promise.all([
        loadTools(),
        loadResources(),
        loadResourceTemplates(),
        loadPrompts(),
    ]);

    return {
        tools,
        resources,
        resourceTemplates,
        prompts,
    };
}

export function loadMcpRegistry(): Promise<McpRegistry> {
    if (!registryPromise) {
        registryPromise = buildMcpRegistry().catch((error) => {
            registryPromise = undefined;
            throw error;
        });
    }

    return registryPromise;
}

export async function refreshMcpRegistry(): Promise<McpRegistry> {
    registryPromise = undefined;
    invalidateToolLoaderCache();
    invalidateResourceLoaderCache();
    invalidateResourceTemplateLoaderCache();
    invalidatePromptLoaderCache();
    return loadMcpRegistry();
}
