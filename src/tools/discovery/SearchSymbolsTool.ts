/**
 * Search Symbols Tool
 *
 * MCP tool for searching symbols (functions, classes, variables, etc.) across the codebase
 * with powerful filtering capabilities.
 */

import { z } from 'zod';
import { BaseMcpTool } from '../../lib/BaseMcpTool.js';
import {
	SearchSymbolsParams,
	SearchSymbolsResult,
} from '../../types/api-types.js';
import { formatSymbolList, section, emphasize } from '../../utils/format-helpers.js';

class SearchSymbolsTool extends BaseMcpTool<
	SearchSymbolsParams,
	SearchSymbolsResult
> {
	name = 'search_symbols';
	description =
		'Search for symbols (functions, classes, variables, types, etc.) across the codebase with powerful filtering options. Returns symbol names, locations, signatures, and metadata. ' +
		'**PAGINATION**: Supports limit/offset for large result sets. Default limit is 50. Use offset to retrieve subsequent pages (e.g., offset=50 for page 2). ' +
		'For broad searches, start with default limit and paginate if needed.';

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
		filterByExported: {
			type: z.coerce.boolean().optional(),
			description:
				'Filter by export status: true (only exported), false (only non-exported)',
		},
		filePattern: {
			type: z.string().optional(),
			description:
				'Limit to file paths matching this pattern (e.g., "src/utils/**")',
		},
		limit: {
			type: z.coerce.number().int().min(1).max(100).optional().default(50),
			description:
				'Maximum number of results to return per page (default: 50, max: 100). Use smaller values (10-20) for quick scans, larger values (50-100) for comprehensive searches.',
		},
		offset: {
			type: z.coerce.number().int().min(0).optional().default(0),
			description: 'Starting position for pagination (default: 0). For page 2, use offset=limit; for page 3, use offset=limit*2, etc. Example: limit=50, offset=50 gets results 51-100.',
		},
		includeUsageCount: {
			type: z.coerce.boolean().optional(),
			description:
				'Include count of how many places use this symbol',
		},
		includeDocumentation: {
			type: z.coerce.boolean().optional(),
			description:
				'Include full documentation/docstrings for symbols',
		},
		includeConfidence: {
			type: z.coerce.boolean().optional(),
			description:
				'Include confidence scores for search results',
		},
	};

	/**
	 * Format the search results for AI-friendly output
	 */
	protected formatResult(
		data: SearchSymbolsResult,
		metadata: { executionTime: number; cached: boolean },
		params?: SearchSymbolsParams
	): string {
		// Defensive checks
		if (!data) {
			return 'Error: No data returned from API';
		}

		const symbols = data.symbols || [];
		const pagination = data.pagination;

		const formatted = formatSymbolList(symbols, pagination);

		// Add performance metadata if useful
		let output = formatted;

		// Contextual next-step suggestions
		const resultCount = symbols.length;
		const totalCount = pagination?.total || resultCount;
		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output;
	}
}

export default SearchSymbolsTool;
