import { Badge } from "@/components/ui/badge";
import { getStatusBadgeClasses, getStatusColors, type StatusType } from "@/styles/tokens";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  variant?: "default" | "outline";
}

/**
 * StatusBadge - A reusable badge component for displaying status/condition with consistent colors
 * 
 * Uses design tokens for consistent styling across different status types:
 * - Equipment status: active, maintenance, retired
 * - Equipment condition: excellent, good, fair, poor  
 * - Service types: repair, inspection, warranty
 * 
 * @param status - The status type which determines the color scheme
 * @param className - Additional CSS classes
 * @param variant - Badge variant (default uses solid colors, outline uses border style)
 */
export function StatusBadge({ status, className, variant = "default" }: StatusBadgeProps) {
  const colors = getStatusColors(status);
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  
  if (variant === "outline") {
    return (
      <Badge 
        variant="outline"
        className={cn(
          colors.text,
          colors.border,
          "border",
          className
        )}
      >
        {label}
      </Badge>
    );
  }
  
  return (
    <Badge 
      className={cn(
        getStatusBadgeClasses(status),
        className
      )}
    >
      {label}
    </Badge>
  );
}