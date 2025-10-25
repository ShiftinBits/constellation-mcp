/**
 * Get Architecture Overview Tool
 *
 * MCP tool for getting a high-level overview of the codebase architecture
 */

import { z } from 'zod';
import { BaseMcpTool } from '../../lib/BaseMcpTool.js';
import { formatBytes } from '../../utils/format-helpers.js';

/**
 * Parameters matching backend API
 */
interface GetArchitectureOverviewParams {
	includeMetrics?: boolean;
	includeModuleGraph?: boolean;
	includePackages?: boolean;
	includeConfidence?: boolean;
}

/**
 * Backend API result types
 */
interface LanguageInfo {
	language: string;
	fileCount: number;
	percentage: number;
}

interface FrameworkInfo {
	name: string;
	version?: string;
	confidence: 'high' | 'medium' | 'low';
	evidence: string[];
}

interface ProjectMetadata {
	languages: LanguageInfo[];
	frameworks: FrameworkInfo[];
	primaryLanguage: string;
	totalFiles: number;
	totalLines?: number;
}

interface StructureStatistics {
	files: {
		total: number;
		byType: Record<string, number>;
		byParadigm: Record<string, number>;
	};
	symbols: {
		total: number;
		byKind: Record<string, number>;
		exported: number;
		public: number;
	};
	modules: {
		total: number;
		averageSize: number;
		largest: string;
	};
}

interface DependencyOverview {
	internal: {
		totalConnections: number;
		averagePerFile: number;
		mostConnectedFiles: Array<{
			path: string;
			incomingCount: number;
			outgoingCount: number;
		}>;
	};
	external: {
		totalPackages: number;
		directDependencies: number;
		production?: number;
		development?: number;
		topPackages: Array<{
			name: string;
			usageCount: number;
			type?: 'production' | 'development' | 'peer' | 'optional';
		}>;
	};
}

interface QualityMetrics {
	complexity: {
		average: number;
		high: number;
	};
	maintainability: {
		score: number;
		issues: string[];
	};
	testCoverage?: {
		percentage: number;
		testedFiles: number;
		totalFiles: number;
	};
}

interface ModuleGraphNode {
	id: string;
	name: string;
	fileCount: number;
	type: string;
}

interface ModuleGraphEdge {
	from: string;
	to: string;
	weight: number;
}

interface ModuleGraph {
	nodes: ModuleGraphNode[];
	edges: ModuleGraphEdge[];
}

interface GetArchitectureOverviewResult {
	metadata: ProjectMetadata;
	structure: StructureStatistics;
	dependencies: DependencyOverview;
	metrics?: QualityMetrics;
	moduleGraph?: ModuleGraph;
}

class GetArchitectureOverviewTool extends BaseMcpTool<
	GetArchitectureOverviewParams,
	GetArchitectureOverviewResult
