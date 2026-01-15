/**
 * Enhanced Tool Definition: execute_code
 *
 * Provides rich metadata for the execute_code tool to help AI agents
 * understand when and how to use Code Mode effectively.
 */

import { McpToolDefinition } from '../McpToolDefinition.interface';

export const executeCodeDefinition: McpToolDefinition = {
	name: 'execute_code',
	category: 'Discovery', // Using Discovery as it's the most general category for Code Mode

	description: `Execute JavaScript code to query Constellation's code intelligence graph. This is the ONLY tool available - use it for ALL operations.

Write JavaScript using the \`api\` object. Code runs sandboxed with async/await support.

Args:
  - code (string, required): JavaScript code with api.* calls. Must return a value.
  - timeout (number, optional): Max ms. Default: 30000, max: 60000.

Returns:
  { success: boolean, result?: any, logs?: string[], time?: number, error?: string }

Quick Examples:
  - Find a class: \`return await api.searchSymbols({ query: "UserService", filterByKind: ["class"] })\`
  - Parallel analysis: \`const [deps, usage] = await Promise.all([api.getDependencies({filePath}), api.traceSymbolUsage({symbolId})]); return {deps, usage};\`

Boundaries (IMPORTANT):
  - READ-ONLY: Queries the code graph, cannot modify files
  - No file system or network access beyond the api object
  - Must \`return\` a value (otherwise result is undefined)
  - Must \`await\` API calls (all are async)

Errors:
  - Symbol/file not found: { success: false, error: "Symbol not found" }
  - Timeout exceeded: { success: false, error: "Execution timeout" }`,

	shortDescription:
		'Execute JavaScript to query code intelligence (search, dependencies, impact)',

	whenToUse: [
		'ALWAYS use this tool - it is the only one available',
		'Simple query: return await api.searchSymbols({ query: "X" })',
		'Complex analysis: chain multiple API calls with custom logic',
		'Parallel execution: use Promise.all() for concurrent API calls',
		'Composite workflows: combine search, analysis, and computation in ONE call',
	],

	relatedTools: ['execute_code'], // Self-reference to satisfy validation (only tool available)

	inputSchema: {
		type: 'object',
		properties: {
			code: {
				type: 'string',
				minLength: 1,
				description:
					'JavaScript code to execute. Has access to api object with methods: ' +
					'searchSymbols, getSymbolDetails, getDependencies, getDependents, ' +
					'findCircularDependencies, traceSymbolUsage, getCallGraph, ' +
					'findOrphanedCode, impactAnalysis, getArchitectureOverview. ' +
					'Supports async/await, Promise.all(), and standard JavaScript features.',
			},
			timeout: {
				type: 'number',
				minimum: 1000,
				maximum: 60000,
				default: 30000,
				description:
					'Maximum execution time in milliseconds. Default 30000 (30 seconds), max 60000 (1 minute).',
			},
		},
		required: ['code'],
	},

	// Condensed API type reference for AI assistants
	apiReference: `
## Available API Methods

### Discovery
api.searchSymbols({ query, filterByKind?, limit? }) → { symbols[], pagination? }
api.getSymbolDetails({ symbolId | symbolName+filePath, includeReferences? }) → { symbol, references?, relationships? }

### Dependencies
api.getDependencies({ filePath, depth?, includePackages? }) → { directDependencies[], transitiveDependencies? }
api.getDependents({ filePath, depth? }) → { directDependents[], transitiveDependents? }
api.findCircularDependencies({ filePath?, maxDepth? }) → { cycles[], totalCycles }

### Tracing
api.traceSymbolUsage({ symbolId | symbolName+filePath, filterByUsageType? }) → { symbol, directUsages[] }
api.getCallGraph({ symbolId | symbolName+filePath, direction?, depth? }) → { root, callers?, callees? }

### Impact
api.impactAnalysis({ symbolId | symbolName+filePath, depth? }) → { symbol, impactedFiles[], summary, breakingChangeRisk? }
api.findOrphanedCode({ filePattern?, filterByKind? }) → { orphanedSymbols[], orphanedFiles[] }

### Architecture
api.getArchitectureOverview({ includeMetrics?, includeModuleGraph? }) → { metadata, structure, dependencies }

### Utility
api.listMethods() → { methods[], usage, example }
`,

	examples: [
		{
			title: 'Find unused exports',
			description:
				'Identify all exported symbols that are never imported or used',
			parameters: {
				code: `
// Find all exported symbols
const symbols = await api.searchSymbols({
  query: '',
  filterByExported: true,
  limit: 100
});

// Check usage for each symbol
const usagePromises = symbols.symbols.map(s =>
  api.traceSymbolUsage({
    symbolName: s.name,
    filePath: s.filePath
  })
);

const usages = await Promise.all(usagePromises);

// Filter to find unused symbols
const unused = symbols.symbols.filter((s, i) =>
  usages[i].totalUsages === 0
);

return {
  unusedCount: unused.length,
  unusedSymbols: unused.map(s => ({
    name: s.name,
    file: s.filePath,
    type: s.kind
  }))
};`,
			},
			expectedOutcome:
				'Returns a list of exported symbols that have no usages across the codebase, ' +
				'helping identify dead code that can be safely removed.',
		},
		{
			title: 'Analyze refactoring impact',
			description:
				'Comprehensive analysis of how refactoring a symbol will affect the codebase',
			parameters: {
				code: `
const symbolName = "UserService";

// Find the symbol
const searchResult = await api.searchSymbols({
  query: symbolName,
  limit: 1
});

if (searchResult.symbols.length === 0) {
  return { error: "Symbol not found: " + symbolName };
}

const symbol = searchResult.symbols[0];

// Parallel analysis of multiple aspects
const [details, usage, deps, dependents, impact] = await Promise.all([
  api.getSymbolDetails({
    symbolName: symbol.name,
    filePath: symbol.filePath
  }),
  api.traceSymbolUsage({
    symbolName: symbol.name,
    filePath: symbol.filePath
  }),
  api.getDependencies({
    filePath: symbol.filePath
  }),
  api.getDependents({
    filePath: symbol.filePath
  }),
  api.impactAnalysis({
    symbolName: symbol.name,
    filePath: symbol.filePath
  })
]);

// Calculate risk score
let riskScore = 0;
if (usage.totalUsages > 50) riskScore += 3;
else if (usage.totalUsages > 20) riskScore += 2;
else if (usage.totalUsages > 5) riskScore += 1;

if (dependents.totalCount > 10) riskScore += 2;
if (deps.totalCount > 20) riskScore += 1;

const riskLevel = riskScore >= 4 ? "HIGH" :
                  riskScore >= 2 ? "MEDIUM" : "LOW";

return {
  symbol: symbol.name,
  file: symbol.filePath,
  usageCount: usage.totalUsages,
  dependencyCount: deps.totalCount,
  dependentCount: dependents.totalCount,
  riskLevel,
  riskScore,
  impactSummary: impact.impact,
  recommendation: riskLevel === "HIGH"
    ? "Consider gradual refactoring with feature flags"
    : "Safe to refactor directly"
};`,
			},
			expectedOutcome:
				'Comprehensive refactoring impact analysis with risk assessment, usage statistics, ' +
				'and actionable recommendations based on multiple factors.',
		},
		{
			title: 'Find circular dependency chains',
			description:
				'Identify and analyze circular dependencies with their impact',
			parameters: {
				code: `
// Find all circular dependencies
const cycles = await api.findCircularDependencies({
  limit: 50
});

// Analyze each cycle for impact
const analysisPromises = cycles.cycles.map(async (cycle) => {
  // Get details for each node in the cycle
  const nodeDetails = await Promise.all(
    cycle.nodes.map(node =>
      api.getDependents({
        filePath: node.filePath,
        limit: 5
      })
    )
  );

  // Calculate total impact
  const totalDependents = nodeDetails.reduce(
    (sum, d) => sum + d.totalCount, 0
  );

  return {
    cycle: cycle.nodes.map(n => n.filePath),
    length: cycle.nodes.length,
    totalDependents,
    severity: totalDependents > 20 ? "HIGH" :
              totalDependents > 10 ? "MEDIUM" : "LOW"
  };
});

const analyzed = await Promise.all(analysisPromises);

// Sort by severity
analyzed.sort((a, b) => b.totalDependents - a.totalDependents);

return {
  totalCycles: analyzed.length,
  highSeverity: analyzed.filter(a => a.severity === "HIGH").length,
  mediumSeverity: analyzed.filter(a => a.severity === "MEDIUM").length,
  lowSeverity: analyzed.filter(a => a.severity === "LOW").length,
  topCycles: analyzed.slice(0, 5)
};`,
			},
			expectedOutcome:
				'Comprehensive circular dependency analysis with severity rankings based on ' +
				'how many other files depend on the circular dependency chain.',
		},
	],

	commonMistakes: [
		'MISTAKE: Not using await with API calls → DO: Always await api.* methods or use Promise.all()',
		'MISTAKE: Sequential API calls in a loop → DO: Use Promise.all() for parallel execution',
		'MISTAKE: Not returning a result → DO: Always return the final analysis result',
		'MISTAKE: Using require() or import → DO: API is already available, just use api.*',
		'MISTAKE: Trying to access files directly → DO: Use API methods only, no fs access',
		'MISTAKE: Infinite loops → DO: Always have exit conditions in loops',
	],

	// Trigger phrases for organic AI recognition (max 20 per schema)
	// Consolidated to cover key categories: Discovery, Dependencies, Impact, Architecture, Dead Code
	triggerPhrases: [
		// Discovery (4)
		'find function',
		'find class',
		'where is defined',
		'search for symbol',
		// Dependencies (4)
		'what imports this',
		'what uses this',
		'show dependencies',
		'dependency tree',
		// Impact (4)
		'is it safe to change',
		'impact analysis',
		'breaking changes',
		'blast radius',
		// Architecture (2)
		'codebase overview',
		'architecture overview',
		// Dead code (3)
		'unused code',
		'dead code',
		'orphaned code',
		// Circular deps (1)
		'circular dependency',
		// Call graph (2)
		'what calls this',
		'find all usages',
	],

	sinceVersion: '0.1.0',
};
