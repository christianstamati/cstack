// The billboard: a lit board on two wooden posts at the side of the town, where the
// agent's questions, the plan and the final report appear. Which card it shows comes from
// `billboardCard`.
import type { ReactNode } from "react";

import type { TownState } from "../../../src/town/protocol.ts";
import { billboardCard, type BillboardCard } from "../logic.ts";
import type { Town } from "../use-town.ts";
import { PlanCard } from "./PlanCard.tsx";
import { QuestionCard } from "./QuestionCard.tsx";
import { ReportCard } from "./ReportCard.tsx";

type Props = {
  state: TownState;
  postAnswer: Town["postAnswer"];
  /** Move keyboard focus to a new card (false while the entry screen is up). */
  takeFocus: boolean;
};

function cardFor(card: BillboardCard | null, { state, postAnswer, takeFocus }: Props): ReactNode {
  switch (card) {
    case "question":
      // Keyed by question, so a new question starts with nothing ticked or typed.
      return (
        <QuestionCard
          key={state.pending!.id}
          question={state.pending!}
          postAnswer={postAnswer}
          takeFocus={takeFocus}
        />
      );
    case "plan":
      return (
        <PlanCard
          plan={state.plan!}
          placements={state.placements}
          postAnswer={postAnswer}
          takeFocus={takeFocus}
        />
      );
    case "report":
      return <ReportCard report={state.report!} takeFocus={takeFocus} />;
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
