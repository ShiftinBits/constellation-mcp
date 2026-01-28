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

	description:
		'Execute JavaScript to query Constellation code intelligence graph using the api object with async/await. ' +
		'Args: code (required), timeout (optional), cwd (optional for multi-project workspaces). ' +
		'Constraints: READ-ONLY, must return a value and await api.* calls, sandboxed (no fs/network). ' +
		'See apiReference for methods, methodSelection for when to use vs Grep/Glob.',

	shortDescription:
		'Execute JavaScript to query code intelligence (search, dependencies, impact)',

	whenToUse: [
		// Problem-oriented (primary recognition)
		'Use when you need to understand code structure, trace dependencies, assess change risk, or find code quality issues',
		// Category mapping (secondary)
		'Discovery: find symbol, where is X defined, show classes, locate function',
		'Dependencies: what imports X, what does X use, dependency tree, who uses this',
		'Impact: safe to change, blast radius, what breaks, breaking changes',
		'Quality: dead code, unused exports, orphaned code, can I delete this',
		'Architecture: project structure, codebase overview, how is this organized',
		// Entry point hint
		'Start with api.listMethods() for composition patterns and method discovery',
		// Core rule
		'ALWAYS use this tool - it is the only one available',
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
			cwd: {
				type: 'string',
				description:
					'Working directory context for multi-project workspaces. ' +
					'Used to locate the correct constellation.json by finding the git repository root. ' +
					'Provide this when working in monorepos or workspaces with multiple indexed projects.',
			},
		},
		required: ['code'],
	},

	// Condensed API type reference for AI assistants with nested structure hints
	// For full TypeScript interfaces, read resource: constellation://types/api
	apiReference: `
## Available API Methods (with nested response shapes)

### Start Here (Entry Points)

api.searchSymbols({ query, filterByKind?, isExported?, limit?, offset?, includeUsageCount? })
  → { symbols: [{ id, name, qualifiedName, kind, filePath, line, column?, isExported, signature?, usageCount? }],
      pagination?: { total, returned, hasMore, nextOffset?, currentOffset } }

api.getSymbolDetails({ symbolId | symbolName+filePath, includeReferences?, includeRelationships?, includeImpactScore? })
  → { symbol: { id, name, qualifiedName, kind, filePath, line, signature?, modifiers?, decorators?, isDeprecated },
      references?: [{ filePath, line, usageType, context?, aliasName? }],
      relationships?: { calls[], calledBy[], inheritsFrom[], inheritedBy[], children[] },
      impactScore?: { directUsage, transitiveImpact, riskScore, riskLevel } }

api.getArchitectureOverview({ includeMetrics?, includeModuleGraph?, includePackages? })
  → { metadata: { totalFiles, totalLines?, primaryLanguage, languages: [{ language, fileCount, percentage }], frameworks: [{ name, version?, confidence }] },
      structure: { files: { total, byType: {ext: count}, byParadigm }, symbols: { total, byKind: {kind: count}, exported, public }, modules: { total, averageSize, largest } },
      dependencies: { internal: { totalConnections, averagePerFile, mostConnectedFiles: [{ path, incomingCount, outgoingCount }] }, external: { totalPackages, directDependencies, topPackages: [{ name, usageCount, type? }] } },
      metrics?: { complexity: { average, high }, maintainability: { score, issues[] }, testCoverage?: { percentage, testedFiles, totalFiles } },
      moduleGraph?: { nodes: [{ id, name, fileCount, type }], edges: [{ from, to, weight }] } }

### Analysis (After Discovery)

api.traceSymbolUsage({ symbolId | symbolName+filePath, filterByUsageType?, includeTransitive?, excludeTests? })
  → { symbol: { name, kind, filePath },
      directUsages: [{ filePath, usageType, relationshipType, line?, column?, enclosingSymbol?: { name, kind }, context?, aliasName?, isTest?, importanceWeight? }],
      transitiveUsages?: [{ filePath, distance, chain[] }] }

api.impactAnalysis({ symbolId | symbolName+filePath, depth?, excludeTests?, analyzeBreakingChanges? })
  → { symbol: { id, name, qualifiedName, kind, filePath, line, column, isExported? },
      directDependents?: [{ id, name, qualifiedName, kind, filePath, line, relationshipType, depth }],
      transitiveDependents?: [...same shape...],
      impactedFiles: [{ filePath, symbolCount, isTest?, symbols: [{ id, name, kind, line }] }],
      breakingChangeRisk?: { riskLevel: 'low'|'medium'|'high'|'critical', factors: [{ factor, severity, description }], recommendations[] },
      summary: { directDependentCount, transitiveDependentCount, impactedFileCount, testFileCount, productionFileCount, maxDepth } }

api.getCallGraph({ symbolId | symbolName+filePath, direction?: 'callers'|'callees'|'both', depth? })
  → { root: { symbolId, name, filePath, line, column },
      callers?: [{ symbolId, name, filePath, line, column, depth }],
      callees?: [{ symbolId, name, filePath, line, column, isAsync, depth }] }

### Dependencies

api.getDependencies({ filePath, depth?, includePackages?, includeSymbols? })
  → { file, directDependencies: [{ filePath, importedSymbols?, isDefault, isNamespace }],
      transitiveDependencies?: [{ filePath, distance, path[] }],
      packages?: [{ name, version?, type }] }

api.getDependents({ filePath, depth?, includeSymbols?, includeImpactMetrics? })
  → { file, directDependents: [{ filePath, usedSymbols? }],
      transitiveDependents?: [{ filePath, distance, path[] }],
      detailedMetrics?: { byDepth: {depth: count}, criticalPaths[][], mostImpactedFiles[] } }

api.findCircularDependencies({ filePath?, maxDepth? })
  → { cycles: [{ cycle: string[], length }], totalCycles }

### Code Quality

api.findOrphanedCode({ filePattern?, filterByKind?, exportedOnly?, excludeTests?, includeReasons?, includeConfidence? })
  → { orphanedSymbols: [{ symbolId, name, kind, filePath, isExported, reason, confidence }],
      orphanedFiles: [{ filePath, reason, lastUpdated, confidence }] }

### Utility

api.ping() → { pong: true }  // Verify auth & connectivity

api.listMethods() → {
  methods: [{ name, description, triggerPhrases[], quickExample, typesResourceUri }],
  usage: string,
  example: string,
  decisionGuide: { "user intent phrase": "methodName", ... },
  tip: string
}
// Note: Returns an object with a 'methods' array, not an array directly
// Example: const result = api.listMethods(); result.methods.forEach(m => ...)

For type details: read resource constellation://types/api/{methodName}
  Examples: constellation://types/api/searchSymbols, constellation://types/api/impact
  Full types (all methods, ~147KB): constellation://types/api
`,

	// Decision tree for when to use Constellation vs other tools
	methodSelection: `
Before Grep/Glob for code questions, check:
1. Symbol location? → api.searchSymbols() (semantic + metadata + line numbers)
2. Usage/imports? → api.traceSymbolUsage() | api.getDependents() (cross-file graph)
3. Architecture? → api.getArchitectureOverview() (aggregated structure)
4. Refactor safety? → api.impactAnalysis() (breaking change risk)
5. Literal text only? → Use Grep (Constellation is semantic, not textual)

Constellation advantage: Pre-indexed graph = instant results vs full-repo search.
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
  isExported: true,
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

// Filter to find unused symbols (directUsages.length === 0 means no usages)
const unused = symbols.symbols.filter((s, i) =>
  usages[i].directUsages.length === 0
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

// Calculate risk score based on usage and dependency counts
const usageCount = usage.directUsages.length;
const depsCount = deps.directDependencies.length;
const dependentCount = dependents.directDependents.length;

let riskScore = 0;
if (usageCount > 50) riskScore += 3;
else if (usageCount > 20) riskScore += 2;
else if (usageCount > 5) riskScore += 1;

if (dependentCount > 10) riskScore += 2;
if (depsCount > 20) riskScore += 1;

const riskLevel = riskScore >= 4 ? "HIGH" :
                  riskScore >= 2 ? "MEDIUM" : "LOW";

return {
  symbol: symbol.name,
  file: symbol.filePath,
  usageCount,
  dependencyCount: depsCount,
  dependentCount,
  riskLevel,
  riskScore,
  impactSummary: impact.summary,
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

  // Calculate total impact (sum of directDependents across all nodes)
  const totalDependents = nodeDetails.reduce(
    (sum, d) => sum + d.directDependents.length, 0
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
		'MISTAKE: Using Grep to find function definitions → DO: api.searchSymbols() returns location + metadata instantly',
		'MISTAKE: Using Grep/Read loops to trace usage → DO: api.traceSymbolUsage() provides cross-file graph',
		'MISTAKE: Manual exploration to understand codebase → DO: api.getArchitectureOverview() gives instant structure',
		'MISTAKE: Wrong project results in multi-repo workspace → DO: Provide cwd parameter with your working directory',
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
