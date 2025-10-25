/**
 * Enhanced Tool Definition: find_similar_patterns
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const findSimilarPatternsDefinition: McpToolDefinition = {
	name: 'find_similar_patterns',
	category: 'Refactoring',

	description:
		'Find duplicate or similar code patterns. USER ASKS: "Find duplicates", "Show similar code", "Find copy-paste". Similarity: 0.7=somewhat, 0.8=very similar (recommended), 0.9+=nearly identical. Use referenceFile or referenceSymbol.',

	shortDescription: 'Find duplicate or similar code patterns',

	whenToUse: [
		'❓ **USER ASKS:** "Find duplicates", "Show similar code", "Find copy-paste", "Detect code duplication", "What can I consolidate?"',
		'🔍 Identifying code duplication for refactoring',
		'🔍 Finding candidates for utility function extraction',
		'🔍 Detecting copy-paste code patterns',
		'🔍 Improving code maintainability through consolidation',
		'🔍 Reducing codebase size by eliminating redundancy',
	],
	relatedTools: ['compare_modules', 'find_orphaned_code', 'get_architecture_overview', 'contextual_symbol_resolution'],

	inputSchema: {
		type: 'object',
		properties: {
			referenceFile: {
				type: 'string',
				description:
					'Reference file to find similar patterns to (e.g., "src/utils/validators.ts"). ' +
					'Finds files with similar code structure/patterns. ' +
					'Use EITHER referenceFile OR referenceSymbol, not both. ' +
					'Example: referenceFile="src/api/users.ts" finds other API files with similar patterns.',
			},
			referenceSymbol: {
				type: 'string',
				description:
					'Reference symbol to find similar patterns to (e.g., "formatUserData", "UserValidator"). ' +
					'Finds symbols (functions/classes) with similar implementation. ' +
					'Use EITHER referenceFile OR referenceSymbol, not both. ' +
					'Example: referenceSymbol="validateEmail" finds other validation functions with similar logic.',
			},
			minSimilarity: {
				type: 'string',
				description:
					'Minimum similarity score (0-1, default: 0.7). ' +
					'0.7 = somewhat similar (shared structure), catches more candidates but includes borderline matches. ' +
					'0.8 = very similar (shared logic), good balance for refactoring. ' +
					'0.9+ = nearly identical (likely copy-paste), immediate extraction candidates. ' +
					'RECOMMENDATION: Start with 0.8, then lower to 0.7 if you need more results.',
			},
			filterByKind: {
				type: 'string',
				description:
					'Filter by symbol kind. Valid values: "function", "class", "variable", "interface", "type". ' +
					'Example: filterByKind="function" finds only similar functions. ' +
					'Omit to search all symbol types.',
			},
			filterByModuleType: {
				type: 'string',
				description:
					'Filter by module type. Valid values: "esm" (ES modules), "commonjs" (require/exports). ' +
					'Example: filterByModuleType="esm" finds similar patterns only in ES module files. ' +
					'Omit to search all module types.',
			},
			filterByParadigm: {
				type: 'string',
				description:
					'Filter by programming paradigm. Valid values: "object-oriented", "functional", "procedural". ' +
					'Example: filterByParadigm="functional" finds similar patterns in functional code. ' +
					'Omit to search all paradigms.',
			},
			includeConfidence: {
				type: 'string',
				description:
					'Include confidence scores for similarity matches (set to "true" or "false"). ' +
					'Confidence indicates how reliable the similarity score is. ' +
					'High confidence (0.9+) = accurate match, low confidence (0.5-0.7) = uncertain match.',
			},
			limit: {
				type: 'string',
				description: 'Maximum results to return (default: 50, max: 100). Use with offset for pagination.',
			},
			offset: {
				type: 'string',
				description: 'Offset for pagination (default: 0). Example: offset=50 gets results 51-100.',
			},
		},
		required: [],
	},
	examples: [
		{ title: 'Find similar functions', description: 'Locate functions similar to a reference', parameters: { referenceSymbol: 'formatUserData', minSimilarity: '0.8', filterByKind: 'function', includeConfidence: 'false', limit: '20', offset: '0' }, expectedOutcome: 'Returns functions with 80%+ similarity to formatUserData' },
		{ title: 'Find duplicate code patterns', description: 'Detect copy-paste code across codebase', parameters: { referenceFile: 'src/utils/validators.ts', minSimilarity: '0.7', includeConfidence: 'true', limit: '30', offset: '0' }, expectedOutcome: 'Returns files with similar patterns to validators.ts' },
	],
	commonMistakes: [
		'❌ MISTAKE: Setting similarity too high (>0.9) → ✅ DO: Start with 0.8, only use 0.9+ for exact copy-paste detection',
		'❌ MISTAKE: Using without reviewing matches → ✅ DO: Review with get_symbol_details before refactoring',
		'❌ MISTAKE: Finding duplicates but not refactoring → ✅ DO: Extract to shared utility after finding similar patterns',
		'❌ MISTAKE: Using referenceFile AND referenceSymbol → ✅ DO: Use EITHER referenceFile OR referenceSymbol, not both',
	],
	sinceVersion: '0.0.1',
};
