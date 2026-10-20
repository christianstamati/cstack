import { useState } from "react";

/** The first screen. Its click is the gesture that lets the music start. */
export function Entry(props: { projectName: string | null; onEnter: () => void }) {
  const [leaving, setLeaving] = useState(false);
  return (
    <button
      type="button"
      className={leaving ? "entry leaving" : "entry"}
      autoFocus
      onClick={() => {
        if (leaving) return;
        setLeaving(true);
        props.onEnter();
      }}
    >
      <span className="entry-card">
        {props.projectName ? <span className="entry-name">{props.projectName}</span> : null}
        <span className="entry-title">cstack town</span>
        <span className="entry-hint">Tap to enter the town</span>
      </span>
    </button>
  );
}
