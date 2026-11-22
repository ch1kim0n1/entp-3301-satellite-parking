import type { ButtonHTMLAttributes, ForwardRefExoticComponent, RefAttributes } from "react";
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "crisis";
  busy?: boolean;
  busyLabel?: string;
  sharp?: boolean;
  iconOnly?: boolean;
};
export const Button: ForwardRefExoticComponent<ButtonProps & RefAttributes<HTMLButtonElement>>;
