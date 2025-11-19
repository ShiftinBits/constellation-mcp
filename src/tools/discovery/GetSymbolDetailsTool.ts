/**
 * Get Symbol Details Tool
 *
 * MCP tool for getting detailed information about a specific symbol including
 * its definition, dependencies, dependents, and usage locations
 */

import { z } from 'zod';
import { BaseMcpTool } from '../../lib/BaseMcpTool.js';
import {
	GetSymbolDetailsParams,
	GetSymbolDetailsResult,
} from '../../types/api-types.js';
import {
	formatLocation,
	section,
	emphasize,
	keyValue,
	collapsedHint,
} from '../../utils/format-helpers.js';
import { standardErrors } from '../../utils/error-messages.js';
import { getSymbolMarkers, applyMarkers, MARKERS } from '../../utils/semantic-markers.js';
import { booleanSchema } from '../../utils/schema-helpers.js';

class GetSymbolDetailsTool extends BaseMcpTool<
	GetSymbolDetailsParams,
	GetSymbolDetailsResult
> {
	name = 'get_symbol_details';
	description =
		'Get detailed information about a specific symbol (function, class, variable, etc.) including its signature, documentation, dependencies, dependents, and all usage locations.';

	schema = z.object({
		symbolId: z.string().optional().describe(
			'Unique symbol identifier (from search results). If not provided, both symbolName and filePath are required.'
		),
		symbolName: z.string().optional().describe(
			'Symbol name to look up (required if symbolId not provided)'
		),
		filePath: z.string().optional().describe(
			'File path containing the symbol (required if symbolId not provided)'
		),
		includeReferences: booleanSchema.optional().default(false).describe(
			'Include all references to this symbol (default: false)'
		),
		includeRelationships: booleanSchema.optional().default(false).describe(
			'Include relationships (calls, extends, implements) (default: false)'
		),
		includeImpactScore: booleanSchema.optional().default(false).describe(
			'Include impact/importance score (default: false)'
		),
	});

	// No parameter transformation needed - direct passthrough to API

	/**
	 * Format the symbol details for AI-friendly output
	 */
	protected formatResult(
		data: GetSymbolDetailsResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		// Defensive checks
		if (!data || !data.symbol) {
			return standardErrors.noData(this.name);
		}

		const { symbol, references, relationships, impactScore } = data;

		const name = symbol?.name || 'unknown';

		// Get semantic markers for the symbol
		const markers = getSymbolMarkers({
			isExported: symbol?.isExported,
			isAbstract: symbol?.modifiers?.includes('abstract'),
			isDeprecated: symbol?.isDeprecated,
			usageCount: impactScore?.directUsage,
		});

		const symbolHeader = markers.length > 0
			? `${section('Symbol Details', 1)}: ${applyMarkers(markers, name)}`
			: `${section('Symbol Details', 1)}: ${name}`;

		let output = `${symbolHeader}\n\n`;

		// Basic info
		output += `${keyValue('Type', symbol?.kind || 'unknown')}\n`;
		output += `${keyValue('Location', formatLocation(symbol?.filePath || 'unknown', symbol?.line, symbol?.column))}\n`;

		if (symbol?.qualifiedName && symbol.qualifiedName !== symbol.name) {
			output += `${keyValue('Qualified Name', symbol.qualifiedName)}\n`;
		}

		if (symbol?.signature) {
			output += `${keyValue('Signature', symbol.signature)}\n`;
		}

		if (symbol?.visibility) {
			output += `${keyValue('Visibility', symbol.visibility)}\n`;
		}

		if (symbol?.modifiers) {
			const modifiers = Array.isArray(symbol.modifiers) ? symbol.modifiers : [];
			if (modifiers.length > 0) {
				output += `${keyValue('Modifiers', modifiers.join(', '))}\n`;
			}
		}

		if (symbol?.decorators) {
			// Handle decorators - can be array or JSON string
			let decorators = [];
			if (Array.isArray(symbol.decorators)) {
				decorators = symbol.decorators;
			} else if (typeof symbol.decorators === 'string') {
				try {
					decorators = JSON.parse(symbol.decorators);
				} catch {
					decorators = [];
				}
			}
			if (decorators.length > 0) {
				output += `Decorators: ${decorators.join(', ')}\n`;
			}
		}

		if (symbol?.documentation) {
			output += `\n${emphasize('Documentation')}:\n${symbol.documentation}\n`;
		}

		// References/Usages
		if (references && references.length > 0) {
			output += `\n${section('References')} (${references.length} locations)\n\n`;
			for (const ref of references.slice(0, 20)) {
				const location = formatLocation(ref?.filePath || 'unknown', ref?.line);
				const usageType = ref?.usageType || 'reference';
				output += `  ${location} (${usageType})`;
				if (ref?.aliasName) {
					output += ` as ${ref.aliasName}`;
				}
				output += '\n';
			}
			if (references.length > 20) {
				output += `  ${collapsedHint(references.length, 20)}\n`;
			}
		}

		// Relationships
		if (relationships) {
			if (relationships.calls && relationships.calls.length > 0) {
				output += `\n${section('Calls')} (${relationships.calls.length})\n`;
				for (const call of relationships.calls.slice(0, 10)) {
					output += `  → ${call}\n`;
				}
				if (relationships.calls.length > 10) {
					output += `  ${collapsedHint(relationships.calls.length, 10)}\n`;
				}
			}

			if (relationships.calledBy && relationships.calledBy.length > 0) {
				output += `\n${section('Called By')} (${relationships.calledBy.length})\n`;
				for (const caller of relationships.calledBy.slice(0, 10)) {
					output += `  ← ${caller}\n`;
				}
				if (relationships.calledBy.length > 10) {
					output += `  ${collapsedHint(relationships.calledBy.length, 10)}\n`;
				}
			}

			if (relationships.inheritsFrom && relationships.inheritsFrom.length > 0) {
				output += `\n${section('Inherits From')}\n`;
				for (const parent of relationships.inheritsFrom) {
					output += `  ↑ ${parent}\n`;
				}
			}

			if (relationships.inheritedBy && relationships.inheritedBy.length > 0) {
				output += `\n${section('Inherited By')} (${relationships.inheritedBy.length})\n`;
				for (const child of relationships.inheritedBy.slice(0, 10)) {
					output += `  ↓ ${child}\n`;
				}
				if (relationships.inheritedBy.length > 10) {
					output += `  ${collapsedHint(relationships.inheritedBy.length, 10)}\n`;
				}
			}

			if (relationships.children && relationships.children.length > 0) {
				output += `\n${section('Children')} (${relationships.children.length})\n`;
				for (const child of relationships.children.slice(0, 10)) {
					output += `  - ${child}\n`;
				}
				if (relationships.children.length > 10) {
					output += `  ${collapsedHint(relationships.children.length, 10)}\n`;
				}
			}
		}

		// Impact Score
		if (impactScore) {
			output += `\n${section('Impact Analysis')}\n`;
			output += `${keyValue('Direct Usage', `${impactScore.directUsage || 0} location${impactScore.directUsage === 1 ? '' : 's'}`)}\n`;
			output += `${keyValue('Transitive Impact', impactScore.transitiveImpact || 0)}\n`;
			const riskLevel = impactScore.riskLevel || 'unknown';
			const riskMarker = impactScore.riskScore >= 75 ? MARKERS.HIGH_IMPACT : '';
			const riskDisplay = riskMarker
				? `${riskMarker} ${impactScore.riskScore || 0}/100 (${riskLevel})`
				: `${impactScore.riskScore || 0}/100 (${riskLevel})`;
			output += `${keyValue('Risk Score', riskDisplay)}\n`;
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default GetSymbolDetailsTool;
