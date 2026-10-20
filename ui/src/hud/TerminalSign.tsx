// A sign that swings in when the agent has gone quiet with nothing to answer here: it is
// probably waiting in the terminal (a permission prompt, or a question it asked there).
import { useEffect, useState } from "react";

import type { TownState } from "../../../src/town/protocol.ts";
import { terminalSignText } from "../logic.ts";

/** The current time, updated every `ms`. */
function useNow(ms: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}

export function TerminalSign({ state }: { state: TownState }) {
  const now = useNow(1000);
  const text = terminalSignText(state, now);
  if (text === null) return null;
  return (
    <div className="terminal-sign" role="status">
      <span className="terminal-board">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect
            x="2.5"
            y="4"
            width="19"
            height="16"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M7 10l3 2.5L7 15M12.5 15.5H17"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {text}
      </span>
    </div>
  );
}
