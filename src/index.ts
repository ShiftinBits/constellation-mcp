import { MCPServer } from "mcp-framework";
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { getConfigContext, initializeConfig } from "./config/config-manager.js";
import { getToolRegistry } from "./registry/ToolRegistry.js";
import { allToolDefinitions } from "./registry/tool-definitions/index.js";

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

/**
 * Initializes and starts the Constellation MCP Server.
 */
async function startServer() {
	try {
		console.error("[CONSTELLATION] Starting server...");
		console.error("[CONSTELLATION] Environment check:");
		console.error(`  CONSTELLATION_API_KEY: ${process.env.CONSTELLATION_API_KEY ? '***SET***' : 'NOT SET'}`);
		console.error(`  Working directory: ${process.cwd()}`);

		// Initialize configuration FIRST (before creating MCPServer)
		// The mcp-framework creates tool instances during MCPServer construction,
		// so configuration must be ready before that happens
		await initializeConfig(process.cwd());

		// Initialize Tool Registry with enhanced definitions
		console.error("[CONSTELLATION] Initializing Tool Registry...");
		const registry = getToolRegistry();
		registry.registerMany(allToolDefinitions);
		registry.markInitialized();

		// Validate registry
		const validation = registry.validateRegistry();
		if (!validation.valid) {
			console.error("[CONSTELLATION] Tool Registry validation errors:");
			for (const error of validation.errors) {
				console.error(`  ❌ ${error}`);
			}
			throw new Error("Tool Registry validation failed");
		}

		if (validation.warnings.length > 0) {
			console.error("[CONSTELLATION] Tool Registry warnings:");
			for (const warning of validation.warnings) {
				console.error(`  ⚠️  ${warning}`);
			}
		}

		const stats = registry.getStats();
		console.error("[CONSTELLATION] Tool Registry initialized:");
		console.error(`  Total tools: ${stats.totalTools}`);
		console.error(`  Tools with examples: ${stats.toolsWithExamples}`);
		console.error(`  Average examples per tool: ${stats.averageExamplesPerTool.toFixed(1)}`);

		const context = getConfigContext();
		console.error("[CONSTELLATION] Configuration loaded:");
		console.error(`  Project: ${context.projectId}`);
		console.error(`  Branch: ${context.branchName}`);

		// Create and configure MCP server
		// Set basePath to the directory containing this file (dist/) so tools are found
		// This is necessary for npm link to work correctly
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);

		const server = new MCPServer({
			name: '@constellationdev/mcp',
			version: packageJson.version,
			basePath: __dirname,
		});

		// Tools are automatically discovered from dist/tools directory
		// The MCP framework will scan for default exports in tools/ subdirectories
		console.error("[CONSTELLATION] Server started successfully");
		console.error("[CONSTELLATION] 20 Available tools");

		// Start the server
		await server.start();

	} catch (error) {
		console.error("\n==========================================================");
		console.error("❌ CONSTELLATION MCP SERVER FAILED TO START");
		console.error("==========================================================\n");

		if (error instanceof Error) {
			console.error(error.message);
		} else {
			console.error("Unknown error:", error);
		}

		console.error("\n==========================================================\n");
		process.exit(1);
	}
}

// Start the server
startServer();
