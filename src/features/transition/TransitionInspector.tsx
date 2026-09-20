import { useEffect, useState } from "react";
import type { ClipTransition } from "./transition";
import { DEFAULT_DISSOLVE_DURATION_MS } from "./transition";

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
  const isDissolve = transition?.type === "dissolve";
  const [durationMs, setDurationMs] = useState(
    transition?.durationMs ?? DEFAULT_DISSOLVE_DURATION_MS,
  );

  useEffect(() => {
    setDurationMs(
      transition?.durationMs ?? DEFAULT_DISSOLVE_DURATION_MS,
    );
  }, [transition?.durationMs]);

  function commitDuration() {
    const value = Number(durationMs);

    if (!Number.isFinite(value)) {
      setDurationMs(
        transition?.durationMs ?? DEFAULT_DISSOLVE_DURATION_MS,
      );
      return;
    }

    onChange({
      type: "dissolve",
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
          : "Place another visual clip directly after this clip to enable a transition."}
      </p>

      <label className="inspector-keyframe-easing">
        <span>Type</span>
        <select
          aria-label="Transition type"
          disabled={!canTransition}
          value={isDissolve ? "dissolve" : "none"}
          onChange={(event) => {
            onChange(
              event.currentTarget.value === "dissolve"
                ? {
                    type: "dissolve",
                    durationMs,
                  }
                : undefined,
            );
          }}
        >
          <option value="none">None</option>
          <option value="dissolve">Dissolve</option>
        </select>
      </label>

      {isDissolve ? (
        <label className="inspector-transform-field">
          <span>Duration</span>
          <div className="inspector-transform-input-wrap">
            <input
              aria-label="Transition duration"
              className="inspector-transform-input"
              max="2000"
              min="50"
              step="50"
              type="number"
              value={durationMs}
              onChange={(event) => {
                setDurationMs(
                  Number.isFinite(Number(event.currentTarget.value))
                    ? Number(event.currentTarget.value)
                    : DEFAULT_DISSOLVE_DURATION_MS,
                );
              }}
              onBlur={commitDuration}
            />
            <span>ms</span>
          </div>
        </label>
      ) : null}
    </div>
  );
}
