import React from "react";

/**
 * Skeleton - loading placeholder geometry for the Affective kit.
 *
 * Rules (see README.md in this folder):
 *  - Fill is always `sunken`, one step down from the surface it sits on.
 *    No signature, no data, no status colors - a skeleton is not a state.
 *  - Pulse = `skeleton-pulse` motion recipe (foundations/motion). Opacity only,
 *    in phase. No shimmer, no stagger. Static under prefers-reduced-motion.
 *  - Never on crisis surfaces (static by design) or status pages.
 *  - Widths are deterministic (fixed percentages), never random - SSR and
 *    tests must render the same geometry twice.
 *
 * Accessibility: every block is aria-hidden. Wrap a loading region in
 * <SkeletonRegion label="Loading conversation"> so screen readers get one
 * announcement, not one per block. Skeletons never take focus.
 */

export function Skeleton({ className = "", ...props }) {
  return (
    <span
      aria-hidden="true"
      {...props}
      className={`block bg-sunken border border-border-default rounded-[var(--radius-sm)] skeleton-pulse ${className}`}
    />
  );
}

/**
 * SkeletonText - stacked text-line bars. Deterministic widths:
 * 100 / 92 / 78 / 64% by line index (last line shortest).
 * lines: number of bars. height: bar height in px (default 12 = body text bar).
 */
export function SkeletonText({ lines = 3, height = 12, className = "", ...props }) {
  const widths = ["100%", "92%", "78%", "64%"];
  return (
    <span aria-hidden="true" className={`block ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          style={{
            height,
            width: widths[Math.min(i, widths.length - 1)],
            marginBottom: i === lines - 1 ? 0 : "var(--space-2)",
          }}
        />
      ))}
    </span>
  );
}

/**
 * SkeletonRegion - accessibility wrapper. one status label so screen
 * readers get exactly one "loading" announcement for the whole region.
 */
export function SkeletonRegion({ label = "Loading", children, className = "", ...props }) {
  return (
    <div className={className} {...props}>
      <span role="status" className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/* ---- Compositions (geometry mirrors the real surfaces they stand in for) ---- */

/** One assistant turn: canvas bubble, border, 14px radius, 5px speaker corner. */
export function SkeletonBubbleAssistant({ lines = 2 }) {
  return (
    <div
      aria-hidden="true"
      className="max-w-[82%] rounded-[14px] rounded-bl-[5px] border border-border-default bg-surface p-3 px-4"
    >
      <SkeletonText lines={lines} />
    </div>
  );
}

/** One user turn: sunken bubble, right-aligned. Plain block - no inner line
 *  (line inside same-fill bubble merges into a blob; the bubble IS the placeholder). */
export function SkeletonBubbleUser() {
  return (
    <div className="flex justify-end">
      <div className="h-11 w-[232px] max-w-[82%] rounded-[14px] rounded-br-[5px] border border-border-default bg-sunken skeleton-pulse" />
    </div>
  );
}

/** Composer row: 44px input bar + send block (the only shape that reads as a control). */
export function SkeletonComposer() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-11 flex-1 rounded-[12px] border border-border-default bg-surface" />
      <div className="h-11 w-11 rounded-[12px] border border-border-default bg-sunken skeleton-pulse" />
    </div>
  );
}

/** ThreadSkeleton - stands in for the chat thread while the first turns load. */
export function ThreadSkeleton() {
  return (
    <SkeletonRegion label="Loading conversation">
      <div className="flex flex-col gap-3">
        <SkeletonBubbleAssistant lines={3} />
        <SkeletonBubbleUser />
        <SkeletonBubbleAssistant lines={2} />
      </div>
    </SkeletonRegion>
  );
}

/** RailSkeleton - stands in for the state rail (264px column). */
export function RailSkeleton() {
  return (
    <SkeletonRegion label="Loading state panel" className="w-[264px] p-4 flex flex-col gap-4">
      <div className="rounded-[10px] border border-border-default bg-surface p-4 flex flex-col gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-2 w-3/4" />
      </div>
      <div className="rounded-[10px] border border-border-default bg-surface p-4 flex flex-col gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-2 w-full" />
      </div>
    </SkeletonRegion>
  );
}

/** CardSkeleton - generic surface card: title + two lines. */
export function CardSkeleton({ lines = 2 }) {
  return (
    <div className="rounded-[10px] border border-border-default bg-surface p-5">
      <Skeleton className="h-3 w-1/3 mb-3" />
      <SkeletonText lines={lines} />
    </div>
  );
}
