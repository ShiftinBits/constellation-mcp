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
		'Constraints: READ-ONLY, must return a value and await api.* calls, sandboxed (no fs/network).',

	shortDescription:
		'Execute JavaScript to query code intelligence (search, dependencies, impact)',

	whenToUse: [
		'Use when you need to understand code structure, trace dependencies, assess change risk, or find code quality issues',
		'Discovery: find symbol, where is X defined, show classes, locate function',
		'Dependencies/Impact: what imports X, what uses this, safe to change, breaking changes',
		'Start with api.listMethods() for composition patterns and method discovery',
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

	examples: [
		{
			title: 'Find a symbol',
			description: 'Search for a function by name',
			parameters: {
				code: 'return await api.searchSymbols({ query: "handleAuth", limit: 5 });',
			},
			expectedOutcome:
				'Returns matching symbols with file paths and line numbers.',
		},
		{
			title: 'Check impact',
			description: 'Analyze impact of changing a symbol',
			parameters: {
				code: 'return await api.impactAnalysis({ symbolName: "UserService", filePath: "src/services/user.ts" });',
			},
			expectedOutcome:
				'Returns dependents, impacted files, and risk assessment.',
		},
	],

	sinceVersion: '0.1.0',
};
