import { TransitionPolicy } from '../../../engines/state/TransitionPolicy';
import { StateEngineRules } from '../../../core/config/state-rules-loader';

export function runTransitionPolicyTests(): void {
  console.log('[SelfTest] Running TransitionPolicy tests...');

  const rules: StateEngineRules = {
    version: '1.0',
    thresholds: {
      velocity: { coasting: 1, stretch: 5, overload: 10 },
      revisionRate: { coasting: 1, stretch: 5, overload: 10 },
      pauseDurationMs: { coasting: 1, stretch: 5, overload: 10 }
    },
    hysteresis: {
      cooldownMs: 1000,
      requiredSustainedMeasurements: 3
    }
  };

  const policy = new TransitionPolicy(rules);
  const now = 5000;

  // 1. Initial identical state (stretch) -> no-op
  if (policy.approveTransition('stretch', now) !== null) throw new Error('Identical state should be null');

  // 2. New state (overload) once -> null (needs 3 measurements)
  if (policy.approveTransition('overload', now) !== null) throw new Error('Unsustained transition should be null');
  if (policy.approveTransition('overload', now) !== null) throw new Error('Unsustained transition should be null');
  
  // 3rd measurement -> approved
  const approvedState = policy.approveTransition('overload', now);
  if (approvedState !== 'overload') throw new Error('Sustained transition failed');

  // 3. Cooldown test
  // Cannot transition immediately
  if (policy.approveTransition('coasting', now + 100) !== null) throw new Error('Cooldown breached');
  
  console.log('[SelfTest] TransitionPolicy hysteresis and cooldowns validated.');
}
