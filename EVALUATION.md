# Evaluation — Output Quality Testing

## Methodology

Tested the summarization pipeline by running real recorded audio files through the app and evaluating the quality of the structured output across three dimensions:

1. **Summary accuracy** — Does the summary capture the key topics without hallucination?
2. **Decision extraction** — Are real decisions identified, and are non-decisions excluded?
3. **Action item structure** — Are tasks, owners, deadlines, and priorities extracted correctly?

Each test recording was a 1–2 minute simulated meeting with deliberate decision points and action items embedded in natural conversation.

---

## Test Results

### Recording 1: _[Your recording title]_
- **Duration**: ~X min
- **Summary quality**: _[Rate: accurate/partially accurate/inaccurate]_
- **Decisions found**: X of Y actual decisions
- **Action items found**: X of Y actual action items
- **Priority inference**: _[accurate/partially accurate]_
- **Owner attribution**: _[accurate/partially accurate]_
- **Notes**: _[Any observations about what the model got right or wrong]_

### Recording 2: _[Your recording title]_
- **Duration**: ~X min
- **Summary quality**: _[Rate]_
- **Decisions found**: X of Y
- **Action items found**: X of Y
- **Priority inference**: _[Rate]_
- **Owner attribution**: _[Rate]_
- **Notes**: _[Observations]_

### Recording 3: _[Your recording title]_
- **Duration**: ~X min
- **Summary quality**: _[Rate]_
- **Decisions found**: X of Y
- **Action items found**: X of Y
- **Priority inference**: _[Rate]_
- **Owner attribution**: _[Rate]_
- **Notes**: _[Observations]_

---

## Observed Failure Cases

1. **_[Describe any case where the model got something wrong]_** — e.g., "The model inferred a decision from a hypothetical discussion ('we could do X') rather than an actual commitment."
2. **_[Another failure case]_**
3. **_[Another failure case]_**

---

## Observations

- _[General takeaways about quality, e.g. "Priority inference is reliable when explicit urgency words are used, but defaults to 'medium' too aggressively for implied-urgent items."]_
- _[Any patterns in what works vs. what doesn't]_
- _[Prompt modifications you'd try next if you had more time]_

---

> **Note**: Fill in the bracketed sections above after running your actual test recordings through the app. The template structure is here so you have a consistent evaluation framework — the value is in the real results you document.
