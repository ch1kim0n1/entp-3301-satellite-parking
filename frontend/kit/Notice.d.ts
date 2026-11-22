import type { ReactNode } from "react";
export function Notice(props: {
  tone?: "success" | "warning" | "error" | "data";
  title?: string;
  children?: ReactNode;
  live?: "status" | "alert";
  sharp?: boolean;
  className?: string;
}): JSX.Element;
