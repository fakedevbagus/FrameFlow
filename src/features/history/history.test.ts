import { describe, expect, it } from "vitest";
import {
  commitHistory,
  createHistoryState,
  redoHistory,
  resetHistory,
  undoHistory,
} from "./history";

describe("history", () => {
  it("starts with no undo or redo entries", () => {
    const state = createHistoryState("A");

    expect(state).toMatchObject({
      past: [],
      present: "A",
      future: [],
    });
  });

  it("commits a change and clears redo history", () => {
    let state = createHistoryState("A");
    state = commitHistory(state, "B");
    state = commitHistory(state, "C");
    state = undoHistory(state);
    state = commitHistory(state, "D");

    expect(state.present).toBe("D");
    expect(state.past).toEqual(["A", "B"]);
    expect(state.future).toEqual([]);
  });

  it("undoes in reverse order and preserves redo order", () => {
    let state = createHistoryState("A");
    state = commitHistory(state, "B");
    state = commitHistory(state, "C");
    state = commitHistory(state, "D");

    state = undoHistory(state);
    expect(state.present).toBe("C");
    expect(state.past).toEqual(["A", "B"]);
    expect(state.future).toEqual(["D"]);

    state = undoHistory(state);
    expect(state.present).toBe("B");
    expect(state.past).toEqual(["A"]);
    expect(state.future).toEqual(["C", "D"]);

    state = redoHistory(state);
    expect(state.present).toBe("C");
    expect(state.past).toEqual(["A", "B"]);
    expect(state.future).toEqual(["D"]);
  });

  it("does nothing when undo or redo is unavailable", () => {
    const state = createHistoryState("A");

    expect(undoHistory(state)).toBe(state);
    expect(redoHistory(state)).toBe(state);
  });

  it("caps the history to the configured size", () => {
    let state = createHistoryState("A", 2);
    state = commitHistory(state, "B");
    state = commitHistory(state, "C");
    state = commitHistory(state, "D");

    expect(state.past).toEqual(["B", "C"]);
  });

  it("can reset history around a newly opened project", () => {
    let state = createHistoryState("A");
    state = commitHistory(state, "B");
    state = resetHistory("Opened");

    expect(state.present).toBe("Opened");
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
  });
});
