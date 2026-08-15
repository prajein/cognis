import { RetentionPolicy } from '../storage/retention/RetentionPolicy';
import { CognisDatabase } from '../storage/indexeddb/CognisDatabase';

const ALARM_NAME = 'cognis-retention-alarm';
const ALARM_PERIOD_MINUTES = 1440; // 24 hours

/**
 * Initializes the retention scheduler.
 * Must be called during the background service worker bootstrap sequence.
 *
 * @param db The active CognisDatabase instance.
 * @param policy The constructed RetentionPolicy instance.
 */
export function initializeRetentionScheduler(db: CognisDatabase, policy: RetentionPolicy): void {
  // 1. Ensure the alarm exists idempotently
  chrome.alarms.get(ALARM_NAME, (existingAlarm) => {
    if (!existingAlarm) {
      console.log(`[RetentionScheduler] Creating new retention alarm: ${ALARM_NAME}`);
      chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: 1, // First run slightly after initialization
        periodInMinutes: ALARM_PERIOD_MINUTES
      });
    } else {
      console.log(`[RetentionScheduler] Existing alarm found: ${ALARM_NAME}`);
    }
  });

  // 2. Listen for the alarm trigger
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      console.log(`[RetentionScheduler] Alarm triggered. Executing RetentionPolicy...`);
      policy.execute(db).catch(err => {
        console.error(`[RetentionScheduler] RetentionPolicy execution failed:`, err);
      });
    }
  });
}
