import type { FocusEvent } from "react";
import {
  DEFAULT_DISSOLVE_DURATION_MS,
  type ClipTransition,
} from "./transition";

interface TransitionInspectorProps {
  canTransition: boolean;
  transition?: ClipTransition;
  onChange: (transition: ClipTransition | undefined) => void;
}

export function TransitionInspector({
  canTransition,
  transition,
  onChange,
}: TransitionInspectorProps) {
  const transitionType = transition?.type ?? "none";
  const durationMs = transition?.durationMs ?? DEFAULT_DISSOLVE_DURATION_MS;

  function commitDuration(event: FocusEvent<HTMLInputElement>) {
    const value = Number(event.currentTarget.value);

    if (!Number.isFinite(value)) {
      event.currentTarget.value = String(durationMs);
      return;
    }

    onChange({
      type:
        transitionType === "fade-through-black"
          ? "fade-through-black"
          : "dissolve",
      durationMs: value,
    });
  }

  return (
    <div className="inspector-section">
      <div className="inspector-section-header">
        <div className="inspector-section-title-group">
          <span className="inspector-section-title">Transition</span>
          <span className="inspector-keyframe-count">Out</span>
        </div>
      </div>

      <p className="inspector-help">
        {canTransition
          ? "Applies between this clip and the next adjacent visual clip."
          : transitionType !== "none"
            ? "This transition is currently inactive because the next visual clip is not adjacent."
            : "Place another visual clip directly after this clip to enable a transition."}
      </p>

      <label className="inspector-keyframe-easing">
        <span>Type</span>
        <select
          aria-label="Transition type"
          disabled={!canTransition && transitionType === "none"}
          value={transitionType}
          onChange={(event) => {
            switch (event.currentTarget.value) {
              case "dissolve":
                onChange({
                  type: "dissolve",
                  durationMs,
                });
                break;
              case "fade-through-black":
                onChange({
                  type: "fade-through-black",
                  durationMs,
                });
                break;
              default:
                onChange(undefined);
            }
          }}
        >
          <option value="none">None</option>
          <option value="dissolve">Dissolve</option>
          <option value="fade-through-black">Fade through black</option>
        </select>
      </label>

      {transitionType !== "none" ? (
        <label className="inspector-transform-field">
          <span>Duration</span>
          <div className="inspector-transform-input-wrap">
            <input
              aria-label="Transition duration"
              className="inspector-transform-input"
              max="2000"
              min="50"
              step="50"
              key={String(transition?.durationMs ?? "default")}
              type="number"
              disabled={!canTransition}
              defaultValue={durationMs}
              onBlur={commitDuration}
            />
            <span>ms</span>
          </div>
        </label>
      ) : null}
    </div>
  );
}
