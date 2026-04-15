

# Fix: Badge Text Showing as ALL CAPS

## Problem
The `SectionHeading` badge `<span>` on line 19 has the Tailwind class `uppercase`, which forces all badge text (like "Why BlueRiver") to render as "WHY BLUERIVER".

## Fix
**File: `src/components/SectionHeading.tsx` (line 19)**
- Remove the `uppercase` class from the badge `<span>`
- This preserves the original casing of badge text ("Why BlueRiver") as intended

Single class removal, no other changes.

