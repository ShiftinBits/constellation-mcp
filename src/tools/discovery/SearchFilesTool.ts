/**
 * Search Files Tool
 *
 * MCP tool for searching files by name or path pattern across the codebase
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';
import {
	SearchFilesParams,
	SearchFilesResult,
} from '../../types/api-types.js';
import { formatFileList } from '../../utils/format-helpers.js';

class SearchFilesTool extends BaseMcpTool<
	SearchFilesParams,
	SearchFilesResult
> {
	name = 'search_files';
	description =
		'Search for files by name or path pattern across the codebase. Returns file paths, language info, symbol counts, and file metadata.';

	schema = {
		pathPattern: {
			type: z.string().optional(),
			description:
				'File path pattern to search for (e.g., "src/**/*.ts", "components/**")',
		},
		filterByLanguage: {
			type: z.array(z.string()).optional(),
			description:
				'Filter by programming language(s) (e.g., ["typescript", "javascript"])',
		},
		filterByParadigm: {
			type: z.array(z.string()).optional(),
			description:
				'Filter by programming paradigm (e.g., ["object-oriented", "functional"])',
		},
		filterByModuleType: {
			type: z.array(z.string()).optional(),
			description:
				'Filter by module type (e.g., ["esm", "commonjs"])',
		},
		filterByDomain: {
			type: z.string().optional(),
			description:
				'Filter by domain/purpose (e.g., "api", "ui", "data")',
		},
		isTest: {
			type: z.coerce.boolean().optional(),
			description:
				'Filter to only test files (true) or only non-test files (false)',
		},
		isEntryPoint: {
			type: z.coerce.boolean().optional(),
			description:
				'Filter to only entry point files (true) or non-entry points (false)',
		},
		includeMetrics: {
			type: z.coerce.boolean().optional().default(false),
			description:
				'Include file metrics (complexity, size, symbol counts) (default: false)',
		},
		limit: {
			type: z.coerce.number().int().min(1).max(100).optional().default(50),
			description:
				'Maximum number of results to return (default: 50, max: 100)',
		},
		offset: {
			type: z.coerce.number().int().min(0).optional().default(0),
			description: 'Offset for pagination (default: 0)',
		},
	};

	/**
	 * Format the search results for AI-friendly output
	 */
	protected formatResult(
		data: SearchFilesResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const formatted = formatFileList(data.files, data.pagination);

		let output = formatted;

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output;
	}
}

export default SearchFilesTool;
