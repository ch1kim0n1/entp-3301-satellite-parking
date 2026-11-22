import React from "react";

/** Pass a percentage from 0 to 100, or omit value while estimating progress. */
export function Progress({ label, value, className = "" }) {
  const id = React.useId();
  const percent = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : undefined;
  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-2 text-small">
        <span id={id} className="font-medium text-text-primary">{label}</span>
        <span className="text-text-secondary tabular-nums" aria-hidden="true">
          {percent === undefined ? "In progress" : `${Math.round(percent)}%`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={id}
        aria-valuenow={percent}
        className="flex h-2 overflow-hidden rounded-full border border-border-control bg-sunken"
      >
        {percent === undefined ? (
          <div className="progress-indeterminate h-full w-1/3 bg-data" />
        ) : (
          <div className="progress-update h-full w-full shrink-0 origin-left bg-data rtl:origin-right" style={{ transform: `scaleX(${percent / 100})` }} />
        )}
      </div>
    </div>
  );
}
