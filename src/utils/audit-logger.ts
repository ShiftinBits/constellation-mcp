/**
 * Execution Audit Trail (SB-258 Step 3.4)
 *
 * Structured audit logging for sandbox executions. Logs to stderr as JSON
 * when enabled via CONSTELLATION_AUDIT_LOG=true. Zero overhead when disabled.
 *
 * Activation: CONSTELLATION_AUDIT_LOG=true
 */

/** Maximum characters of code to include in audit entries */
const AUDIT_CODE_TRUNCATION_LIMIT = 500;

/**
 * Structured audit log entry
 */
export interface AuditEntry {
	timestamp: string;
	event:
		| 'execution_start'
		| 'execution_end'
		| 'api_call'
		| 'validation_failure'
		| 'error';
	/** First 500 chars of executed code (truncated for privacy) */
	code?: string;
	/** API method name */
	method?: string;
	/** Duration in milliseconds */
	duration?: number;
	/** Whether the operation succeeded */
	success?: boolean;
	/** Error message */
	error?: string;
	/** Size of result in bytes */
	resultSize?: number;
}

/**
 * Opt-in audit logger singleton
 *
 * Only logs when CONSTELLATION_AUDIT_LOG=true.
 * Output format: JSON on stderr (one line per entry).
 */
export class AuditLogger {
	private static instance: AuditLogger;
	private enabled: boolean;

	private constructor() {
		this.enabled = process.env.CONSTELLATION_AUDIT_LOG === 'true';
	}

	/**
	 * Get the singleton instance
	 */
	static get(): AuditLogger {
		if (!AuditLogger.instance) {
			AuditLogger.instance = new AuditLogger();
		}
		return AuditLogger.instance;
	}

	/**
	 * Reset the singleton (for testing)
	 */
	static reset(): void {
		AuditLogger.instance = new AuditLogger();
	}

	/**
	 * Check if audit logging is enabled
	 */
	isEnabled(): boolean {
		return this.enabled;
	}

	/**
	 * Log an audit entry to stderr
	 *
	 * No-op when disabled. Code fields are automatically truncated.
	 */
	log(entry: AuditEntry): void {
		if (!this.enabled) return;

		const sanitized = { ...entry };
		if (sanitized.code && sanitized.code.length > AUDIT_CODE_TRUNCATION_LIMIT) {
			sanitized.code =
				sanitized.code.slice(0, AUDIT_CODE_TRUNCATION_LIMIT) + '...';
		}

		console.error(JSON.stringify({ audit: true, ...sanitized }));
	}
}
