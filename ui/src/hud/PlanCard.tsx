// The plan on the billboard: the stack as rows (the ones the agent settled by itself marked
// "auto"), the generators it will run, what the user will do by hand and the files. "Build
// it" starts the build. "Change something" turns the town into a picker: the buildings glow,
// a click on one sends its slot back to be asked again; Esc goes back to the plan.
import { useEffect, useRef, useState } from "react";

import { slotById, type SlotId } from "../../../src/town/catalog.ts";
import type { AnswerBody, PlanView, TownState } from "../../../src/town/protocol.ts";
import { pickable } from "../logic.ts";
import { setPicker } from "../scene/Pick.tsx";
import type { Town } from "../use-town.ts";

type Outcome = Awaited<ReturnType<Town["postAnswer"]>> | "offline";

export function PlanCard(props: {
  plan: PlanView;
  placements: TownState["placements"];
  postAnswer: Town["postAnswer"];
  /** Focus the card's first button when it appears (or once this turns true). */
  takeFocus: boolean;
}) {
  const { plan, placements, postAnswer, takeFocus } = props;
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const card = useRef<HTMLElement>(null);
  /** Where focus goes after the card changes view. */
  const focusNext = useRef<string | null>(null);

  useEffect(() => {
    if (takeFocus)
      card.current?.querySelector<HTMLElement>(".plan-build")?.focus({ preventScroll: true });
  }, [takeFocus]);
  useEffect(() => {
    const selector = focusNext.current;
    focusNext.current = null;
    if (selector)
      card.current?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
  }, [picking, busy]);

  const send = async (body: AnswerBody) => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    let outcome: Outcome;
    try {
      outcome = await postAnswer(body);
    } catch {
      outcome = "offline";
    }
    // Sent: the card stays, busy, until the town moves on.
    if (outcome === "ok") return;
    setBusy(false);
    // Stale: the hook re-syncs and this card is replaced by whatever is current.
    if (outcome === "stale") return;
    focusNext.current = picking ? ".plan-back" : ".plan-build";
    setProblem(
      outcome === "offline"
        ? "Can't reach the town. Is the terminal still running?"
        : "That didn't go through. Try again?",
    );
  };

  const change = (slot: SlotId) => void send({ questionId: "plan", action: "change", slot });

  // Pick mode: the town's buildings pick, and Esc goes back to the plan.
  useEffect(() => {
    if (!picking || busy) return;
    setPicker(change);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      focusNext.current = ".plan-change";
      setPicking(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      setPicker(null);
    };
  }, [picking, busy]);

  if (picking) {
    const slots = pickable(placements);
    return (
      <section ref={card} className="question plan" aria-busy={busy}>
        <header className="question-head">
          <span className="question-kind">Change something</span>
          <span className="question-hint">Esc to go back</span>
        </header>
        <h2 className="question-text">Click the building to change</h2>
        <p className="question-quip">The agent asks about it again, then shows a new plan.</p>
        {slots.length > 0 ? (
          <div className="plan-picks" role="group" aria-label="Or choose it here">
            <span className="plan-picks-label">Or choose it here:</span>
            {slots.map((slot) => (
              <button
                key={slot}
                type="button"
                className="plan-pick"
                disabled={busy}
                onClick={() => change(slot)}
              >
                {slotById(slot).label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="plan-actions">
          <button
            type="button"
            className="plan-back plan-secondary"
            disabled={busy}
            onClick={() => {
              focusNext.current = ".plan-change";
              setPicking(false);
            }}
          >
            Back to the plan
          </button>
        </div>
        {problem ? (
          <p className="question-problem" role="alert">
            {problem}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section ref={card} className="question plan" aria-busy={busy}>
      <header className="question-head">
        <span className="question-kind">The plan</span>
        <span className="question-hint">Check it over</span>
      </header>
      <h2 className="question-text">Ready to build?</h2>
      {plan.rows.length > 0 ? (
        <dl className="plan-rows">
          {plan.rows.map((row, i) => (
            <div key={`${row.label}:${i}`} className="plan-row">
              <dt>{row.label}</dt>
              <dd>
                {row.value}
                {row.auto ? (
                  <span className="plan-auto" title="Settled by the agent">
                    auto
                  </span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {plan.generators.length > 0 ? (
        <div className="plan-section">
          <h3>It will run</h3>
          <ul className="plan-list">
            {plan.generators.map((generator, i) => (
              <li key={i}>
                <code>{generator}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {plan.manualSteps.length > 0 ? (
        <div className="plan-section">
          <h3>You'll do by hand</h3>
          <ul className="plan-list">
            {plan.manualSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {plan.tree.trim() ? (
        <details className="plan-tree">
          <summary>Files</summary>
          <pre>{plan.tree}</pre>
        </details>
      ) : null}
      <div className="plan-actions">
        <button
          type="button"
          className="plan-change plan-secondary"
          disabled={busy}
          onClick={() => {
            focusNext.current = ".plan-back";
            setProblem(null);
            setPicking(true);
          }}
        >
          Change something
        </button>
        <button
          type="button"
          className="plan-build question-send"
          disabled={busy}
          onClick={() => void send({ questionId: "plan", action: "build" })}
        >
          Build it
        </button>
      </div>
      {problem ? (
        <p className="question-problem" role="alert">
          {problem}
        </p>
      ) : null}
    </section>
  );
}
