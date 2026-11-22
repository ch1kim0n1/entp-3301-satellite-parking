import React from "react";
import { Loader2 } from "lucide-react";

const VARIANTS = {
  primary: "border-transparent bg-signature text-canvas enabled:hover:bg-signature-pressed",
  secondary: "border-border-control bg-surface text-text-primary enabled:hover:bg-sunken",
  quiet: "border-transparent bg-transparent text-text-primary enabled:hover:bg-sunken",
  crisis: "border-border-default bg-error-tint text-text-primary enabled:hover:border-error",
};

export const Button = React.forwardRef(function Button({
  variant = "primary",
  disabled = false,
  busy = false,
  busyLabel = "Working…",
  sharp = false,
  iconOnly = false,
  className = "",
  children,
  onClick,
  "aria-disabled": ariaDisabled,
  ...props
}, ref) {
  const unavailable = disabled || busy || ariaDisabled === true || ariaDisabled === "true";
  const size = iconOnly ? "size-11" : "min-h-11 px-4 py-2";
  const appearance = unavailable
    ? "cursor-not-allowed border-transparent bg-disabled-surface text-disabled-text"
    : `cursor-pointer ${VARIANTS[variant]}`;

  return (
    <button
      {...props}
      ref={ref}
      disabled={disabled}
      aria-disabled={busy || ariaDisabled}
      aria-busy={busy || undefined}
      onClick={(event) => {
        if (unavailable) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={`button-press inline-flex shrink-0 items-center justify-center gap-2 border text-body-ui font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${sharp ? "rounded-none" : "rounded-lg"} ${size} ${appearance} ${className}`}
    >
      {busy ? (
        <span className="grid items-center justify-items-center">
          <span className="invisible col-start-1 row-start-1 inline-flex items-center justify-center gap-2">{children}</span>
          <span className="col-start-1 row-start-1 inline-flex items-center justify-center gap-2">
            <Loader2 size={16} aria-hidden="true" className="busy-indicator shrink-0" />
            <span className={iconOnly ? "sr-only" : undefined}>{busyLabel}</span>
          </span>
        </span>
      ) : children}
    </button>
  );
});
