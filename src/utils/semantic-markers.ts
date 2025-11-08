/**
 * Semantic Markers for AI-Optimized Output
 *
 * Provides clean, parsable markers to highlight important symbol metadata
 * in tool responses. Optimized for AI assistant consumption.
 *
 * NO EMOJIS OR DECORATIVE CHARACTERS - text-based markers only
 */

/**
 * Semantic marker constants
 */
export const MARKERS = {
	// Symbol characteristics
	EXPORTED: '[EXPORTED]',
	ABSTRACT: '[ABSTRACT]',
	DEPRECATED: '[DEPRECATED]',
	INTERNAL: '[INTERNAL]',
	EXTERNAL: '[EXTERNAL]',

	// Code quality
	HIGH_IMPACT: '[HIGH_IMPACT]',
	HIGH_COMPLEXITY: '[HIGH_COMPLEXITY]',
	LOW_COVERAGE: '[LOW_COVERAGE]',

	// Change risk
	BREAKING: '[BREAKING]',
	SAFE: '[SAFE]',
	RISKY: '[RISKY]',

	// File types
	TEST: '[TEST]',
	CONFIG: '[CONFIG]',
	GENERATED: '[GENERATED]',

	// Status
	UNUSED: '[UNUSED]',
	HEAVILY_USED: '[HEAVILY_USED]',
	CIRCULAR: '[CIRCULAR]',
} as const;

/**
 * Apply marker to text
 */
function applyMarker(marker: string, text: string): string {
	return `${marker} ${text}`;
}

/**
 * Mark a symbol as exported
 */
export function markExported(text: string): string {
	return applyMarker(MARKERS.EXPORTED, text);
}

/**
 * Mark a symbol as abstract
 */
export function markAbstract(text: string): string {
	return applyMarker(MARKERS.ABSTRACT, text);
}

/**
 * Mark a symbol as deprecated
 */
export function markDeprecated(text: string): string {
	return applyMarker(MARKERS.DEPRECATED, text);
}

/**
 * Mark a symbol as internal (not exported)
 */
export function markInternal(text: string): string {
	return applyMarker(MARKERS.INTERNAL, text);
}

/**
 * Mark a symbol as external (third-party library)
 */
export function markExternal(text: string): string {
	return applyMarker(MARKERS.EXTERNAL, text);
}

/**
 * Mark a symbol as high impact (widely used or critical)
 */
export function markHighImpact(text: string): string {
	return applyMarker(MARKERS.HIGH_IMPACT, text);
}

/**
 * Mark code as high complexity
 */
export function markHighComplexity(text: string): string {
	return applyMarker(MARKERS.HIGH_COMPLEXITY, text);
}

/**
 * Mark code as having low test coverage
 */
export function markLowCoverage(text: string): string {
	return applyMarker(MARKERS.LOW_COVERAGE, text);
}

/**
 * Mark a change as breaking
 */
export function markBreaking(text: string): string {
	return applyMarker(MARKERS.BREAKING, text);
}

/**
 * Mark a change as safe
 */
export function markSafe(text: string): string {
	return applyMarker(MARKERS.SAFE, text);
}

/**
 * Mark a change as risky
 */
export function markRisky(text: string): string {
	return applyMarker(MARKERS.RISKY, text);
}

/**
 * Mark a file as a test file
 */
export function markTest(text: string): string {
	return applyMarker(MARKERS.TEST, text);
}

/**
 * Mark a file as configuration
 */
export function markConfig(text: string): string {
	return applyMarker(MARKERS.CONFIG, text);
}

/**
 * Mark a file as generated
 */
export function markGenerated(text: string): string {
	return applyMarker(MARKERS.GENERATED, text);
}

/**
 * Mark a symbol as unused (dead code)
 */
export function markUnused(text: string): string {
	return applyMarker(MARKERS.UNUSED, text);
}

/**
 * Mark a symbol as heavily used
 */
export function markHeavilyUsed(text: string): string {
	return applyMarker(MARKERS.HEAVILY_USED, text);
}

/**
 * Mark a dependency as circular
 */
export function markCircular(text: string): string {
	return applyMarker(MARKERS.CIRCULAR, text);
}

/**
 * Apply multiple markers to text
 *
 * @param markers Array of marker constants
 * @param text Text to mark
 * @returns Text with all markers applied
 *
 * @example
 * applyMarkers([MARKERS.EXPORTED, MARKERS.DEPRECATED], 'MyClass')
 * // Returns: "[EXPORTED] [DEPRECATED] MyClass"
 */
export function applyMarkers(markers: string[], text: string): string {
	const markerString = markers.join(' ');
	return markerString ? `${markerString} ${text}` : text;
}

/**
 * Determine appropriate markers for a symbol based on its metadata
 *
 * @param metadata Symbol metadata
 * @returns Array of applicable markers
 */
export function getSymbolMarkers(metadata: {
	isExported?: boolean;
	isAbstract?: boolean;
	isDeprecated?: boolean;
	usageCount?: number;
	isExternal?: boolean;
}): string[] {
	const markers: string[] = [];

	if (metadata.isDeprecated) {
		markers.push(MARKERS.DEPRECATED);
	}

	if (metadata.isAbstract) {
		markers.push(MARKERS.ABSTRACT);
	}

	if (metadata.isExported) {
		markers.push(MARKERS.EXPORTED);
	} else if (metadata.isExported === false) {
		markers.push(MARKERS.INTERNAL);
	}

	if (metadata.isExternal) {
		markers.push(MARKERS.EXTERNAL);
	}

	if (metadata.usageCount !== undefined) {
		if (metadata.usageCount === 0) {
			markers.push(MARKERS.UNUSED);
		} else if (metadata.usageCount > 20) {
			markers.push(MARKERS.HEAVILY_USED);
		}
	}

	return markers;
}

/**
 * Determine appropriate markers for a file based on its path
 *
 * @param filePath File path to analyze
 * @returns Array of applicable markers
 */
export function getFileMarkers(filePath: string): string[] {
	const markers: string[] = [];
	const lowerPath = filePath.toLowerCase();

	if (lowerPath.includes('.test.') || lowerPath.includes('.spec.') || lowerPath.includes('/__tests__/') || lowerPath.includes('/test/')) {
		markers.push(MARKERS.TEST);
	}

	if (lowerPath.includes('.config.') || lowerPath.endsWith('.json') || lowerPath.endsWith('.yml') || lowerPath.endsWith('.yaml')) {
		markers.push(MARKERS.CONFIG);
	}

	if (lowerPath.includes('.generated.') || lowerPath.includes('generated/') || lowerPath.includes('.g.')) {
		markers.push(MARKERS.GENERATED);
	}

	if (lowerPath.includes('node_modules/') || lowerPath.includes('vendor/')) {
		markers.push(MARKERS.EXTERNAL);
	}

	return markers;
}

/**
 * Determine risk marker based on impact score or change analysis
 *
 * @param riskLevel Risk level (0-100) or risk category
 * @returns Appropriate risk marker
 */
export function getRiskMarker(riskLevel: number | 'low' | 'medium' | 'high' | 'critical'): string {
	if (typeof riskLevel === 'number') {
		if (riskLevel >= 75) return MARKERS.BREAKING;
		if (riskLevel >= 50) return MARKERS.RISKY;
		return MARKERS.SAFE;
	}

	switch (riskLevel) {
		case 'critical':
		case 'high':
			return MARKERS.BREAKING;
		case 'medium':
			return MARKERS.RISKY;
		case 'low':
		default:
			return MARKERS.SAFE;
	}
}
