import {
	McpServer,
	ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { configCache } from './config/config-cache.js';
import { getServerInstructions } from './config/server-instructions.js';
import { getToolRegistry } from './registry/ToolRegistry.js';
import { allToolDefinitions } from './registry/tool-definitions/index.js';
import { registerQueryCodeGraphTool } from './tools/query-code-graph-tool.js';
import {
	METHOD_SUMMARIES,
	resolveMethodName,
} from './types/method-summaries.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

/**
 * Initializes and starts the Constellation MCP Server.
 */
async function startServer() {
	try {
		console.error('[CONSTELLATION] Starting server...');
		console.error('[CONSTELLATION] Environment check:');
		console.error(
			`  CONSTELLATION_ACCESS_KEY: ${process.env.CONSTELLATION_ACCESS_KEY ? '***SET***' : 'NOT SET'}`,
		);
		console.error(`  Working directory: ${process.cwd()}`);

		// Initialize configuration cache with default from startup directory
		// This is non-fatal - if it fails, server will require cwd parameter on each call
		await configCache.trySetDefaultFromStartup(process.cwd());

		// Initialize Tool Registry with enhanced definitions
		console.error('[CONSTELLATION] Initializing Tool Registry...');
		const registry = getToolRegistry();
		registry.registerMany(allToolDefinitions);
		registry.markInitialized();

		// Validate registry
		const validation = registry.validateRegistry();
		if (!validation.valid) {
			console.error('[CONSTELLATION] Tool Registry validation errors:');
			for (const error of validation.errors) {
				console.error(`  ${error}`);
			}
			throw new Error('Tool Registry validation failed');
		}

		if (validation.warnings.length > 0) {
			console.error('[CONSTELLATION] Tool Registry warnings:');
			for (const warning of validation.warnings) {
				console.error(`   ${warning}`);
			}
		}

		const stats = registry.getStats();
		console.error('[CONSTELLATION] Tool Registry initialized:');
		console.error(`  Total tools: ${stats.totalTools}`);
		console.error(`  Tools with examples: ${stats.toolsWithExamples}`);
		console.error(
			`  Average examples per tool: ${stats.averageExamplesPerTool.toFixed(1)}`,
		);

		// Report configuration status
		const defaultConfig = configCache.getDefaultConfig();
		if (defaultConfig) {
			if (defaultConfig.initializationError) {
				console.error(
					'[CONSTELLATION] WARNING: Server starting in degraded mode',
				);
				console.error(
					'[CONSTELLATION] Configuration error:',
					defaultConfig.initializationError,
				);
				console.error(
					'[CONSTELLATION] Tools will return setup instructions when called',
				);
			}

			console.error('[CONSTELLATION] Default configuration loaded:');
			console.error(`  Git root: ${defaultConfig.gitRoot}`);
			console.error(`  Project: ${defaultConfig.projectId}`);
			console.error(`  Branch: ${defaultConfig.branchName}`);
		} else {
			console.error(
				'[CONSTELLATION] No default configuration (will require cwd parameter)',
			);
		}

		// Create and configure MCP server with official SDK
		// Instructions are passed here and returned during MCP initialization
		// This provides AI guidance without exposing user-facing prompts
		const server = new McpServer(
			{
				name: '@constellationdev/mcp',
				version: packageJson.version,
			},
			{
				instructions: getServerInstructions(),
			},
		);

		// Register tools manually (no auto-discovery with official SDK)
		console.error('[CONSTELLATION] Registering tools...');
		registerQueryCodeGraphTool(server);

		// Register API types resource for AI assistants
		// Provides full TypeScript interfaces on-demand via constellation://types/api
		console.error('[CONSTELLATION] Registering resources...');
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = path.dirname(__filename);
		const apiTypesPath = path.join(__dirname, 'types', 'api-types.d.ts');

		server.registerResource(
			'api-types',
			'constellation://types/api',
			{
				description:
					'Full TypeScript interfaces for ALL Constellation API methods. ' +
					'Large (~147KB). Prefer constellation://types/api/{methodName} for individual methods.',
				mimeType: 'text/typescript',
			},
			async () => ({
				contents: [
					{
						uri: 'constellation://types/api',
						mimeType: 'text/typescript',
						text: readFileSync(apiTypesPath, 'utf-8'),
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
			},
			async (uri, variables) => {
				const methodName = variables.methodName as string;
				const canonical = resolveMethodName(methodName);
				if (!canonical || !METHOD_SUMMARIES[canonical]) {
					const available = Object.keys(METHOD_SUMMARIES).join(', ');
					throw new Error(
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

		console.error(
			'[CONSTELLATION] Registered resources: constellation://types/api, constellation://types/api/{methodName}',
		);

		// Validate that tool registry matches registered tools
		console.error('[CONSTELLATION] Validating tool registry...');
		registry.validateWithMcpServer(server);

		console.error('[CONSTELLATION] Server configured successfully');
		console.error(
			'[CONSTELLATION] Code Mode Only - 1 powerful tool for all operations',
		);
		console.error(
			'[CONSTELLATION] Write JavaScript code to access all Constellation API capabilities',
		);

		// Setup stdio transport and connect
		const transport = new StdioServerTransport();
		await server.connect(transport);

		console.error('[CONSTELLATION] Server connected and ready');
	} catch (error) {
		console.error(
			'\n==========================================================',
		);
		console.error('CONSTELLATION MCP SERVER FAILED TO START');
		console.error(
			'==========================================================\n',
		);

		if (error instanceof Error) {
			console.error(error.message);
		} else {
			console.error('Unknown error:', error);
		}

		console.error(
			'\n==========================================================\n',
		);
		process.exit(1);
	}
}

// Start the server
startServer();
