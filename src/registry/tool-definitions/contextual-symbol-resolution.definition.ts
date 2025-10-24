/**
 * Enhanced Tool Definition: contextual_symbol_resolution
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const contextualSymbolResolutionDefinition: McpToolDefinition = {
	name: 'contextual_symbol_resolution',
	category: 'Refactoring',
	description: 'Resolve a symbol with full context including definition, type information, scope, imports, and usage. Essential for understanding how symbols are defined and used with complete semantic context.',
	shortDescription: 'Resolve symbols with complete semantic context',
	whenToUse: ['Understanding symbol definition with full context', 'Resolving ambiguous symbol references', 'Analyzing type information and scope', 'Tracing import chains and dependencies', 'Getting complete semantic information'],
	relatedTools: ['get_symbol_details', 'trace_symbol_usage', 'search_symbols', 'get_dependencies'],
	inputSchema: {
		type: 'object',
		properties: {
			symbolName: { type: 'string', description: 'Symbol name to resolve (e.g., "getUserById", "User")' },
			symbolId: { type: 'string', description: 'Unique symbol ID (alternative)' },
			filePath: { type: 'string', description: 'File path (optional, improves precision)' },
			qualifiedName: { type: 'string', description: 'Fully qualified name (alternative)' },
			includeDependencies: { type: 'string', description: 'Include dependencies' },
			includeDependents: { type: 'string', description: 'Include dependents' },
			depth: { type: 'string', description: 'Dependency depth (default: 1, max: 3)' },
		},
		required: ['includeDependencies', 'includeDependents', 'depth'],
	},
	examples: [
		{ title: 'Resolve symbol with context', description: 'Get complete context for a symbol', parameters: { symbolName: 'processData', filePath: 'src/services/data.ts', includeDependencies: 'true', includeDependents: 'true', depth: '1' }, expectedOutcome: 'Returns definition, type, scope, imports, and usage context' },
		{ title: 'Quick symbol resolution', description: 'Fast resolution without dependencies', parameters: { symbolName: 'UserService', includeDependencies: 'false', includeDependents: 'false', depth: '1' }, expectedOutcome: 'Returns symbol definition and type information' },
	],
	commonMistakes: ['Not providing filePath for common names - gets ambiguous results', 'Using high depth unnecessarily'],
	performanceNotes: ['Basic resolution very fast (<100ms)', 'Dependency analysis adds time per level'],
	sinceVersion: '0.0.1',
};
