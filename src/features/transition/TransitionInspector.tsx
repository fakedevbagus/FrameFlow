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

const transitionOptions = [
  {
    value: "none",
    label: "None",
    description: "No visual transition.",
  },
  {
    value: "dissolve",
    label: "Dissolve",
    description: "Blend the outgoing and incoming visuals.",
  },
  {
    value: "fade-through-black",
    label: "Fade through black",
    description: "Fade to black before revealing the next clip.",
  },
] as const;

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

  function handleTransitionTypeChange(value: string) {
    switch (value) {
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

      <div
        aria-label="Transition browser"
        className="inspector-transition-picker"
        role="group"
      >
        {transitionOptions.map((option) => {
          const isSelected = transitionType === option.value;
          const isTransitionOption = option.value !== "none";
          const disabled = isTransitionOption && !canTransition;
          const descriptionId = "transition-option-description-" + option.value;

          return (
            <button
              aria-describedby={descriptionId}
              aria-label={option.label}
              aria-pressed={isSelected}
              className="inspector-transition-picker-button"
              disabled={disabled}
              key={option.value}
              onClick={() => handleTransitionTypeChange(option.value)}
              title={option.description}
              type="button"
            >
              <strong>{option.label}</strong>
              <span id={descriptionId}>{option.description}</span>
            </button>
          );
        })}
      </div>

      <label className="inspector-keyframe-easing">
        <span>Type</span>
        <select
          aria-label="Transition type"
          disabled={!canTransition && transitionType === "none"}
          value={transitionType}
          onChange={(event) =>
            handleTransitionTypeChange(event.currentTarget.value)
          }
        >
          {transitionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
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
