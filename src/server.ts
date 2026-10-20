import {
	type CacheHint,
	McpServer,
	ResourceNotFoundError,
	ResourceTemplate,
} from '@modelcontextprotocol/server';
import { getCodeModeGuide, GUIDE_SECTIONS } from './config/code-mode-guide.js';
import { getServerInstructions } from './config/server-instructions.js';
import { registerQueryCodeGraphTool } from './tools/query-code-graph-tool.js';
import {
	METHOD_SUMMARIES,
	resolveMethodName,
} from './types/method-summaries.js';
import { Metrics } from './utils/metrics.js';

/**
 * Discovery, list and static-resource results only change when the package
 * version changes (i.e. on restart) and hold no per-user data, so shared
 * caches may keep them for an hour. A cache that outlives a restart can keep
 * serving the pre-upgrade results for up to that hour.
 */
const STATIC_CACHE_HINT: CacheHint = { ttlMs: 3_600_000, cacheScope: 'public' };

/** Every per-method type summary, served together at constellation://types/api. */
const API_TYPES = Object.values(METHOD_SUMMARIES).join('\n\n');

export interface BuildServerOptions {
	/** Server version reported to clients. */
	version: string;
}

/**
 * Creates and configures the Constellation MCP server: the `code_intel` tool
 * plus the type, guide and metrics resources. Used as the `serveStdio`
 * factory, which may call it more than once per connection (a discarded
 * modern probe followed by a legacy instance), so registration must stay
 * cheap and idempotent; shared state lives in the configCache/Metrics singletons.
 */
export function buildServer({ version }: BuildServerOptions): McpServer {
	// Instructions are returned via server/discover (2026-07-28) or initialize (legacy)
	// This provides AI guidance without exposing user-facing prompts
	const server = new McpServer(
		{
			name: '@constellationdev/mcp',
			version,
		},
		{
			instructions: getServerInstructions(),
			cacheHints: {
				'server/discover': STATIC_CACHE_HINT,
				'tools/list': STATIC_CACHE_HINT,
				'resources/list': STATIC_CACHE_HINT,
				'resources/templates/list': STATIC_CACHE_HINT,
			},
		},
	);

	registerQueryCodeGraphTool(server);

	// Register API types resource for AI assistants
	// Serves every per-method summary in one document via constellation://types/api
	server.registerResource(
		'api-types',
		'constellation://types/api',
		{
			description:
				'Prefer constellation://types/api/{methodName} for individual methods. ' +
				`This resource is ~${Math.round(API_TYPES.length / 1024)}KB and may consume excessive context. ` +
				'TypeScript type definitions for all Code Mode API methods.',
			mimeType: 'text/typescript',
			cacheHint: STATIC_CACHE_HINT,
		},
		async () => ({
			contents: [
				{
					uri: 'constellation://types/api',
					mimeType: 'text/typescript',
					text: API_TYPES,
				},
			],
		}),
	);

	server.registerResource(
		'api-method-types',
		new ResourceTemplate('constellation://types/api/{methodName}', {
			list: async () => ({
				resources: Object.keys(METHOD_SUMMARIES).map((name) => ({
					uri: `constellation://types/api/${name}`,
					name: `${name} types`,
					description: `Type definitions for api.${name}()`,
					mimeType: 'text/typescript',
				})),
			}),
		}),
		{
			description:
				'TypeScript type definitions for a specific API method. ' +
				'Accepts canonical method names (e.g., searchSymbols, getDependencies).',
			mimeType: 'text/typescript',
			cacheHint: STATIC_CACHE_HINT,
		},
		async (uri, variables) => {
			const methodName = variables.methodName as string;
			const canonical = resolveMethodName(methodName);
			if (!canonical || !METHOD_SUMMARIES[canonical]) {
				const available = Object.keys(METHOD_SUMMARIES).join(', ');
				throw new ResourceNotFoundError(
					uri.href,
					`Unknown method: "${methodName}". Available: ${available}`,
				);
			}
			return {
				contents: [
					{
						uri: uri.href,
						mimeType: 'text/typescript',
						text: METHOD_SUMMARIES[canonical],
					},
				],
			};
		},
	);

	// Register Code Mode usage guide resource
	// On-demand reference material: method tables, response shapes, recipes, recovery patterns
	server.registerResource(
		'code-mode-guide',
		'constellation://docs/guide',
		{
			description:
				'Full method reference, response shapes, composition recipes, and error recovery patterns. ' +
				'Read this when writing code_intel queries.',
			mimeType: 'text/markdown',
			cacheHint: STATIC_CACHE_HINT,
		},
		async () => ({
			contents: [
				{
					uri: 'constellation://docs/guide',
					mimeType: 'text/markdown',
					text: getCodeModeGuide(),
				},
			],
		}),
	);

	// Register guide sub-resources for granular access
	// LLMs can read only the section they need (~600-1,200 tokens each vs ~3,500 monolithic)
	server.registerResource(
		'code-mode-guide-section',
		new ResourceTemplate('constellation://docs/guide/{section}', {
			list: async () => ({
				resources: Object.entries(GUIDE_SECTIONS).map(([key, section]) => ({
					uri: `constellation://docs/guide/${key}`,
					name: section.name,
					description: section.description,
					mimeType: 'text/markdown',
				})),
			}),
		}),
		{
			description:
				'Individual guide sections for granular access. ' +
				'Available: methods, recipes, recovery. ' +
				'Smaller than the full guide (~600-1,200 tokens each vs ~3,500).',
			mimeType: 'text/markdown',
			cacheHint: STATIC_CACHE_HINT,
		},
		async (uri, variables) => {
			const section = variables.section as string;
			const sectionDef = GUIDE_SECTIONS[section];
			if (!sectionDef) {
				const available = Object.keys(GUIDE_SECTIONS).join(', ');
				throw new ResourceNotFoundError(
					uri.href,
					`Unknown guide section: "${section}". Available: ${available}`,
				);
			}
			return {
				contents: [
					{
						uri: uri.href,
						mimeType: 'text/markdown',
						text: sectionDef.getter(),
					},
				],
			};
		},
	);

	// Register metrics resource for runtime monitoring (SB-258 Step 3.5)
	// Live snapshot: never cache, and never share across clients
	server.registerResource(
		'metrics',
		'constellation://metrics',
		{
			description:
				'Runtime metrics: execution counts, durations, error rates, and API call patterns.',
			mimeType: 'application/json',
			cacheHint: { ttlMs: 0, cacheScope: 'private' },
		},
		async () => ({
			contents: [
				{
					uri: 'constellation://metrics',
					mimeType: 'application/json',
					text: JSON.stringify(Metrics.get().getSnapshot(), null, 2),
				},
			],
		}),
	);

	return server;
}
