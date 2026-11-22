import React from "react";
import { statusLooks } from "./status.js";

export function StatusTag({ status = "success", children, className = "", ...props }) {
  const { tint, iconColor, Glyph } = statusLooks[status] ?? statusLooks.success;
  return (
    <span
      {...props}
      className={`inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-1 text-small font-medium text-text-primary ${tint} ${className}`}
    >
      <Glyph size={16} strokeWidth={1.5} className={`${iconColor} shrink-0`} aria-hidden="true" />
      {children}
    </span>
  );
}
