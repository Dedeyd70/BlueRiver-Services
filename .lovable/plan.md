

# Fix Hero Image Loading Flash & Blue Overlay

## Problems
1. **Blue flash before image loads** — The hero `<section>` has `bg-hero-gradient` as a background color. While the DB query loads, this solid blue gradient is visible for ~500ms, creating an ugly flash.
2. **Overlay too blue/intense** — The gradient overlay on line 147 uses `from-primary/70 via-primary/40 to-accent/30`, which is very heavy (70% blue). The image looks like it has a blue highlight filter over it.

## Changes

### File: `src/pages/Index.tsx`

**A. Fix loading flash:**
- Change the section background from `bg-hero-gradient` to a neutral dark color (`bg-gray-900`) so before the image loads, users see a dark neutral tone instead of a bright blue flash
- Change the loading skeleton from `bg-gray-200` to `bg-gray-900` to match
- Add a fade-in transition on the hero image so it blends in smoothly when it loads (using an `onLoad` state + opacity transition)

**B. Reduce overlay intensity:**
- Change the overlay gradient from `from-primary/70 via-primary/40 to-accent/30` to a more subtle, darker overlay: `from-black/60 via-black/30 to-transparent`
- This creates a cinematic darkening effect (like a professional photo) instead of a blue tint, making the image look natural while keeping text readable

### Summary of visual result
- **Before load**: Dark neutral background (no blue flash)
- **Image appears**: Smooth fade-in transition
- **Overlay**: Subtle dark-to-transparent gradient for text readability without coloring the image blue

No other files or logic are affected.

