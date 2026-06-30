import { InsightCandidate } from '../../core/types/insight.types';

export class InsightValidator {
  private static readonly MINIMUM_CONFIDENCE = 0.75;
  private static readonly MINIMUM_EVIDENCE = 5;

  /**
   * Validates if a candidate insight meets the strict quality and 
   * confidence thresholds required to be emitted as a permanent fact.
   */
  public isValid(candidate: InsightCandidate): boolean {
    if (!candidate.id || !candidate.domain || !candidate.title || !candidate.summary) {
      return false;
    }

    if (candidate.confidence < InsightValidator.MINIMUM_CONFIDENCE) {
      return false;
    }

    if (candidate.evidenceCount < InsightValidator.MINIMUM_EVIDENCE) {
      return false;
    }

    return true;
  }
}
