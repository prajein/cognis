export interface LabeledPrompt {
  id: string;
  text: string;
  gapType: string;
  humanJudgment: 'addressed' | 'gap_present' | 'below_length_floor';
  matchMechanism: 'exact' | 'stem' | 'fuzzy' | 'none';
  note: string;
}

export const labeledPrompts: LabeledPrompt[] = [
  // --- intentionality ---
  { id: 'int-01', text: 'Write a project update so that my manager understands where things stand.', gapType: 'intentionality', humanJudgment: 'addressed', matchMechanism: 'exact', note: 'exact marker "so that"' },
  { id: 'int-02', text: 'I am trying to understand how compound interest works before I invest.', gapType: 'intentionality', humanJudgment: 'addressed', matchMechanism: 'exact', note: 'exact marker "trying to"' },
  { id: 'int-03', text: 'Explain photosynthesis.', gapType: 'intentionality', humanJudgment: 'gap_present', matchMechanism: 'none', note: 'no purpose given at all' },
  { id: 'int-04', text: 'My objectiv here is to pass the certification exam next month.', gapType: 'intentionality', humanJudgment: 'addressed', matchMechanism: 'fuzzy', note: 'typo of "objective" (1-edit)' },

  // --- audience ---
  { id: 'aud-01', text: 'Explain blockchain for a non-technical audience.', gapType: 'audience', humanJudgment: 'addressed', matchMechanism: 'exact', note: 'exact marker "non-technical" and "audience"' },
  { id: 'aud-02', text: 'Write this for beginners who have never coded before.', gapType: 'audience', humanJudgment: 'addressed', matchMechanism: 'exact', note: 'exact marker "for beginners"' },
  { id: 'aud-03', text: 'Give me a summary of the quarterly report.', gapType: 'audience', humanJudgment: 'gap_present', matchMechanism: 'none', note: 'no audience specified' },
  { id: 'aud-04', text: 'This explanation is for our readerz, who are mostly new hires.', gapType: 'audience', humanJudgment: 'addressed', matchMechanism: 'fuzzy', note: 'typo of "readers" (1-edit)' },

  // --- constraint ---
  { id: 'con-01', text: 'Summarize this in no more than 100 words.', gapType: 'constraint', humanJudgment: 'addressed', matchMechanism: 'exact', note: 'exact marker "no more than"' },
  { id: 'con-02', text: 'Keep it concise and avoid jargon.', gapType: 'constraint', humanJudgment: 'addressed', matchMechanism: 'exact', note: 'exact marker "concise"' },
  { id: 'con-03', text: 'Write me an essay about climate change.', gapType: 'constraint', humanJudgment: 'gap_present', matchMechanism: 'none', note: 'no length or boundary given' },
  { id: 'con-04', text: 'Please avoiding technical terms if possible.', gapType: 'constraint', humanJudgment: 'addressed', matchMechanism: 'stem', note: '"avoiding" stems to "avoid"' },

  // --- stakes ---
  { id: 'sta-01', text: 'This is for a client presentation tomorrow, so accuracy really matters.', gapType: 'stakes', humanJudgment: 'addressed', matchMechanism: 'exact', note: 'exact marker "for a client" and "presentation"' },
  { id: 'sta-02', text: "It's urgent -- we launch in two days.", gapType: 'stakes', humanJudgment: 'addressed', matchMechanism: 'exact', note: 'exact marker "urgent" and "launch"' },
  { id: 'sta-03', text: 'Can you help me write a thank-you note?', gapType: 'stakes', humanJudgment: 'gap_present', matchMechanism: 'none', note: 'no stakes conveyed, genuinely low-stakes task though' },
  { id: 'sta-04', text: 'This is graded, so I want to get it right.', gapType: 'stakes', humanJudgment: 'addressed', matchMechanism: 'exact', note: 'exact marker "graded"' },

  // --- assumption ---
  { id: 'asu-01', text: "For context: we're a 10-person startup with no existing design system.", gapType: 'assumption', humanJudgment: 'addressed', matchMechanism: 'exact', note: 'exact marker "for context"' },
  { id: 'asu-02', text: 'Background: the API already handles auth, I just need the data layer.', gapType: 'assumption', humanJudgment: 'addressed', matchMechanism: 'exact', note: 'exact marker "background:"' },
  { id: 'asu-03', text: 'How do I add a new feature to my app?', gapType: 'assumption', humanJudgment: 'gap_present', matchMechanism: 'none', note: 'no stated context about the existing system' },
  { id: 'asu-04', text: "I'm assumeing you know the difference between REST and GraphQL.", gapType: 'assumption', humanJudgment: 'addressed', matchMechanism: 'fuzzy', note: 'typo of "assuming" (1-edit)' },

  // --- mechanism ---
  { id: 'mec-01', text: 'Show me step by step how to configure a VPN.', gapType: 'mechanism', humanJudgment: 'addressed', matchMechanism: 'exact', note: 'exact marker "step by step"' },
  { id: 'mec-02', text: 'What approach should I use to refactor this legacy module?', gapType: 'mechanism', humanJudgment: 'addressed', matchMechanism: 'exact', note: 'exact marker "approach" (weighted 0.7)' },
  { id: 'mec-03', text: 'Get me a working login page.', gapType: 'mechanism', humanJudgment: 'gap_present', matchMechanism: 'none', note: 'no method or approach requested, just an outcome' },
  { id: 'mec-04', text: 'Can you explain the methode you used to sort this list?', gapType: 'mechanism', humanJudgment: 'addressed', matchMechanism: 'fuzzy', note: 'typo of "method" (1-edit)' },

  // --- temporal ---
  { id: 'tem-01', text: 'First outline the plan, then draft the intro, and finally write the conclusion.', gapType: 'temporal', humanJudgment: 'addressed', matchMechanism: 'exact', note: 'exact markers "first", "then", "finally"' },
  { id: 'tem-02', text: 'I need this by tomorrow morning.', gapType: 'temporal', humanJudgment: 'addressed', matchMechanism: 'exact', note: 'exact marker "by tomorrow"' },
  { id: 'tem-03', text: 'Help me plan my week.', gapType: 'temporal', humanJudgment: 'gap_present', matchMechanism: 'none', note: 'no explicit sequence or deadline despite being about planning' },
  { id: 'tem-04', text: 'Whats the schedul for the onboarding process?', gapType: 'temporal', humanJudgment: 'addressed', matchMechanism: 'fuzzy', note: 'typo of "schedule" (1-edit)' },

  // --- second_order ---
  { id: 'sec-01', text: 'What are the long-term consequences of this pricing change?', gapType: 'second_order', humanJudgment: 'addressed', matchMechanism: 'exact', note: 'exact marker "long-term" and "consequence"' },
  { id: 'sec-02', text: 'What could go wrong if we deploy this on a Friday?', gapType: 'second_order', humanJudgment: 'addressed', matchMechanism: 'exact', note: 'exact marker "what could go wrong"' },
  { id: 'sec-03', text: 'Should we switch our database provider?', gapType: 'second_order', humanJudgment: 'gap_present', matchMechanism: 'none', note: 'no downstream impact considered' },
  { id: 'sec-04', text: 'Is there any rippl effect from this API change on downstream services?', gapType: 'second_order', humanJudgment: 'addressed', matchMechanism: 'fuzzy', note: 'typo of "ripple" (1-edit)' },

  // --- multi-gap and ambiguous cases, spread across types ---
  { id: 'multi-01', text: 'Write a technical doc for our engineering team, keep it under 500 words, and make sure it covers rollback steps.', gapType: 'audience', humanJudgment: 'addressed', matchMechanism: 'exact', note: 'multi-gap prompt addressing audience + constraint + mechanism at once' },
  { id: 'multi-02', text: 'fix bug', gapType: 'intentionality', humanJudgment: 'below_length_floor', matchMechanism: 'none', note: 'CORRECTED: only 7 chars, below minTextLength=12 -- system correctly emits nothing by design, this is not a real gap-detection failure' },
  { id: 'edge-01', text: 'how', gapType: 'mechanism', humanJudgment: 'below_length_floor', matchMechanism: 'none', note: 'below minTextLength (12 chars) -- correctly emits nothing, confirms the length floor works as documented' },
  { id: 'edge-02', text: 'I want to build this using a microservice approach with clear steps.', gapType: 'mechanism', humanJudgment: 'addressed', matchMechanism: 'exact', note: 'multiple mechanism markers stacking ("using", "approach", "steps")' },
];