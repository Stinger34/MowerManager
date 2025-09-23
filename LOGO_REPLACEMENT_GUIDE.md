# Logo Replacement Guide

## Changes Made

### 1. Removed Rounded Corners ✅
- **File**: `client/src/components/AppSidebar.tsx`
- **Change**: Removed `rounded-md` class from the logo image
- **Before**: `className="h-16 w-16 object-contain rounded-md"`
- **After**: `className="h-16 w-16 object-contain"`

### 2. Logo Implementation Location
The logo is implemented in the AppSidebar component at lines 58-62:

```tsx
<img 
  src="/logo.png" 
  alt="Mower Manager" 
  className="h-16 w-16 object-contain"
/>
```

## How to Replace with Your New Logo (image2)

### Step 1: Add Your New Logo File
1. Place your new logo file in the `client/public/` directory
2. Name it appropriately (e.g., `image2.png`, `new-logo.png`, etc.)

### Step 2: Update the Image Reference
In `client/src/components/AppSidebar.tsx`, update the `src` attribute:

```tsx
// Change from:
src="/logo.png"

// To (example):
src="/image2.png"
```

### Step 3: Styling Guidelines
- The current CSS classes applied are: `h-16 w-16 object-contain`
- This sets the logo to 64x64 pixels (4rem) with proper aspect ratio preservation
- **No additional styling** is applied as requested
- **No rounded corners** are applied as requested

### Supported Image Formats
- PNG (recommended for logos with transparency)
- JPG/JPEG (for photographic logos)
- SVG (for vector graphics)
- GIF (if animation is needed)
- WebP (modern format with good compression)

### Current Logo Specifications
- **Current file**: `client/public/logo.png`
- **Dimensions**: 468 x 484 pixels
- **Format**: PNG with transparency
- **Size**: ~187KB

### Example Replacement

```tsx
// For a PNG file named image2.png
<img 
  src="/image2.png" 
  alt="Mower Manager" 
  className="h-16 w-16 object-contain"
/>
```

### Testing
After making changes:
1. Restart the development server if needed
2. Refresh the browser
3. Verify the new logo appears in the left sidebar
4. Confirm no rounded corners are applied
5. Check that the logo scales properly at different screen sizes

## Notes
- The logo appears in the sidebar header section
- It serves as a clickable link to the home page
- The alt text "Mower Manager" should be updated if the new logo represents a different brand
- No additional CSS styling or transforms are applied to the image