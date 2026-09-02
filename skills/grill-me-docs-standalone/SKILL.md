---
name: grill-with-docs
description: A relentless interview to sharpen a plan or design, which also creates docs (CONTEXT.md glossary and ADRs) inline as we go.
disable-model-invocation: true
---

# Grill With Docs

Conducted a structured, relentless interview to turn ambiguous design ideas into concrete specifications while actively building and updating the project's domain model (glossary and architectural decisions).

---

## CORE PHILOSOPHY & RULES

1. **Interview Before Implementation**: Do NOT generate code, architecture diagrams, or final specs upfront. Conduct the interview first.
2. **Batch Questions**: Ask questions in 2-3 structured rounds (3-5 questions per round). Never barrage the user with 10+ questions at once.
3. **Capture Domain Language Inline**: Update `CONTEXT.md` as terms solidify. Do not wait until the end of the session.
4. **Offer ADRs Sparingly**: Record architectural decision records (ADRs) only for high-leverage, irreversible choices.

---

## WORKFLOW

### Phase 1: Context Preparation & Audit
Before starting the interview, inspect the current workspace:
- Check for existing `CONTEXT.md` (or `CONTEXT-MAP.md`). Read current terminology.
- Check `docs/adr/` for previous architectural decision records.
- If no `CONTEXT.md` exists, create one when the first canonical term is defined during conversation.

### Phase 2: Relentless Interviewing Loop (Grilling)

Drive 2 to 3 rounds of targeted questions to resolve ambiguity, edge cases, and scope.

#### Questioning Guidelines
- **Round 1 (Fundamentals)**: Clarify purpose, core user flows, boundary limits, and success criteria.
- **Round 2 (Edge Cases & Mechanics)**: Drill down into state transitions, failure modes, race conditions, and boundary limits revealed in Round 1.
- **Round 3 (Optional - Final Polish)**: Settle remaining trade-offs or technical constraints.

#### Active Domain Modeling During Interview
As the user answers your questions:
- **Challenge Overloaded Terms**: If the user uses vague or conflicting language (e.g. saying "account" when they mean "organization" vs "user"), stop and force a precise canonical definition.
- **Stress-Test Scenarios**: Invent realistic boundary scenarios to test the defined terms (e.g. *"What happens if a user cancels mid-checkout?"*).
- **Check Code Alignment**: If code exists in the repository, cross-reference their answers against real code constructs to catch contradictions.

### Phase 3: Inline Documentation Updates

#### 1. Updating `CONTEXT.md`
Whenever a key domain term, entity, or ubiquitous language rule is agreed upon, update `CONTEXT.md` **immediately**.

*`CONTEXT.md` Guidelines:*
- Must ONLY contain domain definitions, terms, and business concepts.
- **Strictly prohibit** implementation details (e.g., database schemas, React state, specific API paths).

*Format for CONTEXT.md:*

    # Domain Context

    ## Terms

    ### [Term Name]
    - **Definition**: Concise, unambiguous definition of the term.
    - **Rules/Invariants**: Constraints or rules governing this entity.

#### 2. Creating ADRs (Architectural Decision Records)
Only offer or create an ADR in `docs/adr/` if a choice meets ALL three criteria:
1. **Hard to reverse** (High cost to change later).
2. **Surprising without context** (A future reader will wonder *why*).
3. **Result of a real trade-off** (Selected over explicit alternatives).

*Format for `docs/adr/NNNN-[title].md`:*

    # [Number]. [Title]

    - **Status**: Accepted
    - **Context**: What problem were we facing?
    - **Decision**: What did we choose to do?
    - **Consequences**: What becomes easier or harder because of this choice?

---

## HANDLING PUSHBACK

If the user says "just build it" or wants to skip questions:
1. Do not refuse, but compress: Ask the top **2-3 critical questions** whose answers would change the architectural outcome most drastically.
2. Note your default assumptions explicitly before moving on.

---

## CONCLUSION / SESSION EXIT

Once the interview reaches clarity:
1. Output a short summary spec (Goal, In-Scope, Out-of-Scope, Key Decisions).
2. Confirm that `CONTEXT.md` and any necessary ADRs have been written to disk.
3. Ask the user if they are ready to proceed to implementation or ticket generation.