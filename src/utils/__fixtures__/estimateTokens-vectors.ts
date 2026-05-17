/**
 * Canonical vector table for `estimateTokens()`.
 *
 * MUST stay in sync with constellation-core/libs/usage-estimator/src/__fixtures__/estimateTokens-vectors.ts
 *
 * This file is a VERBATIM duplicate of the constellation-core canonical
 * fixture. Cross-repo file imports are not possible because the two
 * repos do not share a package. Drift between the two copies is caught
 * by both repos' unit tests running the same vector table.
 *
 * Any change to this file requires a matching update in
 * constellation-core/libs/usage-estimator/src/__fixtures__/estimateTokens-vectors.ts
 * before either lands.
 */
export interface EstimatorVector {
	readonly label: string;
	readonly input: string;
	readonly expected: number;
}

export const ESTIMATOR_VECTORS: readonly EstimatorVector[] = [
	{ label: 'empty', input: '', expected: 0 },
	{ label: 'single-char', input: 'a', expected: 1 },
	{ label: 'three-chars', input: 'abc', expected: 1 },
	{ label: 'four-chars-boundary', input: 'abcd', expected: 2 },
	{ label: 'seven-chars-exact-multiple', input: 'abcdefg', expected: 2 },
	{ label: 'eight-chars-just-over', input: 'abcdefgh', expected: 3 },
	{
		label: 'ascii-sentence',
		input: 'The quick brown fox jumps over the lazy dog.',
		expected: 13,
	},
	{
		label: 'multibyte-emoji',
		input: 'hello 😀 world',
		// JS .length counts surrogate pairs as 2; '😀' is 2 code units.
		expected: 4,
	},
	{
		label: 'cjk',
		input: '你好世界',
		expected: 2,
	},
	{
		label: 'large-payload-1000',
		input: 'x'.repeat(1000),
		expected: 286,
	},
] as const;
