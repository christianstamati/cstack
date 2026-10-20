import { expect, test } from "vite-plus/test";

import type { PlanView, TownOption } from "../src/town/protocol.ts";
import { AgentStoppedError, TownStore } from "../src/town/store.ts";

const opt = (id: string): TownOption => ({ id, label: id });
const frontendQ = {
  slot: "frontend" as const,
  question: "Frontend?",
  options: [opt("nextjs"), opt("tanstack-start")],
  multiSelect: false,
  freeText: false,
};
const plan: PlanView = { rows: [], tree: "", generators: [], manualSteps: [] };

test("ask waits for the matching answer and places a building", async () => {
  const store = new TownStore("my-app");
  const result = store.ask(frontendQ);
  const id = store.getState().pending!.id;
  expect(store.answer({ questionId: id, optionIds: ["nextjs"] })).toBe("ok");
  await expect(result).resolves.toEqual({ optionIds: ["nextjs"] });
  expect(store.getState().placements.frontend).toMatchObject({
    optionIds: ["nextjs"],
    auto: false,
  });
  expect(store.getState().pending).toBeNull();
});

test("re-answering a slot swaps the building", async () => {
  const store = new TownStore("my-app");
  const first = store.ask(frontendQ);
  store.answer({ questionId: store.getState().pending!.id, optionIds: ["nextjs"] });
  await first;
  const second = store.ask(frontendQ);
  store.answer({ questionId: store.getState().pending!.id, optionIds: ["tanstack-start"] });
  await second;
  expect(store.getState().placements.frontend?.optionIds).toEqual(["tanstack-start"]);
});

test("parallel asks queue and resolve in order", async () => {
  const store = new TownStore("my-app");
  const a = store.ask(frontendQ);
  const b = store.ask({ ...frontendQ, slot: "api", question: "API?", options: [opt("rest")] });
  const first = store.getState().pending!;
  expect(first.question).toBe("Frontend?");
  store.answer({ questionId: first.id, optionIds: ["nextjs"] });
  await a;
  const second = store.getState().pending!;
  expect(second.question).toBe("API?");
  expect(second.id).not.toBe(first.id);
  store.answer({ questionId: second.id, optionIds: ["rest"] });
  await expect(b).resolves.toEqual({ optionIds: ["rest"] });
  expect(store.getState().pending).toBeNull();
});

test("stale and invalid answers change nothing", () => {
  const store = new TownStore("my-app");
  void store.ask(frontendQ);
  const id = store.getState().pending!.id;
  expect(store.answer({ questionId: "nope", optionIds: ["nextjs"] })).toBe("stale");
  expect(store.answer({ questionId: id, optionIds: ["bogus"] })).toBe("invalid");
  expect(store.answer({ questionId: id, optionIds: ["nextjs", "tanstack-start"] })).toBe("invalid");
  expect(store.answer({ questionId: id, optionIds: [] })).toBe("invalid");
  expect(store.getState().pending?.id).toBe(id);
  expect(store.getState().placements.frontend).toBeUndefined();

  void store.ask({ ...frontendQ, slot: null, multiSelect: true, freeText: true });
  expect(store.answer({ questionId: id, optionIds: ["nextjs"] })).toBe("ok");
  const multiId = store.getState().pending!.id;
  expect(store.answer({ questionId: multiId, optionIds: [], text: "   " })).toBe("invalid");
  expect(store.answer({ questionId: multiId, optionIds: [], text: "hello" })).toBe("ok");
});

test("multi-select needs at least one id and accepts several", async () => {
  const store = new TownStore("my-app");
  const r = store.ask({ ...frontendQ, slot: "extras", multiSelect: true });
  const id = store.getState().pending!.id;
  expect(store.answer({ questionId: id, optionIds: [] })).toBe("invalid");
  expect(store.answer({ questionId: id, optionIds: ["nextjs", "tanstack-start"] })).toBe("ok");
  await expect(r).resolves.toEqual({ optionIds: ["nextjs", "tanstack-start"] });
});

test("a free-text answer resolves with the text", async () => {
  const store = new TownStore("my-app");
  const r = store.ask({
    slot: null,
    question: "Name?",
    options: [],
    multiSelect: false,
    freeText: true,
  });
  store.answer({ questionId: store.getState().pending!.id, optionIds: [], text: " Acme " });
  await expect(r).resolves.toEqual({ optionIds: [], text: "Acme" });
});

test("a no-slot question places nothing", async () => {
  const store = new TownStore("my-app");
  const r = store.ask({ ...frontendQ, slot: null });
  store.answer({ questionId: store.getState().pending!.id, optionIds: ["nextjs"] });
  await r;
  expect(store.getState().placements).toEqual({});
});

test("decide places an auto building", () => {
  const store = new TownStore("my-app");
  store.decide({
    slot: "database",
    optionIds: ["convex"],
    labels: ["Built into Convex"],
    reason: "Convex",
  });
  expect(store.getState().placements.database).toMatchObject({ auto: true, reason: "Convex" });
});

