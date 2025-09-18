import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getStatCardColors, type StatCardType } from "@/styles/tokens";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  type: StatCardType;
  clickable?: boolean;
  onClick?: () => void;
  badge?: {
    text: string;
    variant?: "default" | "destructive" | "outline" | "secondary";
  };
  className?: string;
  testId?: string;
}

/**
 * StatCard - A reusable card component for displaying dashboard statistics
 * 
 * Features:
 * - Consistent color scheme based on stat type using design tokens
 * - Optional click handling for navigation
 * - Optional badge for additional context (e.g., "Urgent" for overdue items)
 * - Proper accessibility and test attributes
 * 
 * @param title - The stat title/label
 * @param value - The numeric value to display
 * @param icon - Lucide icon component to display
 * @param type - Stat type which determines the color scheme
 * @param clickable - Whether the card should show hover effects and be clickable
 * @param onClick - Click handler function
 * @param badge - Optional badge configuration
 * @param className - Additional CSS classes
 * @param testId - Test ID for testing
 */
export function StatCard({
  title,
  value,
  icon: Icon,
  type,
  clickable = false,
  onClick,
  badge,
  className,
  testId
}: StatCardProps) {
  const colors = getStatCardColors(type);
  
  return (
    <Card 
      data-testid={testId}
      className={cn(
        "bg-background-card rounded-card shadow-card border-0",
        clickable && "hover-elevate cursor-pointer",
        className
      )}
      onClick={clickable ? onClick : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-text-muted">
          {title}
        </CardTitle>
        <div className={cn("p-2 rounded-button", colors.background)}>
          <Icon className={cn("h-4 w-4", colors.icon)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <div 
            className="text-2xl font-bold text-text" 
            data-testid={testId ? `${testId}-value` : undefined}
          >
            {value}
          </div>
          {badge && (
            <Badge variant={badge.variant || "default"} className="text-xs rounded-button">
              {badge.text}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}