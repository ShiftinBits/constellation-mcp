/**
 * Enhanced Tool Definition: compare_modules
 */

import { McpToolDefinition } from '../McpToolDefinition.interface.js';

export const compareModulesDefinition: McpToolDefinition = {
	name: 'compare_modules',
	category: 'Architecture',
	description:
		'Compare two modules: similarities, differences, dependencies, relationships. For refactoring/consolidation decisions. ' +
		'Accepts module1/module2 OR moduleA/moduleB. Control detail with include flags (Structure, Patterns, Dependencies, Similarity).',
	shortDescription: 'Compare two modules for similarities and differences',
	whenToUse: ['Deciding whether to consolidate similar modules', 'Understanding differences before merging code', 'Identifying duplicate functionality', 'Analyzing module relationships', 'Planning module refactoring'],
	relatedTools: ['get_module_overview', 'find_similar_patterns', 'get_architecture_overview', 'detect_architecture_violations'],
	inputSchema: {
		type: 'object',
		properties: {
			module1: { type: 'string', description: 'Path to first module (e.g., "src/services/auth")' },
			module2: { type: 'string', description: 'Path to second module (e.g., "src/services/users")' },
			moduleA: { type: 'string', description: 'Alternative naming for first module' },
			moduleB: { type: 'string', description: 'Alternative naming for second module' },
			includeStructure: { type: 'string', description: 'Include structure comparison' },
			includePatterns: { type: 'string', description: 'Include pattern analysis' },
			includeDependencies: { type: 'string', description: 'Include dependency comparison' },
			includeSimilarity: { type: 'string', description: 'Include similarity scoring' },
			includeConfidence: { type: 'string', description: 'Include confidence scores' },
		},
		required: [],
	},
	examples: [
		{ title: 'Compare two service modules', description: 'Check if auth and user services can be consolidated', parameters: { module1: 'src/services/auth', module2: 'src/services/user', includeStructure: 'true', includeSimilarity: 'true', includePatterns: 'true', includeDependencies: 'true', includeConfidence: 'false' }, expectedOutcome: 'Returns similarity score and structural comparison' },
		{ title: 'Quick similarity check', description: 'Fast comparison without details', parameters: { module1: 'src/utils/string', module2: 'src/helpers/text', includeStructure: 'false', includePatterns: 'false', includeDependencies: 'false', includeSimilarity: 'true', includeConfidence: 'false' }, expectedOutcome: 'Returns similarity score only' },
	],
	commonMistakes: ['Comparing unrelated modules - no useful insights', 'Not acting on high similarity findings'],
	sinceVersion: '0.0.1',
};
