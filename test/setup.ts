import { afterEach, jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.CONSTELLATION_ACCESS_KEY = 'test-api-key';
process.env.CONSTELLATION_API_URL = 'https://api.constellation.test';

// Increase timeout for integration tests
if (process.env.INTEGRATION_TEST) {
	jest.setTimeout(30000);
}

// Mock console methods to reduce noise in tests
global.console = {
	...console,
	log: jest.fn(),
	debug: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
};

// Clean up after each test
afterEach(() => {
	jest.clearAllMocks();
});
