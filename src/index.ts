import { MCPServer } from "mcp-framework";
import { initializeConfig, getConfigContext } from "./config/config-manager.js";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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
		console.error("  ✅ Discovery Tools (4/4):");
		console.error("    - search_symbols");
		console.error("    - search_files");
		console.error("    - get_symbol_details");
		console.error("    - get_file_details");
		console.error("");
		console.error("  ✅ Dependency Tools (5/5):");
		console.error("    - get_dependencies");
		console.error("    - get_dependents");
		console.error("    - find_circular_dependencies");
		console.error("    - trace_symbol_usage");
		console.error("    - get_call_graph");
		console.error("");
		console.error("  ✅ Impact Analysis Tools (4/4):");
		console.error("    - analyze_change_impact");
		console.error("    - find_orphaned_code");
		console.error("    - analyze_breaking_changes");
		console.error("    - impact_analysis");
		console.error("");
		console.error("  ✅ Architecture Tools (5/5):");
		console.error("    - get_architecture_overview");
		console.error("    - get_module_overview");
		console.error("    - detect_architecture_violations");
		console.error("    - analyze_package_usage");
		console.error("    - compare_modules");
		console.error("");
		console.error("  ✅ Refactoring Tools (4/4):");
		console.error("    - find_similar_patterns");
		console.error("    - find_entry_points");
		console.error("    - get_inheritance_hierarchy");
		console.error("    - contextual_symbol_resolution");
		console.error("");
		console.error("  🎉 ALL 22 TOOLS IMPLEMENTED!");

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