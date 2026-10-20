// In-memory state of one town session. Sits between the MCP tools (agent side)
// and the HTTP server (page side). No HTTP and no Node imports beyond the global
// `crypto`, so it can be shared later.
import { SLOTS, takesLot, type SlotId } from "./catalog.ts";
import type {
  AnswerBody,
  BuildStep,
  PlanView,
  Placement,
  Question,
  ReportView,
  TownState,
} from "./protocol.ts";

export class AgentStoppedError extends Error {
  constructor() {
    super("The agent stopped before the town was finished.");
    this.name = "AgentStoppedError";
  }
}

export type AskResult = { optionIds: string[]; text?: string };
export type PlanResult = { action: "build" } | { action: "change"; slot: SlotId };

interface QueuedQuestion {
  question: Question;
  resolve: (result: AskResult) => void;
  reject: (error: Error) => void;
}

interface PendingPlan {
  resolve: (result: PlanResult) => void;
  reject: (error: Error) => void;
}

const SLOT_IDS: ReadonlySet<string> = new Set(SLOTS.map((s) => s.id));

export class TownStore {
  private state: TownState;
  private readonly queue: QueuedQuestion[] = [];
  private pendingPlan: PendingPlan | null = null;
  private readonly listeners = new Set<(state: TownState) => void>();
  /** The seq the next newly placed slot gets, and the next block nobody has had. */
  private nextSeq = 0;
  private nextLot = 0;

  constructor(
    projectName: string,
    private readonly now: () => number = Date.now,
  ) {
    this.state = {
      projectName,
      phase: "interview",
      placements: {},
      pending: null,
      plan: null,
      steps: [],
      report: null,
      status: null,
      lastAgentActivity: now(),
      agentStopped: false,
    };
  }

  getState(): TownState {
    return structuredClone(this.state);
  }

