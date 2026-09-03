"use client";

export function Stepper({
  activeStep,
  canStep2,
  canStep3,
  canStep4,
  onStep,
  compact = false,
}: {
  activeStep: 1 | 2 | 3 | 4;
  canStep2: boolean;
  canStep3: boolean;
  canStep4: boolean;
  onStep: (step: 1 | 2 | 3 | 4) => void;
  compact?: boolean;
}) {
  return (
    <div className={`stepper ${compact ? "compact" : ""}`} role="tablist" aria-label="Setup steps">
      <button
        type="button"
        className={`step ${activeStep > 1 ? "done" : ""} ${activeStep === 1 ? "active" : ""}`}
        onClick={() => onStep(1)}
        aria-current={activeStep === 1 ? "step" : undefined}
      >
        <span className="step-dot">1</span>
        <span className="step-label">Import JSON</span>
      </button>
      <button
        type="button"
        className={`step ${activeStep > 2 ? "done" : ""} ${activeStep === 2 ? "active" : ""}`}
        onClick={() => onStep(2)}
        disabled={!canStep2}
        aria-current={activeStep === 2 ? "step" : undefined}
      >
        <span className="step-dot">2</span>
        <span className="step-label">Board &amp; List</span>
      </button>
      <button
        type="button"
        className={`step ${activeStep > 3 ? "done" : ""} ${activeStep === 3 ? "active" : ""}`}
        onClick={() => onStep(3)}
        disabled={!canStep3}
        aria-current={activeStep === 3 ? "step" : undefined}
      >
        <span className="step-dot">3</span>
        <span className="step-label">Review Cards</span>
      </button>
      <button
        type="button"
        className={`step ${activeStep > 4 ? "done" : ""} ${activeStep === 4 ? "active" : ""}`}
        onClick={() => onStep(4)}
        disabled={!canStep4}
        aria-current={activeStep === 4 ? "step" : undefined}
      >
        <span className="step-dot">4</span>
        <span className="step-label">Commit</span>
      </button>
    </div>
  );
}
