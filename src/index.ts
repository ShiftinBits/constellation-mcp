import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createRequire } from 'module';
import { getConfigContext, initializeConfig } from './config/config-manager.js';
import { getServerInstructions } from './config/server-instructions.js';
import { getToolRegistry } from './registry/ToolRegistry.js';
import { allToolDefinitions } from './registry/tool-definitions/index.js';
import { registerExecuteCodeTool } from './tools/execute-code-tool.js';

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

		// Initialize configuration FIRST (before creating MCPServer)
		// The mcp-framework creates tool instances during MCPServer construction,
		// so configuration must be ready before that happens
		await initializeConfig(process.cwd());

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

		const context = getConfigContext();

		if (context.initializationError) {
			console.error(
				'[CONSTELLATION]  WARNING: Server starting in degraded mode',
			);
			console.error(
				'[CONSTELLATION] Configuration error:',
				context.initializationError,
			);
			console.error(
				'[CONSTELLATION] Tools will return setup instructions when called',
			);
		}

		console.error('[CONSTELLATION] Configuration loaded:');
		console.error(`  Project: ${context.projectId}`);
		console.error(`  Branch: ${context.branchName}`);

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
		registerExecuteCodeTool(server);

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