  subscribe(listener: (state: TownState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Queues a question. If `signal` aborts before it is answered (the agent gave up
   * waiting), the question is withdrawn and the returned promise rejects.
   */
  ask(input: Omit<Question, "id">, signal?: AbortSignal): Promise<AskResult> {
    if (!input.freeText && input.options.length === 0) {
      throw new Error("A question needs options, or freeText: true.");
    }
    if (new Set(input.options.map((o) => o.id)).size !== input.options.length) {
      throw new Error("Option ids must be unique.");
    }
    this.touch();
    if (this.state.agentStopped) {
      this.emit();
      return Promise.reject(new AgentStoppedError());
    }
    const question: Question = { ...input, id: crypto.randomUUID() };
    if (signal?.aborted) return Promise.reject(new Error("The question was cancelled."));
    return new Promise<AskResult>((resolve, reject) => {
      const entry: QueuedQuestion = { question, resolve, reject };
      this.queue.push(entry);
      signal?.addEventListener(
        "abort",
        () => {
          const index = this.queue.indexOf(entry);
          if (index === -1) return;
          this.queue.splice(index, 1);
          this.syncPending();
          reject(new Error("The question was cancelled."));
          this.emit();
        },
        { once: true },
      );
      this.syncPending();
      this.emit();
    });
  }

  decide(input: { slot: SlotId; optionIds: string[]; labels: string[]; reason: string }): void {
    this.touch();
    this.state.placements[input.slot] = {
      slot: input.slot,
      optionIds: input.optionIds,
      labels: input.labels,
      auto: true,
      reason: input.reason,
      ...this.order(input.slot, input.optionIds),
    };
    this.emit();
  }

  showPlan(plan: PlanView, signal?: AbortSignal): Promise<PlanResult> {
    this.touch();
    if (this.state.agentStopped) {
      this.emit();
      return Promise.reject(new AgentStoppedError());
    }
    // A newer plan supersedes an unanswered one.
    this.pendingPlan?.reject(new Error("The plan was replaced by a newer one."));
    this.state.plan = plan;
    this.state.phase = "plan";
    if (signal?.aborted) return Promise.reject(new Error("The plan was cancelled."));
    return new Promise<PlanResult>((resolve, reject) => {
      const entry: PendingPlan = { resolve, reject };
      this.pendingPlan = entry;
      signal?.addEventListener(
        "abort",
        () => {
          if (this.pendingPlan !== entry) return;
          this.pendingPlan = null;
          reject(new Error("The plan was cancelled."));
        },
        { once: true },
      );
      this.emit();
    });
  }

  progress(step: BuildStep): void {
    this.touch();
    this.state.steps.push(step);
    if (this.state.phase === "interview" || this.state.phase === "plan") {
      this.state.phase = "build";
    }
    this.emit();
  }

  report(report: ReportView): void {
    this.touch();
    this.state.report = report;
    this.state.phase = "done";
    this.emit();
  }

  setStatus(text: string): void {
    this.touch();
    this.state.status = text;
    this.emit();
  }

  answer(body: AnswerBody): "ok" | "stale" | "invalid" {
    if (body.questionId === "plan") {
      return this.answerPlan(body);
    }
    const head = this.queue[0];
    if (!head || head.question.id !== body.questionId) return "stale";
    if (!("optionIds" in body)) return "invalid";
    const { question } = head;
    const { optionIds } = body;
    if (!Array.isArray(optionIds) || optionIds.some((id) => typeof id !== "string")) {
      return "invalid";
    }
    const known = new Set(question.options.map((o) => o.id));
    if (optionIds.some((id) => !known.has(id))) return "invalid";

    const text = typeof body.text === "string" ? body.text.trim() : undefined;
    if (question.freeText) {
      if (!text) return "invalid";
    } else if (question.multiSelect) {
      if (optionIds.length < 1) return "invalid";
    } else if (optionIds.length !== 1) {
      return "invalid";
    }

    this.queue.shift();
    // The agent was waiting on the user, not silent: its silence starts now.
    this.touch();
    if (question.slot) {
      const labels = optionIds.map((id) => question.options.find((o) => o.id === id)!.label);
      if (text) labels.push(text);
      const placement: Placement = {
        slot: question.slot,
        optionIds,
        labels,
        auto: false,
        ...this.order(question.slot, optionIds),
      };
      this.state.placements[question.slot] = placement;
    }
    this.syncPending();
    const result: AskResult = text ? { optionIds, text } : { optionIds };
    head.resolve(result);
    this.emit();
    return "ok";
  }

  /** The slot's seq and block for a new answer. A re-answer keeps its seq, unless it
   * gains a building (a fresh seq). A building gets the block the slot already had, else the
   * next block nobody has had; a slot keeps its block when it turns "not needed". */
  private order(slot: SlotId, optionIds: string[]): { seq: number; lot: number | null } {
    const previous = this.state.placements[slot];
    const real = takesLot(slot, optionIds);
    const gained = real && !(previous && takesLot(slot, previous.optionIds));
    const seq = previous && !gained ? previous.seq : this.nextSeq++;
    const lot = previous?.lot ?? (real ? this.nextLot++ : null);
    return { seq, lot };
  }

  agentStopped(): void {
    this.state.agentStopped = true;
    const error = new AgentStoppedError();
    for (const queued of this.queue.splice(0)) queued.reject(error);
    this.pendingPlan?.reject(error);
    this.pendingPlan = null;
    this.state.pending = null;
    this.emit();
  }

  private answerPlan(body: AnswerBody): "ok" | "stale" | "invalid" {
    if (!this.pendingPlan) return "stale";
    if (!("action" in body)) return "invalid";
    let result: PlanResult;
    if (body.action === "build") {
      result = { action: "build" };
      this.state.phase = "build";
    } else if (body.action === "change" && SLOT_IDS.has(body.slot)) {
      result = { action: "change", slot: body.slot };
      this.state.phase = "interview";
    } else {
      return "invalid";
    }
    const { resolve } = this.pendingPlan;
    this.pendingPlan = null;
    // As for an answer: the agent's silence starts with the user's decision.
    this.touch();
    resolve(result);
    this.emit();
    return "ok";
  }

  private syncPending(): void {
    this.state.pending = this.queue[0]?.question ?? null;
  }

  private touch(): void {
    this.state.lastAgentActivity = this.now();
  }

  private emit(): void {
    if (this.listeners.size === 0) return;
    const snapshot = this.getState();
    for (const listener of this.listeners) listener(snapshot);
  }
}
