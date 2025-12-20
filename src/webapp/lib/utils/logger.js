/**
 * Logger utility that respects environment settings
 *
 * In production builds, console statements are stripped by Vite's esbuild.
 * This utility provides a consistent logging interface that:
 * - Works in development (logs to console)
 * - Is stripped in production builds (no console output)
 * - Can be extended to send logs to external services in the future
 */
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;
/**
 * Log levels
 */
export var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
})(LogLevel || (LogLevel = {}));
/**
 * Logger class that conditionally logs based on environment
 */
class Logger {
    shouldLog(level) {
        // Only log in development
        // In production, all console logs are hidden
        // Errors can be sent to external services (Sentry, LogRocket, etc.) if needed
        return isDevelopment;
    }
    /**
     * Log debug messages (development only)
     */
    debug(...args) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.debug(...args);
        }
    }
    /**
     * Log info messages (development only)
     */
    info(...args) {
        if (this.shouldLog(LogLevel.INFO)) {
            console.info(...args);
        }
    }
    /**
     * Log warning messages (development only)
     */
    warn(...args) {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(...args);
        }
    }
    /**
     * Log error messages
     * In production, these will be stripped by build but can be extended
     * to send to error tracking services (Sentry, LogRocket, etc.)
     */
    error(...args) {
        if (this.shouldLog(LogLevel.ERROR)) {
            console.error(...args);
        }
        // TODO: In production, send errors to error tracking service
        // if (isProduction) {
        //   // Send to Sentry, LogRocket, etc.
        // }
    }
    /**
     * Log messages with a prefix (useful for service/component logging)
     */
    withPrefix(prefix) {
        return {
            debug: (...args) => this.debug(`[${prefix}]`, ...args),
            info: (...args) => this.info(`[${prefix}]`, ...args),
            warn: (...args) => this.warn(`[${prefix}]`, ...args),
            error: (...args) => this.error(`[${prefix}]`, ...args),
        };
    }
}
// Export singleton instance
export const logger = new Logger();
// Export default for convenience
export default logger;
