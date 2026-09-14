# Intelligence Layer Architecture Notes

# Executive Overview

The Intelligence Layer comprises two core engines that provide real-time cognitive analytics and historical pattern recognition for the Cognis extension:

1. Response Intelligence Engine – Analyzes streaming AI response quality in real-time
2. Insights Engine – Measures user skill progression and behavioral patterns over time

Both engines are pure, platform-agnostic business logic processors that operate independently of the UI, platform adapters, or storage layer. They communicate exclusively through the EventBus and comply with the transient data policy (ADR-019).

---

# Architecture Overview

## Target Architecture

```
src/
├── engines/          # Pure, platform-agnostic business logic processors
│   ├── response/     # Analyzes AI response stream chunks (transient per ADR-019)
│   └── insights/     # Measures task automaticity and patterns (background worker)
```

---

## Deliverables (WS0)

- ✓ Intelligence Layer Architecture Notes (this document)
- ✓ Module Dependency Diagrams (in respective sections)
- ✓ Event Flow Diagrams (in respective sections)

---

# Insights Engine

The Insights Engine detects patterns in user behavior over time, measuring skill progression from conscious learning to automatic competence (automaticity).

---

## Core Interfaces

### `src/engines/insights/interfaces.ts` 
        Four main Interfaces : 
        - ResponseIntelligenceEnigne        #The main orchestrator interface for the response analysis engine
        - AnalysisResult                    #The output contract returned after analyzing a response( contians score, flags, metadata with additional context)
        - Response Analyser                 #The interface that inidivdual analyzer implentations must follow   
    
## Scoring Components

    src/engines/insights/InsightValidator.ts :
        A quality filter layer, where only insights with complete metadata, high confidence ( >=75% ) and strong evidence ( >= 5 ) are allowed through. Prevents speculative or incomplete insights from cluttering the permenant knowledge storage.
    
## Orchestrator Components

    src/engines/insights/InsightScheduler.ts :
        A coordinator that decides when the insight pipeline can be run. Usually, runs when a session ends, and periodically every 100 prompts during a long session. It also handles event subscription lifecycle, cleanup and orchestrates the pipeline execution! 
    
    src/engines/insights/InsightEngine.ts : 
        It is a three component orchestrator + coordinator that has 
        - Strategies: individual insight detection algorithms 
        - Pipelines: runs all the procedures and strategies, produces validated insights
        - Scheduler: decides when to run
    
    src/engines/insights/ConfidenceCalculator.ts :
        The main calculation that is being computed, to score insights in a range of 0.0 to 1.0, representing how certain the system is that an insight is valid. It is a sophisticated scoring system that : 
        - Weights evidence by recency 
        - Normalizes against thresholds 
        - Factors in strategy quality 
        - Penalizes contradiction
        - Ensures valid probability ( always 0.0 to 1.0 )

## Execution Components

    src/engines/insights/pipeline/ReasoningPipeline.ts :
        It is the execution engine that orechestrates the full 8 stage insight generation process of : 
        - Builds Reasoning Context 
        - Collects evidence
        - Signal Weighting 
        - Executes detection strategies 
        - Validates quality 
        - Publishes to EventBus
        It seperates the concerns of strategies focusing on detection logic.
    
    src/engines/insights/strategies/V1AutomaticityEvaluator.ts : 
        - Automaticity = detecting when a user has transitioned from conscious, effortful learning to automatic, subconscious competence is a skill. 
        - Hysteresis = Uses a threshold with "memory", doesn't essentially flip-flop on the borderline cases. Once a user proves mastery ( which is many successes and few errors), they stay in "Autonomous", unless evidence degrades significantly.
        
        It is a concrete detection strategy that identifies when a user has achieved mastery, specifically in TypeScript. It is done by checking if they have more successful compilations attempts than error attempts. Confidence is calculated by using time-weighted evidence and returns insight candidates for downstream validation and publishing.

    src/eningines/response/analyzers/CompletenessAnalyzer.ts : 
        A lightweight response quality checker that identifies whether an AI response appears to be complete or turncated by checking for unclosed markdown code blocks and conclusion phrases. It then assigns a confidence scoring that reflects the completeness and flags potential turncation issues for the downstream systems ( like ui, logging, retry logic ).  It has lightweight heuristics, signal weighting, composable analysis and metadata for debugging! 

    src/engines/response/analyzers/QualityAnalyzer.ts : 
        A meta Analyzer Orchestrator, that combines three specialized reponse quality detectors : 
        - Structure 
        - Reasoning 
        - Completeness
        Using weighted aggregationg, it produces a composite quality score of 0.0 - 1.0, along with a unified flag list and breakdown of inidividual dimension scores, enabling both high-level quality assesment and detailed root cause analysis! 
    
    src/engines/response/analyzers/ReasoningAnalyzer.ts : 
        It is a lightweight linguistic quality detector that evaluates the depth and breadth of logical reasoning response. It is done by counting casual connectives and branching markers. Resulting in a produced score that reflects reasoning quality, flags for catergorization and metadata for debugging.
        Key Features : 
        - Linguistic Pattern Matching  ( word boundary regex )
        - Dual Dimension Scoring ( chain length + branching )
        - Weighted Components ( branching weighted is higher than reasoning ) 
        - Transparent Metadata ( raw counts for downstream systems ) 
    
    src/engines/response/analyzers/StructureAnalyzer.ts : 
        A formatting quality detector that evalutes the organizational quality of a response by counting the markdown structural elements ( like headers, lists codes etc ) and calculating organization density. It results in producing a score that reflects presentation quality, flags ( for code based, or prose based ) and metadata for a detailed analysis. A reward system is used, where good structure or code examples are rewarded and whereas long prose walls are penalized.
        Key Features : 
        - Regex Based Structural Detection 
        - Density Based Heuristic 
        - Contextual scoring 
        - Complementary Flags 
        - Format-Agnostic Approach 
    
