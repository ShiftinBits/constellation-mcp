import { MCPServer } from "mcp-framework";
import { ConfigLoader } from "./config/config.loader.js";
import { ConstellationConfig } from "./config/config.js";

// Global configuration instance
let globalConfig: ConstellationConfig | null = null;

/**
 * Initializes and starts the Constellation MCP Server.
 */
async function startServer() {
	try {
		// Load configuration on startup
		console.log("[Constellation MCP] Starting server...");

		// Try to load config, use defaults if not found
		globalConfig = await ConfigLoader.loadConfig(process.cwd(), true);

		if (!globalConfig) {
			console.warn("[Constellation MCP] Running without configuration");
		}

		// Create and configure MCP server
		const server = new MCPServer();

		// Store config in server context for tools to access
		(server as any).constellationConfig = globalConfig;

		// Start the server
		await server.start();

		console.log("[Constellation MCP] Server started successfully");

		// Optional: Watch for config changes in development
		if (process.env.NODE_ENV === 'development') {
			ConfigLoader.watchConfig((newConfig) => {
				if (newConfig) {
					globalConfig = newConfig;
					(server as any).constellationConfig = newConfig;
					console.log("[Constellation MCP] Configuration reloaded");
				}
			});
		}

	} catch (error) {
		console.error("[Constellation MCP] Failed to start server:", error);
		process.exit(1);
	}
}

// Export the configuration getter for tools
export function getConfiguration(): ConstellationConfig | null {
	return globalConfig;
}

// Start the server
startServer();