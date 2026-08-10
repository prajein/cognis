# M11 Exit Audit: Attribution & Measurement (Independent Verification)

**Final Verdict: M11 APPROVED FOR COMMIT**

The implementation has been corrected to resolve the scientific flaws identified in the initial adversarial audit. It is now structurally and scientifically sound, fulfilling all M11 requirements without breaching adaptation policy boundaries.

## 1. Measurement Semantics (PASSED)

### What exactly is being compared?
The observer correctly captures the immutable `baselineText` at the start of the measurement window. 
At termination, it uses an LCP/LCS (Longest Common Prefix/Suffix) algorithm to extract the **delta** (the specific continuation text) typed by the user, isolating it from the rest of the document.
`calculateEditDistance` and `calculateLexicalOverlap` now compare the Ghost Text `stem` exclusively against the **delta**, producing meaningful behavioral features. 

- **`editDistance`**: The inputs are accurately normalized before comparison, meaning stylistic typing differences (capitalization, whitespace, punctuation) no longer artificially inflate the distance.
- **`lexicalOverlap`**: Jaccard similarity is calculated exclusively between the stem and the delta, resulting in mathematically sound overlap scores.
- **Normalization**: Both the `stem` and the `delta` are consistently normalized by lowercasing, stripping punctuation, and collapsing whitespace.

## 2. Lifecycle Correctness (PASSED)
The lifecycle boundaries are robust.
- **Termination Paths:** All 6 paths correctly call `terminateActiveMeasurement()`.
- **Double-termination prevention:** `terminateActiveMeasurement` synchronously extracts and nullifies `this.activeMeasurement`, guaranteeing that subsequent asynchronous timeouts or events simply return early, preventing duplicate emissions.
- **Cleanup:** `clearTimers()` is invoked deterministically.

## 3. Attribution Correctness (PASSED)
Interventions generate `ghosttext.generated` (or subsequent `ghosttext.dismissed`). The observer intercepts these events and explicitly checks for `this.activeMeasurement`, terminating it synchronously with the reason `intervention_replaced` before the new measurement begins. State cross-contamination is impossible.

## 4. Event Architecture (PASSED)
The new event `ghosttext.measurement.computed` is dispatched to the EventBus. It acts purely as telemetry and does not intersect with `GhostTextAdaptor`, `GhostTextEngine`, or any existing probing policies. 

## 5. Privacy (PASSED)
- **Raw Text:** Raw `baselineText` and `capturedText` are extracted into transient variables, processed via the delta algorithm into numeric primitives, and explicitly nullified (`m.baselineText = ''`; `m.capturedText = ''`). Raw text never enters the EventBus payload.
- **URLs:** Explicitly constrained to `window.location.origin`. Paths and query params are stripped.

## 6. Test Quality (PASSED)
The self-tests in `GhostTextMeasurementObserver.selftest.ts` have been rewritten to reflect realistic scenarios.
- The typing simulator now appropriately appends to an existing long prompt, mathematically validating the LCP/LCS delta extraction.
- A complex modification test verifies that inner replacements are extracted properly.
- Normalization logic is explicitly verified.
- The concurrent execution flaw in the test runner `setTimeout` was identified and patched.