test("decide accepts an empty optionIds for slots that do not apply", () => {
  const store = new TownStore("my-app");
  store.decide({ slot: "dbHost", optionIds: [], labels: ["Not needed"], reason: "No database" });
  expect(store.getState().placements.dbHost).toEqual({
    slot: "dbHost",
    optionIds: [],
    labels: ["Not needed"],
    auto: true,
    reason: "No database",
  });
});

test("plan moves to the plan phase and returns build or change", async () => {
  const store = new TownStore("my-app");
  const built = store.showPlan(plan);
  expect(store.getState().phase).toBe("plan");
  expect(store.getState().plan).toEqual(plan);
  expect(store.answer({ questionId: "plan", action: "build" })).toBe("ok");
  await expect(built).resolves.toEqual({ action: "build" });
  expect(store.getState().phase).toBe("build");

  const changed = store.showPlan(plan);
  expect(store.answer({ questionId: "plan", action: "change", slot: "nope" as never })).toBe(
    "invalid",
  );
  expect(store.answer({ questionId: "plan", action: "change", slot: "deploy" })).toBe("ok");
  await expect(changed).resolves.toEqual({ action: "change", slot: "deploy" });
  expect(store.getState().phase).toBe("interview");
});

test("a plan answer with no plan pending is stale", () => {
  const store = new TownStore("my-app");
  expect(store.answer({ questionId: "plan", action: "build" })).toBe("stale");
});

test("progress, report and status update state and lastAgentActivity", () => {
  let t = 100;
  const store = new TownStore("my-app", () => t);
  expect(store.getState().lastAgentActivity).toBe(100);
  t = 200;
  store.progress({ name: "scaffold", slots: ["frontend"], status: "started" });
  expect(store.getState().steps).toHaveLength(1);
  expect(store.getState().lastAgentActivity).toBe(200);
  t = 300;
  store.setStatus("thinking");
  expect(store.getState().status).toBe("thinking");
  expect(store.getState().lastAgentActivity).toBe(300);
  t = 400;
  store.report({ built: ["a"], commands: [], manualSteps: [], unverified: [] });
  expect(store.getState().report?.built).toEqual(["a"]);
  expect(store.getState().phase).toBe("done");
  expect(store.getState().lastAgentActivity).toBe(400);
});

test("progress moves the interview or plan phase to build", () => {
  const store = new TownStore("my-app");
  store.progress({ name: "scaffold", slots: [], status: "started" });
  expect(store.getState().phase).toBe("build");

  const planned = new TownStore("my-app");
  void planned.showPlan(plan);
  planned.progress({ name: "scaffold", slots: [], status: "started" });
  expect(planned.getState().phase).toBe("build");
});

test("agentStopped rejects pending calls and marks the state", async () => {
  const store = new TownStore("my-app");
  const pending = store.ask(frontendQ);
  const queued = store.ask(frontendQ);
  const planned = store.showPlan(plan);
  store.agentStopped();
  await expect(pending).rejects.toBeInstanceOf(AgentStoppedError);
  await expect(queued).rejects.toBeInstanceOf(AgentStoppedError);
  await expect(planned).rejects.toBeInstanceOf(AgentStoppedError);
  expect(store.getState().agentStopped).toBe(true);
  expect(store.getState().pending).toBeNull();
});

test("subscribers get a snapshot on every change", () => {
  const store = new TownStore("my-app");
  let calls = 0;
  const unsubscribe = store.subscribe(() => calls++);
  store.setStatus("a");
  store.decide({ slot: "database", optionIds: ["convex"], labels: ["Convex"], reason: "r" });
  expect(calls).toBe(2);
  const snap = store.getState();
  store.setStatus("b");
  expect(snap.status).toBe("a");
  unsubscribe();
  store.setStatus("c");
  expect(calls).toBe(3);
});

test("an aborted ask is withdrawn and the next question becomes pending", async () => {
  const store = new TownStore("my-app");
  const controller = new AbortController();
  const first = store.ask(frontendQ, controller.signal);
  const second = store.ask({ ...frontendQ, question: "Second?" });
  const firstResult = expect(first).rejects.toThrow("cancelled");
  controller.abort();
  await firstResult;
  expect(store.getState().pending?.question).toBe("Second?");
  store.answer({ questionId: store.getState().pending!.id, optionIds: ["nextjs"] });
  await second;
  expect(store.getState().pending).toBeNull();
});

test("an already aborted ask is not queued", async () => {
  const store = new TownStore("my-app");
  await expect(store.ask(frontendQ, AbortSignal.abort())).rejects.toThrow("cancelled");
  expect(store.getState().pending).toBeNull();
});

test("an aborted plan is withdrawn", async () => {
  const store = new TownStore("my-app");
  const controller = new AbortController();
  const result = expect(store.showPlan(plan, controller.signal)).rejects.toThrow("cancelled");
  controller.abort();
  await result;
  expect(store.answer({ questionId: "plan", action: "build" })).toBe("stale");
});

test("a question that cannot be answered is refused", () => {
  const store = new TownStore("my-app");
  expect(() => store.ask({ ...frontendQ, options: [] })).toThrow("options");
  expect(() => store.ask({ ...frontendQ, options: [opt("a"), opt("a")] })).toThrow("unique");
  expect(store.getState().pending).toBeNull();
  void store.ask({ ...frontendQ, options: [], freeText: true });
});
