import { ErrorReporter } from '../event-bus/types';

/**
 * Composite Error Reporter
 *
 * Implements the ErrorReporter interface and multiplexes errors
 * to an array of registered reporters.
 */
export class CompositeErrorReporter implements ErrorReporter {
  private readonly reporters: ErrorReporter[];

  constructor(reporters: ErrorReporter[]) {
    this.reporters = reporters;
  }

  public report(error: unknown, context: { eventType: string; source: string }): void {
    for (const reporter of this.reporters) {
      try {
        reporter.report(error, context);
      } catch (reporterError) {
        // Fallback if a reporter itself fails.
        // We use console.error directly here because the reporter failed.
        console.error(
          '[CompositeErrorReporter] A reporter threw an error while reporting:',
          reporterError,
          'Original error:',
          error
        );
      }
    }
  }
}
