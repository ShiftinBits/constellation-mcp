/**
 * Enhanced Tool Definition: query_code
 *
 * Provides rich metadata for the query_code tool to help AI agents
 * understand when and how to use Code Mode effectively.
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const queryCodeDefinition: McpToolDefinition = {
	name: 'query_code',
	category: 'Discovery',

	description:
		'Query codebase structure and relationships via AST-based code intelligence graph. ' +
		'Understands symbols, dependencies, call hierarchies, and change impact—capabilities text search lacks. ' +
		'Use for: finding definitions, tracing usage, dependency analysis, change impact, finding dead code, understanding architecture.',

	shortDescription:
		'Query code structure, dependencies, and relationships via AST-based intelligence graph',

	whenToUse: [
		'Finding symbol definitions: "where is X defined", "find function Y", "locate class Z"',
		'Tracing symbol usage: "what calls X", "what uses this function", "who imports this"',
		'Dependency analysis: "what does X import", "dependency tree", "what does this file depend on"',
		'Impact assessment: "safe to modify X", "blast radius", "what breaks if I change this"',
		'Finding dead code: "unused exports", "orphaned symbols", "can I delete this"',
		'Architecture overview: "project structure", "how is this organized", "codebase layout"',
	],

	relatedTools: ['query_code'],

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

	examples: [
		{
			title: 'Find a symbol by name',
			description:
				'Search for functions, classes, or variables matching a pattern',
			parameters: {
				code: 'return await api.searchSymbols({ query: "handleAuth", limit: 5 });',
			},
			expectedOutcome:
				'Returns matching symbols with file paths, line numbers, and metadata.',
		},
		{
			title: 'Analyze change impact',
			description: 'Assess risk and dependencies before modifying a symbol',
			parameters: {
				code: 'return await api.impactAnalysis({ symbolName: "UserService", filePath: "src/services/user.ts" });',
			},
			expectedOutcome:
				'Returns dependents, impacted files, and breaking change risk assessment.',
		},
		{
			title: 'Find unused code',
			description: 'Identify exported symbols that are never imported',
			parameters: {
				code: 'return await api.findOrphanedCode({ limit: 20 });',
			},
			expectedOutcome:
				'Returns list of orphaned symbols and files that can potentially be removed.',
		},
	],

	sinceVersion: '0.1.0',
};
