/**
 * Design Tokens
 * 
 * Centralized design tokens for consistent styling across the application.
 * These tokens provide semantic meaning to colors, spacing, typography, and other design values.
 */

// Status and condition color mappings
export const statusColors = {
  // Equipment status colors
  active: {
    background: "bg-accent-teal/20",
    text: "text-accent-teal",
    border: "border-accent-teal/20",
  },
  maintenance: {
    background: "bg-accent-orange/10", 
    text: "text-accent-orange",
    border: "border-accent-orange/20",
  },
  retired: {
    background: "bg-text-muted/10",
    text: "text-text-muted", 
    border: "border-text-muted/20",
  },
  
  // Equipment condition colors
  excellent: {
    background: "bg-accent-teal/20",
    text: "text-accent-teal",
    border: "border-accent-teal/20",
  },
  good: {
    background: "bg-accent-teal-light/20", 
    text: "text-accent-teal-light",
    border: "border-accent-teal-light/20",
  },
  fair: {
    background: "bg-accent-orange/10",
    text: "text-accent-orange",
    border: "border-accent-orange/20",
  },
  poor: {
    background: "bg-accent-orange/20",
    text: "text-accent-orange",
    border: "border-accent-orange/30",
  },
  
  // Service type colors
  repair: {
    background: "bg-accent-orange/10",
    text: "text-accent-orange",
    border: "border-accent-orange/20",
  },
  inspection: {
    background: "bg-accent-card/20",
    text: "text-accent-teal", 
    border: "border-accent-teal/20",
  },
  warranty: {
    background: "bg-calendar-bg",
    text: "text-text-primary",
    border: "border-panel-border/20",
  },
} as const;

// Dashboard stat card colors
export const statCardColors = {
  totalMowers: {
    icon: "text-accent-teal",
    background: "bg-accent-teal/10",
  },
  active: {
    icon: "text-accent-teal", 
    background: "bg-accent-teal/10",
  },
  maintenance: {
    icon: "text-accent-orange",
    background: "bg-accent-orange/10", 
  },
  upcomingServices: {
    icon: "text-accent-teal-light",
    background: "bg-accent-teal-light/10",
  },
  overdue: {
    icon: "text-destructive",
    background: "bg-destructive/10",
  },
} as const;

// Typography scale
export const typography = {
  // Font sizes  
  xs: "text-xs",     // 12px
  sm: "text-sm",     // 14px
  base: "text-base", // 16px
  lg: "text-lg",     // 18px
  xl: "text-xl",     // 20px
  "2xl": "text-2xl", // 24px
  "3xl": "text-3xl", // 30px
  
  // Font weights
  fontNormal: "font-normal",   // 400
  medium: "font-medium",   // 500
  semibold: "font-semibold", // 600
  bold: "font-bold",       // 700
  
  // Line heights
  tight: "leading-tight",   // 1.25
  normal: "leading-normal", // 1.5
  relaxed: "leading-relaxed", // 1.625
} as const;

// Spacing scale (following Tailwind's spacing scale)
export const spacing = {
  xs: "0.25rem",    // 4px
  sm: "0.5rem",     // 8px  
  md: "1rem",       // 16px
  lg: "1.5rem",     // 24px
  xl: "2rem",       // 32px
  "2xl": "3rem",    // 48px
  "3xl": "4rem",    // 64px
} as const;

// Component sizing
export const sizing = {
  // Icon sizes
  iconSm: "h-4 w-4",   // 16px
  iconMd: "h-5 w-5",   // 20px
  iconLg: "h-6 w-6",   // 24px
  iconXl: "h-8 w-8",   // 32px
  
  // Avatar sizes
  avatarSm: "h-8 w-8",   // 32px
  avatarMd: "h-10 w-10", // 40px
  avatarLg: "h-12 w-12", // 48px
  
  // Card dimensions
  cardThumbnail: "h-48", // 192px
  cardMinHeight: "min-h-[120px]",
} as const;

// Animation durations
export const animation = {
  fast: "duration-150",     // 150ms
  normal: "duration-200",   // 200ms
  slow: "duration-300",     // 300ms
} as const;

// Helper function to get status color classes
export function getStatusColors(status: keyof typeof statusColors) {
  return statusColors[status] || statusColors.active;
}

// Helper function to get stat card colors
export function getStatCardColors(type: keyof typeof statCardColors) {
  return statCardColors[type] || statCardColors.totalMowers;
}

// Combined classes for common badge styling
export function getStatusBadgeClasses(status: keyof typeof statusColors) {
  const colors = getStatusColors(status);
  return `${colors.background} ${colors.text} px-2 py-1 rounded-md text-xs font-medium`;
}

// Type definitions for better TypeScript support
export type StatusType = keyof typeof statusColors;
export type StatCardType = keyof typeof statCardColors;
export type TypographySize = keyof typeof typography;
export type SpacingSize = keyof typeof spacing;
export type SizingType = keyof typeof sizing;
export type AnimationSpeed = keyof typeof animation;