// The billboard: a lit board on two wooden posts at the side of the town, where the
// agent's questions appear. Which card it shows comes from `billboardCard`.
import type { ReactNode } from "react";

import type { TownState } from "../../../src/town/protocol.ts";
import { billboardCard, type BillboardCard } from "../logic.ts";
import type { Town } from "../use-town.ts";
import { QuestionCard } from "./QuestionCard.tsx";

type Props = { state: TownState; postAnswer: Town["postAnswer"] };

function cardFor(card: BillboardCard | null, { state, postAnswer }: Props): ReactNode {
  switch (card) {
    case "question":
      // Keyed by question, so a new question starts with nothing ticked or typed.
      return (
        <QuestionCard key={state.pending!.id} question={state.pending!} postAnswer={postAnswer} />
      );
    // The plan card (Build it / Change something) and the report card go here.
    case "plan":
    case "report":
    case null:
      return null;
  }
}

export function Billboard(props: Props) {
  const content = cardFor(billboardCard(props.state), props);
  if (!content) return null;
  return (
    <aside className="billboard" aria-label="Billboard">
      <div className="billboard-lamps" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="billboard-board">{content}</div>
      <div className="billboard-posts" aria-hidden="true">
        <span />
        <span />
      </div>
    </aside>
  );
}
