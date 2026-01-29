/**
 * Enhanced Tool Definition: query_code_graph
 *
 * Provides rich metadata for the query_code_graph tool to help AI agents
 * understand when and how to use Code Mode effectively.
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const queryCodeGraphDefinition: McpToolDefinition = {
	name: 'query_code_graph',
	category: 'Discovery',

	description:
		'Query codebase structure and relationships via AST-based code intelligence graph. ' +
		'Understands symbols, dependencies, call hierarchies, and change impact—capabilities text search lacks. ' +
		'Use for code structure (definitions, callers, dependencies, impact). Use Grep/Glob for literal strings, config values, log messages.',

	shortDescription:
		'Query code structure, dependencies, and relationships via AST-based intelligence graph',

	whenToUse: [
		'"Where is X defined?" / "Find function Y" → searchSymbols({query})',
		'"What calls X?" / "What imports this?" → getDependents({filePath}) or getCallGraph({symbolId})',
		'"What does X depend on?" → getDependencies({filePath})',
		'"Safe to modify X?" / "Blast radius?" → impactAnalysis({symbolId})',
		'"Find dead code" / "Unused exports?" → findOrphanedCode()',
		'"Project structure?" → getArchitectureOverview()',
		'About to modify a function/class → impactAnalysis first',
		'Exploring unfamiliar code → getArchitectureOverview first',
		'Planning a refactor → trace dependencies and dependents',
		'Reviewing a PR → check call graph and blast radius',
		'Refactoring code → impactAnalysis + getDependents to assess risk before restructuring',
		'Planning multi-file changes → getDependencies + getDependents to map modification order',
		'Finding all implementations of an interface → searchSymbols + traceSymbolUsage',
	],

	relatedTools: ['query_code_graph'],

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
				code: 'const {symbols} = await api.searchSymbols({query: "UserService"}); return await api.impactAnalysis({ symbolId: symbols[0].id });',
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
