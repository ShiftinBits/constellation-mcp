/**
 * Enhanced Tool Definition: contextual_symbol_resolution
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const contextualSymbolResolutionDefinition: McpToolDefinition = {
	name: 'contextual_symbol_resolution',
	category: 'Refactoring',
	description:
		'Resolve symbol type/import context. USER ASKS: "What type is X?", "Where does Y come from?", "How do I import this?". depth 1-3 (usually 1). Shows how to import and use symbols with full context: definition, type, scope.',
	shortDescription: 'Resolve symbols with complete semantic context',
	whenToUse: [
		'❓ **USER ASKS:** "What type is X?", "Where does Y come from?", "Resolve ambiguous symbol", "Find import source", "How do I import this?"',
		'🔍 Need to understand how to import a symbol into your code',
		'🔍 Want full type signature with generics, constraints, inferred types',
		'🔍 Understanding scope chain (global/module/class/function/block)',
		'🔍 Need to see how a symbol is properly used with context',
		'🔍 Resolving where a symbol comes from in complex import chains',
	],
	relatedTools: [
		'search_symbols',
		'get_symbol_details',
		'trace_symbol_usage',
		'get_dependencies',
	],
	inputSchema: {
		type: 'object',
		properties: {
			symbolName: {
				type: 'string',
				description:
					'Symbol name to resolve (e.g., "getUserById", "User", "API_KEY"). ' +
					'This is the primary way to identify the symbol you want to analyze.',
			},
			symbolId: {
				type: 'string',
				description:
					'Unique symbol identifier (from search results). Alternative to symbolName. ' +
					'More precise if you have it from previous tool calls.',
			},
			filePath: {
				type: 'string',
				description:
					'File where symbol is defined (optional but recommended). ' +
					'Improves precision when multiple symbols have same name. ' +
					'Example: "src/services/user.service.ts"',
			},
			qualifiedName: {
				type: 'string',
				description:
					'Fully qualified symbol name (alternative identifier). ' +
					'Example: "MyNamespace.MyClass.myMethod"',
			},
			includeDependencies: {
				type: 'string',
				description:
					'Include dependencies analysis (what this symbol depends on). ' +
					'Set to "true" or "false". When true, shows what imports/references this symbol needs.',
			},
			includeDependents: {
				type: 'string',
				description:
					'Include dependents analysis (what depends on this symbol). ' +
					'Set to "true" or "false". When true, shows what code uses this symbol.',
			},
			depth: {
				type: 'string',
				description:
					'Dependency traversal depth (1-3, default: 1). ' +
					'⚠️ EXPONENTIAL GROWTH: depth=1 shows direct deps, depth=2 adds deps of deps, etc. ' +
					'Usually 1 is sufficient for understanding import context. Higher values for deep analysis only.',
			},
		},
		required: [],
	},
	examples: [
		{
			title: 'Understand how to import and use a symbol',
			description: 'Get import statement, type signature, and usage context',
			parameters: {
				symbolName: 'UserService',
				filePath: 'src/services/user.service.ts',
				includeDependencies: 'true',
				includeDependents: 'false',
				depth: '1',
			},
			expectedOutcome:
				'Returns how to import UserService, its complete type signature (class methods, properties, generics), ' +
				'scope information, and what dependencies it needs. Perfect for understanding how to use the symbol.',
		},
		{
			title: 'Resolve type information only',
			description: 'Quick type lookup without dependency analysis',
			parameters: {
				symbolName: 'calculateTotal',
				filePath: 'src/utils/math.ts',
				includeDependencies: 'false',
				includeDependents: 'false',
				depth: '1',
			},
			expectedOutcome:
				'Returns function signature with parameter types, return type, generics, and type constraints. ' +
				'Fast response focused on type system only.',
		},
		{
			title: 'Deep import chain analysis',
			description: 'Understand complex re-export chains',
			parameters: {
				symbolName: 'Button',
				includeDependencies: 'true',
				includeDependents: 'true',
				depth: '2',
			},
			expectedOutcome:
				'Returns where Button is originally defined, how it\'s re-exported through index files, ' +
				'and what imports Button to use it. Useful for understanding barrel exports and re-export patterns.',
		},
	],
	commonMistakes: [
		'❌ MISTAKE: Using for simple symbol search → ✅ DO: Use search_symbols instead for basic lookup',
		'❌ MISTAKE: Using for basic details without type context → ✅ DO: Use get_symbol_details instead if you don\'t need import/type resolution',
		'❌ MISTAKE: Not providing filePath for common symbol names → ✅ DO: Add filePath to disambiguate when multiple symbols share a name',
		'❌ MISTAKE: Using depth > 1 without needing deep import chain analysis → ✅ DO: Start with depth=1, only increase for complex re-export chains',
		'❌ MISTAKE: Enabling both dependencies and dependents when you only need one → ✅ DO: Enable only what you need to reduce response size',
	],
	sinceVersion: '0.0.1',
};
