// One question on the billboard. A single choice answers on click; a multi-select ticks
// options and sends them with Done; free text takes a typed answer and OK (any options
// shown with it are ticked, not sent on click). Hovering an option previews its building.
import { useEffect, useId, useState } from "react";

import { slotById } from "../../../src/town/catalog.ts";
import type { Question } from "../../../src/town/protocol.ts";
import { setPreview } from "../scene/Preview.tsx";
import type { Town } from "../use-town.ts";

type Outcome = Awaited<ReturnType<Town["postAnswer"]>> | "offline";

export function QuestionCard(props: { question: Question; postAnswer: Town["postAnswer"] }) {
  const { question, postAnswer } = props;
  const { slot, options, multiSelect, freeText } = question;
  /** Options are ticked rather than sent on click. */
  const ticking = multiSelect || freeText;
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const [hovered, setHovered] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const inputId = useId();

  // What would be built: the ticked options plus the hovered one, in the question's order.
  // Nothing while an answer is on its way: its real building is about to drop.
  useEffect(() => {
    if (!slot) return;
    if (busy) {
      setPreview(null);
      return;
    }
    const shown = options.filter((o) => ticked.has(o.id) || o.id === hovered);
    setPreview({ slot, options: shown.map(({ id, label }) => ({ id, label })) });
  }, [slot, options, ticked, hovered, busy]);
  useEffect(() => () => setPreview(null), []);

  const send = async (optionIds: string[], typed?: string) => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    const body =
      typed === undefined
        ? { questionId: question.id, optionIds }
        : { questionId: question.id, optionIds, text: typed };
    let outcome: Outcome;
    try {
      outcome = await postAnswer(body);
    } catch {
      outcome = "offline";
    }
    // Answered: the card stays put, still busy, until the town moves on to what's next.
    if (outcome === "ok") return;
    setBusy(false);
    // Stale: the hook re-syncs and this card is replaced by whatever is current.
    if (outcome === "stale") return;
    setShaking(true);
    if (outcome === "offline") setProblem("Can't reach the town. Is the terminal still running?");
    else setProblem("That answer didn't fit. Try again?");
  };

  const pick = (id: string) => {
    if (!ticking) {
      void send([id]);
      return;
    }
    setTicked((current) => {
      const next = new Set(multiSelect ? current : []);
      if (current.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const tickedIds = options.filter((o) => ticked.has(o.id)).map((o) => o.id);
  const typed = text.trim();
  const kind = slot ? slotById(slot).label : "Question";
  const hint = freeText
    ? options.length > 0
      ? "Type an answer"
      : null
    : multiSelect
      ? "Pick any"
      : null;

  return (
    <section
      className={shaking ? "question shake" : "question"}
      aria-busy={busy}
      onAnimationEnd={() => setShaking(false)}
    >
      <header className="question-head">
        <span className="question-kind">{kind}</span>
        {hint ? <span className="question-hint">{hint}</span> : null}
      </header>
      <h2 className="question-text">{question.question}</h2>
      {question.quip ? <p className="question-quip">{question.quip}</p> : null}
      {options.length > 0 ? (
        <ul className="options" role="list">
          {options.map((option) => {
            const on = ticked.has(option.id);
            return (
              <li key={option.id}>
                <button
                  type="button"
                  className={on ? "option on" : "option"}
                  aria-pressed={ticking ? on : undefined}
                  disabled={busy}
                  onClick={() => pick(option.id)}
                  onPointerEnter={() => setHovered(option.id)}
                  onPointerLeave={() => setHovered((h) => (h === option.id ? null : h))}
                  onFocus={() => setHovered(option.id)}
                  onBlur={() => setHovered((h) => (h === option.id ? null : h))}
                >
                  {ticking ? <span className="option-tick" aria-hidden="true" /> : null}
                  <span className="option-body">
                    <span className="option-label">
                      {option.label}
                      {option.recommended ? (
                        <span className="option-recommended">recommended</span>
                      ) : null}
                    </span>
                    {option.description ? (
                      <span className="option-description">{option.description}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {freeText ? (
        <form
          className="question-free"
          onSubmit={(event) => {
            event.preventDefault();
            if (typed) void send(tickedIds, typed);
          }}
        >
          <label className="visually-hidden" htmlFor={inputId}>
            Your answer
          </label>
          <input
            id={inputId}
            className="question-input"
            value={text}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            onChange={(event) => setText(event.target.value)}
          />
          <button type="submit" className="question-send" disabled={busy || !typed}>
            OK
          </button>
        </form>
      ) : multiSelect ? (
        <div className="question-actions">
          <button
            type="button"
            className="question-send"
            disabled={busy || tickedIds.length === 0}
            onClick={() => void send(tickedIds)}
          >
            Done
          </button>
        </div>
      ) : null}
      {problem ? (
        <p className="question-problem" role="alert">
          {problem}
        </p>
      ) : null}
    </section>
  );
}