> {
	name = 'get_architecture_overview';
	description =
		'Get a high-level overview of the codebase architecture including modules, layers, dependencies, and statistics. Useful for understanding system structure.';

	schema = {
		includeMetrics: {
			type: z.coerce.boolean().optional().default(false),
			description:
				'Include quality metrics (complexity, maintainability, test coverage) - default: false',
		},
		includeModuleGraph: {
			type: z.coerce.boolean().optional().default(false),
			description: 'Include module graph structure - default: false',
		},
		includePackages: {
			type: z.coerce.boolean().optional().default(true),
			description:
				'Include external package dependency details - default: true',
		},
		includeConfidence: {
			type: z.coerce.boolean().optional().default(false),
			description: 'Include confidence scores (default: false)',
		},
	};

	/**
	 * Format the architecture overview for AI-friendly output
	 */
	protected formatResult(
		data: GetArchitectureOverviewResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const { metadata: projectMeta, structure, dependencies, metrics, moduleGraph } = data;

		// Defensive checks for required data
		if (!projectMeta) {
			return 'Error: API returned incomplete data - missing metadata';
		}
		if (!structure) {
			return 'Error: API returned incomplete data - missing structure';
		}
		if (!dependencies) {
			return 'Error: API returned incomplete data - missing dependencies';
		}

		let output = `# Architecture Overview\n\n`;

		// Project Metadata
		output += `## Project Metadata\n\n`;
		output += `**Primary Language:** ${projectMeta.primaryLanguage}\n`;
		output += `**Total Files:** ${projectMeta.totalFiles.toLocaleString()}\n`;
		if (projectMeta.totalLines) {
			output += `**Total Lines:** ${projectMeta.totalLines.toLocaleString()}\n`;
		}

		// Languages
		if (projectMeta.languages.length > 0) {
			output += `\n### Languages\n\n`;
			for (const lang of projectMeta.languages) {
				output += `- **${lang.language}**: ${lang.fileCount} files (${lang.percentage.toFixed(1)}%)\n`;
			}
		}

		// Frameworks
		if (projectMeta.frameworks.length > 0) {
			output += `\n### Detected Frameworks\n\n`;
			for (const framework of projectMeta.frameworks) {
				const version = framework.version ? ` v${framework.version}` : '';
				output += `- **${framework.name}**${version} (${framework.confidence} confidence)\n`;
				if (framework.evidence.length > 0 && framework.evidence.length <= 3) {
					output += `  - Evidence: ${framework.evidence.join(', ')}\n`;
				}
			}
		}

		// Structure Statistics
		output += `\n## Code Structure\n\n`;

		output += `### Files\n`;
		output += `- **Total:** ${structure.files.total.toLocaleString()}\n`;

		if (Object.keys(structure.files.byType).length > 0) {
			output += `- **By Type:**\n`;
			const sortedTypes = Object.entries(structure.files.byType)
				.sort(([, a], [, b]) => b - a)
				.slice(0, 10);
			for (const [type, count] of sortedTypes) {
				output += `  - ${type}: ${count}\n`;
			}
		}

		output += `\n### Symbols\n`;
		output += `- **Total:** ${structure.symbols.total.toLocaleString()}\n`;
		output += `- **Exported:** ${structure.symbols.exported.toLocaleString()}\n`;
		output += `- **Public:** ${structure.symbols.public.toLocaleString()}\n`;

		if (Object.keys(structure.symbols.byKind).length > 0) {
			output += `- **By Kind:**\n`;
			const sortedKinds = Object.entries(structure.symbols.byKind)
				.sort(([, a], [, b]) => b - a)
				.slice(0, 10);
			for (const [kind, count] of sortedKinds) {
				output += `  - ${kind}: ${count}\n`;
			}
		}

		output += `\n### Modules\n`;
		output += `- **Total:** ${structure.modules.total}\n`;
		output += `- **Average Size:** ${structure.modules.averageSize.toFixed(1)} files\n`;
		output += `- **Largest Module:** ${structure.modules.largest}\n`;

		// Dependencies
		output += `\n## Dependencies\n\n`;

		output += `### Internal Dependencies\n`;
		output += `- **Total Connections:** ${dependencies.internal.totalConnections.toLocaleString()}\n`;
		output += `- **Average Per File:** ${dependencies.internal.averagePerFile.toFixed(2)}\n`;

		if (dependencies.internal.mostConnectedFiles.length > 0) {
			output += `- **Most Connected Files:**\n`;
			for (const file of dependencies.internal.mostConnectedFiles.slice(0, 5)) {
				output += `  - ${file.path} (↓${file.incomingCount} ↑${file.outgoingCount})\n`;
			}
		}

		output += `\n### External Dependencies\n`;
		output += `- **Total Packages:** ${dependencies.external.totalPackages}\n`;
		output += `- **Direct Dependencies:** ${dependencies.external.directDependencies}\n`;
		if (dependencies.external.production !== undefined) {
			output += `- **Production:** ${dependencies.external.production}\n`;
		}
		if (dependencies.external.development !== undefined) {
			output += `- **Development:** ${dependencies.external.development}\n`;
		}

		if (dependencies.external.topPackages.length > 0) {
			output += `- **Top Packages by Usage:**\n`;
			for (const pkg of dependencies.external.topPackages.slice(0, 10)) {
				const type = pkg.type ? ` (${pkg.type})` : '';
				output += `  - ${pkg.name}: ${pkg.usageCount} usages${type}\n`;
			}
		}

		// Quality Metrics (optional)
		if (metrics) {
			output += `\n## Quality Metrics\n\n`;

			output += `### Complexity\n`;
			output += `- **Average:** ${metrics.complexity.average.toFixed(2)}\n`;
			output += `- **High Complexity Items:** ${metrics.complexity.high}\n`;

			output += `\n### Maintainability\n`;
			output += `- **Score:** ${metrics.maintainability.score}/100\n`;
			if (metrics.maintainability.issues.length > 0) {
				output += `- **Issues:**\n`;
				for (const issue of metrics.maintainability.issues.slice(0, 5)) {
					output += `  - ${issue}\n`;
				}
				if (metrics.maintainability.issues.length > 5) {
					output += `  - ... and ${metrics.maintainability.issues.length - 5} more\n`;
				}
			}

			if (metrics.testCoverage) {
				output += `\n### Test Coverage\n`;
				output += `- **Coverage:** ${metrics.testCoverage.percentage.toFixed(1)}%\n`;
				output += `- **Tested Files:** ${metrics.testCoverage.testedFiles}/${metrics.testCoverage.totalFiles}\n`;
			}
		}

		// Module Graph (optional)
		if (moduleGraph) {
			output += `\n## Module Graph\n\n`;
			output += `- **Nodes:** ${moduleGraph.nodes.length}\n`;
			output += `- **Edges:** ${moduleGraph.edges.length}\n`;

			if (moduleGraph.nodes.length > 0 && moduleGraph.nodes.length <= 10) {
				output += `\n**Modules:**\n`;
				for (const node of moduleGraph.nodes) {
					output += `- ${node.name} (${node.fileCount} files, type: ${node.type})\n`;
				}
			}
		}

		// Contextual next-step suggestions
		output += `\n\n## 📋 Next Steps for Exploration\n\n`;

		if (structure.modules.total > 0) {
			output += `- **get_module_overview** - Deep dive into specific modules (${structure.modules.total} available). Start with "${structure.modules.largest}" (largest module).\n`;
		}

		if (dependencies.internal.totalConnections > 100) {
			output += `- **detect_architecture_violations** - ${dependencies.internal.totalConnections} internal connections. Check for layering violations and coupling issues.\n`;
		}

		if (dependencies.internal.mostConnectedFiles.length > 0) {
			const topFile = dependencies.internal.mostConnectedFiles[0];
			output += `- **get_dependents** - Analyze high-traffic files like "${topFile.path}" (${topFile.incomingCount + topFile.outgoingCount} connections).\n`;
		}

		output += `- **find_entry_points** - Understand application execution flow by identifying main entry points.\n`;

		if (structure.symbols.total > 1000) {
			output += `- **search_symbols** - ${structure.symbols.total.toLocaleString()} symbols available. Search for specific functions, classes, or types.\n`;
		}

		if (dependencies.external.topPackages.length > 5) {
			output += `- **analyze_package_usage** - Review external dependency usage patterns for ${dependencies.external.totalPackages} packages.\n`;
		}

		if (metrics?.complexity.high > 10) {
			output += `- **get_quality_metrics** - ${metrics.complexity.high} high-complexity items detected. Identify refactoring candidates.\n`;
		}

		if (metadata.cached) {
			output += '\n\n---\n*Results served from cache*';
		}

		return output.trim();
	}
}

export default GetArchitectureOverviewTool;
