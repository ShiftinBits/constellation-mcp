/**
 * Documentation URL constants
 * Centralized to ensure consistency and easy updates
 */
export const DOCS_BASE_URL = 'https://docs.constellationdev.io';

export const DOCS_URLS = {
	root: DOCS_BASE_URL,
	auth: `${DOCS_BASE_URL}/auth`,
	authPermissions: `${DOCS_BASE_URL}/auth#permissions`,
	setup: `${DOCS_BASE_URL}/setup`,
	gettingStarted: `${DOCS_BASE_URL}/getting-started`,
	tools: `${DOCS_BASE_URL}/tools`,
} as const;

export type DocsUrlKey = keyof typeof DOCS_URLS;
