import React from "react";
import { statusLooks } from "./status.js";

export function Notice({ tone = "data", title, children, live, sharp = false, className = "" }) {
  const { tint, iconColor, Glyph } = statusLooks[tone] ?? statusLooks.data;

  return (
    <div className={`flex items-start gap-3 border border-border-default p-4 text-text-primary ${sharp ? "" : "rounded-[var(--radius-card)]"} ${tint} ${className}`} role={live}>
      <Glyph size={16} strokeWidth={1.5} className={`mt-1 shrink-0 ${iconColor}`} aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="text-body-ui font-medium">{title}</p>}
        {children && <div className={`text-small ${title ? "mt-1" : ""}`}>{children}</div>}
      </div>
    </div>
  );
}
