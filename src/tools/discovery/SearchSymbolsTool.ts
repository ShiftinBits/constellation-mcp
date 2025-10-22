/**
 * Search Symbols Tool
 *
 * MCP tool for searching symbols (functions, classes, variables, etc.) across the codebase
 * with powerful filtering capabilities.
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';
import {
	SearchSymbolsParams,
	SearchSymbolsResult,
} from '../../types/api-types.js';
import { formatSymbolList } from '../../utils/format-helpers.js';

class SearchSymbolsTool extends BaseMcpTool<
	SearchSymbolsParams,
	SearchSymbolsResult
> {
	name = 'search_symbols';
	description =
		'Search for symbols (functions, classes, variables, types, etc.) across the codebase with powerful filtering options. Returns symbol names, locations, signatures, and metadata.';

	schema = {
		query: {
			type: z.string().min(1).max(200),
			description:
				'Name or pattern to search for (e.g., "calculate", "User", "handleClick")',
		},
		filterByKind: {
			type: z.array(z.string()).optional(),
			description:
				'Filter by symbol type: function, class, variable, interface, type, enum, method, property, etc.',
		},
		filterByVisibility: {
			type: z.array(z.string()).optional(),
			description:
				'Filter by access level: public, private, protected',
		},
		isExported: {
			type: z.boolean().optional(),
			description:
				'Only return exported symbols (true) or only non-exported (false)',
		},
		filePattern: {
			type: z.string().optional(),
			description:
				'Limit to file paths matching this pattern (e.g., "src/utils/**")',
		},
		limit: {
			type: z.number().int().min(1).max(100).optional().default(50),
			description:
				'Maximum number of results to return (default: 50, max: 100)',
		},
		offset: {
			type: z.number().int().min(0).optional().default(0),
			description: 'Offset for pagination (default: 0)',
		},
		includeUsageCount: {
			type: z.boolean().optional(),
			description:
				'Include count of how many places use this symbol',
		},
		includeDocumentation: {
			type: z.boolean().optional(),
			description:
				'Include full documentation/docstrings for symbols',
		},
	};

	/**
	 * Format the search results for AI-friendly output
	 */
	protected formatResult(
		data: SearchSymbolsResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const formatted = formatSymbolList(data.symbols, data.pagination);

		// Add performance metadata if useful
		let output = formatted;

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output;
	}
}

export default SearchSymbolsTool;
