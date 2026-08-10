import React, { useState } from 'react';
import { useSidepanelRuntime } from '../../runtime/RuntimeContext';

/**
 * OnboardingFlow
 *
 * Renders the initial onboarding configuration form.
 * Dispatches the results using IdentityService.
 */
export const OnboardingFlow: React.FC = () => {
  const { identityService } = useSidepanelRuntime();
  const [answer1, setAnswer1] = useState('');
  const [answer2, setAnswer2] = useState('');
  const [answer3, setAnswer3] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      identityService.completeOnboarding({ answer1, answer2, answer3 });
      setIsSubmitting(false);
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="onboarding-flow">
      <h2>Welcome to Cognis</h2>
      <p>Please complete your onboarding configuration.</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="answer1">Answer 1</label>
          <input
            id="answer1"
            type="text"
            value={answer1}
            onChange={(e) => setAnswer1(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="answer2">Answer 2</label>
          <input
            id="answer2"
            type="text"
            value={answer2}
            onChange={(e) => setAnswer2(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="answer3">Answer 3</label>
          <input
            id="answer3"
            type="text"
            value={answer3}
            onChange={(e) => setAnswer3(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Complete Onboarding'}
        </button>
      </form>
    </div>
  );
};
