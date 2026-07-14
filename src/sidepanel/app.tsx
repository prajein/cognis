import React, { useState, useEffect, useRef } from 'react';
import { getActivationProfilesConfig } from '../core/config/activation-profile-loader';
import { EventBus } from '../core/event-bus/EventBus';
import { createDomainEvent } from '../core/event-bus';
import { SessionEvents, InsightEvents } from '../core/event-bus/registry';
import { SessionId } from '../core/types/session.types';
import { TaskId } from '../core/types/activation-profile.types';
import { StateLabel } from '../core/types/state.types';
import { GapType } from '../core/types/gap.types';

// Inline Profiles config matching activation_profiles.json for direct UI rendering
const PROFILES: Record<string, {
  name: string;
  cat: string;
  domain: string;
  DLPFC: number;
  mPFC: number;
  M1: number;
  Parietal: number;
  Temporal: number;
  Occipital: number;
  Cerebellum: number;
  Hippocampus: number;
  Amygdala: number;
  ACC: number;
  insight: string;
  automaticityType: 'motor' | 'cognitive' | 'creative' | 'ai';
  thresholdHours: number;
}> = {
  deep_reading: { name: "Deep Reading", cat: "Cognitive", domain: "Reading", DLPFC: 3, mPFC: 1, M1: 0, Parietal: 3, Temporal: 4, Occipital: 3, Cerebellum: 1, Hippocampus: 3, Amygdala: 1, ACC: 2, insight: "Engages temporal cortex for semantic processing and parietal cortex for spatial scanning. Hippocampus supports comprehension encoding.", automaticityType: "cognitive", thresholdHours: 50 },
  writing_creative: { name: "Writing — Creative", cat: "Cognitive", domain: "Writing", DLPFC: 3, mPFC: 4, M1: 1, Parietal: 2, Temporal: 3, Occipital: 1, Cerebellum: 1, Hippocampus: 3, Amygdala: 3, ACC: 2, insight: "High medial prefrontal activation drives creative generation, while DLPFC coordinates structure.", automaticityType: "creative", thresholdHours: 60 },
  writing_analytical: { name: "Writing — Analytical", cat: "Cognitive", domain: "Writing", DLPFC: 4, mPFC: 2, M1: 1, Parietal: 3, Temporal: 3, Occipital: 1, Cerebellum: 1, Hippocampus: 3, Amygdala: 1, ACC: 3, insight: "Strong DLPFC-ACC activation for analytical monitoring and logical structure representation.", automaticityType: "cognitive", thresholdHours: 50 },
  writing_technical: { name: "Writing — Technical", cat: "Cognitive", domain: "Writing", DLPFC: 4, mPFC: 1, M1: 1, Parietal: 3, Temporal: 2, Occipital: 2, Cerebellum: 1, Hippocampus: 2, Amygdala: 1, ACC: 4, insight: "Peak ACC and DLPFC for precision syntax checking and structured logic.", automaticityType: "cognitive", thresholdHours: 40 },
  coding: { name: "Coding", cat: "Cognitive", domain: "Coding", DLPFC: 4, mPFC: 1, M1: 1, Parietal: 4, Temporal: 2, Occipital: 2, Cerebellum: 1, Hippocampus: 3, Amygdala: 2, ACC: 4, insight: "DLPFC-ACC co-activation indicates deep logical planning, rule application, and error tracking.", automaticityType: "cognitive", thresholdHours: 80 },
  maths_and_logic: { name: "Maths and Logic", cat: "Cognitive", domain: "Studying", DLPFC: 4, mPFC: 1, M1: 0, Parietal: 4, Temporal: 2, Occipital: 2, Cerebellum: 1, Hippocampus: 2, Amygdala: 2, ACC: 4, insight: "Parietal cortex handles mathematical constructs and numeric processing, alongside DLPFC control.", automaticityType: "cognitive", thresholdHours: 70 },
  language_vocabulary: { name: "Language — Vocabulary", cat: "Cognitive", domain: "Language", DLPFC: 3, mPFC: 1, M1: 1, Parietal: 2, Temporal: 4, Occipital: 1, Cerebellum: 2, Hippocampus: 4, Amygdala: 1, ACC: 2, insight: "Temporal cortex handles lexical mapping, while Hippocampus drives memorisation and retrieval.", automaticityType: "cognitive", thresholdHours: 30 },
  language_grammar: { name: "Language — Grammar", cat: "Cognitive", domain: "Language", DLPFC: 4, mPFC: 1, M1: 1, Parietal: 3, Temporal: 3, Occipital: 1, Cerebellum: 2, Hippocampus: 3, Amygdala: 1, ACC: 3, insight: "DLPFC represents grammatical rules, while temporal cortex integrates semantics.", automaticityType: "cognitive", thresholdHours: 40 },
  language_speaking: { name: "Language — Speaking", cat: "Cognitive", domain: "Language", DLPFC: 3, mPFC: 3, M1: 2, Parietal: 2, Temporal: 4, Occipital: 1, Cerebellum: 3, Hippocampus: 3, Amygdala: 3, ACC: 3, insight: "Social feedback loop recruits mPFC, temporal semantic access, and motor-speech circuits.", automaticityType: "cognitive", thresholdHours: 50 },
  studying_memorisation: { name: "Studying — Memorisation", cat: "Cognitive", domain: "Studying", DLPFC: 3, mPFC: 1, M1: 0, Parietal: 2, Temporal: 3, Occipital: 2, Cerebellum: 1, Hippocampus: 4, Amygdala: 2, ACC: 2, insight: "Peak Hippocampus activation indicates active memorisation, encoding, and index building.", automaticityType: "cognitive", thresholdHours: 30 },
  drawing_observational: { name: "Drawing — Observational", cat: "Creative", domain: "Drawing", DLPFC: 2, mPFC: 2, M1: 3, Parietal: 4, Temporal: 1, Occipital: 4, Cerebellum: 3, Hippocampus: 2, Amygdala: 1, ACC: 2, insight: "Occipital visual encoding couples with parietal spatial tracking and M1 movement control.", automaticityType: "motor", thresholdHours: 60 },
  drawing_abstract: { name: "Drawing — Abstract", cat: "Creative", domain: "Drawing", DLPFC: 2, mPFC: 4, M1: 2, Parietal: 3, Temporal: 1, Occipital: 3, Cerebellum: 2, Hippocampus: 3, Amygdala: 3, ACC: 1, insight: "High mPFC activity reflects self-reflective creative modelling with lower motor constraints.", automaticityType: "creative", thresholdHours: 40 },
  music_instrument: { name: "Music — Instrument", cat: "Creative", domain: "Music", DLPFC: 2, mPFC: 1, M1: 4, Parietal: 3, Temporal: 3, Occipital: 1, Cerebellum: 4, Hippocampus: 2, Amygdala: 2, ACC: 3, insight: "Cerebellum coordinates rhythm and timing while M1 executes precise finger movements.", automaticityType: "motor", thresholdHours: 100 },
  music_composition: { name: "Music — Composition", cat: "Creative", domain: "Music", DLPFC: 3, mPFC: 4, M1: 2, Parietal: 2, Temporal: 4, Occipital: 1, Cerebellum: 2, Hippocampus: 3, Amygdala: 3, ACC: 2, insight: "High mPFC activity drives novel auditory sequence generation, guided by temporal cortex.", automaticityType: "creative", thresholdHours: 80 },
  ai_research: { name: "AI Co-pilot — Research", cat: "AI-Assisted Work", domain: "AI Co-pilot", DLPFC: 3, mPFC: 2, M1: 0, Parietal: 3, Temporal: 3, Occipital: 2, Cerebellum: 1, Hippocampus: 3, Amygdala: 1, ACC: 3, insight: "DLPFC handles query formulation, while temporal cortex maps structural answers.", automaticityType: "ai", thresholdHours: 40 },
  ai_writing: { name: "AI Co-pilot — Writing", cat: "AI-Assisted Work", domain: "AI Co-pilot", DLPFC: 3, mPFC: 3, M1: 0, Parietal: 2, Temporal: 3, Occipital: 1, Cerebellum: 1, Hippocampus: 2, Amygdala: 2, ACC: 3, insight: "AI scaffolds structure, lowering prefrontal demands while keeping mPFC creative modeling active.", automaticityType: "ai", thresholdHours: 30 },
  running_easy: { name: "Running — Easy", cat: "Sport & Movement", domain: "Running", DLPFC: 1, mPFC: 3, M1: 3, Parietal: 2, Temporal: 1, Occipital: 2, Cerebellum: 4, Hippocampus: 3, Amygdala: 1, ACC: 1, insight: "Low DLPFC demand allows default mode recovery, while Cerebellum coordinates gait automaticity.", automaticityType: "motor", thresholdHours: 40 },
  running_intervals: { name: "Running — Intervals", cat: "Sport & Movement", domain: "Running", DLPFC: 3, mPFC: 1, M1: 4, Parietal: 2, Temporal: 1, Occipital: 2, Cerebellum: 3, Hippocampus: 2, Amygdala: 4, ACC: 4, insight: "Amygdala and ACC register high cardiorespiratory stress and effort regulation.", automaticityType: "motor", thresholdHours: 50 },
  tennis_serve: { name: "Tennis — Serve Practice", cat: "Sport & Movement", domain: "Tennis", DLPFC: 2, mPFC: 1, M1: 4, Parietal: 3, Temporal: 1, Occipital: 3, Cerebellum: 4, Hippocampus: 2, Amygdala: 2, ACC: 4, insight: "Highly complex motor sequence. M1 and Cerebellum execute, while ACC evaluates body metrics.", automaticityType: "motor", thresholdHours: 60 },
  meditation_focused: { name: "Meditation — Focused Attention", cat: "Restorative", domain: "Meditation", DLPFC: 2, mPFC: 2, M1: 0, Parietal: 2, Temporal: 1, Occipital: 1, Cerebellum: 1, Hippocampus: 1, Amygdala: 1, ACC: 4, insight: "ACC is active in monitoring focus drift, directing cognitive resources back to base.", automaticityType: "creative", thresholdHours: 20 },
  rest: { name: "Rest and Recovery", cat: "Restorative", domain: "Meditation", DLPFC: 0, mPFC: 3, M1: 0, Parietal: 1, Temporal: 1, Occipital: 1, Cerebellum: 1, Hippocampus: 2, Amygdala: 0, ACC: 0, insight: "Allows default mode network to consolidate skills and move items to long term memory.", automaticityType: "creative", thresholdHours: 10 }
};

