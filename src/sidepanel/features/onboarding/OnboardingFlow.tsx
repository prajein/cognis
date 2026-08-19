import React, { useState } from 'react';
import { useSidepanelRuntime } from '../../runtime/RuntimeContext';

const ROLE_PRESETS = [
  'Full-Stack Engineer',
  'Software Architect',
  'AI / ML Researcher',
  'Data Scientist',
  'Product Specialist'
];

const STYLE_PRESETS = [
  'Strict TypeScript & React',
  'Clean Python & PEP8',
  'System Architecture & RFCs',
  'Concise Code, No Fluff'
];

const GOAL_PRESETS = [
  'Detect Formulation Gaps',
  'Sharpen System Constraints',
  'Improve Code & Architecture Quality',
  'Maintain Deep Focus'
];

/**
 * OnboardingFlow
 *
 * Renders the initial cognitive profile configuration form.
 * Dispatches the results using IdentityService while maintaining exact compatibility
 * with domain schema contracts (answer1: role/domain, answer2: style, answer3: priority).
 */
export const OnboardingFlow: React.FC = () => {
  const { identityService } = useSidepanelRuntime();

  const [role, setRole] = useState('');
  const [style, setStyle] = useState('');
  const [goal, setGoal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      identityService.completeOnboarding({
        answer1: role,
        answer2: style,
        answer3: goal
      });
      setIsSubmitting(false);
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-header">
        <div className="onboarding-brand">
          <span className="onboarding-brand-dot"></span>
          Cognis Intelligence
        </div>
        <h1 className="onboarding-title">Welcome to Cognis</h1>
        <p className="onboarding-subtitle">
          Calibrate your cognitive observation layer to personalize inline prompt enrichment and ghost-text interventions.
        </p>
      </div>

      <div className="onboarding-card">
        <form onSubmit={handleSubmit} className="onboarding-form">
          {/* Step 1: Role & Domain */}
          <div className="onboarding-group">
            <div className="onboarding-label-row">
              <label htmlFor="role-input" className="onboarding-label">
                <span className="onboarding-step-num">1</span> Primary Role & Domain
              </label>
              <span className="onboarding-hint">Select or type</span>
            </div>
            <div className="onboarding-chips">
              {ROLE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`onboarding-chip ${role === preset ? 'selected' : ''}`}
                  onClick={() => setRole(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              id="role-input"
              type="text"
              className="onboarding-input"
              placeholder="e.g. Senior Full-Stack Architect"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Step 2: Code & Response Preferences */}
          <div className="onboarding-group">
            <div className="onboarding-label-row">
              <label htmlFor="style-input" className="onboarding-label">
                <span className="onboarding-step-num">2</span> AI Response & Code Style
              </label>
              <span className="onboarding-hint">Select or type</span>
            </div>
            <div className="onboarding-chips">
              {STYLE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`onboarding-chip ${style === preset ? 'selected' : ''}`}
                  onClick={() => setStyle(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              id="style-input"
              type="text"
              className="onboarding-input"
              placeholder="e.g. Strict TypeScript, React 19, modular architecture"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Step 3: Interaction Priority */}
          <div className="onboarding-group">
            <div className="onboarding-label-row">
              <label htmlFor="goal-input" className="onboarding-label">
                <span className="onboarding-step-num">3</span> Primary Interaction Priority
              </label>
              <span className="onboarding-hint">Select or type</span>
            </div>
            <div className="onboarding-chips">
              {GOAL_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`onboarding-chip ${goal === preset ? 'selected' : ''}`}
                  onClick={() => setGoal(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              id="goal-input"
              type="text"
              className="onboarding-input"
              placeholder="e.g. Catch prompt gaps & maintain deep focus"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <button type="submit" className="onboarding-submit-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Initializing Cognis...' : 'Complete Onboarding & Start'} →
          </button>
        </form>
      </div>
    </div>
  );
};

