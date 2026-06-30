import { ErrorReporter } from '../event-bus/types';

/**
 * Console Error Reporter
 *
 * Implements the ErrorReporter interface, outputting critical
 * runtime and storage failures to the browser console.
 * It enriches the error with context to assist in debugging.
 */
export class ConsoleErrorReporter implements ErrorReporter {
  public report(error: unknown, context: { eventType: string; source: string }): void {
    const contextPrefix = `[Cognis Error][Source: ${context.source}][Event: ${context.eventType}]`;
    console.error(contextPrefix, error);
  }
}
