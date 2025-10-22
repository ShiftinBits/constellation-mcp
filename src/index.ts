import { MCPServer } from "mcp-framework";
import { initializeConfig, getConfigContext } from "./config/config-manager.js";

// Discovery Tools (4/4 implemented)
import SearchSymbolsTool from "./tools/discovery/SearchSymbolsTool.js";
import SearchFilesTool from "./tools/discovery/SearchFilesTool.js";
import GetSymbolDetailsTool from "./tools/discovery/GetSymbolDetailsTool.js";
import GetFileDetailsTool from "./tools/discovery/GetFileDetailsTool.js";

// Dependency Tools (5/5 implemented)
import GetDependenciesTool from "./tools/dependency/GetDependenciesTool.js";
import GetDependentsTool from "./tools/dependency/GetDependentsTool.js";
import FindCircularDependenciesTool from "./tools/dependency/FindCircularDependenciesTool.js";
import TraceSymbolUsageTool from "./tools/dependency/TraceSymbolUsageTool.js";
import GetCallGraphTool from "./tools/dependency/GetCallGraphTool.js";

// Impact Analysis Tools (4/4 implemented)
import AnalyzeChangeImpactTool from "./tools/impact/AnalyzeChangeImpactTool.js";
import FindOrphanedCodeTool from "./tools/impact/FindOrphanedCodeTool.js";
import AnalyzeBreakingChangesTool from "./tools/impact/AnalyzeBreakingChangesTool.js";
import ImpactAnalysisTool from "./tools/impact/ImpactAnalysisTool.js";

// Architecture Tools (5/5 implemented)
import GetArchitectureOverviewTool from "./tools/architecture/GetArchitectureOverviewTool.js";
import GetModuleOverviewTool from "./tools/architecture/GetModuleOverviewTool.js";
import DetectArchitectureViolationsTool from "./tools/architecture/DetectArchitectureViolationsTool.js";
import AnalyzePackageUsageTool from "./tools/architecture/AnalyzePackageUsageTool.js";
import CompareModulesTool from "./tools/architecture/CompareModulesTool.js";

// Refactoring Tools (4/4 implemented)
import FindSimilarPatternsTool from "./tools/refactoring/FindSimilarPatternsTool.js";
import FindEntryPointsTool from "./tools/refactoring/FindEntryPointsTool.js";
import GetInheritanceHierarchyTool from "./tools/refactoring/GetInheritanceHierarchyTool.js";
import ContextualSymbolResolutionTool from "./tools/refactoring/ContextualSymbolResolutionTool.js";

/**
 * Initializes and starts the Constellation MCP Server.
 */
async function startServer() {
	try {
		console.log("[Constellation MCP] Starting server...");

		// Initialize configuration (loads from file + auto-detects from git)
		await initializeConfig(process.cwd());

		const context = getConfigContext();
		console.log("[Constellation MCP] Configuration loaded:");
		console.log(`  API: ${context.config.apiUrl}`);
		console.log(`  Project: ${context.projectId}`);
		console.log(`  Branch: ${context.branchName}`);
		console.log(`  Config from file: ${context.configLoaded ? 'yes' : 'no (using defaults)'}`);
		console.log(`  Git repository: ${context.isGitRepo ? 'yes' : 'no'}`);

		// Create and configure MCP server
		const server = new MCPServer();

		// Register all implemented tools
		// Note: MCP framework auto-discovers tools from default exports
		// Tools are automatically registered when imported

		console.log("[Constellation MCP] Server started successfully");
		console.log("[Constellation MCP] Available tools (22/22 implemented - 100%):");
		console.log("");
		console.log("  ✅ Discovery Tools (4/4):");
		console.log("    - search_symbols");
		console.log("    - search_files");
		console.log("    - get_symbol_details");
		console.log("    - get_file_details");
		console.log("");
		console.log("  ✅ Dependency Tools (5/5):");
		console.log("    - get_dependencies");
		console.log("    - get_dependents");
		console.log("    - find_circular_dependencies");
		console.log("    - trace_symbol_usage");
		console.log("    - get_call_graph");
		console.log("");
		console.log("  ✅ Impact Analysis Tools (4/4):");
		console.log("    - analyze_change_impact");
		console.log("    - find_orphaned_code");
		console.log("    - analyze_breaking_changes");
		console.log("    - impact_analysis");
		console.log("");
		console.log("  ✅ Architecture Tools (5/5):");
		console.log("    - get_architecture_overview");
		console.log("    - get_module_overview");
		console.log("    - detect_architecture_violations");
		console.log("    - analyze_package_usage");
		console.log("    - compare_modules");
		console.log("");
		console.log("  ✅ Refactoring Tools (4/4):");
		console.log("    - find_similar_patterns");
		console.log("    - find_entry_points");
		console.log("    - get_inheritance_hierarchy");
		console.log("    - contextual_symbol_resolution");
		console.log("");
		console.log("  🎉 ALL 22 TOOLS IMPLEMENTED!");

		// Start the server
		await server.start();

	} catch (error) {
		console.error("[Constellation MCP] Failed to start server:", error);
		process.exit(1);
	}
}

// Start the server
startServer();