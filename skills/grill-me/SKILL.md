---
name: grill-me
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round, always through the `ask_user_question` tool (`@juicesharp/rpiv-ask-user-question`) rather than as prose in chat. Then wait for the answers before the next round. Mention in one chat line which branches you're opening, then let the dialog carry the questions; don't restate them as text.

## Writing a round

Each frontier decision becomes one `question` in the call:

- `question` — the decision itself, ending with `?`. A decision that needs paragraphs of framing is usually two decisions; split it.
- `header` — a ≤16-character chip naming the area the decision sits in.
- 2-4 `options` — the real candidate answers, mutually exclusive, each with a `label` (≤60 chars) and a `description` saying what that choice commits you to and what it costs.
- Your recommended answer **first**, labelled `<label> (Recommended)`, with its `description` carrying the reason. For a decision where "yes, as you said" is a real option, a first option meaning exactly that is how the user accepts your reading; don't word questions so agreement is the only thing worth clicking.
- `preview` (single-select only) when the candidates are artifacts worth comparing side by side: ASCII layouts, code, configs, diagrams.
- `multiSelect: true` only when more than one option can genuinely hold at once.

The dialog appends its own `Type something.` row, so never author `Other`, `Type something.`, or `Next` as a label. A question with an open answer space still gets 2-4 concrete candidates plus the user's own words; always offer the candidates, never a single "what do you think?" row.

## Sizing a round

The tool accepts at most 4 questions per call. A wider frontier is split into consecutive calls in the same round, ordered so the decisions the rest of the frontier hangs off come first. Never drop a frontier question to fit, and never promote a blocked question into a call to fill it: a question whose answer depends on a question still open in this round belongs to a _later_ round.

## Reading the answers

- **A decline is not an answer.** `User declined to answer questions` / `cancelled: true` means the user stopped the round. Ask whether to continue; never fill the blanks in yourself.
- **Blanks stay open.** A partial submit names its unanswered questions; carry them into the next round instead of assuming a default.
- **Notes are part of the answer.** `user notes:` and `global note:` override the option they were attached to when the two disagree. If a note opens a new decision, it joins the frontier, not the settled set.

Each round's answers reshape the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent with a fresh context window to find it; don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.
