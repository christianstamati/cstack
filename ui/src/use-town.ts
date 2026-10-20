// Subscribes to the town server's state stream and posts answers back.
import { useCallback, useEffect, useRef, useState } from "react";

import type { AnswerBody, TownState } from "../../src/town/protocol.ts";
import { answerOutcome, reconnectDelay, tokenFrom, type AnswerOutcome } from "./logic.ts";

export interface Town {
  state: TownState | null;
  connected: boolean;
  /** False when the page was opened without the session token. */
  hasToken: boolean;
  /** Rejects only when the server can't be reached. */
  postAnswer: (body: AnswerBody) => Promise<AnswerOutcome>;
}

export function useTown(): Town {
  const [token] = useState(() => tokenFrom(window.location.search));
  const [state, setState] = useState<TownState | null>(null);
  const [connected, setConnected] = useState(false);
  const resubscribe = useRef<() => void>(() => {});

  useEffect(() => {
    if (!token) return;
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let stopped = false;
    // After the agent stops the CLI closes the server, so there is nothing to reconnect to.
    let agentStopped = false;

    const connect = () => {
      clearTimeout(timer);
      source?.close();
      source = new EventSource(`/events?token=${encodeURIComponent(token)}`);
      source.onopen = () => {
        attempt = 0;
        setConnected(true);
      };
      source.onmessage = (event: MessageEvent<string>) => {
        try {
          const next = JSON.parse(event.data) as TownState;
          agentStopped = next.agentStopped;
          setState(next);
        } catch {
          // A broken message: the next one carries the full state again.
        }
      };
      source.onerror = () => {
        // EventSource gives up on HTTP errors and retries blindly on others; take
        // over both so the backoff is ours.
        source?.close();
        setConnected(false);
        if (!stopped && !agentStopped) timer = setTimeout(connect, reconnectDelay(attempt++));
      };
    };

    resubscribe.current = () => {
      attempt = 0;
      connect();
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      source?.close();
      resubscribe.current = () => {};
    };
  }, [token]);

  const postAnswer = useCallback(
    async (body: AnswerBody): Promise<AnswerOutcome> => {
      if (!token) return "invalid";
      const res = await fetch(`/answer?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const outcome = answerOutcome(res.status);
      // Someone else answered first (another tab, or the agent moved on): reconnect,
      // and the server sends the state as it is now.
      if (outcome === "stale") resubscribe.current();
      return outcome;
    },
    [token],
  );

  return { state, connected, hasToken: token !== null, postAnswer };
}
