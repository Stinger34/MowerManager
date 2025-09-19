# Visual Feedback Components

This document describes the visual feedback and animation components implemented in MowerManager.

## Overview

The application uses Framer Motion for smooth animations and enhanced loading states to provide better user experience during async operations.

## Components

### Animated Dialogs (`/components/ui/animated-dialog.tsx`)

Enhanced dialog components with smooth enter/exit animations.

**Features:**
- Fade in/out overlay with 0.2s duration
- Scale and fade content animation
- Staggered header/footer animations
- Custom easing curves

**Usage:**
```tsx
import { 
  AnimatedDialog, 
  AnimatedDialogContent, 
  AnimatedDialogHeader,
  AnimatedDialogTitle,
  AnimatedDialogDescription,
  AnimatedDialogFooter 
} from "@/components/ui/animated-dialog";

<AnimatedDialog>
  <AnimatedDialogContent>
    <AnimatedDialogHeader>
      <AnimatedDialogTitle>Confirm Action</AnimatedDialogTitle>
      <AnimatedDialogDescription>
        Are you sure you want to proceed?
      </AnimatedDialogDescription>
    </AnimatedDialogHeader>
    <AnimatedDialogFooter>
      <Button>Cancel</Button>
      <Button>Confirm</Button>
    </AnimatedDialogFooter>
  </AnimatedDialogContent>
</AnimatedDialog>
```

### Animated Drawers (`/components/ui/animated-drawer.tsx`)

Bottom drawer components with slide-up animations.

**Features:**
- Slide up from bottom animation
- Smooth handle and content animations
- Custom spring easing
- 0.3s duration with staggered children

**Usage:**
```tsx
import { 
  AnimatedDrawer, 
  AnimatedDrawerContent, 
  AnimatedDrawerHeader 
} from "@/components/ui/animated-drawer";

<AnimatedDrawer>
  <AnimatedDrawerContent>
    <AnimatedDrawerHeader>
      <AnimatedDrawerTitle>Options</AnimatedDrawerTitle>
    </AnimatedDrawerHeader>
    {/* Content */}
  </AnimatedDrawerContent>
</AnimatedDrawer>
```

### Page Transitions (`/components/ui/page-transitions.tsx`)

Page-level transition components for route changes.

**Components:**
- `PageTransition` - Main page transition with scale and fade
- `FadeTransition` - Simple fade in/out
- `SlideUpTransition` - Slide up from bottom

**Features:**
- 0.4s duration with anticipate easing
- Scale and opacity animations
- Consistent timing across the app

**Usage:**
```tsx
import { PageTransition } from "@/components/ui/page-transitions";

// Wrap page components
<Route path="/mowers" component={() => 
  <PageTransition>
    <MowerList />
  </PageTransition>
} />
```

### Loading Components (`/components/ui/loading-components.tsx`)

Enhanced loading states and skeleton components.

#### LoadingSpinner
Animated spinner with customizable sizes.

```tsx
import { LoadingSpinner } from "@/components/ui/loading-components";

<LoadingSpinner size="md" /> // sm, md, lg
```

#### ButtonLoading
Button content with loading state transition.

```tsx
import { ButtonLoading } from "@/components/ui/loading-components";

<Button disabled={isLoading}>
  <ButtonLoading 
    isLoading={isLoading} 
    loadingText="Saving..."
  >
    <Save className="h-4 w-4 mr-2" />
    Save Changes
  </ButtonLoading>
</Button>
```

#### Skeleton Components

**FormLoadingSkeleton** - Loading state for forms
```tsx
<FormLoadingSkeleton fields={4} />
```

**CardLoadingSkeleton** - Loading state for card grids
```tsx
<CardLoadingSkeleton cards={3} className="grid-cols-1 lg:grid-cols-3" />
```

**TableLoadingSkeleton** - Loading state for tables
```tsx
<TableLoadingSkeleton rows={5} columns={4} />
```

## Animation Patterns

### Timing
- Quick interactions: 0.2s (buttons, small elements)
- Medium interactions: 0.3s (cards, modals)
- Page transitions: 0.4s (route changes)

### Easing
- Content animations: `easeOut` for natural feel
- Page transitions: `anticipate` for smooth navigation
- Loading states: `linear` for spinners

### Staggering
Children animations are staggered by 0.1s for visual hierarchy:
```tsx
transition={{ duration: 0.3, staggerChildren: 0.1 }}
```

## Implementation Notes

### Performance
- Animations use `transform` and `opacity` for 60fps performance
- `layout` prop used sparingly to avoid layout thrashing
- Exit animations handled by AnimatePresence

### Accessibility
- Animations respect `prefers-reduced-motion`
- Focus management maintained during transitions
- Screen reader announcements preserved

### Browser Support
- Requires modern browsers supporting CSS transforms
- Graceful degradation on older browsers
- No JavaScript fallbacks needed

## Future Enhancements

1. **Micro-interactions** - Hover states and button press animations
2. **Loading progress** - Progress bars for file uploads
3. **Gesture support** - Swipe to dismiss for mobile
4. **Route transitions** - Directional slide animations based on navigation

## Dependencies

- `framer-motion`: ^11.13.1 - Animation library
- `@radix-ui/*`: UI primitives with animation support
- `lucide-react`: Icon components