## Orchestrator Components

    src/engines/response/pipeline/AnalysisPipeline.ts : 
        It is the Orchestrator for the response analysis. Instantiating and composing four layers ( all the analyzer layers ), it runs the composite analyzer on the response text, extracts and validates scores, and packages the results into an event payload, publishting to the EventBus. 

# Data Flow Summary

        Data Flow Diagram ( for a deeper understanding ) -
            ResponseText
                ↓
            AnalysisPipeline.execute()
                ↓
            QualityAnalyzer.analyze()
                ├→ StructureAnalyzer (headers, lists, code blocks) → score, flags
                ├→ ReasoningAnalyzer (reasoning/branching markers) → score, flags
                ├→ CompletenessAnalyzer (markdown balance, conclusions) → score, flags
                ↓
            Aggregate scores (weighted: C:40% R:40% S:20%) and flags
                ↓
            Create ResponseAnalysisCompletedPayload
                ↓
            Publish to EventBus
                ↓
            Subscribers (UI, Storage, Retry Logic, Metrics) consume event


# Response Intelligence Engine

## Core Interfaces

    src/engines/response/interfaces.ts : 
        This interface defines the lifecycle ( specifically the start and stop ), all while definign contract for all the analyzers ( version, name budget and all ). It standardizes output using score, flags, metadata enabling composition and pipeline orchestration across different analyzer implementations. 
    
## Buffering Components

    src/engines/response/ReconstructorBuffer.ts : 
        A streaming response accumulator with safety gaurds, it : 
        - Collects treaming response chunks into a single buffer.
        - Enforces size limits ( 500KB max ) 
        - Implements watchdog timeout ( 60s of inactivity = abondon ) 
        - Triggers analysis pipeline when complete 
        - Explicitly clears sensitive data from memory ( The transient policy ) 
        - Notifies creator when finished ( through a call back ) 
        The buffer handles two terminal states - a sealed ( completed and analyzed ) or abandoned ( error and discarded ). All operations are indempotent and defensive, which ensures robustness under failure inducing conditions. 
    
    src/engines/response/Responseintelligence.ts : 
        The orchestrator for response quality analysis in a streaming related context. 
        Diagram for understanding : 
            ResponseIntelligenceEngine
            ├─ start(eventBus)
            │  ├ Create pipeline
            │  └ Subscribe to 4 response events
            ├
            ├─ [IDLE: waiting for responses]
            ├
            ├─ ResponseEvents.STARTED → handleStarted()
            │  └ Create buffer, store in map
            ├
            ├─ ResponseEvents.CHUNK (repeated) → handleChunk()
            │  └ Append chunk to buffer
            ├
            ├─ ResponseEvents.COMPLETED → handleCompleted()
            │  └ Seal buffer → analyze → destroy → cleanup
            │
            ├─ OR ResponseEvents.ABANDONED → handleAbandoned()
            │  └ Abandon buffer → destroy → cleanup
            │
            └─ stop()
                ├ Unsubscribe from events
                ├ Destroy all remaining buffers
                └ Clear references

        The Engine acts as a state machine coordinator, managing the life cycle of multiple concurrent response buffers across multiple sessions, ensuring all analysis happens exactly once and resources are cleaned up in all those scenarios. 
    
# Complete Workflow Summary 
# Data Flow Summary

## Response Intelligence Engine
AI Response Stream
        │
        ▼
ResponseIntelligenceEngine
        │
        ├── Receives ResponseEvents.STARTED
        │       └── Creates ReconstructorBuffer
        │
        ├── Receives ResponseEvents.CHUNK
        │       └── Streams chunks into buffer
        │
        ├── Receives ResponseEvents.COMPLETED
        │       └── Seals buffer
        │               │
        │               ▼
        │       AnalysisPipeline.execute()
        │               │
        │               ▼
        │       QualityAnalyzer
        │          ├── StructureAnalyzer
        │          ├── ReasoningAnalyzer
        │          └── CompletenessAnalyzer
        │               │
        │               ▼
        │       Composite Analysis Result
        │               │
        │               ▼
        │       ResponseAnalysisCompletedPayload
        │               │
        │               ▼
        │          Publish to EventBus
        │
        └── Receives ResponseEvents.ABANDONED
                └── Cleans up buffer and resources

## Insights Engine

Session Activity / User Behaviour
                │
                ▼
        InsightScheduler
                │
                ├── Session End
                └── Every 100 Prompts
                │
                ▼
          InsightEngine
                │
                ▼
        ReasoningPipeline
                │
                ├── Build Reasoning Context
                ├── Collect Evidence
                ├── Signal Weighting
                ├── Execute Detection Strategies
                │         └── V1AutomaticityEvaluator
                ├── Calculate Confidence
                │         └── ConfidenceCalculator
                ├── Validate Insight
                │         └── InsightValidator
                ▼
          Validated Insights
                │
                ▼
          Publish to EventBus

## Overall Intelligence Layer Flow

                AI Response Stream
                        │
                        ▼
        Response Intelligence Engine
                        │
        Response Quality Analysis
                        │
                        ▼
                EventBus Events
                        │
                        ▼
               Insights Engine
                        │
        Behaviour & Automaticity Analysis
                        │
                        ▼
            Validated User Insights
                        │
                        ▼
          Consumers (UI, Storage,
        Retry Logic, Metrics, etc.)


