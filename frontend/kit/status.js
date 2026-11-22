import { CheckCircle, TriangleAlert, OctagonAlert, CircleAlert } from "lucide-react";

export const statusLooks = {
  success: { tint: "bg-success-tint", iconColor: "text-success", Glyph: CheckCircle },
  warning: { tint: "bg-warning-tint", iconColor: "text-warning", Glyph: TriangleAlert },
  error: { tint: "bg-error-tint", iconColor: "text-error", Glyph: OctagonAlert },
  data: { tint: "bg-data-tint", iconColor: "text-data", Glyph: CircleAlert },
};
