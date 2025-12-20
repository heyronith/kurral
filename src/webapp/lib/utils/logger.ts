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
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Logger class that conditionally logs based on environment
 */
class Logger {
  private shouldLog(level: LogLevel): boolean {
    // Only log in development
    // In production, all console logs are hidden
    // Errors can be sent to external services (Sentry, LogRocket, etc.) if needed
    return isDevelopment;
  }

  /**
   * Log debug messages (development only)
   */
  debug(...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(...args);
    }
  }

  /**
   * Log info messages (development only)
   */
  info(...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(...args);
    }
  }

  /**
   * Log warning messages (development only)
   */
  warn(...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(...args);
    }
  }

  /**
   * Log error messages
   * In production, these will be stripped by build but can be extended
   * to send to error tracking services (Sentry, LogRocket, etc.)
   */
  error(...args: any[]): void {
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
  withPrefix(prefix: string) {
    return {
      debug: (...args: any[]) => this.debug(`[${prefix}]`, ...args),
      info: (...args: any[]) => this.info(`[${prefix}]`, ...args),
      warn: (...args: any[]) => this.warn(`[${prefix}]`, ...args),
      error: (...args: any[]) => this.error(`[${prefix}]`, ...args),
    };
  }
}

// Export singleton instance
export const logger = new Logger();

// Export default for convenience
export default logger;