const REGIONS = ['DLPFC', 'mPFC', 'M1', 'Parietal', 'Temporal', 'Occipital', 'Cerebellum', 'Hippocampus', 'Amygdala', 'ACC'];
const LEVEL_LABELS = ['Inactive', 'Low', 'Moderate', 'High', 'Peak'];
const LEVEL_OPACITIES = [0.05, 0.22, 0.42, 0.70, 0.95];

export function App() {
  const [tab, setTab] = useState<'now' | 'progress' | 'skills' | 'digest'>('now');
  
  // Onboarding state
  const [onboarded, setOnboarded] = useState<boolean>(false);
  const [onboardingAnswers, setOnboardingAnswers] = useState({
    environment: '',
    goal: '',
    exhausting: ''
  });

  // Session state
  const [sessionState, setSessionState] = useState<'IDLE' | 'TASK_SELECTED' | 'SESSION_ACTIVE' | 'SESSION_ENDED'>('IDLE');
  const [selectedTask, setSelectedTask] = useState<string>('coding');
  const [timer, setTimer] = useState<number>(0);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [sessionLogs, setSessionLogs] = useState<any[]>([]);
  const [activePlatform, setActivePlatform] = useState<string>('ChatGPT');

  // Simulation of user typing / cognitive state guessing
  const [userWpm, setUserWpm] = useState<number>(0);
  const [baselineWpm, setBaselineWpm] = useState<number>(40);
  const [deletionRate, setDeletionRate] = useState<number>(0.0);
  const [revisionDepth, setRevisionDepth] = useState<number>(0);
  const [cognitiveState, setCognitiveState] = useState<StateLabel>('stretch');
  
  // Tooltip state for brain map SVG
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // EventBus instance
  const eventBusRef = useRef<EventBus | null>(null);

  useEffect(() => {
    // Check if onboarding completed previously
    const saved = localStorage.getItem('cognis_onboarding_completed');
    if (saved === 'true') {
      setOnboarded(true);
    }

    // Set up a mock EventBus for local harness interaction
    const eb = (window as any).cognisEventBus || new EventBus({
      report: (err, ctx) => console.error('[UI Event Error]', err, ctx)
    });
    eventBusRef.current = eb;

    // Listen to mock typing updates or state changes
    eb.subscribe('state.changed', (event: any) => {
      setCognitiveState(event.payload.currentState);
    });

    eb.subscribe('prompt.typed', (event: any) => {
      setRevisionDepth(event.payload.revisionDepth);
    });

    // Populate mock session counts
    setSessionLogs([
      { taskId: 'coding', date: 'Jul 12', duration: 45, state: 'stretch' },
      { taskId: 'coding', date: 'Jul 13', duration: 30, state: 'stretch' },
      { taskId: 'deep_reading', date: 'Jul 14', duration: 20, state: 'coasting' }
    ]);
  }, []);

  // Timer runner
  useEffect(() => {
    let interval: any = null;
    if (timerActive) {
      interval = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  // Handle onboarding submit
  const handleOnboardingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardingAnswers.environment || !onboardingAnswers.goal || !onboardingAnswers.exhausting) {
      alert("Please fill out all sentence completions.");
      return;
    }

    // Publish event
    if (eventBusRef.current) {
      const onboardingEvent = createDomainEvent(
        'session.onboarding_completed',
        'session_onboard' as SessionId,
        'sidepanel-ui',
        {
          environment: onboardingAnswers.environment,
          goal: onboardingAnswers.goal,
          exhausting: onboardingAnswers.exhausting
        }
      );
      eventBusRef.current.publish('session.onboarding_completed', onboardingEvent);
    }

    localStorage.setItem('cognis_onboarding_completed', 'true');
    setOnboarded(true);
  };

  // Session Control handlers
  const handleStartSession = () => {
    setSessionState('SESSION_ACTIVE');
    setTimer(0);
    setTimerActive(true);

    if (eventBusRef.current) {
      const startEvent = createDomainEvent(
        'session.started',
        `session_${Date.now()}` as SessionId,
        'sidepanel-ui',
        { platform: activePlatform }
      );
      eventBusRef.current.publish('session.started', startEvent);
    }
  };

  const handlePauseSession = () => {
    setTimerActive(false);
    if (eventBusRef.current) {
      const pauseEvent = createDomainEvent(
        'session.paused',
        `session_${Date.now()}` as SessionId,
        'sidepanel-ui',
        { reason: 'explicit' }
      );
      eventBusRef.current.publish('session.paused', pauseEvent);
    }
  };

  const handleResumeSession = () => {
    setTimerActive(true);
    if (eventBusRef.current) {
      const resumeEvent = createDomainEvent(
        'session.resumed',
        `session_${Date.now()}` as SessionId,
        'sidepanel-ui',
        { pauseDurationMs: 5000 } // mock pause duration
      );
      eventBusRef.current.publish('session.resumed', resumeEvent);
    }
  };

  const handleEndSession = () => {
    setTimerActive(false);
    setSessionState('IDLE');

    if (eventBusRef.current) {
      const endEvent = createDomainEvent(
        'session.ended',
        `session_${Date.now()}` as SessionId,
        'sidepanel-ui',
        { reason: 'explicit' }
      );
      eventBusRef.current.publish('session.ended', endEvent);
    }

    // Add log
    setSessionLogs([
      { taskId: selectedTask, date: 'Today', duration: Math.ceil(timer / 60), state: cognitiveState },
      ...sessionLogs
    ]);
  };

  // Get active profile config
  const activeProfile = PROFILES[selectedTask] || PROFILES.coding;

  // Soft session notes based on timer
  const getSessionNote = () => {
    const mins = Math.floor(timer / 60);
    if (mins < 5) return "Session underway. Settling phase — cognitive state typically stabilises by minute 8.";
    if (mins < 15) return "Past the settling threshold. If this is a focused task, you are likely in your productive window.";
    if (mins < 25) return "First natural fatigue inflection point for most cognitive tasks. If accuracy or quality is dropping, consider a 5-minute break.";
    if (mins < 45) return "Extended session. Diminishing technique returns may apply. Maintain steady breathing.";
    return "Long session. This is a strong signal of engagement. Hydration and a short physical break recommended.";
  };

  // Typing event simulation (to demonstrate Suchit's state guesser metrics)
  const simulateTyping = (wpmVal: number, deleteVal: number) => {
    setUserWpm(wpmVal);
    setDeletionRate(deleteVal);

    // Calculate simulated State based on suchit's criteria
    let nextState: StateLabel = 'stretch';
    if (wpmVal > baselineWpm * 1.2 && deleteVal < 0.15) {
      nextState = 'coasting';
    } else if (wpmVal < baselineWpm * 0.7 && deleteVal >= 0.25) {
      nextState = 'overload';
    } else {
      nextState = 'stretch';
    }
    setCognitiveState(nextState);
    setRevisionDepth(prev => prev + (deleteVal > 0 ? 1 : 0));
  };

  return (
    <div className="flex flex-col h-screen bg-[#06060c] text-[#d6d6db] font-sans overflow-hidden select-none">
      
      {/* ── Top Header ── */}
      <div className="flex justify-between items-center px-5 py-4 border-b border-white/5 bg-[#0a0a14]/60 backdrop-blur-md">
        <div>
          <h1 className="text-sm font-bold tracking-widest text-[#7c4dff] uppercase">Cognis Visualiser</h1>
          <span className="text-[10px] text-[#55557a] tracking-wider">HYLE COGNITIVE SYSTEM LAYER</span>
        </div>
        <div className="flex bg-[#111124] border border-white/5 rounded-lg p-0.5">
          <button onClick={() => setTab('now')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${tab === 'now' ? 'bg-[#7c4dff] text-white shadow' : 'text-[#8888a8] hover:text-[#e8e8f0]'}`}>Now</button>
          <button onClick={() => setTab('progress')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${tab === 'progress' ? 'bg-[#7c4dff] text-white shadow' : 'text-[#8888a8] hover:text-[#e8e8f0]'}`}>Progress</button>
          <button onClick={() => setTab('skills')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${tab === 'skills' ? 'bg-[#7c4dff] text-white shadow' : 'text-[#8888a8] hover:text-[#e8e8f0]'}`}>Skills</button>
          <button onClick={() => setTab('digest')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${tab === 'digest' ? 'bg-[#7c4dff] text-white shadow' : 'text-[#8888a8] hover:text-[#e8e8f0]'}`}>Digest</button>
        </div>
      </div>

      {/* ── Main Tab Contents ── */}
      <div className="flex-1 overflow-y-auto p-5 pb-8">
        
        {/* 1. NOW TAB */}
        {tab === 'now' && (
          <div className="flex flex-col gap-5">
            {/* Task Picker */}
            <div className="bg-[#0b0b16] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
              <label className="text-[10px] font-bold text-[#8888a8] uppercase tracking-wider">Select Active Task</label>
              <select
                value={selectedTask}
                onChange={e => {
                  setSelectedTask(e.target.value);
                  setSessionState('TASK_SELECTED');
                }}
                className="w-full bg-[#14142a] border border-white/5 rounded-lg px-4 py-2.5 text-xs font-medium text-white outline-none focus:border-[#7c4dff] cursor-pointer"
              >
                <optgroup label="Cognitive">
                  <option value="coding">Coding</option>
                  <option value="deep_reading">Deep Reading</option>
                  <option value="writing_creative">Writing — Creative</option>
                  <option value="writing_analytical">Writing — Analytical</option>
                  <option value="writing_technical">Writing — Technical</option>
                  <option value="maths_and_logic">Maths and Logic</option>
                  <option value="language_vocabulary">Language — Vocabulary</option>
                </optgroup>
                <optgroup label="Creative">
                  <option value="drawing_observational">Drawing — Observational</option>
                  <option value="drawing_abstract">Drawing — Abstract</option>
                  <option value="music_instrument">Music — Instrument</option>
                  <option value="music_composition">Music — Composition</option>
                </optgroup>
                <optgroup label="AI-Assisted">
                  <option value="ai_research">AI Co-pilot — Research</option>
                  <option value="ai_writing">AI Co-pilot — Writing</option>
                </optgroup>
                <optgroup label="Sport & Movement">
                  <option value="running_easy">Running — Easy</option>
                  <option value="running_intervals">Running — Intervals</option>
                  <option value="tennis_serve">Tennis — Serve Practice</option>
                </optgroup>
                <optgroup label="Restorative">
                  <option value="meditation_focused">Meditation — Focused</option>
                  <option value="rest">Rest and Recovery</option>
                </optgroup>
              </select>
            </div>

            {/* Brain Map Render Box */}
            <div className="relative bg-[#0c0c17]/80 border border-white/5 rounded-2xl p-5 backdrop-blur-xl flex flex-col items-center">
              <span className="absolute top-4 left-4 text-[9px] font-semibold text-[#55557a] uppercase tracking-wider">Brain Activation Visualiser</span>
              
              <div className="w-full max-w-[280px] aspect-[1/0.82] relative my-2">
                <svg id="brainSvg" viewBox="0 0 500 410" width="100%" className="overflow-visible">
                  <defs>
                    <filter id="glow-peak" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="6" result="blur"/>
                      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
                    </filter>
                  </defs>
                  
                  {/* Silhouette base */}
                  <path 
                    d="M 62,210 C 52,165 56,118 80,82 C 106,44 148,22 205,16 C 262,10 318,14 365,38 C 412,62 442,100 455,148 C 468,196 464,244 442,284 C 420,324 388,350 358,362 L 345,366 C 324,372 304,374 284,372 L 262,368 C 236,364 216,358 196,348 C 176,338 158,326 142,314 C 112,292 82,260 62,210 Z"
                    fill="#101026" stroke="#22223c" strokeWidth="1.5"
                  />
                  {/* Brain Stem */}
                  <path 
                    d="M 262,368 C 266,382 270,400 268,418 C 266,430 262,438 254,442 C 246,438 242,430 240,418 C 238,400 242,382 246,368"
                    fill="#0e0e1c" stroke="#22223c" strokeWidth="1.2"
                  />
                  {/* Cerebellum Base */}
                  <path 
                    d="M 358,362 C 376,366 392,376 398,392 C 404,408 396,424 380,432 C 364,440 344,436 328,428 C 312,420 302,406 300,392 C 298,378 308,370 324,366 C 336,363 348,362 358,362 Z"
                    fill="#0d0d1c" stroke="#22223c" strokeWidth="1.2"
                  />

                  {/* 10 Brain Regions mapped to profile levels */}
                  {REGIONS.map(regionKey => {
                    const level = (activeProfile[regionKey as keyof typeof activeProfile] as number) || 0;
                    const opacity = LEVEL_OPACITIES[level];
                    
                    // Simple path colors
                    const colors: Record<string, string> = {
                      DLPFC: '#7c4dff', mPFC: '#e040fb', M1: '#00bcd4', Parietal: '#ff7043',
                      Temporal: '#ffc107', Occipital: '#66bb6a', Cerebellum: '#42a5f5',
                      Hippocampus: '#ab47bc', Amygdala: '#ef5350', ACC: '#ffab40'
                    };
                    const color = colors[regionKey];

                    // Region paths replicated from SVG template
                    const paths: Record<string, string> = {
                      DLPFC: "M 88,130 C 96,102 118,78 142,65 C 168,52 194,48 216,52 C 228,55 234,66 230,80 C 224,104 212,130 198,152 C 184,174 166,184 148,184 C 130,184 118,176 112,164 C 104,152 92,142 88,130 Z",
                      mPFC: "M 198,54 C 210,40 228,32 248,30 C 268,28 284,36 290,50 C 296,64 290,82 278,98 C 266,114 250,122 236,120 C 222,118 212,108 206,94 C 200,80 196,66 198,54 Z",
                      M1: "M 220,46 C 228,40 238,36 246,40 C 256,46 262,60 260,78 C 258,96 252,118 244,142 C 236,166 228,186 222,200 C 218,210 212,212 208,204 C 202,192 206,174 212,152 C 218,130 224,108 228,86 C 232,68 230,54 220,46 Z",
                      Parietal: "M 296,46 C 324,56 356,76 380,102 C 404,130 418,162 422,192 C 424,210 416,224 402,226 C 386,228 364,218 344,202 C 322,184 304,164 292,140 C 280,116 276,96 282,78 C 288,62 292,52 296,46 Z",
                      Temporal: "M 114,222 C 130,214 156,206 188,205 C 220,204 254,210 284,224 C 308,234 322,250 326,268 C 330,284 322,298 304,306 C 282,314 256,312 228,304 C 200,296 172,282 150,266 C 134,254 120,238 114,222 Z",
                      Occipital: "M 424,210 C 438,226 448,248 450,270 C 452,292 444,312 430,326 C 416,340 398,346 382,342 C 366,338 354,328 350,312 C 346,296 352,276 362,258 C 374,240 390,226 406,218 C 416,212 422,210 424,210 Z",
                      Cerebellum: "M 354,364 C 374,368 390,378 396,394 C 402,410 396,426 382,434 C 368,442 350,440 334,432 C 318,424 308,412 306,398 C 304,384 314,374 330,368 C 340,364 348,363 354,364 Z",
                      Hippocampus: "M 218,226 C 228,218 244,214 258,220 C 272,226 280,238 276,252 C 272,266 262,276 250,278 C 238,280 226,274 220,262 C 214,250 212,236 218,226 Z",
                      Amygdala: "M 188,220 C 196,212 208,210 218,214 C 226,218 230,226 226,236 C 222,246 214,252 204,254 C 194,254 186,248 182,240 C 178,232 182,224 188,220 Z",
                      ACC: "M 228,88 C 238,78 254,74 268,78 C 280,82 286,92 284,106 C 282,120 274,130 264,136 C 254,142 242,140 234,132 C 226,124 222,112 226,98 C 227,94 228,90 228,88 Z"
                    };

                    const textLabelPos: Record<string, {x: number, y: number}> = {
                      DLPFC: {x: 165, y: 135}, mPFC: {x: 275, y: 85}, M1: {x: 260, y: 145},
                      Parietal: {x: 375, y: 155}, Temporal: {x: 245, y: 275}, Occipital: {x: 430, y: 300},
                      Cerebellum: {x: 350, y: 410}, Hippocampus: {x: 260, y: 250}, Amygdala: {x: 215, y: 235},
                      ACC: {x: 265, y: 110}
                    };
                    const textPos = textLabelPos[regionKey];

                    return (
                      <g
                        key={regionKey}
                        className="cursor-pointer group"
                        onMouseEnter={(e) => {
                          setHoveredRegion(regionKey);
                          setTooltipPos({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseMove={(e) => {
                          setTooltipPos({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseLeave={() => setHoveredRegion(null)}
                      >
                        <path
                          d={paths[regionKey]}
                          fill={level > 0 ? color : 'none'}
                          fillOpacity={opacity}
                          stroke={color}
                          strokeWidth={hoveredRegion === regionKey ? 2.5 : level >= 3 ? 1.5 : 1}
                          strokeDasharray={level === 0 ? "4,3" : "none"}
                          strokeOpacity={level === 0 ? 0.3 : 0.8}
                          filter={level === 4 ? "url(#glow-peak)" : "none"}
                          className="transition-all duration-300"
                        />
                        {level >= 2 && textPos && (
                          <text
                            x={textPos.x}
                            y={textPos.y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize="8"
                            fontWeight="700"
                            fill={level >= 3 ? '#ffffff' : color}
                            opacity={level >= 3 ? 0.9 : 0.7}
                            pointerEvents="none"
                          >
                            {regionKey}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Intensity Scale Bar */}
              <div className="flex items-center gap-2 mt-4 text-[10px] text-[#8888a8]">
                <span>SCALE:</span>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map(l => (
                    <div
                      key={l}
                      className="w-5 h-2.5 rounded-sm flex items-center justify-center text-[7px] text-[#333] font-bold"
                      style={{
                        background: l === 0 ? 'transparent' : '#7c4dff',
                        opacity: LEVEL_OPACITIES[l],
                        border: l === 0 ? '1px dashed #555' : 'none'
                      }}
                    >
                      {l}
                    </div>
                  ))}
                </div>
              </div>

              {/* Status disclosure */}
              <div className="mt-5 border-t border-white/5 pt-3 w-full text-center">
                <span className="text-[10px] text-[#55557a] italic">
                  Research baseline — no hardware connected
                </span>
              </div>
            </div>

            {/* Interactive Tooltip */}
            {hoveredRegion && (
              <div
                className="fixed bg-[#0d0d18] border border-[#7c4dff]/40 rounded-xl p-3 shadow-xl backdrop-blur-md max-w-[200px] z-50 pointer-events-none transition-all duration-100"
                style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 12 }}
              >
                <div className="text-[11px] font-bold text-white uppercase">{hoveredRegion}</div>
                <div className="text-[10px] mt-0.5" style={{ color: '#00bcd4' }}>
                  Activation: {LEVEL_LABELS[(activeProfile[hoveredRegion as keyof typeof activeProfile] as number) || 0]}
                </div>
                <div className="text-[9px] text-[#8888a8] mt-1 leading-normal">
                  {hoveredRegion === 'DLPFC' && "Working memory, planning, executive control."}
                  {hoveredRegion === 'mPFC' && "Self-reference, motivation, default mode network, creativity."}
                  {hoveredRegion === 'M1' && "Voluntary motor program execution."}
                  {hoveredRegion === 'Parietal' && "Spatial reasoning, numbers, sensory integrations."}
                  {hoveredRegion === 'Temporal' && "Language, auditory memory, music retrieval."}
                  {hoveredRegion === 'Occipital' && "Visual-spatial coordinates, object processing."}
                  {hoveredRegion === 'Cerebellum' && "Rhythm, procedural movements, muscle memory storage."}
                  {hoveredRegion === 'Hippocampus' && "Long-term memory consolidation, novelty index."}
                  {hoveredRegion === 'Amygdala' && "Emotional regulation, high stakes arousal, stress."}
                  {hoveredRegion === 'ACC' && "Error checks, attention conflicts, effort allocation."}
                </div>
              </div>
            )}

            {/* Task Profile Card */}
            <div className="bg-[#0b0b16] border border-white/5 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-white">{activeProfile.name}</span>
                <span className="text-[9px] bg-[#7c4dff]/25 text-[#a29bfe] font-semibold px-2 py-0.5 rounded-full uppercase">
                  {activeProfile.automaticityType}
                </span>
              </div>
              <div className="text-[10px] text-[#8888a8] leading-relaxed mt-1">
                {activeProfile.insight}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/5 text-[10px] text-[#55557a]">
                <div>Total Domain Hours: <span className="font-semibold text-[#8888a8]">{(sessionLogs.filter(s => s.taskId === selectedTask).reduce((a,c) => a + (c.duration as number), 0)/60).toFixed(1)} hrs</span></div>
                <div>Mastery Phase: <span className="font-semibold text-[#8888a8] uppercase">
                  {sessionLogs.filter(s => s.taskId === selectedTask).length >= 10 ? 'Autonomous' : 
                   sessionLogs.filter(s => s.taskId === selectedTask).length >= 3 ? 'Associative' : 'Cognitive'}
                </span></div>
              </div>
            </div>

            {/* Active Session Timer & Control Panel */}
            <div className="bg-[#0a0a14] border border-white/5 rounded-xl p-4 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-[#8888a8] uppercase tracking-wider">Session Control</span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${sessionState === 'SESSION_ACTIVE' ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-[#55557a]/20 text-[#8888a8]'}`}>
                  {sessionState === 'SESSION_ACTIVE' ? 'ACTIVE' : 'STANDBY'}
                </span>
              </div>

              {/* Timer & WPM Display */}
              <div className="flex justify-around items-center py-2">
                <div className="text-center">
                  <div className="text-3xl font-mono font-bold text-white tracking-widest">
                    {String(Math.floor(timer / 60)).padStart(2, '0')}:{String(timer % 60).padStart(2, '0')}
                  </div>
                  <span className="text-[9px] text-[#55557a] uppercase">Elapsed Duration</span>
                </div>
                
                {sessionState === 'SESSION_ACTIVE' && (
                  <div className="text-center border-l border-white/5 pl-8">
                    <div className="text-2xl font-bold text-[#00bcd4] font-mono">{userWpm}</div>
                    <span className="text-[9px] text-[#55557a] uppercase">Typing Speed (WPM)</span>
                  </div>
                )}
              </div>

              {/* Soft session warning/note */}
              {sessionState === 'SESSION_ACTIVE' && (
                <div className="bg-[#101026] border border-[#7c4dff]/20 rounded-lg p-3 text-[10px] text-[#8888a8] leading-relaxed italic text-center">
                  {getSessionNote()}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-2">
                {sessionState !== 'SESSION_ACTIVE' ? (
                  <button
                    onClick={handleStartSession}
                    className="flex-1 bg-[#7c4dff] hover:bg-[#6c3df0] text-white font-semibold py-2.5 rounded-lg text-xs transition-all active:scale-98 shadow shadow-[#7c4dff]/30"
                  >
                    Start Session
                  </button>
                ) : (
                  <>
                    {timerActive ? (
                      <button
                        onClick={handlePauseSession}
                        className="flex-1 bg-[#ffab40]/25 text-[#ffab40] hover:bg-[#ffab40]/40 font-semibold py-2.5 rounded-lg text-xs transition-all"
                      >
                        Pause
                      </button>
                    ) : (
                      <button
                        onClick={handleResumeSession}
                        className="flex-1 bg-[#00bcd4]/25 text-[#00bcd4] hover:bg-[#00bcd4]/40 font-semibold py-2.5 rounded-lg text-xs transition-all"
                      >
                        Resume
                      </button>
                    )}
                    <button
                      onClick={handleEndSession}
                      className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold py-2.5 rounded-lg text-xs transition-all"
                    >
                      End & Save
                    </button>
                  </>
                )}
              </div>

              {/* Typing Simulator controls (Only visible during active session) */}
              {sessionState === 'SESSION_ACTIVE' && (
                <div className="border-t border-white/5 pt-3 flex flex-col gap-2">
                  <span className="text-[8px] font-bold text-[#55557a] uppercase tracking-wider text-center">Simulate User Typing Behavior</span>
                  <div className="flex gap-1.5 justify-center">
                    <button onClick={() => simulateTyping(65, 0.02)} className="bg-[#111124] text-[#8888a8] border border-white/5 hover:bg-[#151530] text-[9px] px-2 py-1 rounded">Coasting (65 WPM)</button>
                    <button onClick={() => simulateTyping(22, 0.35)} className="bg-[#111124] text-[#8888a8] border border-white/5 hover:bg-[#151530] text-[9px] px-2 py-1 rounded">Overload (22 WPM, edit)</button>
                    <button onClick={() => simulateTyping(42, 0.05)} className="bg-[#111124] text-[#8888a8] border border-white/5 hover:bg-[#151530] text-[9px] px-2 py-1 rounded">Stretch (42 WPM)</button>
                  </div>
                </div>
              )}
            </div>

            {/* Recent Session Logs */}
            <div className="bg-[#0b0b16] border border-white/5 rounded-xl p-4 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-[#8888a8] uppercase tracking-wider">Recent Activity Logs</span>
              <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto mt-1">
                {sessionLogs.map((log, i) => (
                  <div key={i} className="flex justify-between items-center text-[10px] py-1 border-b border-white/5 last:border-0 text-[#8888a8]">
                    <div>
                      <span className="font-semibold text-white">{PROFILES[log.taskId]?.name || log.taskId}</span>
                      <span className="text-[8px] bg-white/5 text-[#55557a] ml-2 px-1 py-0.5 rounded">{log.date}</span>
                    </div>
                    <div className="flex gap-3 items-center">
                      <span>{log.duration} mins</span>
                      <span className="text-[8px] text-[#e040fb] font-semibold uppercase">{log.state}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. PROGRESS CURVES TAB */}
        {tab === 'progress' && (
          <div className="flex flex-col gap-5">
            <div className="bg-[#0b0b16] border border-white/5 rounded-xl p-4">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Cognitive Automaticity Curve</h2>
              <p className="text-[9px] text-[#8888a8] leading-relaxed mb-4">
                DLPFC Prefrontal Cost vs. Output Quality. Prefrontal cost falls as task structure/vocabulary consolidates.
              </p>

              {/* Cognitive SVG line chart */}
              <div className="w-full aspect-[2/1.1] border-l border-b border-white/10 relative p-2 my-2">
                <svg viewBox="0 0 200 100" width="100%" height="100%">
                  {/* DLPFC Cost curve (falling) */}
                  <path d="M 10,20 Q 80,60 190,80" fill="none" stroke="#7c4dff" strokeWidth="2" />
                  {/* Quality curve (stable/holding) */}
                  <path d="M 10,50 Q 80,30 190,25" fill="none" stroke="#00bcd4" strokeWidth="2" />
                  
                  {/* Grid / Dots */}
                  <circle cx="10" cy="20" r="2.5" fill="#7c4dff"/>
                  <circle cx="190" cy="80" r="2.5" fill="#7c4dff"/>
                  <circle cx="10" cy="50" r="2.5" fill="#00bcd4"/>
                  <circle cx="190" cy="25" r="2.5" fill="#00bcd4"/>
                </svg>
                {/* Labels */}
                <div className="absolute top-2 right-2 flex flex-col gap-1 text-[8px]">
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 bg-[#7c4dff]"></div><span className="text-[#7c4dff]">DLPFC Cost</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 bg-[#00bcd4]"></div><span className="text-[#00bcd4]">Session Quality</span></div>
                </div>
              </div>
              <div className="text-[10px] text-[#55557a] text-center italic mt-2">
                "Same quality output, lower prefrontal cost. This is cognitive automaticity developing."
              </div>
            </div>

            <div className="bg-[#0b0b16] border border-white/5 rounded-xl p-4">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Motor Automaticity Curve</h2>
              <p className="text-[9px] text-[#8888a8] leading-relaxed mb-4">
                Primary Motor Cortex (M1) vs. Cerebellum. The crossing point represents the automaticity transition.
              </p>

              {/* Motor SVG line chart */}
              <div className="w-full aspect-[2/1.1] border-l border-b border-white/10 relative p-2 my-2">
                <svg viewBox="0 0 200 100" width="100%" height="100%">
                  {/* M1 curve (falling) */}
                  <path d="M 10,25 Q 100,60 190,80" fill="none" stroke="#ff7043" strokeWidth="2" />
                  {/* Cerebellum curve (rising) */}
                  <path d="M 10,75 Q 100,50 190,30" fill="none" stroke="#42a5f5" strokeWidth="2" />
                  
                  {/* Intersection point marker */}
                  <circle cx="105" cy="53" r="3.5" fill="#e040fb" className="animate-ping" style={{ transformOrigin: '105px 53px' }}/>
                  <circle cx="105" cy="53" r="2.5" fill="#e040fb"/>
                </svg>
                {/* Labels */}
                <div className="absolute top-2 right-2 flex flex-col gap-1 text-[8px]">
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 bg-[#ff7043]"></div><span className="text-[#ff7043]">M1 Load</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 bg-[#42a5f5]"></div><span className="text-[#42a5f5]">Cerebellum</span></div>
                </div>
                <div className="absolute top-[48%] left-[54%] text-[7px] text-[#e040fb] font-semibold bg-[#0b0b16] px-1 rounded">
                  TRANSITION POINT
                </div>
              </div>
              <div className="text-[10px] text-[#55557a] text-center italic mt-2">
                Motor automaticity transition detected — Session 5. Movement program begins to encode procedurally.
              </div>
            </div>
          </div>
        )}

        {/* 3. SKILLS BALANCE TAB */}
        {tab === 'skills' && (
          <div className="flex flex-col gap-4">
            <span className="text-[10px] font-bold text-[#8888a8] uppercase tracking-wider">Skill Domain Summaries</span>
            
            {/* Writing Domain Card */}
            <div className="bg-[#0b0b16] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-white">Writing Mastery</span>
                <span className="text-[9px] font-bold text-[#66bb6a] bg-[#66bb6a]/15 px-2 py-0.5 rounded">BALANCED</span>
              </div>
              <div className="text-[9px] text-[#8888a8] leading-normal">
                Development is distributed across Analytical, Technical, and Creative writing. High mPFC access paired with consistent DLPFC control.
              </div>
              {/* Balance bar */}
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden flex">
                <div className="h-full bg-[#7c4dff]" style={{ width: '45%' }} title="Analytical (45%)"></div>
                <div className="h-full bg-[#e040fb]" style={{ width: '35%' }} title="Creative (35%)"></div>
                <div className="h-full bg-[#00bcd4]" style={{ width: '20%' }} title="Technical (20%)"></div>
              </div>
              <div className="flex justify-between text-[8px] text-[#55557a] font-semibold uppercase">
                <span>Balance Score: 0.18</span>
                <span>Total: 8.5 hrs</span>
              </div>
            </div>

            {/* Tennis Domain Card (Imbalanced illustration) */}
            <div className="bg-[#0b0b16] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-white">Tennis Skill</span>
                <span className="text-[9px] font-bold text-[#ff7043] bg-[#ff7043]/15 px-2 py-0.5 rounded">IMBALANCED</span>
              </div>
              <div className="text-[9px] text-[#8888a8] leading-normal">
                Your tennis development is heavily weighted toward rally work. Serve practice and match play are underdeveloped relative to your baseline.
              </div>
              {/* Balance bar */}
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden flex">
                <div className="h-full bg-[#00bcd4]" style={{ width: '85%' }} title="Rallying (85%)"></div>
                <div className="h-full bg-[#ff7043]" style={{ width: '10%' }} title="Serve (10%)"></div>
                <div className="h-full bg-[#ffab40]" style={{ width: '5%' }} title="Match (5%)"></div>
              </div>
              <div className="flex justify-between text-[8px] text-[#55557a] font-semibold uppercase">
                <span>Balance Score: 0.72</span>
                <span>Total: 95.0 hrs</span>
              </div>
            </div>
          </div>
        )}

        {/* 4. DIGEST TAB */}
        {tab === 'digest' && (
          <div className="flex flex-col gap-4">
            <span className="text-[10px] font-bold text-[#8888a8] uppercase tracking-wider">Weekly Skill Digest Insights</span>
            
            <div className="bg-[#0a0a14] border border-l-4 border-l-[#e040fb] border-white/5 rounded-r-xl p-4">
              <div className="text-[10px] font-bold text-white uppercase tracking-wide">Motor Automaticity Transition</div>
              <div className="text-[9.5px] text-[#8888a8] leading-relaxed mt-1">
                Based on your logged Tennis Serve Practice, we have detected a transition in motor encoding. Movement programs are shifting to procedural cerebellar pathways. Deliberate, precise practice is recommended now.
              </div>
            </div>

            <div className="bg-[#0a0a14] border border-l-4 border-l-[#00bcd4] border-white/5 rounded-r-xl p-4">
              <div className="text-[10px] font-bold text-white uppercase tracking-wide">AI Scaffolding Divergence Warning</div>
              <div className="text-[9.5px] text-[#8888a8] leading-relaxed mt-1">
                AI Research sessions exceed standalone Conceptual Study by an 8:1 ratio. Prefrontal load is significantly reduced during AI research. To build independent capability, consider alternating standalone sessions.
              </div>
            </div>

            <div className="bg-[#0a0a14] border border-l-4 border-l-[#7c4dff] border-white/5 rounded-r-xl p-4">
              <div className="text-[10px] font-bold text-white uppercase tracking-wide">Skill Transfer Activation</div>
              <div className="text-[9.5px] text-[#8888a8] leading-relaxed mt-1">
                Your recent grammar study sessions predict a faster adaptation in Language Speaking. Grammar rule retrieval is becoming automated, freeing working memory for verbal production.
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
