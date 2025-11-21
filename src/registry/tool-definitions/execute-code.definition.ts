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
    'THE ONLY TOOL AVAILABLE. Execute TypeScript code to interact with the Constellation API. ' +
    'You MUST use this tool for ALL operations. Write TypeScript code that calls api methods like searchSymbols(), ' +
    'getDependencies(), etc. Supports async/await, Promise.all(), and full TypeScript capabilities. ' +
    'This is a Code Mode-only server - always write TypeScript code instead of trying to call individual tools.',

  shortDescription:
    'Code Mode - Write TypeScript to access all Constellation capabilities',

  whenToUse: [
    '**ALWAYS** - This is the only tool available',
    '**ANY REQUEST** - Search, analysis, dependencies, architecture overview, etc.',
    'Simple queries: Write code like `return await api.searchSymbols({ query: "User" })`',
    'Complex analysis: Chain multiple API calls with custom logic',
    'Parallel operations: Use Promise.all() for concurrent execution',
    'All codebase exploration must be done through Code Mode',
    'Remember: There are NO other tools - you MUST write code',
  ],

  relatedTools: ['execute_code'], // Self-reference to satisfy validation (only tool available)

  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        minLength: 1,
        description:
          'TypeScript code to execute. Has access to api object with methods: ' +
          'searchSymbols, getSymbolDetails, getDependencies, getDependents, ' +
          'findCircularDependencies, traceSymbolUsage, getCallGraph, ' +
          'findOrphanedCode, impactAnalysis, getArchitectureOverview. ' +
          'Supports async/await, Promise.all(), and standard TypeScript features.',
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

  sinceVersion: '0.1.0',
};