// Shapes shared by the town server, the MCP tools and the browser page.
// No Node imports: the page bundles this file.
import type { SlotId } from "./catalog.ts";

export interface TownOption {
  id: string;
  label: string;
  description?: string;
  recommended?: boolean;
}

export interface Question {
  id: string;
  /** The slot this question fills, or null when it isn't a stack choice. */
  slot: SlotId | null;
  question: string;
  quip?: string;
  options: TownOption[];
  multiSelect: boolean;
  freeText: boolean;
}

export interface Placement {
  slot: SlotId;
  optionIds: string[];
  labels: string[];
  /** True when the agent settled this without asking. */
  auto: boolean;
  reason?: string;
  /** The order slots were placed in (0, 1, 2, …). Re-answering keeps it; a slot that
   * gains a building (from nothing or "not needed") gets a fresh one. */
  seq: number;
  /** The town block this slot was given (0 = the central one, then outward), or null if it
   * never had one. Set by the store, never handed out twice, and kept when the slot turns
   * "not needed" (the block stays, empty), so nothing ever moves. */
  lot: number | null;
}

export interface PlanView {
  rows: { label: string; value: string; auto: boolean }[];
  tree: string;
  generators: string[];
  manualSteps: string[];
}

export interface BuildStep {
  name: string;
  slots: SlotId[];
  status: "started" | "done" | "failed";
  message?: string;
}

export interface ReportView {
  built: string[];
  commands: string[];
  manualSteps: { slot: SlotId | null; text: string }[];
  unverified: string[];
}

export type Phase = "interview" | "plan" | "build" | "done";

export interface TownState {
  projectName: string;
  phase: Phase;
  placements: Partial<Record<SlotId, Placement>>;
  pending: Question | null;
  plan: PlanView | null;
  steps: BuildStep[];
  report: ReportView | null;
  status: string | null;
  lastAgentActivity: number;
  agentStopped: boolean;
}

export type AnswerBody =
  | { questionId: string; optionIds: string[]; text?: string }
  | { questionId: "plan"; action: "build" }
  | { questionId: "plan"; action: "change"; slot: SlotId };
