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
		query: {
			type: z.string().min(1).max(200),
			description:
				'File name or path pattern to search for (e.g., "UserService", "*.test.ts", "components/**")',
		},
		language: {
			type: z.string().optional(),
			description:
				'Filter by programming language (e.g., "typescript", "javascript", "python")',
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
		includeStats: {
			type: z.boolean().optional(),
			description:
				'Include file statistics (size, symbol count, last modified)',
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
