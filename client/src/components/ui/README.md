# UI Components

This directory contains reusable UI components built with Radix primitives and styled with Tailwind CSS. These components follow a consistent design system and provide accessibility out of the box.

## Components Overview

### Base Components (Radix-based)
All base components in this directory are built with [Radix UI](https://www.radix-ui.com/) primitives and styled using Tailwind CSS. They provide:
- Full keyboard navigation
- Focus management
- Screen reader support
- Customizable styling through CSS variables

### Custom Components

#### StatusBadge
A standardized badge component for displaying status and condition information with consistent colors.

**Usage:**
```tsx
import { StatusBadge } from "@/components/ui/status-badge";

// Equipment status
<StatusBadge status="active" />
<StatusBadge status="maintenance" />
<StatusBadge status="retired" />

// Equipment condition  
<StatusBadge status="excellent" />
<StatusBadge status="good" />
<StatusBadge status="fair" />
<StatusBadge status="poor" />

// Service types
<StatusBadge status="repair" />
<StatusBadge status="inspection" />
<StatusBadge status="warranty" />

// Variants
<StatusBadge status="active" variant="outline" />
```

**Props:**
- `status`: StatusType - The status/condition type
- `variant?`: "default" | "outline" - Visual variant
- `className?`: string - Additional CSS classes

#### StatCard
A reusable card component for displaying dashboard statistics with consistent styling and optional interactions.

**Usage:**
```tsx
import { StatCard } from "@/components/ui/stat-card";
import { Tractor } from "lucide-react";

<StatCard
  title="Total Mowers"
  value={42}
  icon={Tractor}
  type="totalMowers"
  clickable={true}
  onClick={() => navigate('/mowers')}
/>

// With badge
<StatCard
  title="Overdue Services"
  value={3}
  icon={AlertTriangle}
  type="overdue"
  clickable={true}
  badge={{ text: "Urgent", variant: "destructive" }}
/>
```

**Props:**
- `title`: string - Card title
- `value`: number - Numeric value to display
- `icon`: LucideIcon - Icon component
- `type`: StatCardType - Determines color scheme
- `clickable?`: boolean - Enable hover effects and clicks
- `onClick?`: () => void - Click handler
- `badge?`: object - Optional badge configuration
- `className?`: string - Additional CSS classes
- `testId?`: string - Test identifier

## Design System Integration

All components use design tokens from `@/styles/tokens` for consistent colors, spacing, and typography. This ensures:

- **Consistent theming** across light/dark modes
- **Centralized color management** for status/condition states
- **Easy customization** by updating tokens
- **Type safety** with TypeScript definitions

## Styling Guidelines

### Colors
Use semantic color tokens instead of hardcoded Tailwind classes:
```tsx
// ❌ Don't do this
<div className="bg-green-100 text-green-800">

// ✅ Do this  
import { getStatusColors } from "@/styles/tokens";
const colors = getStatusColors("active");
<div className={`${colors.background} ${colors.text}`}>
```

### Spacing & Sizing
Use design tokens for consistent spacing:
```tsx
import { spacing, sizing } from "@/styles/tokens";

// Icons
<Icon className={sizing.iconSm} /> // h-4 w-4
<Icon className={sizing.iconMd} /> // h-5 w-5

// Spacing in custom components
<div className="p-4 gap-2"> // Use Tailwind for standard spacing
```

### Typography
Use typography tokens for text styling:
```tsx
import { typography } from "@/styles/tokens";

<h1 className={`${typography["2xl"]} ${typography.bold}`}>
<p className={`${typography.sm} ${typography.normal}`}>
```

## Accessibility

All components follow WCAG guidelines:
- Proper ARIA attributes
- Keyboard navigation support
- Screen reader compatibility
- Sufficient color contrast
- Focus management

## Testing

Components include proper `data-testid` attributes for testing:
```tsx
<StatusBadge status="active" data-testid="status-badge" />
<StatCard testId="stat-total-mowers" />
```

## Extending Components

To extend existing components:

1. **Add new status types** - Update `src/styles/tokens.ts`
2. **Create component variants** - Use the `variant` prop pattern
3. **Custom styling** - Use the `className` prop with `cn()` utility
4. **New component types** - Follow the existing patterns with Radix primitives

## Dependencies

- **Radix UI** - Headless component primitives
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Icon library
- **clsx/cn** - Conditional className utility
- **class-variance-authority** - Component variant management