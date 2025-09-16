# Design Tokens Documentation

## Overview

The design tokens system provides centralized management of design values including colors, spacing, typography, and component sizing. This ensures consistency across the application and makes it easy to maintain and extend the design system.

## File Location
`client/src/styles/tokens.ts`

## Available Token Categories

### Status Colors (`statusColors`)
Semantic color mappings for different status and condition types:

```typescript
// Equipment statuses
statusColors.active      // Green theme for active equipment
statusColors.maintenance // Orange theme for maintenance
statusColors.retired     // Gray theme for retired equipment

// Equipment conditions  
statusColors.excellent   // Green theme for excellent condition
statusColors.good        // Blue theme for good condition
statusColors.fair        // Yellow theme for fair condition
statusColors.poor        // Red theme for poor condition

// Service types
statusColors.repair      // Red theme for repairs
statusColors.inspection  // Green theme for inspections  
statusColors.warranty    // Purple theme for warranty work
```

Each status color includes:
- `background` - Background color class
- `text` - Text color class
- `border` - Border color class

### Stat Card Colors (`statCardColors`)
Color schemes for dashboard statistics cards:

```typescript
statCardColors.totalMowers     // Blue theme
statCardColors.active          // Green theme
statCardColors.maintenance     // Orange theme
statCardColors.upcomingServices // Purple theme
statCardColors.overdue         // Red theme
```

### Typography (`typography`)
Text styling utilities:

```typescript
// Font sizes
typography.xs, typography.sm, typography.base, 
typography.lg, typography.xl, typography["2xl"], typography["3xl"]

// Font weights
typography.fontNormal, typography.medium, 
typography.semibold, typography.bold

// Line heights
typography.tight, typography.normal, typography.relaxed
```

### Spacing (`spacing`)
Consistent spacing values:

```typescript
spacing.xs    // 0.25rem (4px)
spacing.sm    // 0.5rem (8px)
spacing.md    // 1rem (16px) 
spacing.lg    // 1.5rem (24px)
spacing.xl    // 2rem (32px)
spacing["2xl"] // 3rem (48px)
spacing["3xl"] // 4rem (64px)
```

### Sizing (`sizing`)
Component and element sizing:

```typescript
// Icons
sizing.iconSm, sizing.iconMd, sizing.iconLg, sizing.iconXl

// Avatars  
sizing.avatarSm, sizing.avatarMd, sizing.avatarLg

// Cards
sizing.cardThumbnail, sizing.cardMinHeight
```

### Animation (`animation`)
Duration utilities:

```typescript
animation.fast    // duration-150 (150ms)
animation.normal  // duration-200 (200ms)
animation.slow    // duration-300 (300ms)
```

## Helper Functions

### `getStatusColors(status: StatusType)`
Returns the color object for a given status:

```typescript
import { getStatusColors } from "@/styles/tokens";

const colors = getStatusColors("active");
// Returns: { background: "bg-green-100...", text: "text-green-800...", border: "border-green-200..." }
```

### `getStatCardColors(type: StatCardType)`
Returns colors for stat card types:

```typescript
import { getStatCardColors } from "@/styles/tokens";

const colors = getStatCardColors("totalMowers");
// Returns: { icon: "text-blue-600", background: "bg-blue-100..." }
```

### `getStatusBadgeClasses(status: StatusType)`
Returns complete badge classes:

```typescript
import { getStatusBadgeClasses } from "@/styles/tokens";

const classes = getStatusBadgeClasses("active");
// Returns: "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 px-2 py-1 rounded-md text-xs font-medium"
```

## Usage Examples

### Using Status Colors in Components

```typescript
import { getStatusColors } from "@/styles/tokens";

function CustomStatusIndicator({ status }: { status: StatusType }) {
  const colors = getStatusColors(status);
  
  return (
    <div className={`${colors.background} ${colors.text} p-2 rounded`}>
      Status: {status}
    </div>
  );
}
```

### Using Typography Tokens

```typescript
import { typography } from "@/styles/tokens";

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h1 className={`${typography["2xl"]} ${typography.bold} ${typography.tight}`}>
      {children}
    </h1>
  );
}
```

### Using Sizing Tokens

```typescript
import { sizing } from "@/styles/tokens";
import { User } from "lucide-react";

function UserIcon({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? sizing.iconSm : 
                    size === "lg" ? sizing.iconLg : sizing.iconMd;
  
  return <User className={sizeClass} />;
}
```

## Extending the Design System

### Adding New Status Types

1. **Add to `statusColors` object:**
```typescript
export const statusColors = {
  // ... existing statuses
  newStatus: {
    background: "bg-purple-100 dark:bg-purple-900/20",
    text: "text-purple-800 dark:text-purple-400", 
    border: "border-purple-200 dark:border-purple-800",
  },
} as const;
```

2. **Update the TypeScript type:**
```typescript
export type StatusType = keyof typeof statusColors;
```

3. **Use in components:**
```typescript
<StatusBadge status="newStatus" />
```

### Adding New Stat Card Types

```typescript
export const statCardColors = {
  // ... existing types
  newMetric: {
    icon: "text-indigo-600",
    background: "bg-indigo-100 dark:bg-indigo-900/20",
  },
} as const;
```

### Adding New Sizing Options

```typescript
export const sizing = {
  // ... existing sizes
  buttonSm: "h-8 px-3",
  buttonMd: "h-10 px-4", 
  buttonLg: "h-12 px-6",
} as const;
```

## Best Practices

### Do's ✅
- **Use semantic tokens** instead of hardcoded colors
- **Leverage helper functions** for consistent application
- **Extend tokens** for new use cases rather than hardcoding
- **Follow the naming convention** (background, text, border)
- **Test in both light and dark themes** when adding new colors

### Don'ts ❌
- **Don't hardcode Tailwind colors** directly in components
- **Don't create one-off color schemes** - extend the tokens instead
- **Don't bypass the type system** - use the provided TypeScript types
- **Don't mix different color schemes** in the same component

### Example: Wrong vs Right

```typescript
// ❌ Wrong: Hardcoded colors
<div className="bg-green-100 text-green-800">Active</div>

// ✅ Right: Using design tokens
import { getStatusColors } from "@/styles/tokens";
const colors = getStatusColors("active");
<div className={`${colors.background} ${colors.text}`}>Active</div>

// ✅ Even better: Using the StatusBadge component
<StatusBadge status="active" />
```

## Dark Mode Support

All color tokens include dark mode variants using Tailwind's `dark:` prefix:

```typescript
background: "bg-green-100 dark:bg-green-900/20",
text: "text-green-800 dark:text-green-400",
```

When extending colors, always include both light and dark variants for consistency.

## Integration with Components

The tokens system is integrated with:

- **StatusBadge component** - Automatically applies correct colors
- **StatCard component** - Uses stat card color scheme  
- **Tailwind configuration** - Extends the default color palette
- **CSS custom properties** - Available in `index.css` for advanced usage

## Performance Considerations

- **Tree shaking friendly** - Only imported tokens are included in the bundle
- **Type-safe** - TypeScript ensures only valid tokens are used
- **No runtime overhead** - Tokens are compile-time constants
- **Small bundle impact** - String constants have minimal footprint