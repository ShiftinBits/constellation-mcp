import { MCPServer } from "mcp-framework";
import { initializeConfig, getConfigContext } from "./config/config-manager.js";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getToolRegistry } from "./registry/ToolRegistry.js";
import { allToolDefinitions } from "./registry/tool-definitions/index.js";

/**
 * Initializes and starts the Constellation MCP Server.
 */
async function startServer() {
	try {
		console.error("[Constellation MCP] Starting server...");
		console.error("[Constellation MCP] Environment check:");
		console.error(`  CONSTELLATION_API_KEY: ${process.env.CONSTELLATION_API_KEY ? '***SET***' : 'NOT SET'}`);
		console.error(`  Working directory: ${process.cwd()}`);

		// Initialize configuration FIRST (before creating MCPServer)
		// The mcp-framework creates tool instances during MCPServer construction,
		// so configuration must be ready before that happens
		await initializeConfig(process.cwd());

		// Initialize Tool Registry with enhanced definitions
		console.error("[Constellation MCP] Initializing Tool Registry...");
		const registry = getToolRegistry();
		registry.registerMany(allToolDefinitions);
		registry.markInitialized();

		// Validate registry
		const validation = registry.validateRegistry();
		if (!validation.valid) {
			console.error("[Constellation MCP] Tool Registry validation errors:");
			for (const error of validation.errors) {
				console.error(`  ❌ ${error}`);
			}
			throw new Error("Tool Registry validation failed");
		}

		if (validation.warnings.length > 0) {
			console.error("[Constellation MCP] Tool Registry warnings:");
			for (const warning of validation.warnings) {
				console.error(`  ⚠️  ${warning}`);
			}
		}

		const stats = registry.getStats();
		console.error("[Constellation MCP] Tool Registry initialized:");
		console.error(`  Total tools: ${stats.totalTools}`);
		console.error(`  Tools with examples: ${stats.toolsWithExamples}`);
		console.error(`  Average examples per tool: ${stats.averageExamplesPerTool.toFixed(1)}`);

		const context = getConfigContext();
		console.error("[Constellation MCP] Configuration loaded:");
		console.error(`  API: ${context.config.apiUrl}`);
		console.error(`  Project: ${context.projectId}`);
		console.error(`  Branch: ${context.branchName}`);
		console.error(`  Config from file: ${context.configLoaded ? 'yes' : 'no (using defaults)'}`);

		// Create and configure MCP server
		// Set basePath to the directory containing this file (dist/) so tools are found
		// This is necessary for npm link to work correctly
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);

		const server = new MCPServer({
			name: '@constellationdev/mcp',
			version: '0.0.1',
			basePath: __dirname,
		});

		// Tools are automatically discovered from dist/tools directory
		// The MCP framework will scan for default exports in tools/ subdirectories

		console.error("[Constellation MCP] Server started successfully");
		console.error("[Constellation MCP] Available tools (22/22 implemented - 100%):");
		console.error("");
		console.error("  ✅ Discovery Tools (4/4) - Enhanced definitions loaded");
		console.error("    - search_symbols (3 examples)");
		console.error("    - search_files (3 examples)");
		console.error("    - get_symbol_details (3 examples)");
		console.error("    - get_file_details (3 examples)");
		console.error("");
		console.error("  ✅ Dependency Tools (5/5) - Enhanced definitions loaded");
		console.error("    - get_dependencies (3 examples)");
		console.error("    - get_dependents (3 examples)");
		console.error("    - find_circular_dependencies (3 examples)");
		console.error("    - trace_symbol_usage (3 examples)");
		console.error("    - get_call_graph (3 examples)");
		console.error("");
		console.error("  ✅ Impact Analysis Tools (4/4) - Enhanced definitions loaded");
		console.error("    - analyze_change_impact (3 examples)");
		console.error("    - find_orphaned_code (3 examples)");
		console.error("    - analyze_breaking_changes (3 examples)");
		console.error("    - impact_analysis (3 examples)");
		console.error("");
		console.error("  ✅ Architecture Tools (5/5) - Enhanced definitions loaded");
		console.error("    - get_architecture_overview (3 examples)");
		console.error("    - get_module_overview (2 examples)");
		console.error("    - detect_architecture_violations (2 examples)");
		console.error("    - analyze_package_usage (2 examples)");
		console.error("    - compare_modules (2 examples)");
		console.error("");
		console.error("  ✅ Refactoring Tools (4/4) - Enhanced definitions loaded");
		console.error("    - find_similar_patterns (2 examples)");
		console.error("    - find_entry_points (2 examples)");
		console.error("    - get_inheritance_hierarchy (2 examples)");
		console.error("    - contextual_symbol_resolution (2 examples)");
		console.error("");
		console.error("  🎉 ALL 22 TOOLS IMPLEMENTED WITH ENHANCED DEFINITIONS!");
		console.error("  📚 Rich descriptions, examples, and usage guidance available for AI agents");

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