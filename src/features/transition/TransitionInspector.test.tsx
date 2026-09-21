import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TransitionInspector } from "./TransitionInspector";

describe("TransitionInspector", () => {
  it("renders a transition picker with the available transition types", () => {
    render(
      <TransitionInspector canTransition={true} onChange={vi.fn()} />,
    );

    expect(
      screen.getByRole("group", { name: "Transition browser" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "None" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Dissolve" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Fade through black" }),
    ).toBeEnabled();
  });

  it("selects a transition through the picker while preserving duration", () => {
    const onChange = vi.fn();

    render(
      <TransitionInspector
        canTransition={true}
        transition={{ type: "dissolve", durationMs: 600 }}
        onChange={onChange}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Dissolve" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(
      screen.getByRole("button", { name: "Fade through black" }),
    );

    expect(onChange).toHaveBeenCalledWith({
      type: "fade-through-black",
      durationMs: 600,
    });
  });

  it("disables adding transitions when clips are not eligible but keeps removal available", () => {
    const onChange = vi.fn();

    render(
      <TransitionInspector
        canTransition={false}
        transition={{ type: "dissolve", durationMs: 600 }}
        onChange={onChange}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Dissolve" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Fade through black" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "None" }),
    ).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "None" }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("keeps the active transition selected while duration is edited", () => {
    const onChange = vi.fn();

    render(
      <TransitionInspector
        canTransition={true}
        transition={{ type: "fade-through-black", durationMs: 300 }}
        onChange={onChange}
      />,
    );

    const duration = screen.getByRole("spinbutton", {
      name: "Transition duration",
    });

    fireEvent.change(duration, { target: { value: "900" } });
    fireEvent.blur(duration);

    expect(
      screen.getByRole("button", { name: "Fade through black" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(onChange).toHaveBeenCalledWith({
      type: "fade-through-black",
      durationMs: 900,
    });
  });
});
