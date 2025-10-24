/**
 * Enhanced Tool Definition: find_similar_patterns
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const findSimilarPatternsDefinition: McpToolDefinition = {
	name: 'find_similar_patterns',
	category: 'Refactoring',
	description: 'Find duplicate or similar code patterns across the codebase. Identifies refactoring opportunities to reduce duplication and improve maintainability by extracting common patterns.',
	shortDescription: 'Find duplicate or similar code patterns',
	whenToUse: ['Identifying code duplication for refactoring', 'Finding candidates for utility function extraction', 'Detecting copy-paste code', 'Improving code maintainability', 'Reducing codebase size through consolidation'],
	relatedTools: ['compare_modules', 'find_orphaned_code', 'get_architecture_overview', 'contextual_symbol_resolution'],
	inputSchema: {
		type: 'object',
		properties: {
			referenceFile: { type: 'string', description: 'Reference file to find similar patterns to' },
			referenceSymbol: { type: 'string', description: 'Reference symbol to find similar patterns to' },
			minSimilarity: { type: 'string', description: 'Minimum similarity score (0-1, default: 0.7)' },
			filterByKind: { type: 'string', description: 'Filter by symbol kind (e.g., "function", "class")' },
			filterByModuleType: { type: 'string', description: 'Filter by module type' },
			filterByParadigm: { type: 'string', description: 'Filter by paradigm' },
			includeConfidence: { type: 'string', description: 'Include confidence scores' },
			limit: { type: 'string', description: 'Max results (default: 50, max: 100)' },
			offset: { type: 'string', description: 'Offset for pagination' },
		},
		required: ['minSimilarity', 'includeConfidence', 'limit', 'offset'],
	},
	examples: [
		{ title: 'Find similar functions', description: 'Locate functions similar to a reference', parameters: { referenceSymbol: 'formatUserData', minSimilarity: '0.8', filterByKind: 'function', includeConfidence: 'false', limit: '20', offset: '0' }, expectedOutcome: 'Returns functions with 80%+ similarity to formatUserData' },
		{ title: 'Find duplicate code patterns', description: 'Detect copy-paste code across codebase', parameters: { referenceFile: 'src/utils/validators.ts', minSimilarity: '0.7', includeConfidence: 'true', limit: '30', offset: '0' }, expectedOutcome: 'Returns files with similar patterns to validators.ts' },
	],
	commonMistakes: ['Setting similarity too high (>0.9) - misses useful matches', 'Not refactoring after finding duplicates'],
	performanceNotes: ['Pattern matching takes 3-5 seconds', 'Lower similarity thresholds take longer'],
	sinceVersion: '0.0.1',
};
